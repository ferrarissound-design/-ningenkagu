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

test('壁ぎわの家具から押し出した結果が、部屋クランプで家具の中へ戻されない', () => {
  // 図書室の壁ぎわ本棚と同じ配置。半径ぶん膨らませた矩形の左端は
  // 部屋の可動範囲より外にあるため、素直に「近い方」へ逃がすと
  // クランプで引き戻されて家具にめり込む。
  const radius = 0.34;
  const shelf = box(ROOM.minX + 0.275, ROOM.minX + 1.125, -1, 1);
  const pad = radius + 0.05;
  for (let x = ROOM.minX + pad; x <= shelf.maxX + radius; x += 0.05) {
    const pos = new THREE.Vector3(x, 0, 0);
    resolveCollisions(pos, radius, [shelf]);
    const inside = pos.x > shelf.minX - radius && pos.x < shelf.maxX + radius
      && pos.z > shelf.minZ - radius && pos.z < shelf.maxZ + radius;
    assert.ok(!inside, `x=${x.toFixed(2)} から押し出した結果 ${pos.x.toFixed(3)} が家具の中に残った`);
    assert.ok(pos.x >= ROOM.minX + pad - 1e-9 && pos.x <= ROOM.maxX - pad + 1e-9, '可動範囲の中に収まる');
  }
});

test('部屋を横断する家具でも、従来どおり最短の辺へ逃がす', () => {
  // 4方向とも可動範囲の外＝逃げ場がない場合のフォールバック。
  const wide = box(ROOM.minX - 1, ROOM.maxX + 1, ROOM.minZ - 1, ROOM.maxZ + 1);
  const pos = new THREE.Vector3(0, 0, ROOM.maxZ - 1);
  resolveCollisions(pos, 0.3, [wide]);
  assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.z), '座標がNaNにならない');
  assert.ok(pos.z <= ROOM.maxZ - 0.35, '可動範囲の中に収まる');
});
