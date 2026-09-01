// 壁や家具に押しつけている間の「実際には動いていない」扱いを固定するテスト。
//
// Player.update() は入力どおりに進めたはずの速度を入れるが、そのあと
// game.js が resolveCollisions() で移動を打ち消すことがある。
// 足音・静止度・家具検査の判定はすべて player.speed / stillness を見るので、
// 押し戻された分がここで反映されないとゲームの手触りが壊れる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { Player, STILL_SPEED } from '../../js/player.js';
import { Game, CONFIG } from '../../js/game.js';

function makePlayer() {
  const player = new Player(new THREE.Scene());
  player.reset(new THREE.Vector3(0, 0, 0));
  return player;
}

const FORWARD = new THREE.Vector3(0, 0, 1);
const DT = 1 / 60;

test('押し戻されなければ速度も静止時間もそのまま', () => {
  const p = makePlayer();
  p.update(DT, FORWARD, 3.3);
  const moved = 3.3 * DT;
  p.applyResolvedMovement(DT, moved);

  assert.equal(p.speed, 3.3);
  assert.equal(p.stillTime, 0);
});

test('壁に押しつけて一歩も進めなければ速度0・静止時間が積み上がる', () => {
  const p = makePlayer();
  // まず2秒ぶん立ち止まって静止度を貯めておく
  for (let i = 0; i < 120; i++) {
    p.update(DT, new THREE.Vector3(0, 0, 0), 0);
    p.applyResolvedMovement(DT, 0);
  }
  const stillBefore = p.stillTime;
  assert.ok(stillBefore > 1.5);

  // 壁へ向かって進もうとするが、衝突解決で移動距離は0になる
  p.update(DT, FORWARD, 3.3);
  p.applyResolvedMovement(DT, 0);

  assert.equal(p.speed, 0, '実際に動いていないなら速度は0');
  assert.equal(p.stillness, 1, '静止度は「押しつける直前」から継続する');
  assert.ok(p.stillTime > stillBefore, `stillTime=${p.stillTime}`);
});

test('押し戻されて動けないと足音も鳴らない', () => {
  const p = makePlayer();
  p.update(DT, FORWARD, CONFIG.speed.stand);
  const stub = { player: p };

  assert.ok(Game.prototype.noiseLevel.call(stub) > 0.9, '押し戻される前は全開の足音');
  p.applyResolvedMovement(DT, 0);
  assert.equal(Game.prototype.noiseLevel.call(stub), 0, '壁に押しつけている間は無音');
});

test('家具に半分だけ押し戻されたら、その分だけ速度が下がる', () => {
  const p = makePlayer();
  p.update(DT, FORWARD, 3.3);
  p.applyResolvedMovement(DT, (3.3 * DT) / 2);

  assert.ok(Math.abs(p.speed - 1.65) < 1e-6, `speed=${p.speed}`);
  assert.equal(p.stillTime, 0, '半分でも動いているなら静止扱いにはしない');
});

test('applyResolvedMovement は実際の移動が多いときに速度を上書きしない', () => {
  const p = makePlayer();
  p.update(DT, FORWARD, 1.7);
  p.applyResolvedMovement(DT, 3.3 * DT);
  assert.equal(p.speed, 1.7);
});

test('STILL_SPEED 未満は止まっている扱い', () => {
  const p = makePlayer();
  p.update(DT, FORWARD, 3.3);
  p.applyResolvedMovement(DT, STILL_SPEED * 0.5 * DT);
  assert.equal(p.speed, 0);
});
