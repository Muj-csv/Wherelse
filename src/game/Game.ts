import * as THREE from 'three';
import { World } from '../world/World';
import { CameraRig } from './CameraRig';
import { UI } from '../ui/UI';
import { GRAPHICS,type GraphicsQuality } from './settings';

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
  private reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private renderNeeded=true;

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
    this.camera.reducedMotion=this.reducedMotion;
    document.body.classList.toggle('reduce-motion',this.reducedMotion);
    this.ui=new UI({
      navigate:(id)=>this.visit(id),
      action:(id)=>this.revisit(id),
      zoom:(amount)=>this.camera.zoom(amount),
      resetCamera:()=>{this.camera.reset();this.ui.hideStory();this.ui.showToast('The whole world, just for you. ✿');},
      night:(value)=>this.setNight(value),
      resetProgress:()=>this.world.resetProgress(),
      benchMood:(mood)=>this.world.setBenchMood(mood,this.time),
      benchFlower:(flower)=>this.world.setBenchFlower(flower),
      releaseBoat:()=>{this.world.releaseBoat(this.time,this.reducedMotion);this.renderNeeded=true;},
      storyMemory:(count)=>{this.world.setStoryMemory(count);this.renderNeeded=true;},
      quality:(quality)=>this.setQuality(quality),
      motion:(reduced)=>{
        this.reducedMotion=reduced;this.camera.reducedMotion=reduced;
        this.renderNeeded=true;
        document.body.classList.toggle('reduce-motion',reduced);
      },
    });
    this.ui.initialize(this.world.discovered);
    this.camera.onTap=(x,y)=>this.pick(x,y);
    this.camera.onHover=(x,y)=>this.hover(x,y);
    this.camera.onDrag=()=>{this.ui.hideStory();this.ui.dismissIntro();this.ui.showHover(undefined,0,0);};
    for(const event of ['pointermove','pointerup','wheel'])canvas.addEventListener(event,()=>{this.renderNeeded=true;});
    document.addEventListener('click',()=>{this.renderNeeded=true;});
    window.addEventListener('resize',()=>this.resize());
    document.addEventListener('visibilitychange',()=>{this.lastTime=0;this.renderNeeded=true;});
    document.addEventListener('keydown',e=>{
      if(document.querySelector('dialog[open]')||!(e.target===document.body||e.target===canvas))return;
      this.renderNeeded=true;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','=','-'].includes(e.key))e.preventDefault();
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
    this.renderNeeded=true;
    const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
    this.renderer.setSize(w,h,false);
    this.camera.resize();
  }

  private setQuality(quality:GraphicsQuality):void {
    const settings=GRAPHICS[quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,settings.pixelRatio));
    this.renderer.shadowMap.enabled=settings.shadows;
    this.sun.shadow.mapSize.set(settings.shadowSize,settings.shadowSize);
    this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
    this.scene.traverse(object=>{
      if(object instanceof THREE.Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{material.needsUpdate=true;});}
    });
    this.world.setDetail(settings.detail);this.resize();
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
    this.camera.focus(this.world.getPoint(id),id==='nook');
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
    requestAnimationFrame(time=>this.animate(time));
    if(document.hidden||(this.reducedMotion&&!this.renderNeeded)){
      this.lastTime=now;return;
    }
    this.renderNeeded=false;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,.06):.016;
    this.lastTime=now;
    this.time+=dt;
    this.world.update(this.reducedMotion?0:this.time,this.reducedMotion?0:dt,this.reducedMotion);
    this.camera.update(dt);
    const blend=this.reducedMotion?1:1-Math.exp(-dt*2);
    const target=this.night?1:0;
    const current=(this.sun.userData.nightBlend as number|undefined)??0;
    const v=THREE.MathUtils.lerp(current,target,blend);
    this.sun.userData.nightBlend=v;
    this.sun.intensity=3.3-v*2.75;
    this.sun.color.set('#fff0cd').lerp(new THREE.Color('#9bb7ee'),v);
    this.sun.position.set(-8+v*2,13-v*17,10-v*5);
    this.sky.intensity=2.4-v*1.25;
    this.renderer.toneMappingExposure=1.4-v*.25;
    this.renderer.render(this.scene,this.camera.camera);
  }
}
