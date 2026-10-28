import * as THREE from 'three';
import { elevation, onSurface, PLANET_RADIUS, tangentAxes } from '../utils/math';

const grass = new THREE.Color('#88b966');
const greenLight = new THREE.Color('#a4ca78');
const greenDark = new THREE.Color('#5f9e6d');

export function makePlanet(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 5);
  const p = geo.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  const n = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    const r = PLANET_RADIUS + elevation(n);
    p.setXYZ(i, n.x * r, n.y * r, n.z * r);
    const variation = Math.sin(n.x * 22.4 + n.z * 7.2) * Math.cos(n.y * 19.1 + n.x * 9.3);
    const detail = Math.sin(n.x * 55.5 + n.z * 42.1) * Math.cos(n.y * 66.2);
    col.copy(grass).lerp(variation > 0 ? greenLight : greenDark, Math.abs(variation) * 0.27)
      .multiplyScalar(1 + detail * 0.022);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.castShadow = false; mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** A smoothly curved polygon conforming to the sphere, used for ponds, trails and grassy patches. */
export function surfaceDisk(center: THREE.Vector3, radius: number, color: string, options: { opacity?: number; offset?: number; segments?: number; oval?: number } = {}): THREE.Mesh {
  const segments = options.segments ?? 45;
  const [x, z] = tangentAxes(center);
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const height = options.offset ?? 0.018;
  const mid = onSurface(center, height);
  verts.push(...mid.toArray()); uvs.push(0.5, 0.5);
  const oval = options.oval ?? 1;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const rr = radius * (1 + 0.065 * Math.sin(theta * 5 + center.x * 50) + 0.045 * Math.sin(theta * 8 + center.z * 50));
    const xx = Math.cos(theta) * rr;
    const zz = Math.sin(theta) * rr * oval;
    const dir = center.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(x, xx).addScaledVector(z, zz).normalize();
    const v = onSurface(dir, height);
    verts.push(...v.toArray()); uvs.push((xx / (radius * 2)) + 0.5, zz / (radius * 2) + 0.5);
    if (i > 0) indices.push(0, i, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color, transparent: (options.opacity ?? 1) < 1, opacity: options.opacity ?? 1, roughness: 0.38, metalness: 0.02, side: THREE.DoubleSide, depthWrite: (options.opacity ?? 1) >= 1 });
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  return mesh;
}
