import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM } from '../../js/stageBuilder.js';
import { START_VIEWS, viewDirection } from '../../js/startViews.js';
import { buildLivingRoom } from '../../js/stages/living.js';
import { buildClassroom } from '../../js/stages/classroom.js';
import { buildArtRoom } from '../../js/stages/artroom.js';
import { buildLibrary } from '../../js/stages/library.js';
import { buildScienceRoom } from '../../js/stages/scienceroom.js';
import { buildElectronicsStore } from '../../js/stages/electronics.js';

// player.js の Player.radius と揃える（DOM/WebGL を持ち込まずに済むよう定数で持つ）
const PLAYER_RADIUS = 0.34;

const BUILDERS = {
  living: buildLivingRoom,
  classroom: buildClassroom,
  artroom: buildArtRoom,
  library: buildLibrary,
  scienceroom: buildScienceRoom,
  electronics: buildElectronicsStore,
};

/** 開始地点から視線方向へ、部屋の外へ出るまでの距離 */
function roomAhead(x, z, dir) {
  let t = Infinity;
  if (dir.x > 1e-6) t = Math.min(t, (ROOM.maxX - x) / dir.x);
  else if (dir.x < -1e-6) t = Math.min(t, (ROOM.minX - x) / dir.x);
  if (dir.z > 1e-6) t = Math.min(t, (ROOM.maxZ - z) / dir.z);
  else if (dir.z < -1e-6) t = Math.min(t, (ROOM.minZ - z) / dir.z);
  return t;
}

test('全ステージに開始構図が定義されている', () => {
  for (const id of Object.keys(BUILDERS)) {
    assert.ok(START_VIEWS[id], `START_VIEWS に ${id} が無い`);
  }
});

test('開始位置が家具にめり込まない', () => {
  for (const [id, build] of Object.entries(BUILDERS)) {
    const stage = build(new THREE.Scene());
    const [x, , z] = START_VIEWS[id].position;
    const r = PLAYER_RADIUS;
    const hit = stage.solids.find((s) => (
      x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r
    ));
    assert.equal(hit, undefined, `${id} の開始位置 (${x}, ${z}) が家具に重なっている`);
    assert.ok(
      x > ROOM.minX + r && x < ROOM.maxX - r && z > ROOM.minZ + r && z < ROOM.maxZ - r,
      `${id} の開始位置が部屋の外`
    );
  }
});

test('開始時のカメラは背後の壁ではなく部屋の中を向く', () => {
  for (const id of Object.keys(BUILDERS)) {
    const view = START_VIEWS[id];
    const [x, , z] = view.position;
    const ahead = roomAhead(x, z, viewDirection(view.yaw));
    assert.ok(ahead >= 8, `${id} は視線の先に部屋が ${ahead.toFixed(2)}m しかない（壁を向いている）`);
  }
});
