import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM } from '../../js/stageBuilder.js';
import { buildElectronicsStore } from '../../js/stages/electronics.js';
import { STAGE_EVENTS } from '../../js/stageEvents.js';

function insideSolid(p, solids, pad = 0) {
  return solids.some((s) => (
    p.x > s.minX - pad && p.x < s.maxX + pad
    && p.z > s.minZ - pad && p.z < s.maxZ + pad
  ));
}

test('stage 6 has appliance disguises and a display-demo event rig', () => {
  const stage = buildElectronicsStore(new THREE.Scene());
  assert.equal(stage.id, 'electronics');
  assert.equal(stage.name, '家電量販店');
  assert.ok(stage.targets.length >= 20);
  const kinds = new Set(stage.targets.map((t) => t.kind));
  for (const kind of ['tv', 'fridge', 'washer', 'massage', 'table', 'shelf', 'box']) {
    assert.ok(kinds.has(kind), 'missing mimic kind: ' + kind);
  }
  assert.equal(stage.eventRig.screens.length, 5);
  assert.ok(stage.eventRig.spots.length >= 3);
  assert.equal(STAGE_EVENTS.electronics.id, 'demo');
});

test('stage 6 spawns, waypoints and event spots stay inside walkable space', () => {
  const stage = buildElectronicsStore(new THREE.Scene());
  const points = [
    ['player', stage.playerSpawn],
    ['oni', stage.oniSpawn],
    ...stage.waypoints.map((p, i) => ['waypoint' + i, p]),
    ...stage.eventRig.spots.map((p, i) => ['spot' + i, p]),
  ];
  for (const [label, p] of points) {
    assert.ok(p.x >= ROOM.minX + 0.2 && p.x <= ROOM.maxX - 0.2, label + ' x outside room');
    assert.ok(p.z >= ROOM.minZ + 0.2 && p.z <= ROOM.maxZ - 0.2, label + ' z outside room');
    assert.equal(insideSolid(p, stage.solids, 0.05), false, label + ' collides with furniture');
  }
});
