/**
 * ゴールの枠（ポストとクロスバー）。ゴールラインは x = 0、ネットは x > 0 の側。
 * ネットは net.ts で別に作る。
 */
import * as THREE from 'three';
import { FIELD } from '../field/dimensions.ts';

export function createGoal(): THREE.Group {
  const group = new THREE.Group();
  const r = FIELD.postRadius;
  const frame = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  const postHeight = FIELD.goalHeight + r;

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r, r, postHeight, 20), frame);
    post.position.set(0, postHeight / 2, side * (FIELD.goalWidth / 2 + r));
    post.castShadow = true;
    group.add(post);
    // ネットを後ろで支える支柱
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, postHeight, 8), frame);
    stay.position.set(FIELD.goalDepthTop, postHeight / 2, side * (FIELD.goalWidth / 2 + r));
    group.add(stay);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, FIELD.goalWidth + 4 * r, 20), frame);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, postHeight, 0);
  bar.castShadow = true;
  group.add(bar);
  return group;
}
