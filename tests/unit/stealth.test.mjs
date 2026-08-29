// ゲームの中核となる「擬態成功度」と「足音」の計算式のテスト。
//
// これらは README に仕様として明記されている、プレイヤーへの約束そのもの
// （「色・静止・ポーズ・距離の4要素で決まる」「100%にはならない」
//   「しゃがみは足音自体も小さい」）。重み係数を1つ変えただけで
// ゲーム性が変わってしまうため、式の性質を契約として固定しておく。
//
// computeMimicry() / noiseLevel() は Game のメソッドだが、参照するのは
// player・backdropColor・stage.targets・CONFIG だけなので、
// THREE のシーンを組まずスタブの this で呼べる（call で直接叩く）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { Game, CONFIG } from '../../js/game.js';
import { POSE_FOR_KIND } from '../../js/stage.js';

/** 擬態対象1つ分の最小データ。stage.js の target() が作る形に合わせる。 */
function makeTarget(kind, { cx = 0, cz = 0, w = 1, d = 1 } = {}) {
  return {
    kind,
    rect: { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 },
  };
}

/**
 * computeMimicry() / noiseLevel() が参照する分だけを持つスタブ。
 * 既定は「最高条件」（色ぴったり・完全静止・ポーズ一致・対象の真上）にして、
 * 各テストで崩したい要素だけを上書きする。
 */
function makeStub(overrides = {}) {
  const {
    color = 0x8899aa, backdrop = 0x8899aa, stillness = 1,
    kind = 'shelf', pose = null, x = 0, z = 0, speed = 0, targets = null,
  } = overrides;
  const target = kind ? makeTarget(kind) : null;
  return {
    player: {
      currentColor: new THREE.Color(color),
      stillness,
      mimicTarget: target,
      pose: pose ?? (kind ? POSE_FOR_KIND[kind] : 'stand'),
      position: { x, z },
      speed,
    },
    backdropColor: new THREE.Color(backdrop),
    stage: { targets: targets ?? (target ? [target] : []) },
  };
}

const mimicry = (o) => Game.prototype.computeMimicry.call(makeStub(o));
const noise = (o) => Game.prototype.noiseLevel.call(makeStub(o));

// ---------------- 擬態成功度 ----------------

test('擬態成功度は最高条件でも1.0にならない（絶対安全は存在しない）', () => {
  const best = mimicry();
  assert.ok(best <= 0.94, `上限0.94のはずが ${best}`);
  assert.ok(best > 0.9, `最高条件なら0.9は超えるはず。実際 ${best}`);
});

test('擬態成功度は常に 0..0.94 に収まる', () => {
  const cases = [
    {}, // 最高条件
    { kind: null }, // 擬態なし
    { color: 0xffffff, backdrop: 0x000000, stillness: 0, pose: 'stand', x: 99, z: 99 }, // 最悪条件
    { stillness: -5 }, // 異常値が入っても壊れない
    { stillness: 5 },
  ];
  for (const c of cases) {
    const v = mimicry(c);
    assert.ok(v >= 0 && v <= 0.94, `${JSON.stringify(c)} → ${v} が範囲外`);
  }
});

test('4要素それぞれが単独で擬態成功度を動かす（色・静止・ポーズ・距離）', () => {
  const best = mimicry();

  // 色だけ崩す
  assert.ok(mimicry({ color: 0xffffff, backdrop: 0x000000 }) < best, '色が合わないと下がるはず');
  // 静止だけ崩す
  assert.ok(mimicry({ stillness: 0 }) < best, '動いていると下がるはず');
  // ポーズだけ崩す（shelf は tpose が正解なので crouch にする）
  assert.ok(mimicry({ pose: 'crouch' }) < best, 'ポーズが合わないと下がるはず');
  // 距離だけ崩す（対象は原点、プレイヤーを遠くへ）
  assert.ok(mimicry({ x: 20, z: 20 }) < best, '対象から離れると下がるはず');
});

