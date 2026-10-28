import * as THREE from 'three';
import { mat } from '../utils/math';

const bark = mat('#816e6d');
const darkBark = mat('#6f636b');
const leafColors = ['#78ae69', '#6c9f66', '#84b875', '#609b85', '#78ad83', '#95bd6d'];
const cream = mat('#f4eacb');

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group, pos: [number, number, number], scale?: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m);
  return m;
}
function blob(group: THREE.Group, material: THREE.Material, position: [number, number, number], scale: [number, number, number], detail = 1): THREE.Mesh {
  return mesh(new THREE.IcosahedronGeometry(1, detail), material, group, position, scale);
}
function sphere(group: THREE.Group, material: THREE.Material, position: [number, number, number], scale: [number, number, number]): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(1, 12, 9), material, group, position, scale);
}
function block(group: THREE.Group, material: THREE.Material, position: [number, number, number], size: [number, number, number]): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(...size), material, group, position);
}

export function makeTree(style: number, height = 1.5): THREE.Group {
  const g = new THREE.Group();
  const leaf = mat(leafColors[style % leafColors.length], { flatShading: true });
  const h = height;
  if (style % 3 === 0) {
    mesh(new THREE.CylinderGeometry(0.08*h, 0.13*h, 0.9*h, 7), bark, g, [0, 0.44*h, 0]);
    blob(g, leaf, [0, 1.07*h, 0], [0.43*h, 0.55*h, 0.41*h], 2);
    blob(g, leaf, [-0.24*h, 0.93*h, 0.08*h], [0.3*h, 0.37*h, 0.31*h], 1);
    blob(g, leaf, [0.23*h, 0.96*h, -0.05*h], [0.31*h, 0.38*h, 0.34*h], 2);
    blob(g, leaf, [0.05*h, 1.40*h, 0], [0.28*h, 0.30*h, 0.28*h], 1);
  } else if (style % 3 === 1) {
    mesh(new THREE.CylinderGeometry(0.065*h, 0.11*h, 0.81*h, 7), darkBark, g, [0, 0.4*h, 0]);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5 + 0.3;
      blob(g, leaf, [Math.cos(a)*0.22*h, (0.88 + .12 * (i%2))*h, Math.sin(a)*0.22*h], [0.35*h, .38*h, .34*h], 2);
    }
    blob(g, leaf, [0, 1.22*h, 0], [.36*h, .39*h, .36*h], 2);
  } else {
    mesh(new THREE.CylinderGeometry(0.07*h, 0.14*h, 1.16*h, 7), bark, g, [0, .57*h, 0]);
    blob(g, leaf, [0, .95*h, 0], [.23*h, .38*h, .24*h], 2);
    blob(g, leaf, [0, 1.29*h, 0], [.28*h, .48*h, .31*h], 2);
    blob(g, leaf, [0, 1.66*h, 0], [.22*h, .42*h, .25*h], 2);
    blob(g, leaf, [0, 1.97*h, 0], [.14*h, .27*h, .18*h], 1);
  }
  return g;
}

export function makeMushroom(color = '#ed9ba4', height = 0.24): THREE.Group {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.045, 0.058, height * 0.78, 8), cream, g, [0, height*.38, 0]);
  sphere(g, mat(color), [0, height*.82, 0], [.16, .11, .15]);
  const dots = mat('#fff9e5');
  for (let i = 0; i < 4; i++) sphere(g, dots, [Math.sin(i*2)*.085, height*.89 + (i%2)*.02, Math.cos(i*2)*.076], [.022,.015,.022]);
  return g;
}

export function makeBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = mat('#d4a06a');
  const slate = mat('#807576');
  block(g, seat, [0, .48, .02], [1.9, .15, .67]);
  block(g, seat, [0, .79, -.31], [1.9, .48, .12]);
  for (const x of [-.77,.77]) {
    block(g, slate, [x,.22,.24], [.17,.45,.17]);
    block(g, slate, [x,.25,-.24], [.17,.49,.16]);
    block(g, slate, [x,.8,-.24], [.15,.62,.13]);
  }
  return g;
}

export function makeTeacup(): THREE.Group {
  const g = new THREE.Group();
  const m = mat('#fff5de');
  mesh(new THREE.CylinderGeometry(.115, .084, .18, 14, 1), m, g, [0,.1,0]);
  mesh(new THREE.TorusGeometry(.079, .016, 5, 16), mat('#e6b59e'), g, [0,.192,0]).rotation.x = Math.PI / 2;
  const handle = mesh(new THREE.TorusGeometry(.067,.021,6,14,Math.PI*1.7), m, g, [.12,.115,0]);
  handle.rotation.y = Math.PI/2;
  for (const [x,z] of [[.02,.095],[-.03,.096]]) sphere(g,mat('#a2bf92'),[x,.11,z],[.012,.013,.007]);
  return g;
}

export type LittleCharacter = { group: THREE.Group; bob: THREE.Group; leftArm: THREE.Group; eyes: THREE.Group; update: (time: number, excited: boolean) => void };

