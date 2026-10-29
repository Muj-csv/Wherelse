import * as THREE from 'three';
import { fromDegrees, mat, mulberry32, onSurface, PLANET_RADIUS, randomDirection, surfaceQuaternion, tangentAxes, terrainRadius, UP } from '../utils/math';
import { makePlanet, surfaceDisk } from './Planet';
import { FLOWERS, type BenchMood, type FlowerColor } from '../story/bench';
import { makeKeepsakeFlower } from './Models';
import { makeBench, makeButterfly, makeCharacter, makeCottage, makeFlowerBush, makeLantern, makeLibrary, makeMushroom, makePicnic, makeStoneRing, makeTeacup, makeTree, makeBridge, type LittleCharacter } from './Models';

export interface Place {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  lat: number;
  lon: number;
  action: string;
  color: string;
}

export const PLACES: Place[] = [
  { id:'nook', title:'The Daydream Bench', subtitle:'Company, quiet, or an unfinished story', description:'Between classes and everything else, there is a seat beside Pip. Come for a little company, a student story, or a pause that asks nothing of you.', icon:'☕', lat:24, lon:-17, action:'Sit with Pip',color:'#edba78' },
  { id:'pond', title:'Whispering Waters', subtitle:'The pond that listens', description:'A place for something you are carrying. Keep a thought privately on this browser, or release a paper boat without sending your words anywhere.',icon:'≈',lat:6,lon:38,action:'Keep a thought or release a boat',color:'#7dc7d3' },
  { id:'meadow', title:'Butterfly Meadow', subtitle:'The flowers know your name', description:'A hundred little flowers lean toward the sun as the butterflies dance. Somewhere between one bloom and the next, ordinary days become extraordinary.',icon:'✿',lat:-23,lon:13,action:'Wake the flowers',color:'#eda5c2' },
  { id:'library', title:'The Story Tree', subtitle:'Stories for every wanderer', description:'Ordinary student days, with a few different ways through them. Open a story about belonging, friendship, pressure or small victories. There are no right endings.',icon:'▤',lat:33,lon:51,action:'Open the student stories',color:'#e6be84' },
  { id:'grove', title:'Firefly Grove', subtitle:'A pocketful of starlight', description:'The lanterns hum softly among the trees. The fireflies are practicing their constellations, and tonight they’ve decided you can be one of them.',icon:'✧',lat:-16,lon:-42,action:'Light the lanterns',color:'#ffce79' },
  { id:'picnic', title:'The Secret Picnic', subtitle:'A table for unexpected friends', description:'The tea is poured and there is room to stay a while. Explore on your own, or visit the invited postcard garden to share a small piece of your day.',icon:'♡',lat:-11,lon:-73,action:'Visit the postcard garden',color:'#dda6bd' },
];

type Butterfly = { group: THREE.Group; wings:[THREE.Group,THREE.Group]; startLat:number; startLon:number; phase:number; speed:number };
type Firefly = { glow: THREE.Mesh; light?: THREE.PointLight; phase:number; base: THREE.Vector3 };
type Marker = {group: THREE.Group; phase:number; dir: THREE.Vector3; id: string};

type Ripple = { root:THREE.Group; ring:THREE.Mesh; material:THREE.MeshBasicMaterial; start:number; active:boolean };

export class World {
  readonly group = new THREE.Group();
  readonly hitZones: THREE.Object3D[] = [];
  readonly discovered = new Set<string>();
  readonly places = PLACES;
  private rng = mulberry32(20261029);
  private butterflies: Butterfly[] = [];
  private fireflies: Firefly[] = [];
  private markers: Marker[] = [];
  private swayingTrees: {group:THREE.Group; phase:number; strength:number}[] = [];
  private character: LittleCharacter | undefined;
  private lanterns: THREE.Mesh[] = [];
  private pondRipples: Ripple[] = [];
  private pollen: THREE.Points | undefined;
  private blooms: THREE.InstancedMesh[] = [];
  private lastExcitedUntil = 0;
  private lightNight = false;
  private pondWishTime = -100;
  private boat=new THREE.Group();
  private boatStart=-100;
  private libraryRibbon=new THREE.Mesh(new THREE.BoxGeometry(.12,.6,.035),new THREE.MeshStandardMaterial({color:'#efae86',emissive:'#8b4b20',emissiveIntensity:.15}));
  private trees:THREE.Group[]=[];
  private waterSurface:THREE.Mesh|null=null;
  private groveLight=new THREE.PointLight('#ffcf8d',.1,7,2);
  private benchMood:BenchMood='company';
  private keepsake=makeKeepsakeFlower();

