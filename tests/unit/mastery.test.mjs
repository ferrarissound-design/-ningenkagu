import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMasterySnapshot, nextMasteryTarget } from '../../js/mastery.js';

const STAGES = ['living', 'classroom'];
const ONIS = ['watcher', 'charger'];

function snapshot({ ranks = {}, missions = {}, oni = {}, allClear = false } = {}) {
  return buildMasterySnapshot(STAGES, ONIS, {
    loadRank: (stageId) => ranks[stageId] || null,
    loadMission: (stageId) => !!missions[stageId],
    loadOniClear: (stageId, oniId) => !!oni[`${stageId}.${oniId}`],
    loadAllClear: () => allClear,
  });
}

test('mastery total is derived from stage and oni counts', () => {
  const result = snapshot();
  // 2 S ranks + 2 missions + 2x2 oni clears + 1 all clear
  assert.equal(result.total, 9);
  assert.equal(result.earned, 0);
  assert.equal(result.complete, false);
  assert.deepEqual(result.groups, {
    sRank: { earned: 0, total: 2 },
    mission: { earned: 0, total: 2 },
    oni: { earned: 0, total: 4 },
    allClear: { earned: 0, total: 1 },
  });
});

test('all crowns produce MASTER CLEAR state', () => {
  const result = snapshot({
    ranks: { living: 'S', classroom: 'S' },
    missions: { living: true, classroom: true },
    oni: {
      'living.watcher': true,
      'living.charger': true,
      'classroom.watcher': true,
      'classroom.charger': true,
    },
    allClear: true,
  });

  assert.equal(result.earned, 9);
  assert.equal(result.complete, true);
  assert.deepEqual(result.missing.sRanks, []);
  assert.deepEqual(result.missing.missions, []);
  assert.deepEqual(result.missing.oniClears, []);
  assert.equal(result.missing.allClear, false);
  assert.equal(nextMasteryTarget(result), null);
});

test('next target prioritizes story clear, then S, mission, oni clear', () => {
  let result = snapshot();
  assert.deepEqual(nextMasteryTarget(result), { type: 'allClear' });

  result = snapshot({ allClear: true });
  assert.deepEqual(nextMasteryTarget(result), { type: 'sRank', stageId: 'living' });

  result = snapshot({
    allClear: true,
    ranks: { living: 'S', classroom: 'S' },
  });
  assert.deepEqual(nextMasteryTarget(result), { type: 'mission', stageId: 'living' });

  result = snapshot({
    allClear: true,
    ranks: { living: 'S', classroom: 'S' },
    missions: { living: true, classroom: true },
  });
  assert.deepEqual(nextMasteryTarget(result), { type: 'oni', stageId: 'living', oniId: 'watcher' });
});

test('duplicate ids do not inflate mastery totals', () => {
  const result = buildMasterySnapshot(['living', 'living'], ['watcher', 'watcher'], {
    loadRank: () => 'S',
    loadMission: () => true,
    loadOniClear: () => true,
    loadAllClear: () => true,
  });

  assert.equal(result.total, 4);
  assert.equal(result.earned, 4);
  assert.equal(result.complete, true);
});
