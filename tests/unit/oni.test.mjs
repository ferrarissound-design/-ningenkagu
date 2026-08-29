// 鬼の「足音の聞こえ方」と「性格タイプのバランス」のテスト。
//
// hearTarget() は Oni のメソッドだが、参照するのは root.position と tune だけなので
// THREE のシーンを組まずスタブの this で呼べる。
//
// 性格バランスのほうは README の設計意図
// 「3種類は『強さ』ではなく攻略法が違うように調整してあります
//   （得意な能力の裏に必ず弱点があります）」
// を不変条件として固定するもの。将来の調整で、うっかり
// 「全部の軸で他より強い鬼」が生まれるのを防ぐ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Oni, HEARING, ONI_PERSONALITIES,
  pickOniPersonality, setForcedOniPersonality, getForcedOniPersonality,
} from '../../js/oni.js';

function hear(player, loudness, tune = {}) {
  const stub = {
    root: { position: { x: 0, z: 0 } },
    tune: { detectFalloffScale: 1, detectScale: 1, ...tune },
  };
  return Oni.prototype.hearTarget.call(stub, { position: player }, loudness);
}

const at = (x, z = 0) => ({ x, z });

// ---------------- 足音の聞こえ方 ----------------

test('音を立てていなければ聞こえない（距離ゼロでも）', () => {
  assert.equal(hear(at(0), 0).level, 0);
});

test('足音は距離とともに減衰し、可聴範囲の外では完全に0になる', () => {
  const near = hear(at(0), 1).level;
  const mid = hear(at(HEARING.range / 2), 1).level;
  const edge = hear(at(HEARING.range), 1).level;
  const beyond = hear(at(HEARING.range * 2), 1).level;

  assert.equal(near, 1, '距離0なら減衰なし');
  assert.ok(mid < near && mid > edge, `中間(${mid})は near(${near}) と edge(${edge}) の間`);
  assert.equal(edge, 0, '可聴範囲ちょうどで0');
  assert.equal(beyond, 0, '範囲外でも負にならず0のまま');
});

test('足音の大きさ（loudness）に比例する', () => {
  const full = hear(at(1), 1).level;
  const half = hear(at(1), 0.5).level;
  assert.ok(Math.abs(half - full / 2) < 1e-9, `半分の音量なら半分のはず（${half} vs ${full / 2}）`);
});

test('聞こえた位置はプレイヤーの位置そのものを返す', () => {
  const r = hear(at(3, -2), 1);
  assert.equal(r.x, 3);
  assert.equal(r.z, -2);
});

test('耳の良い鬼ほど遠くの足音を拾う（detectFalloffScale）', () => {
  const d = HEARING.range * 0.9; // 標準ならほぼ聞こえない距離
  const normal = hear(at(d), 1).level;
  const sharp = hear(at(d), 1, { detectFalloffScale: 1.5 }).level; // 見張り鬼相当
  assert.ok(sharp > normal, `耳が良いほうが大きく聞こえるはず（${sharp} > ${normal}）`);
});

test('見抜く力が弱い鬼は足音にも気づきにくい（detectScale）', () => {
  const normal = hear(at(1), 1).level;
  const dull = hear(at(1), 1, { detectScale: 0.78 }).level; // 猪突猛進鬼相当
  assert.ok(dull < normal, `雑な鬼のほうが小さく聞こえるはず（${dull} < ${normal}）`);
});

// ---------------- 性格タイプのバランス ----------------

const PERSONAS = Object.values(ONI_PERSONALITIES);

// 「大きいほど鬼に有利」な軸だけを並べる。
// inspectCooldownScale は小さいほど検査が多い＝有利なので、ここには入れず別扱い。
const ADVANTAGE_AXES = [
  'speedScale', 'visionRangeScale', 'visionAngleScale', 'periRangeScale',
  'detectScale', 'detectFalloffScale', 'inspectChanceScale',
];