export function makeCharacter(): LittleCharacter {
  const group = new THREE.Group();
  const bob = new THREE.Group(); group.add(bob);
  const turquoise = mat('#36b5b9');
  const turquoiseDark = mat('#208aa3');
  const pastelPink = mat('#f6a6c0');
  const paleHeadphones = mat('#c7e8d7');
  const orange = mat('#f09569');
  // A friendly blue creature with a music-loving personality, not a copied reference character.
  sphere(bob, turquoise, [0,.84,0], [.44,.47,.37]);
  sphere(bob, turquoiseDark, [-.16,.41,.08], [.23,.15,.23]);
  sphere(bob, turquoiseDark, [.19,.41,.08], [.23,.15,.23]);
  sphere(bob, mat('#fde5b2'), [0,.51,.22], [.38,.17,.24]);
  const eyes = new THREE.Group(); bob.add(eyes);
  for (const x of [-.16,.16]) {
    sphere(eyes, mat('#e9f2e4'), [x,.93,.328], [.135,.14,.062]);
    sphere(eyes, mat('#423f62'), [x,.93,.381], [.068,.086,.027]);
    sphere(eyes, mat('#ffffff'), [x-.02,.96,.405], [.025,.03,.01]);
    const rim = mesh(new THREE.TorusGeometry(.137,.025,6,24),orange,eyes,[x,.93,.363]);
    rim.scale.set(1,1.03,.8);
  }
  // Smile curves slightly upward.
  const smilePts = [new THREE.Vector3(-.115,.74,.361), new THREE.Vector3(0,.704,.403), new THREE.Vector3(.11,.75,.362)];
  const smile = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 12,.018,5,false), mat('#5b5d72'));
  bob.add(smile);
  for (const x of [-.32,.32]) sphere(bob, pastelPink, [x,.77,.26], [.09,.06,.025]);
  // Curved headphones and oversized soft ear-cushions.
  const band = mesh(new THREE.TorusGeometry(.415,.063,8,28,Math.PI),paleHeadphones,bob,[0,1.01,-.015]);
  band.rotation.z = 0;
  sphere(bob,pastelPink,[-.435,.94,.02],[.11,.19,.16]);
  sphere(bob,pastelPink,[.435,.94,.02],[.11,.19,.16]);
  sphere(bob,paleHeadphones,[-.449,.94,.075],[.07,.12,.11]);
  sphere(bob,paleHeadphones,[.449,.94,.075],[.07,.12,.11]);
  // Scarf and swinging sleeves.
  const scarf = mesh(new THREE.TorusGeometry(.27,.075,7,18), mat('#f6d887'),bob,[0,.51,.13]);
  scarf.rotation.x = Math.PI/2.25;
  const leftArm = new THREE.Group(); bob.add(leftArm); leftArm.position.set(-.4,.60,.03);
  const lArm = sphere(leftArm,mat('#fff3d8'),[-.09,-.13,.08],[.135,.245,.15]);
  lArm.rotation.z = -.4;
  sphere(leftArm,turquoise,[-.15,-.28,.13],[.15,.12,.14]);
  const rightArm = sphere(bob,mat('#fff3d8'),[.48,.51,.15],[.145,.23,.15]);
  rightArm.rotation.z = -.42;
  sphere(bob,turquoise,[.54,.36,.17],[.13,.12,.12]);
  return {
    group, bob, leftArm, eyes,
    update(time, excited) {
      bob.position.y = .027*Math.sin(time*1.95) + (excited ? .05*Math.sin(time*6) : 0);
      bob.rotation.z = .019*Math.sin(time*1.2);
      leftArm.rotation.z = excited ? -.45 + .35*Math.sin(time*7.2) : .11*Math.sin(time*1.8);
      const blinkTime = time % 5.7;
      eyes.scale.y = blinkTime > 5.2 && blinkTime < 5.35 ? .12 : 1;
      eyes.position.y = eyes.scale.y < .5 ? .82 : 0;
    },
  };
}

export function makeLibrary(): THREE.Group {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(.78,.85,.2,12),mat('#6d6468'),g,[0,.10,0]);
  const wall = mat('#686870');
  mesh(new THREE.CylinderGeometry(.66,.74,1.2,14),wall,g,[0,.78,0]);
  mesh(new THREE.CylinderGeometry(.79,.77,.22,14),mat('#625f6b'),g,[0,1.44,0]);
  const books = ['#f5c376','#86c9b3','#ec93ad','#f6e9a4','#a4aed9','#e5ab78','#90b7b2'];
  for (let row=0; row<3; row++) {
    for (let i=0; i<15; i++) {
      const a=i/15*Math.PI*2 + .06;
      const book = block(g,mat(books[(i+row*3)%books.length]),[Math.sin(a)*.705, .42+row*.39, Math.cos(a)*.705],[.175,.29,.095]);
      book.rotation.y=a;
    }
  }
  // Big friendly mushroom-cap roof makes the library a landmark.
  const roof = mesh(new THREE.CylinderGeometry(.87, .79, .14, 16),mat('#5b6069'),g,[0,1.6,0]);
  roof.castShadow=true;
  const sign = block(g,mat('#f8e5ae'),[0,1.87,.02],[.93,.23,.13]);
  sign.rotation.z=.04;
  return g;
}

