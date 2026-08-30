import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM } from '../../js/stageBuilder.js';
import { buildScienceRoom } from '../../js/stages/scienceroom.js';

function insideSolid(p, solids, pad = 0) {
  return solids.some((s) => (
    p.x > s.minX - pad && p.x < s.maxX + pad
    && p.z > s.minZ - pad && p.z < s.maxZ + pad
  ));
}

function insideRoom(p, pad = 0) {
  return p.x >= ROOM.minX + pad && p.x <= ROOM.maxX - pad
    && p.z >= ROOM.minZ + pad && p.z <= ROOM.maxZ - pad;
}

test('理科室は実験台・丸イス・標本棚・骨格模型を持つ', () => {
  const scene = new THREE.Scene();
  const stage = buildScienceRoom(scene);

  assert.equal(stage.id, 'scienceroom');
  assert.equal(stage.name, '理科室');
  assert.ok(stage.targets.length >= 18, `targets=${stage.targets.length}`);
  assert.ok(stage.eventRig?.look);
  assert.ok(stage.eventRig?.spots?.length >= 3);

  const kinds = new Set(stage.targets.map((t) => t.kind));
  for (const kind of ['table', 'chair', 'shelf', 'box', 'statue']) {
    assert.ok(kinds.has(kind), `missing mimic kind: ${kind}`);
  }
});

test('理科室のスポーン・巡回点・イベント立ち位置は家具に埋まらない', () => {
  const scene = new THREE.Scene();
  const stage = buildScienceRoom(scene);
  const points = [
    ['playerSpawn', stage.playerSpawn],
    ['oniSpawn', stage.oniSpawn],
    ...stage.waypoints.map((p, i) => [`waypoint${i}`, p]),
    ...stage.eventRig.spots.map((p, i) => [`eventSpot${i}`, p]),
  ];

  for (const [label, p] of points) {
    assert.ok(insideRoom(p, 0.25), `${label} is outside room: ${p.x},${p.z}`);
    assert.equal(insideSolid(p, stage.solids, 0.05), false, `${label} is inside/too close to a solid`);
  }
});
