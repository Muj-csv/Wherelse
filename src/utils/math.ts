import * as THREE from 'three';

export const UP = new THREE.Vector3(0, 1, 0);
export const PLANET_RADIUS = 5.2;

export function toDirection(lat: number, lon: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
}

export function fromDegrees(lat: number, lon: number): THREE.Vector3 {
  return toDirection(THREE.MathUtils.degToRad(lat), THREE.MathUtils.degToRad(lon));
}

export function elevation(n: THREE.Vector3): number {
  const a = Math.sin(n.x * 8.1 + n.y * 4.3) * Math.cos(n.z * 8.7 - n.x * 2.2);
  const b = Math.sin(n.x * 16.3 + n.y * 20.9 + n.z * 9.1);
  const c = Math.cos(n.x * 31.2 - n.y * 21.4 + n.z * 14.5);
  return a * 0.105 + b * 0.045 + c * 0.016;
}

export function terrainRadius(n: THREE.Vector3): number { return PLANET_RADIUS + elevation(n); }
export function onSurface(n: THREE.Vector3, height = 0): THREE.Vector3 { return n.clone().multiplyScalar(terrainRadius(n) + height); }
export function surfaceQuaternion(n: THREE.Vector3): THREE.Quaternion { return new THREE.Quaternion().setFromUnitVectors(UP, n); }

export function tangentAxes(n: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const x = new THREE.Vector3(0, 1, 0).cross(n);
  if (x.lengthSq() < 0.0001) x.set(1, 0, 0);
  x.normalize();
  const z = n.clone().cross(x).normalize();
  return [x, z];
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomDirection(rng: () => number): THREE.Vector3 {
  const y = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  return new THREE.Vector3(Math.sqrt(1 - y * y) * Math.sin(a), y, Math.sqrt(1 - y * y) * Math.cos(a));
}

export function mat(color: number | string, options: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0, ...options });
}
