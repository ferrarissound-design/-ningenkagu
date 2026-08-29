import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { resolveCollisions, ROOM } from '../../js/stage.js';

function box(minX, maxX, minZ, maxZ) {
  return { minX, maxX, minZ, maxZ };
}

test('resolveCollisions leaves a point outside any solid untouched', () => {
  const pos = new THREE.Vector3(0, 0, 0);
  resolveCollisions(pos, 0.3, [box(3, 4, 3, 4)]);
  assert.equal(pos.x, 0);
  assert.equal(pos.z, 0);
});

test('resolveCollisions pushes out along the nearest edge', () => {
  // 矩形 [0,2]x[0,2] のすぐ右内側にいる場合、右へ押し出される
  const pos = new THREE.Vector3(1.9, 0, 1.0);
  resolveCollisions(pos, 0.3, [box(0, 2, 0, 2)]);
  assert.ok(pos.x >= 2, `expected pushed past maxX+radius, got x=${pos.x}`);
  assert.equal(pos.z, 1.0, 'Zは押し出し方向と無関係なら変化しない');
});

test('resolveCollisions clamps to the room bounds', () => {
  const pos = new THREE.Vector3(ROOM.minX - 5, 0, ROOM.minZ - 5);
  resolveCollisions(pos, 0.3, []);
  assert.ok(pos.x >= ROOM.minX);
  assert.ok(pos.z >= ROOM.minZ);
});
