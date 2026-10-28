import * as THREE from 'three';
import { PLANET_RADIUS, tangentAxes } from '../utils/math';

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(43, 1, .08, 200);
  private yaw = .03;
  private pitch = .24;
  private desiredYaw = .03;
  private desiredPitch = .24;
  private distance = 21;
  private desiredDistance = 21;
  private homeDistance = 21;
  private focusPoint = new THREE.Vector3();
  private focusNormal = new THREE.Vector3(0,1,0);
  private currentLookAt = new THREE.Vector3();
  private focused = false;
  private focusZoom = 1;
  private pointers = new Map<number,{x:number;y:number}>();
  private dragStart: {x:number;y:number}|null = null;
  private moved = false;
  private startPinchDistance = 0;
  private startPinchZoom = 0;
  onTap: ((x:number,y:number)=>void)|undefined;
  onHover: ((x:number,y:number)=>void)|undefined;
  onDrag: (()=>void)|undefined;

  constructor(private canvas: HTMLCanvasElement) {
    this.resize();
    this.reset(true);
    canvas.addEventListener('pointerdown', e=>this.pointerDown(e));
    canvas.addEventListener('pointermove', e=>this.pointerMove(e));
    canvas.addEventListener('pointerup', e=>this.pointerUp(e));
    canvas.addEventListener('pointercancel', e=>this.pointerUp(e));
    canvas.addEventListener('wheel', e=>{e.preventDefault();this.zoom(e.deltaY>0?1.095:.91);},{passive:false});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    window.addEventListener('resize',()=>this.resize());
  }

  resize():void {
    const w=Math.max(1,this.canvas.clientWidth);
    const h=Math.max(1,this.canvas.clientHeight);
    this.camera.aspect=w/h;
    this.camera.updateProjectionMatrix();
    const previousHomeDistance=this.homeDistance;
    const halfAngle=THREE.MathUtils.degToRad(this.camera.fov/2);
    const size=PLANET_RADIUS+1.2;
    this.homeDistance=size*1.17/(Math.tan(halfAngle)*Math.min(1,this.camera.aspect));
    if(this.homeDistance<17)this.homeDistance=17;
    if(!this.focused) {
      if(this.distance<1||this.desiredDistance<1){this.distance=this.homeDistance;this.desiredDistance=this.homeDistance;}
      else {
        const ratio=this.homeDistance/Math.max(previousHomeDistance,1);
        this.distance*=ratio;
        this.desiredDistance=THREE.MathUtils.clamp(this.desiredDistance*ratio,PLANET_RADIUS+2.3,this.homeDistance*1.6);
      }
    }
  }

  private pointerDown(e:PointerEvent):void {
    if(e.pointerType==='mouse'&&e.button!==0)return;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size===1){this.dragStart={x:e.clientX,y:e.clientY};this.moved=false;}
    if(this.pointers.size===2){
      const points=[...this.pointers.values()];
      this.startPinchDistance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      this.startPinchZoom=this.focused?this.focusZoom:this.desiredDistance;
      this.moved=true;
    }
  }

  private pointerMove(e:PointerEvent):void {
    const prev=this.pointers.get(e.pointerId);
    if(!prev){this.onHover?.(e.clientX,e.clientY);return;}
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size===2){
      const points=[...this.pointers.values()];
      const dist=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      if(this.startPinchDistance>0){
        const ratio=this.startPinchDistance/Math.max(30,dist);
        if(this.focused)this.focusZoom=THREE.MathUtils.clamp(this.startPinchZoom*ratio,.73,2.8);
        else this.desiredDistance=THREE.MathUtils.clamp(this.startPinchZoom*ratio,PLANET_RADIUS+2.3,this.homeDistance*1.6);
      }
      return;
    }
    if(!this.dragStart)return;
    const total=Math.hypot(e.clientX-this.dragStart.x,e.clientY-this.dragStart.y);
    if(total>5){
      if(!this.moved){this.onDrag?.();this.focused=false;}
      this.moved=true;
    }
    if(!this.moved)return;
    this.desiredYaw-= (e.clientX-prev.x)*.0055;
    this.desiredPitch=THREE.MathUtils.clamp(this.desiredPitch+(e.clientY-prev.y)*.0048,-1.35,1.35);
    this.desiredDistance=Math.min(this.desiredDistance, this.homeDistance*1.4);
  }

  private pointerUp(e:PointerEvent):void {
    const previousCount=this.pointers.size;
    this.pointers.delete(e.pointerId);
    if(previousCount===1&&!this.moved&&this.dragStart)this.onTap?.(e.clientX,e.clientY);
    if(this.pointers.size===1){
      const one=[...this.pointers.values()][0];this.dragStart={x:one.x,y:one.y};this.moved=true;
    } else if(this.pointers.size===0){this.dragStart=null;this.moved=false;}
  }

  zoom(factor:number):void {
    if(this.focused)this.focusZoom=THREE.MathUtils.clamp(this.focusZoom*factor,.73,2.8);
    else this.desiredDistance=THREE.MathUtils.clamp(this.desiredDistance*factor,PLANET_RADIUS+2.3,this.homeDistance*1.6);
  }

  spin(dx:number,dy:number):void {
    if(this.focused)this.focused=false;
    this.desiredYaw+=dx;
    this.desiredPitch=THREE.MathUtils.clamp(this.desiredPitch+dy,-1.35,1.35);
  }

  focus(point:THREE.Vector3):void {
    this.focused=true;
    this.focusPoint.copy(point);
    this.focusNormal.copy(point).normalize();
    this.focusZoom=1;
  }

  reset(immediate=false):void {
    this.focused=false;
    this.desiredYaw=0.03;
    this.desiredPitch=.24;
    this.desiredDistance=this.homeDistance;
    this.focusZoom=1;
    if(immediate){
      this.yaw=this.desiredYaw;this.pitch=this.desiredPitch;this.distance=this.desiredDistance;
      const pos=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.distance);
      this.camera.position.copy(pos);this.currentLookAt.set(0,0,0);this.camera.lookAt(this.currentLookAt);
    }
  }

  showOverview():void {
    this.focused=false;
    this.desiredDistance=Math.max(this.homeDistance*.76,this.desiredDistance);
  }

  update(delta:number):void {
    const k=1-Math.exp(-delta*5.0);
    this.yaw=THREE.MathUtils.lerp(this.yaw,this.desiredYaw,k);
    this.pitch=THREE.MathUtils.lerp(this.pitch,this.desiredPitch,k);
    this.distance=THREE.MathUtils.lerp(this.distance,this.desiredDistance,k);
    const p = new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.distance);
    let target=new THREE.Vector3(0,0,0);
    if(this.focused){
      const [tangent]=tangentAxes(this.focusNormal);
      const fov=THREE.MathUtils.degToRad(this.camera.fov/2);
      const closeDist=Math.max(4.6, 1.25/(Math.tan(fov)*Math.min(1,this.camera.aspect)))*this.focusZoom;
      target=this.focusPoint.clone().addScaledVector(this.focusNormal,.17);
      p.copy(target).addScaledVector(this.focusNormal,closeDist).addScaledVector(tangent,closeDist*.23).add(new THREE.Vector3(0,.54,0));
    }
    const focusK=1-Math.exp(-delta*3.3);
    this.camera.position.lerp(p,focusK);
    this.currentLookAt.lerp(target,focusK);
    this.camera.lookAt(this.currentLookAt);
  }
}
