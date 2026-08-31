import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { buildScienceRoom } from '../../js/stages/scienceroom.js';
import { buildLibrary } from '../../js/stages/library.js';
import { StageEventManager } from '../../js/stageEvents.js';

function fakeGame(build) {
  const scene = new THREE.Scene();
  scene.userData.stageLights = null;
  const stage = build(scene);
  return {
    scene,
    stage,
    state: 'playing',
    timeLeft: 60,
    suspicion: 0,
    player: { speed: 0 },
    oni: {
      state: 'patrol', eventFocus: null, tune: {},
      setEventVision() {}, clearEventVision() {},
      beginEventFocus() { return false; }, endEventFocus() {},
      canReachEventSpot() { return true; },
      position: new THREE.Vector3(),
    },
    hud: { eventNotice() {}, popup() {} },
  };
}

test('理科室の蒸気は視線も移動も塞がない', () => {
  const stage = buildScienceRoom(new THREE.Scene());
  const steam = stage.eventRig.steam;
  assert.ok(steam, 'eventRig.steam が無い');
  assert.ok(steam.puffs.length >= 4);
  assert.equal(steam.group.visible, false, '初期状態では隠れている');
  for (const p of steam.puffs) {
    assert.equal(stage.occluders.includes(p.mesh), false, '白煙が視線を遮っている');
  }
});

test('蒸気は発生中だけ見え、終了・中断で必ず消える', () => {
  const game = fakeGame(buildScienceRoom);
  const m = new StageEventManager(game);
  const steam = game.stage.eventRig.steam;

  assert.equal(steam.group.visible, false);

  m.begin();
  assert.equal(steam.group.visible, true, 'イベント中に表示されない');

  // 立ちのぼる演出が実際に位置と不透明度を動かしている
  m.elapsed = 2;
  for (let i = 0; i < 30; i++) m.animateSteam(1 / 60);
  assert.ok(steam.puffs.some((p) => p.mesh.material.opacity > 0.05), '白煙が見えていない');
  assert.ok(steam.puffs.some((p) => p.mesh.position.y > 0.6), '白煙が上がっていない');

  m.finish();
  assert.equal(steam.group.visible, false, 'イベント終了後も残っている');
  for (const p of steam.puffs) assert.equal(p.mesh.material.opacity, 0);

  // 決着・ステージ切替での強制中断でも残さない
  m.begin();
  assert.equal(steam.group.visible, true);
  m.abort();
  assert.equal(steam.group.visible, false, '中断後も残っている');
});

test('蒸気を持たないステージでも演出呼び出しが落ちない', () => {
  const game = fakeGame(buildLibrary);
  const m = new StageEventManager(game);
  assert.doesNotThrow(() => { m.setSteam(true); m.animateSteam(0.016); m.setSteam(false); });
});
