import * as THREE from 'three';
import { World } from '../world/World';
import { CameraRig } from './CameraRig';
import { UI } from '../ui/UI';

export class Game {
  private readonly canvas:HTMLCanvasElement;
  private readonly renderer:THREE.WebGLRenderer;
  private readonly scene=new THREE.Scene();
  private readonly world=new World();
  private readonly camera:CameraRig;
  private readonly ui:UI;
  private readonly raycaster=new THREE.Raycaster();
  private readonly pointer=new THREE.Vector2();
  private readonly sun:THREE.DirectionalLight;
  private readonly sky:THREE.HemisphereLight;
  private night=false;
  private time=0;
  private lastTime=0;
  private running=true;

  constructor(canvas:HTMLCanvasElement){
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0xffffff,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.55;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<680?1.35:1.7));
    this.scene.add(this.world.group);
    this.sky = new THREE.HemisphereLight('#f9f4e2','#648a64',2.4);
    this.scene.add(this.sky);
    this.sun = new THREE.DirectionalLight('#fff0cd',3.3);
    this.sun.position.set(-8,13,10);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);
    this.sun.shadow.camera.left=-11;this.sun.shadow.camera.right=11;
    this.sun.shadow.camera.top=11;this.sun.shadow.camera.bottom=-11;
    this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=40;
    this.sun.shadow.normalBias=.04;
    this.sun.shadow.bias=-.0001;
    this.scene.add(this.sun,this.sun.target);
    const fill=new THREE.DirectionalLight('#c3e8f6',.85);fill.position.set(6,-3,-9);this.scene.add(fill);
    this.camera=new CameraRig(canvas);
    this.ui=new UI({
      navigate:(id)=>this.visit(id),
      action:(id)=>this.revisit(id),
      zoom:(amount)=>this.camera.zoom(amount),
      resetCamera:()=>{this.camera.reset();this.ui.hideStory();this.ui.showToast('The whole world, just for you. ✿');},
      night:(value)=>this.setNight(value),
      resetProgress:()=>this.world.resetProgress(),
    });
    this.ui.initialize(this.world.discovered);
    this.camera.onTap=(x,y)=>this.pick(x,y);
    this.camera.onHover=(x,y)=>this.hover(x,y);
    this.camera.onDrag=()=>{this.ui.hideStory();this.ui.dismissIntro();this.ui.showHover(undefined,0,0);};
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.lastTime=0;});
    document.addEventListener('keydown',e=>{
      if((e.target as HTMLElement).matches('input,textarea,select'))return;
      if(e.key==='ArrowLeft')this.camera.spin(-.22,0);
      if(e.key==='ArrowRight')this.camera.spin(.22,0);
      if(e.key==='ArrowUp')this.camera.spin(0,-.16);
      if(e.key==='ArrowDown')this.camera.spin(0,.16);
      if(e.key==='+'||e.key==='=')this.camera.zoom(.8);
      if(e.key==='-')this.camera.zoom(1.2);
      if(e.key==='Home')this.camera.reset();
    });
    this.resize();
    const loading=document.getElementById('loading');
    if(loading){loading.classList.add('loaded');window.setTimeout(()=>loading.remove(),500);}
    requestAnimationFrame((now)=>this.animate(now));
  }

  private resize():void {
    const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
    this.renderer.setSize(w,h,false);
    this.camera.resize();
  }

  private makeRay(x:number,y:number):void {
    const rect=this.canvas.getBoundingClientRect();
    this.pointer.x=((x-rect.left)/rect.width)*2-1;
    this.pointer.y=-((y-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(this.pointer,this.camera.camera);
  }

  private findPlace(x:number,y:number):string|undefined {
    this.makeRay(x,y);
    const hits=this.raycaster.intersectObjects(this.world.hitZones,false);
    const cameraDirection=this.camera.camera.position.clone().normalize();
    // The planet is opaque: a marker on its far side must not be clickable through the ground.
    const visibleHit=hits.find(hit=>hit.object.position.clone().normalize().dot(cameraDirection)>.08);
    if(visibleHit)return visibleHit.object.userData.placeId as string;
    return undefined;
  }

  private pick(x:number,y:number):void {
    const id=this.findPlace(x,y);
    if(id)this.visit(id);
    else {this.ui.dismissIntro();this.ui.hideStory();}
  }

  private hover(x:number,y:number):void {
    const id=this.findPlace(x,y);
    this.canvas.style.cursor=id?'pointer':'grab';
    this.ui.showHover(id?this.world.getPlace(id):undefined,x,y);
  }

  private visit(id:string):void {
    this.camera.focus(this.world.getPoint(id));
    const result=this.world.discover(id,this.time);
    if(result)this.ui.showDiscovery(result.place,result.isNew);
  }

  private revisit(id:string):void {
    this.world.act(id,this.time);
    const p=this.world.getPlace(id);
    if(p){
      const responses:Record<string,string>={
        nook:'Pip waves hello. Today is a wonderful day to be here. ♡',
        pond:'Your wish dances across the water in little circles. ≈',
        meadow:'The wildflowers are cheering you on! ✿',
        library:'A page turns somewhere, and a new story begins. ▤',
        grove:'The lanterns glow like tiny captured sunsets. ✧',
        picnic:'There is always room for one more friend at this table. ♡',
      };
      this.ui.showToast(responses[id]||p.subtitle);
    }
  }

  private setNight(night:boolean):void {
    this.night=night;this.world.setNight(night);
  }

  private animate(now:number):void {
    if(!this.running)return;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,.06):.016;
    this.lastTime=now;
    this.time+=dt;
    this.world.update(this.time,dt);
    this.camera.update(dt);
    const blend=1-Math.exp(-dt*2);
    const target=this.night?1:0;
    const current=(this.sun.userData.nightBlend as number|undefined)??0;
    const v=THREE.MathUtils.lerp(current,target,blend);
    this.sun.userData.nightBlend=v;
    this.sun.intensity=3.3-v*2.75;
    this.sun.color.set('#fff0cd').lerp(new THREE.Color('#9bb7ee'),v);
    this.sun.position.set(-8+v*2,13-v*17,10-v*5);
    this.sky.intensity=2.4-v*1.8;
    this.renderer.toneMappingExposure=1.55-v*.4;
    this.renderer.render(this.scene,this.camera.camera);
    requestAnimationFrame(time=>this.animate(time));
  }
}
