import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGES,
  CHALLENGE_IDS,
  challengeProgress,
  challengeRules,
  loadChallengeClear,
  normalizeChallengeId,
  saveChallengeClear,
} from '../../js/challenges.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
}

test('five distinct challenge rules are registered', () => {
  assert.equal(CHALLENGE_IDS.length, 5);
  assert.equal(new Set(CHALLENGE_IDS).size, 5);
  assert.equal(challengeRules('noDecoy').decoyUses, 0);
  assert.equal(challengeRules('oneMimic').maxMimics, 1);
  assert.equal(challengeRules('noCrouch').forbidCrouch, true);
  assert.equal(challengeRules('anomalyRush').anomalyCount, 2);
  assert.equal(challengeRules('dangerDance').requireMaxSuspicion, 0.75);
  assert.equal(normalizeChallengeId('missing'), null);
});

test('challenge progress reaches master only after all conditions are cleared', () => {
  const storage = new MemoryStorage();
  assert.equal(challengeProgress(storage).count, 0);

  for (const id of CHALLENGE_IDS) {
    assert.equal(saveChallengeClear(id, storage), true);
    assert.equal(loadChallengeClear(id, storage), true);
  }

  const progress = challengeProgress(storage);
  assert.equal(progress.count, CHALLENGE_IDS.length);
  assert.equal(progress.complete, true);
  assert.deepEqual(progress.cleared, CHALLENGE_IDS);
});

test('every challenge has player-facing metadata', () => {
  for (const id of CHALLENGE_IDS) {
    const def = CHALLENGES[id];
    assert.ok(def.icon);
    assert.ok(def.name);
    assert.ok(def.desc);
  }
});