  constructor() {
    this.group.add(makePlanet());
    this.addPaths();
    this.addMeadows();
    this.addPondsAndStream();
    this.addTrees();
    this.addUndergrowth();
    this.addLandmarks();
    this.addButterflies();
    this.addPollen();
    this.loadSavedProgress();
    this.updateMarkers();
  }

  get count(): number { return this.discovered.size; }
  get completed(): boolean {return this.discovered.size === PLACES.length;}
  getPlace(id: string): Place | undefined { return PLACES.find(x => x.id===id); }
  getPoint(id: string): THREE.Vector3 {
    const p = this.getPlace(id);
    if(!p) return new THREE.Vector3(0,0,PLANET_RADIUS);
    const n=fromDegrees(p.lat,p.lon);
    return onSurface(n,.5);
  }

  private positionAt(obj: THREE.Object3D, dir: THREE.Vector3, offset=0, turn=0): void {
    obj.position.copy(onSurface(dir,offset));
    obj.quaternion.copy(surfaceQuaternion(dir));
    obj.rotateY(turn);
  }

  private nearPlace(n:THREE.Vector3, angleThreshold = .966): boolean {
    // Keep Pip's seat and keepsake clear of surrounding foliage at the close-up angle.
    return PLACES.some(p => n.dot(fromDegrees(p.lat,p.lon)) > (p.id==='nook'?Math.min(angleThreshold,.966):angleThreshold));
  }