export function makeCottage(): THREE.Group {
  const g = new THREE.Group();
  const walls = mat('#ffe4c1');
  block(g,walls,[0,.48,0],[1.12,.91,.92]);
  const roof = mesh(new THREE.ConeGeometry(.92,.72,4),mat('#d98781'),g,[0,1.27,0]);
  roof.rotation.y = Math.PI/4;
  const door = block(g,mat('#8b9d9b'),[0,.35,.477],[.26,.56,.036]);
  door.position.x=.06;
  sphere(g,mat('#ffd47b'),[.15,.34,.51],[.023,.023,.02]);
  for (const x of [-.34,.34]) {
    block(g,mat('#a6cad4'),[x,.76,.477],[.20,.23,.02]);
    block(g,mat('#f1d69a'),[x,.76,.495],[.025,.23,.032]);
  }
  const chimney = block(g,mat('#c99e91'),[.34,1.5,-.2],[.22,.47,.23]);
  chimney.rotation.z=.07;
  return g;
}

export function makePicnic(): THREE.Group {
  const g = new THREE.Group();
  // Handmade table and four stone stools.
  mesh(new THREE.CylinderGeometry(.59,.59,.08,9),mat('#ada3a1'),g,[0,.54,0]);
  mesh(new THREE.CylinderGeometry(.18,.24,.53,7),mat('#91888b'),g,[0,.28,0]);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    mesh(new THREE.CylinderGeometry(.23,.25,.36,8),mat(i%2?'#6b8191':'#7b858e'),g,[Math.sin(a)*.91,.18,Math.cos(a)*.91]);
  }
  const vase = mesh(new THREE.CylinderGeometry(.15,.10,.28,8),mat('#f4ada7'),g,[-.17,.73,-.09]);
  vase.rotation.z=.07;
  sphere(g,mat('#f6d6de'),[-.17,.93,-.09],[.15,.12,.15]);
  for(let i=0;i<5;i++)sphere(g,mat(i%2?'#b76dbd':'#d45d97'),[-.17+Math.sin(i*1.5)*.08,1.02+Math.cos(i*1.5)*.04,-.09+Math.cos(i*2)*.07],[.05,.05,.045]);
  return g;
}

export function makeBridge(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#ac775d');
  for(let i=0;i<9;i++) {
    const x=(i-4)*.20;
    block(g,wood,[x,.16+Math.cos((i-4)/4*Math.PI/2)*.16,0],[.17,.09,.90]);
  }
  for(const z of [-.50,.50]) {
    for(const x of [-.70,0,.70]) block(g,mat('#90715e'),[x,.58,z],[.07,.56,.075]);
    block(g,mat('#c79472'),[0,.78,z],[1.58,.09,.09]);
  }
  return g;
}

export function makeLantern(): {group: THREE.Group; glow: THREE.Mesh} {
  const group = new THREE.Group();
  mesh(new THREE.CylinderGeometry(.04,.055,.65,7),mat('#84746f'),group,[0,.32,0]);
  const globe = sphere(group,mat('#ffe4a3',{ emissive:'#ffb96e',emissiveIntensity:.18 }),[0,.77,0],[.14,.18,.14]);
  mesh(new THREE.ConeGeometry(.17,.14,7),mat('#7c7772'),group,[0,.99,0]);
  return { group, glow: globe };
}

export function makeButterfly(color: string): { group: THREE.Group; wings: [THREE.Group,THREE.Group] } {
  const group = new THREE.Group();
  sphere(group,mat('#685e67'),[0,0,0],[.045,.055,.115]);
  const wings: [THREE.Group,THREE.Group] = [new THREE.Group(),new THREE.Group()];
  for (const [i,wing] of wings.entries()) {
    group.add(wing);
    const sign=i===0?-1:1;
    blob(wing,mat(color,{side:THREE.DoubleSide}),[sign*.115,.035,0],[.14,.13,.035],1);
    blob(wing,mat('#fff3c9',{side:THREE.DoubleSide}),[sign*.12,-.06,.045],[.085,.075,.028],1);
  }
  return {group,wings};
}

export function makeStoneRing(): THREE.Group {
  const g = new THREE.Group();
  const st = mat('#b5a69d');
  for(let i=0;i<10;i++) {
    const a=i*Math.PI*2/10;
    blob(g,st,[Math.cos(a)*.7,.08,Math.sin(a)*.7],[.18,.15,.20],1);
  }
  return g;
}

export function makeFlowerBush(): THREE.Group {
  const g = new THREE.Group();
  const green = mat('#72a971');
  for (let i=0;i<5;i++) {
    const a=i*Math.PI*2/5;
    sphere(g,green,[Math.sin(a)*.2,.21,Math.cos(a)*.2],[.3,.24,.25]);
    sphere(g,mat(i%2?'#f7a6c9':'#ffcf6e'),[Math.sin(a)*.24,.42,Math.cos(a)*.22],[.065,.075,.065]);
  }
  return g;
}