test('擬態していない生身は、同じ条件の擬態中より必ず目立つ', () => {
  // 色・静止を揃えたうえで、擬態対象の有無だけを変える
  const withTarget = mimicry({ stillness: 1 });
  const bare = mimicry({ kind: null, stillness: 1 });
  assert.ok(bare < withTarget, `生身(${bare})は擬態中(${withTarget})より低いはず`);
});

test('ポーズ一致の判定は POSE_FOR_KIND に従う', () => {
  // sofa の正解は crouch。正解ポーズのほうが必ず高い
  const matched = mimicry({ kind: 'sofa', pose: 'crouch' });
  const mismatched = mimicry({ kind: 'sofa', pose: 'tpose' });
  assert.equal(POSE_FOR_KIND.sofa, 'crouch');
  assert.ok(matched > mismatched, `一致(${matched}) > 不一致(${mismatched}) のはず`);
});

test('同じ種類の家具が近くにあれば、擬態対象から離れていても距離要素が救われる', () => {
  // README の「距離＝擬態した物の近くにいるか」は、同じ kind の最寄りで測る。
  // 遠くに1つだけの場合と、足元にもう1つ同じ kind がある場合を比べる。
  const far = makeTarget('shelf', { cx: 0, cz: 0 });
  const near = makeTarget('shelf', { cx: 20, cz: 20 });
  const stub = makeStub({ x: 20, z: 20, targets: [far] });
  stub.player.mimicTarget = far;
  const alone = Game.prototype.computeMimicry.call(stub);

  stub.stage.targets = [far, near];
  const withNeighbor = Game.prototype.computeMimicry.call(stub);

  assert.ok(withNeighbor > alone, `同種が近くにあるほうが高いはず（${withNeighbor} > ${alone}）`);
});

// ---------------- 足音 ----------------

test('静止していれば足音は鳴らない', () => {
  assert.equal(noise({ speed: 0 }), 0);
  assert.equal(noise({ speed: 0, pose: 'stand' }), 0);
});

test('足音は速度に比例し、基準速度で最大になる', () => {
  const ref = CONFIG.noise.speedRef;
  assert.equal(noise({ speed: ref, pose: 'stand' }), 1);
  const half = noise({ speed: ref / 2, pose: 'stand' });
  assert.ok(Math.abs(half - 0.5) < 1e-9, `半分の速度なら0.5のはずが ${half}`);
});

test('基準速度を超えても足音は1.0で頭打ちになる', () => {
  assert.equal(noise({ speed: CONFIG.noise.speedRef * 10, pose: 'stand' }), 1);
});

test('しゃがみは同じ速度でも直立より静か（READMEの約束）', () => {
  const speed = CONFIG.speed.crouch;
  const crouch = noise({ speed, pose: 'crouch' });
  const stand = noise({ speed, pose: 'stand' });
  assert.ok(crouch < stand, `しゃがみ(${crouch})は直立(${stand})より静かなはず`);
  assert.equal(CONFIG.noise.poseScale.crouch, 0.55);
});

test('しゃがみは移動そのものも遅いので、全力移動時の足音は直立の半分以下になる', () => {
  // README:「しゃがみは移動そのものが遅いうえ、足音自体も小さいので一番静か」
  const crouchFull = noise({ speed: CONFIG.speed.crouch, pose: 'crouch' });
  const standFull = noise({ speed: CONFIG.speed.stand, pose: 'stand' });
  assert.ok(crouchFull <= standFull * 0.5,
    `しゃがみ全力(${crouchFull})は直立全力(${standFull})の半分以下のはず`);
});

test('T/Yポーズでの移動は直立と同じだけ響く', () => {
  const speed = CONFIG.speed.tpose;
  assert.equal(noise({ speed, pose: 'tpose' }), noise({ speed, pose: 'stand' }));
  assert.equal(noise({ speed, pose: 'ypose' }), noise({ speed, pose: 'stand' }));
});

test('未知のポーズでも足音の計算が壊れない（倍率1として扱う）', () => {
  const v = noise({ speed: CONFIG.noise.speedRef, pose: 'unknown-pose' });
  assert.equal(v, 1);
});