  private addPaths():void {
    const vertices:number[]=[];
    for(let index=0;index<PLACES.length-1;index++){
      const a=PLACES[index],b=PLACES[index+1];
      for(let step=0;step<=22;step++){
        const t=step/22;
        const n=fromDegrees(THREE.MathUtils.lerp(a.lat,b.lat,t),THREE.MathUtils.lerp(a.lon,b.lon,t));
        const disk=surfaceDisk(n,.10,'#d8c795',{offset:.035,segments:9});
        const geometry=disk.geometry.toNonIndexed();
        vertices.push(...geometry.getAttribute('position').array);
        geometry.dispose();disk.geometry.dispose();(disk.material as THREE.Material).dispose();
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const path=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#d8c795',roughness:.95}));path.receiveShadow=true;this.group.add(path);
  }

  private addMeadows(): void {
    const rng=this.rng;
    const stems: {pos: THREE.Vector3; q: THREE.Quaternion; scale: number; color: number}[]=[];
    const colors=['#f49ec0','#f5b5d0','#fcda6a','#8cb9e5','#fff4dc','#9cc88e'];
    const flowerBase = new THREE.CylinderGeometry(.019,.025,1,5);
    const petalGeo = new THREE.SphereGeometry(1,7,5);
    const centerGeo = new THREE.SphereGeometry(1,7,5);
    const stemMat=mat('#598f60',{side:THREE.DoubleSide});
    const quat=new THREE.Quaternion();
    const instanceDummy=new THREE.Object3D();
    const around = [fromDegrees(-23,13),fromDegrees(24,-17),fromDegrees(6,38),fromDegrees(-16,-42),fromDegrees(-11,-73)];
    for(let i=0;i<820;i++){
      let n = randomDirection(rng);
      if (i<390) {
        const root=around[i%around.length];
        const [tx,tz]=tangentAxes(root);
        const r=Math.sqrt(rng()) * (i<130 ? 1.55 : 2.75);
        const theta=rng()*Math.PI*2;
        n=root.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(tx,Math.cos(theta)*r).addScaledVector(tz,Math.sin(theta)*r).normalize();
      }
      const closeToBuilding=this.nearPlace(n,.994);
      if(closeToBuilding) continue;
      quat.copy(surfaceQuaternion(n));
      stems.push({pos:onSurface(n,0.025),q:quat.clone(),scale: .65+rng()*.80,color:Math.floor(rng()*colors.length)});
    }
    const stemInstance = new THREE.InstancedMesh(flowerBase,stemMat,stems.length);
    stemInstance.castShadow=false;
    stems.forEach((s,i) => {
      instanceDummy.position.copy(s.pos).addScaledVector(s.pos.clone().normalize(), .15*s.scale);
      instanceDummy.quaternion.copy(s.q);
      instanceDummy.scale.set(.8,.31*s.scale,.8);
      instanceDummy.updateMatrix(); stemInstance.setMatrixAt(i,instanceDummy.matrix);
    });
    stemInstance.instanceMatrix.needsUpdate=true;stemInstance.computeBoundingSphere();this.group.add(stemInstance);

    colors.forEach((color,k)=>{
      const matches=stems.filter(s=>s.color===k);
      const petals = new THREE.InstancedMesh(petalGeo,mat(color),matches.length*5);
      const middle = new THREE.InstancedMesh(centerGeo,mat(k===2?'#945f56':'#ffde79'),matches.length);
      matches.forEach((s,i)=>{
        const n=s.pos.clone().normalize();
        const [tx,tz]=tangentAxes(n);
        const c=s.pos.clone().addScaledVector(n,.33*s.scale);
        for(let j=0;j<5;j++){
          const a=j*Math.PI*2/5;
          instanceDummy.position.copy(c).addScaledVector(tx,Math.cos(a)*.073*s.scale).addScaledVector(tz,Math.sin(a)*.073*s.scale);
          instanceDummy.quaternion.copy(s.q).multiply(new THREE.Quaternion().setFromAxisAngle(UP,a));
          instanceDummy.scale.set(.072*s.scale,.057*s.scale,.055*s.scale);
          instanceDummy.updateMatrix();petals.setMatrixAt(i*5+j,instanceDummy.matrix);
        }
        instanceDummy.position.copy(c).addScaledVector(n,.018);
        instanceDummy.quaternion.copy(s.q);instanceDummy.scale.setScalar(.055*s.scale);
        instanceDummy.updateMatrix();middle.setMatrixAt(i,instanceDummy.matrix);
      });
      petals.instanceMatrix.needsUpdate=true;middle.instanceMatrix.needsUpdate=true;
      petals.computeBoundingSphere();middle.computeBoundingSphere();
      this.group.add(petals,middle);this.blooms.push(petals);
    });
  }

  private addPondsAndStream(): void {
    const pond=fromDegrees(6,38);
    const c=fromDegrees(38,5);
    this.group.add(surfaceDisk(pond, .96, '#c4d3a5',{offset:.035,oval:.78}));
    this.group.add(surfaceDisk(pond, .88, '#4eafd1',{offset:.046,oval:.76}));
    this.waterSurface=surfaceDisk(pond,.69,'#61c6d3',{offset:.055,oval:.76,opacity:.9});
    (this.waterSurface.material as THREE.Material).dispose();
    this.waterSurface.material=new THREE.MeshPhysicalMaterial({color:'#67bdc7',roughness:.19,metalness:.12,clearcoat:1,clearcoatRoughness:.2,transparent:true,opacity:.9,side:THREE.DoubleSide});
    this.group.add(this.waterSurface);
    this.group.add(surfaceDisk(c, .36, '#60bdce',{offset:.045,oval:.72}));
    // A winding ribbon of water following the round geometry.
    for(let i=0;i<18;i++) {
      const lat = -3 + i*.61;
      const lon = 33 + Math.sin(i*.36)*1.8;
      this.group.add(surfaceDisk(fromDegrees(lat,lon),.24,'#5cb3c8',{offset:.055,oval:.8,segments:16}));
    }
    // lily pads + reeds perched along the curved shoreline
    for(const [x,z,s] of [[-.23,-.3,.2],[.46,.09,.18],[.1,.35,.13]]) {
      const [tx,tz]=tangentAxes(pond);
      const n=pond.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(tx,x).addScaledVector(tz,z).normalize();
      const lily=surfaceDisk(n,s,'#82bd79',{offset:.09,oval:.6,segments:14});
      this.group.add(lily);
    }
    for(let i=0;i<3;i++){
      const root=new THREE.Group();
      const n=fromDegrees(6+i*1.3, 44+i*.3);
      this.positionAt(root,n,.025);
      const reed=mat('#548c66');
      for(let j=0;j<4;j++){
        const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.02,.025,.5+j*.06,5),reed);
        stalk.position.set((j-2)*.09,.22,-.04+j*.05); stalk.rotation.z=(j-2)*.12;root.add(stalk);
      }
      this.group.add(root);
    }
    const center=fromDegrees(6,38);
    const ringRoot=new THREE.Group();this.positionAt(ringRoot,center,.08);
    this.group.add(ringRoot);
    const paper=new THREE.MeshStandardMaterial({color:'#fff6d9',side:THREE.DoubleSide,roughness:.8});
    const hull=new THREE.Mesh(new THREE.ConeGeometry(.19,.22,4),paper);
    hull.rotation.z=Math.PI;hull.scale.set(1.4,1,.7);hull.position.y=.11;
    const sail=new THREE.Mesh(new THREE.ConeGeometry(.12,.24,3),paper);sail.position.y=.25;
    this.boat.add(hull,sail);this.boat.visible=false;this.group.add(this.boat);
    for(let i=0;i<3;i++){
      const material=new THREE.MeshBasicMaterial({color:'#d7f8f0',transparent:true,opacity:0,depthWrite:false});
      const torus=new THREE.Mesh(new THREE.TorusGeometry(.2,.018,5,44),material);
      torus.rotation.x=-Math.PI/2;torus.position.y=.02;
      ringRoot.add(torus);
      this.pondRipples.push({root:ringRoot,ring:torus,material,start:-10+i*.36,active:true});
    }
  }

