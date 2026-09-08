import test from 'node:test';
import assert from 'node:assert/strict';
import { objectiveProgress } from '../../js/objectives.js';
import { MISSIONS } from '../../js/mission.js';

function game(stageId, stats = {}, extra = {}) {
  return { stage: { id: stageId }, stats: { maxSuspicion: 0, mimicKinds: new Set(), ...stats }, ...extra };
}

test('all six mission thresholds agree with result evaluation', () => {
  const cases = [
    ['living', { maxSuspicion: .619 }, 'active'],
    ['living', { maxSuspicion: .62 }, 'failed'],
    ['library', { heardAlert: false }, 'active'],
    ['library', { heardAlert: true }, 'failed'],
    ['classroom', { mimicKinds: new Set(['desk', 'shelf']) }, 'active'],
    ['classroom', { mimicKinds: new Set(['desk', 'shelf', 'plant']) }, 'ready'],
    ['artroom', { blackoutDistance: 5.999 }, 'active'],
    ['artroom', { blackoutDistance: 6 }, 'ready'],
    ['scienceroom', { steamDistance: 7 }, 'ready'],
    ['electronics', { retailRushDistance: 8 }, 'ready'],
  ];
  for (const [id, stats, state] of cases) {
    const g = game(id, stats);
    assert.equal(objectiveProgress(g).state, state);
    if (state === 'ready') assert.equal(MISSIONS[id].check(g.stats), true);
    if (state === 'failed') assert.equal(MISSIONS[id].check(g.stats), false);
  }
  assert.match(objectiveProgress(game('artroom', { blackoutDistance: 5.999 })).detail, /5\.9 \/ 6m/);
});

test('danger challenge remembers crossing 75% and takes priority over mission failure', () => {
  const g = game('living', { maxSuspicion: .7499 }, { challengeId: 'dangerDance' });
  assert.equal(objectiveProgress(g).state, 'active');
  assert.match(objectiveProgress(g).detail, /74 \/ 75%/);
  g.stats.maxSuspicion = .75;
  assert.equal(objectiveProgress(g).state, 'ready');
});

test('limited mimic count and persistent failure are visible', () => {
  const g = game('living', {}, { challengeId: 'oneMimic', mimicUses: 1 });
  assert.match(objectiveProgress(g).detail, /あと0回/);
  g.challengeId = 'noCrouch';
  g.challengeFailed = true;
  g.challengeFailureReason = 'しゃがみポーズを使った';
  assert.equal(objectiveProgress(g).state, 'failed');
  assert.match(objectiveProgress(g).detail, /生存は続行可/);
});
