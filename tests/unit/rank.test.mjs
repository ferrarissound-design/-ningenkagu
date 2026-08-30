import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankForResult, isBetterRank, isRank } from '../../js/rank.js';

test('敗北時はスコアに関係なくランクを付けない', () => {
  assert.equal(rankForResult(false, 99999), null);
});

test('クリア評価は C/B/A/S の境界値どおりに決まる', () => {
  assert.equal(rankForResult(true, 0), 'C');
  assert.equal(rankForResult(true, 799), 'C');
  assert.equal(rankForResult(true, 800), 'B');
  assert.equal(rankForResult(true, 1499), 'B');
  assert.equal(rankForResult(true, 1500), 'A');
  assert.equal(rankForResult(true, 2399), 'A');
  assert.equal(rankForResult(true, 2400), 'S');
  assert.equal(rankForResult(true, 99999), 'S');
});

test('不正なスコアでも勝利なら最低 C に収まる', () => {
  assert.equal(rankForResult(true, -100), 'C');
  assert.equal(rankForResult(true, Number.NaN), 'C');
});

test('ベストランクは上位評価だけで更新する', () => {
  assert.equal(isBetterRank('C', null), true);
  assert.equal(isBetterRank('B', 'C'), true);
  assert.equal(isBetterRank('A', 'B'), true);
  assert.equal(isBetterRank('S', 'A'), true);
  assert.equal(isBetterRank('A', 'S'), false);
  assert.equal(isBetterRank('B', 'B'), false);
  assert.equal(isBetterRank(null, 'C'), false);
});

test('保存値として認めるのは S/A/B/C だけ', () => {
  for (const rank of ['S', 'A', 'B', 'C']) assert.equal(isRank(rank), true);
  for (const rank of ['', null, 'D', 'SS']) assert.equal(isRank(rank), false);
});