test('性格タイプは3種類あり、それぞれ id・名前・アイコン・説明を持つ', () => {
  assert.equal(PERSONAS.length, 3);
  for (const p of PERSONAS) {
    assert.ok(p.id && p.name && p.icon && p.desc, `${JSON.stringify(p)} に不足がある`);
    assert.equal(ONI_PERSONALITIES[p.id], p, 'キーと id が一致していること');
  }
});

test('どの性格タイプも全軸で他を上回らない（得意の裏に必ず弱点がある）', () => {
  // README の設計意図そのもの。1体でも「全部の軸で他以上」になっていたら
  // それは純粋な上位互換＝攻略法の違いではなく強弱になってしまう。
  //
  // 保証の範囲について（過信しないための注記）:
  // これが捕まえるのは「全軸で他以上」という完全な上位互換だけで、
  // 「7軸中6軸で勝っていて弱点は1つだけ」は通ってしまう。
  // 実際の3体は最小で1軸しか劣位を持たないペアがあるため
  // （見張り鬼が猪突猛進鬼に劣るのは speed のみ）、
  // 「2軸以上劣ること」まで厳しくすると現在のバランスが通らない。
  // つまりこれは現在の調整が満たせる範囲で最も強い不変条件であって、
  // バランスの良し悪しそのものを保証するものではない。
  for (const a of PERSONAS) {
    for (const b of PERSONAS) {
      if (a === b) continue;
      const dominatesAll = ADVANTAGE_AXES.every((k) => a[k] >= b[k]);
      assert.ok(!dominatesAll,
        `${a.name} が ${b.name} に対して全軸で優位になっている（上位互換は不可）`);
    }
  }
});

test('どの性格タイプも、標準より優れた軸と劣った軸を最低1つずつ持つ', () => {
  for (const p of PERSONAS) {
    const better = ADVANTAGE_AXES.filter((k) => p[k] > 1);
    const worse = ADVANTAGE_AXES.filter((k) => p[k] < 1);
    assert.ok(better.length > 0, `${p.name} に得意な軸がない`);
    assert.ok(worse.length > 0, `${p.name} に弱点の軸がない`);
  }
});

test('倍率はすべて正の有限値（0や負値だと視界や速度が壊れる）', () => {
  const scaleKeys = Object.keys(PERSONAS[0]).filter((k) => k.endsWith('Scale') || k === 'sweepRate');
  for (const p of PERSONAS) {
    for (const k of scaleKeys) {
      assert.ok(Number.isFinite(p[k]) && p[k] > 0, `${p.name}.${k} = ${p[k]} が不正`);
    }
  }
});

// pickOniPersonality() が返すのはオブジェクトではなく性格の id（文字列）。
// 受け取った側（Oni.setPersonality）が id から実体を引く作りになっている。
test('pickOniPersonality は必ず定義済みの3種類の id のどれかを返す', () => {
  setForcedOniPersonality(null); // 固定を解除して通常のランダムに戻す
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const id = pickOniPersonality();
    assert.ok(ONI_PERSONALITIES[id], `未知の性格 id が返された: ${JSON.stringify(id)}`);
    seen.add(id);
  }
  // 300回も引けば3種類とも出るはず（均等確率なので取りこぼしは事実上ありえない）
  assert.equal(seen.size, 3, `3種類とも出るはずが ${[...seen].join(',')} だけだった`);
});

test('setForcedOniPersonality で次の抽選を固定でき、null で解除できる', () => {
  assert.equal(setForcedOniPersonality('watcher'), 'watcher', '設定した id を返す');
  assert.equal(getForcedOniPersonality(), 'watcher');
  for (let i = 0; i < 20; i++) {
    assert.equal(pickOniPersonality(), 'watcher');
  }

  // 不正な id は無視され、通常のランダムに戻る
  assert.equal(setForcedOniPersonality('no-such-oni'), null, '不正な id では固定しない');
  assert.equal(getForcedOniPersonality(), null);
  const ids = new Set();
  for (let i = 0; i < 200; i++) ids.add(pickOniPersonality());
  assert.ok(ids.size > 1, '不正な id を渡したら固定は解除されるはず');

  setForcedOniPersonality(null);
});
