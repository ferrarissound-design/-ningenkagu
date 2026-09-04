import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, evaluateMission } from '../../js/mission.js';

test('6ステージすべてにミッションがある', () => {
  assert.deepEqual(Object.keys(MISSIONS), ['living', 'classroom', 'artroom', 'library', 'scienceroom', 'electronics']);
});

test('リビング: 警戒度62%未満なら達成、62%到達は失敗', () => {
  assert.equal(evaluateMission('living', { maxSuspicion: 0.619 }, true).completed, true);
  assert.equal(evaluateMission('living', { maxSuspicion: 0.62 }, true).completed, false);
});

test('教室: 3種類以上の家具へ擬態で達成', () => {
  assert.equal(evaluateMission('classroom', { mimicKinds: new Set(['desk', 'chair']) }, true).completed, false);
  assert.equal(evaluateMission('classroom', { mimicKinds: new Set(['desk', 'chair', 'locker']) }, true).completed, true);
});

test('美術室: 消灯中の移動距離6m以上で達成', () => {
  assert.equal(evaluateMission('artroom', { blackoutDistance: 5.99 }, true).completed, false);
  assert.equal(evaluateMission('artroom', { blackoutDistance: 6 }, true).completed, true);
});

test('図書室: 足音警戒を一度も起こさなければ達成', () => {
  assert.equal(evaluateMission('library', { heardAlert: false }, true).completed, true);
  assert.equal(evaluateMission('library', { heardAlert: true }, true).completed, false);
});

test('理科室: 蒸気発生中の移動距離7m以上で達成', () => {
  assert.equal(evaluateMission('scienceroom', { steamDistance: 6.99 }, true).completed, false);
  assert.equal(evaluateMission('scienceroom', { steamDistance: 7 }, true).completed, true);
});

test('家電量販店: 展示デモ中の移動距離8m以上で達成', () => {
  assert.equal(evaluateMission('electronics', { retailRushDistance: 7.99 }, true).completed, false);
  assert.equal(evaluateMission('electronics', { retailRushDistance: 8 }, true).completed, true);
});

test('条件を満たしていても敗北時はミッション未達成', () => {
  assert.equal(evaluateMission('living', { maxSuspicion: 0 }, false).completed, false);
  assert.equal(evaluateMission('library', { heardAlert: false }, false).completed, false);
  assert.equal(evaluateMission('scienceroom', { steamDistance: 99 }, false).completed, false);
  assert.equal(evaluateMission('electronics', { retailRushDistance: 99 }, false).completed, false);
});
