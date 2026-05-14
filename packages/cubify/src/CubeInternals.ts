import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface InternalsOptions {
  stickerOpacity: number;
  wallOpacity:    number;
  coreOpacity:    number;
}

export const DEFAULT_INTERNALS_OPTIONS: InternalsOptions = {
  stickerOpacity: 0.60,
  wallOpacity:    0.20,
  coreOpacity:    0.80,
};

export function buildCoreGroup(plasticColour: string, options: InternalsOptions): THREE.Group {
  const group = new THREE.Group();
  const colorInt = parseInt(plasticColour.slice(1), 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: colorInt,
    transparent: true,
    opacity: options.coreOpacity,
    depthWrite: false,
  });

  // Build each piece, apply transform into world-space vertices, then merge into
  // a single mesh — one draw call, no per-part depth-sort flickering.
  const sphereGeo = new THREE.SphereGeometry(0.38, 16, 12);

  // Single full-length cylinder per axis, centred at origin.
  // Height 1.6 — arms end short of the centre pieces, leaving a small gap.
  const armHeight = 1.6;
  const armRadius = 0.08;

  const yGeo = new THREE.CylinderGeometry(armRadius, armRadius, armHeight, 8);

  const xGeo = new THREE.CylinderGeometry(armRadius, armRadius, armHeight, 8);
  xGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));

  const zGeo = new THREE.CylinderGeometry(armRadius, armRadius, armHeight, 8);
  zGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));

  const merged = mergeGeometries([sphereGeo, yGeo, xGeo, zGeo]);
  sphereGeo.dispose();
  yGeo.dispose();
  xGeo.dispose();
  zGeo.dispose();

  const mesh = new THREE.Mesh(merged, coreMat);
  group.add(mesh);

  return group;
}

export function buildWallMaterial(plasticColour: string, options: InternalsOptions): THREE.Material {
  const colorInt = parseInt(plasticColour.slice(1), 16);
  return new THREE.MeshStandardMaterial({
    color: colorInt,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: options.wallOpacity,
    depthWrite: false,
  });
}