  private addTrees(): void {
    for(let i=0;i<110;i++){
      let n=randomDirection(this.rng);
      if(i<36) { // Woodland belt framing the northern part of the storybook globe
        const lat=THREE.MathUtils.degToRad(32+this.rng()*48);
        const lon=this.rng()*Math.PI*2;
        n = new THREE.Vector3(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));
      }
      if(this.nearPlace(n,.961))continue;
      const h=.65+this.rng()*.48;
      const tree=makeTree(Math.floor(this.rng()*6),h);
      this.trees.push(tree);
      this.positionAt(tree,n,-.045,this.rng()*Math.PI*2);
      this.group.add(tree);
      if(i%3===0)this.swayingTrees.push({group:tree,phase:this.rng()*Math.PI*2,strength:.012+this.rng()*.013});
    }
    // Extra giant silhouettes placed toward the distant side of the globe.
    for(const [lat,lon,scale] of [[52,-28,1.38],[48,-53,1.24],[44,74,1.34],[54,117,1.27],[-29,122,1.3]]){
      const tree=makeTree(2,scale);
      this.trees.push(tree);
      this.positionAt(tree,fromDegrees(lat,lon),-.035);
      this.group.add(tree);
    }
  }

  private addUndergrowth(): void {
    const shrubGeo=new THREE.IcosahedronGeometry(1,1);
    const tones=['#a4c36d','#8fbb75','#9fca72','#75aa76','#b0c97a','#78a881'];
    const buckets: {pos:THREE.Vector3; q:THREE.Quaternion; s:number}[][]=tones.map(()=>[]);
    for(let i=0;i<530;i++){
      const n=randomDirection(this.rng);
      if(this.nearPlace(n,.992))continue;
      const b=buckets[Math.floor(this.rng()*buckets.length)];
      b.push({pos:onSurface(n,.015),q:surfaceQuaternion(n),s:.09+this.rng()*.24});
    }
    const d=new THREE.Object3D();
    buckets.forEach((bucket,i)=>{
      const im=new THREE.InstancedMesh(shrubGeo,mat(tones[i],{flatShading:true}),bucket.length);
      bucket.forEach((s,j)=>{
        d.position.copy(s.pos).addScaledVector(s.pos.clone().normalize(),s.s*.42);
        d.quaternion.copy(s.q);d.scale.set(s.s*1.3,s.s*.69,s.s*1.2);
        d.updateMatrix();im.setMatrixAt(j,d.matrix);
      });
      im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();this.group.add(im);
    });
    const rockColors=['#a6a59a','#b7b7a4','#8e9b92'];
    for(let i=0;i<95;i++){
      const n=randomDirection(this.rng);
      if(this.nearPlace(n,.986))continue;
      const root = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),mat(rockColors[i%3],{flatShading:true}));
      rock.scale.set(.08+this.rng()*.12,.07+this.rng()*.08,.09+this.rng()*.16);
      rock.position.y=rock.scale.y*.52;root.add(rock);
      this.positionAt(root,n,.005);this.group.add(root);
    }
    for(let i=0;i<36;i++){
      const n=randomDirection(this.rng);
      if(this.nearPlace(n,.990))continue;
      const mushroom=makeMushroom(i%2?'#f9bc8e':'#ef9ab2',.18+this.rng()*.10);
      this.positionAt(mushroom,n,.015,this.rng()*6);
      this.group.add(mushroom);
    }
    for(let i=0;i<19;i++){
      const n=randomDirection(this.rng);
      if(this.nearPlace(n,.987))continue;
      const bush=makeFlowerBush();bush.scale.setScalar(.48+this.rng()*.5);
      this.positionAt(bush,n,.015);this.group.add(bush);
    }
  }

  private addLandmarks(): void {
    for(const p of PLACES){
      const n=fromDegrees(p.lat,p.lon);
      let obj:THREE.Group;
      if(p.id==='nook'){
        obj=makeBench();
        const character=makeCharacter();character.group.position.set(.24,.03,.05);
        obj.add(character.group);this.character=character;
        const cup=makeTeacup();cup.position.set(-.64,.58,.05);obj.add(cup);
        this.keepsake.group.position.set(-.48,.58,.25);
        this.keepsake.group.visible=false;
        obj.add(this.keepsake.group);
        const patch=surfaceDisk(n,1.38,'#9acb74',{offset:.019,opacity:.6});this.group.add(patch);
      }else if(p.id==='pond'){
        obj=makeBridge();obj.scale.setScalar(.78);obj.position.set(.0,0,.0);
        const floatingStones=makeStoneRing();floatingStones.position.set(-1.18,0,.13);floatingStones.scale.setScalar(.31);obj.add(floatingStones);
      }else if(p.id==='meadow'){
        obj=makeStoneRing();obj.scale.setScalar(.48);
        for(let i=0;i<7;i++){
          const bush=makeFlowerBush();const a=i/7*Math.PI*2;
          bush.position.set(Math.sin(a)*.64,0,Math.cos(a)*.67);bush.scale.setScalar(.35+this.rng()*.25);obj.add(bush);
        }
      }else if(p.id==='library'){
        obj=makeLibrary();
        this.libraryRibbon.position.set(.18,1.34,.77);this.libraryRibbon.visible=false;obj.add(this.libraryRibbon);
        const cup=makeMushroom('#f3b1c2',.28);cup.position.set(-.97,0,.20);obj.add(cup);
      }else if(p.id==='grove'){
        obj=new THREE.Group();
        this.groveLight.position.set(0,1.2,0);obj.add(this.groveLight);
        for(let i=0;i<7;i++){
          const a=(i/7)*Math.PI*2;
          const lamp=makeLantern();
          lamp.group.position.set(Math.cos(a)*.95,0,Math.sin(a)*.95);
          obj.add(lamp.group);this.lanterns.push(lamp.glow);
        }
        for(let i=0;i<4;i++){
          const tree=makeTree(i, .56);
          const a=i*Math.PI/2+.36;
          tree.position.set(Math.cos(a)*1.3,0,Math.sin(a)*1.3);
          obj.add(tree);
        }
      }else{
        obj=makePicnic();
        const cup=makeTeacup();cup.position.set(.17,.59,.12);obj.add(cup);
        const cottage=makeCottage();cottage.position.set(-1.48,0,-.8);cottage.scale.setScalar(.64);obj.add(cottage);
      }
      this.positionAt(obj,n,.065,0);
      this.group.add(obj);
      // Invisible hit volumes are deliberately generous for touch users.
      const collider = new THREE.Mesh(new THREE.SphereGeometry(p.id==='pond'?1.13:1.08,10,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,color:'#ffffff'}));
      collider.position.copy(onSurface(n,p.id==='library' ? .7 : .58));
      collider.userData.placeId=p.id;
      this.group.add(collider);this.hitZones.push(collider);
      // A little glowing beacon invites interaction without crowding the view.
      const marker=new THREE.Group();
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.115,12,10),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.9}));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.17,.016,5,20),new THREE.MeshBasicMaterial({color:'#fff7d5',transparent:true,opacity:.86,side:THREE.DoubleSide}));
      glow.position.y=0;ring.rotation.x=Math.PI/2;marker.add(glow,ring);
      marker.position.copy(onSurface(n,p.id==='library'?2.0:1.65));
      this.group.add(marker);
      this.markers.push({group:marker,dir:n,phase:this.rng()*Math.PI*2,id:p.id});
    }
  }

  private addButterflies(): void {
    const colors=['#f7dc75','#f4b38c','#a7b8f8','#edabd2','#8cdcc5','#f2d46b'];
    for(let i=0;i<24;i++){
      const b=makeButterfly(colors[i%colors.length]);
      const n=i<12?fromDegrees(-24+(this.rng()-.5)*33, 14+(this.rng()-.5)*72):randomDirection(this.rng);
      b.group.scale.setScalar(.68+this.rng()*.7);
      this.group.add(b.group);
      this.butterflies.push({ ...b,startLat:Math.asin(n.y),startLon:Math.atan2(n.x,n.z),phase:this.rng()*20,speed:.38+this.rng()*.8 });
    }
    for(let i=0;i<18;i++){
      const dir=fromDegrees(-16+(this.rng()-.5)*23,-42+(this.rng()-.5)*22);
      const glow=new THREE.Mesh(new THREE.SphereGeometry(.04+this.rng()*.027,7,6),new THREE.MeshBasicMaterial({color:i%2?'#ffeeb3':'#f4ffc3',transparent:true,opacity:.85}));
      glow.position.copy(onSurface(dir,.3+this.rng()*.8));
      this.group.add(glow);
      this.fireflies.push({glow,phase:i*1.3,base:glow.position.clone()});
    }
  }

  private addPollen(): void {
    const pts:number[]=[];
    for(let i=0;i<110;i++){
      const n=randomDirection(this.rng);
      const r=5.7+this.rng()*2.8;
      pts.push(n.x*r,n.y*r,n.z*r);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    this.pollen=new THREE.Points(g,new THREE.PointsMaterial({color:'#fff5d0',size:.041,transparent:true,opacity:.75,depthWrite:false,sizeAttenuation:true}));
    this.group.add(this.pollen);
  }

  private updateMarkers():void {
    for(const m of this.markers){
      m.group.visible=!this.discovered.has(m.id);
    }
  }

  private loadSavedProgress():void {
    try {
      const raw=localStorage.getItem('little-elsewhere-discoveries');
      const ids=JSON.parse(raw||'[]') as unknown;
      if(Array.isArray(ids))ids.forEach(id=>{if(typeof id==='string'&&this.getPlace(id))this.discovered.add(id);});
    }catch { /* Storage is optional in private browsing contexts. */ }
  }
  resetProgress():void {
    this.discovered.clear();
    this.updateMarkers();
    try{localStorage.removeItem('little-elsewhere-discoveries');}catch { /* no-op */ }
  }

  discover(id:string, time:number):{place:Place;isNew:boolean}|undefined {
    const place=this.getPlace(id);if(!place)return undefined;
    const isNew=!this.discovered.has(id);
    this.discovered.add(id);
    this.updateMarkers();
    if(isNew){
      try{localStorage.setItem('little-elsewhere-discoveries',JSON.stringify([...this.discovered]));}catch { /* no-op */ }
    }
    this.act(id,time);
    return {place,isNew};
  }

  act(id:string,time:number):void {
    if(id==='nook')this.lastExcitedUntil=time+4.0;
    if(id==='pond')this.pondWishTime=time;
    if(id==='grove'){
      for(const l of this.lanterns){
        const m=l.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity=this.lightNight?2.8:1.45;
      }
    }
    if(id==='meadow'){
      // Gentle flower growth that retains the world’s peaceful mood.
      for(const bloom of this.blooms){
        bloom.userData.bloomUntil=time+2.1;
      }
    }
  }

  setNight(night:boolean):void {
    this.lightNight=night;
    this.groveLight.intensity=night?3.5:.1;
    this.lanterns.forEach(l=>{
      const m=l.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity=night?2.3:.12;
    });
  }

  setBenchMood(mood:BenchMood,time:number):void {
    this.benchMood=mood;
    if(mood==='company')this.lastExcitedUntil=time+3;
  }

  setBenchFlower(flower:FlowerColor|null):void {
    this.keepsake.group.visible=flower!==null;
    if(flower)this.keepsake.petals.color.set(FLOWERS[flower].color);
  }

  releaseBoat(time:number,reducedMotion:boolean):void {
    this.boatStart=time;this.pondWishTime=time;
    this.boat.visible=true;this.positionBoat(reducedMotion?.18:-.4,time);
  }
  private positionBoat(x:number,time:number):void {
    const pond=fromDegrees(6,38),[tx,tz]=tangentAxes(pond);
    const direction=pond.multiplyScalar(PLANET_RADIUS).addScaledVector(tx,x).addScaledVector(tz,.43).normalize();
    this.positionAt(this.boat,direction,.10+Math.sin(time*2)*.01,.4);
    this.boat.rotateZ(Math.sin(time*1.4)*.04);
  }
  setStoryMemory(count:number):void{this.libraryRibbon.visible=count>0;this.libraryRibbon.scale.x=1+Math.min(count,4)*.15;}
  setDetail(ratio:number):void {
    this.group.traverse(object=>{
      if(object instanceof THREE.InstancedMesh){
        object.userData.fullCount??=object.count;
        object.count=Math.max(1,Math.floor(object.userData.fullCount*ratio));
      }
    });
    this.trees.forEach((tree,index)=>{tree.visible=ratio>.6||index%2===0;});
    this.butterflies.forEach((butterfly,index)=>{butterfly.group.visible=index<Math.ceil(this.butterflies.length*ratio);});
    if(this.pollen)this.pollen.visible=ratio>.6;
  }

  update(time:number, delta:number, reducedMotion=false):void {
    if(this.character)this.character.update(time,time<this.lastExcitedUntil,this.benchMood,reducedMotion);
    for(const t of this.swayingTrees){
      t.group.rotation.z = Math.sin(time*.74+t.phase)*t.strength;
    }
    for(const b of this.butterflies){
      const cycle=(time*b.speed+b.phase)%9;
      const flight=Math.sin(Math.min(cycle/6,1)*Math.PI);
      const travelTime=(Math.floor((time*b.speed+b.phase)/9)*9+Math.min(cycle,6)-b.phase)/b.speed;
      const lat=b.startLat+.045*Math.sin(travelTime*.37*b.speed+b.phase);
      const lon=b.startLon+.08*Math.cos(travelTime*.43*b.speed+b.phase);
      const n=new THREE.Vector3(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));
      b.group.position.copy(n).multiplyScalar(terrainRadius(n)+.16+flight*.55);
      b.group.quaternion.copy(surfaceQuaternion(n));
      b.group.rotateY(travelTime*.34+b.phase);
      const flap=.15+Math.sin(time*11*b.speed+b.phase)*(.08+flight*.72);
      b.wings[0].rotation.y=flap;b.wings[1].rotation.y=-flap;
    }
    for(const f of this.fireflies){
      f.glow.position.copy(f.base).add(new THREE.Vector3(.12*Math.sin(time*.7+f.phase),.12*Math.sin(time*.9+f.phase),.1*Math.cos(time*.63+f.phase)));
      (f.glow.material as THREE.MeshBasicMaterial).opacity=.65+.35*Math.sin(time*2.5+f.phase);
    }
    for(const m of this.markers){
      m.group.position.copy(onSurface(m.dir,1.65+(m.id==='library'?.35:0)+Math.sin(time*1.6+m.phase)*.10));
      m.group.rotation.y+=delta*.45;
    }
    for(let i=0;i<this.pondRipples.length;i++){
      const r=this.pondRipples[i];
      const elapsed=time-this.pondWishTime-i*.28;
      r.ring.scale.setScalar(.3+Math.max(0,elapsed)*.6);
      r.material.opacity=elapsed>=0&&elapsed<2.65?(1-elapsed/2.65)*.42:0;
    }
    if(this.boat.visible&&!reducedMotion){
      const age=time-this.boatStart;
      this.positionBoat(-.4+Math.min(age/5,1)*.8,time);
      if(age>5)this.boat.visible=false;
    }
    if(this.pollen)this.pollen.rotation.y+=delta*.012;
    if(this.waterSurface)(this.waterSurface.material as THREE.MeshPhysicalMaterial).roughness=.18+.035*Math.sin(time*.8);
    for(const bloom of this.blooms){
      const until=(bloom.userData.bloomUntil as number|undefined)||0;
      const growing=until>time;
      bloom.scale.setScalar(growing?1+Math.sin((until-time)*6)*.003:1);
    }
  }
}
