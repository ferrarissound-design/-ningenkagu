import test from 'node:test';
import assert from 'node:assert/strict';
import { ANOMALIES, AnomalyManager } from '../../js/anomalies.js';

const STAGES = ['living', 'classroom', 'artroom', 'library', 'scienceroom', 'electronics'];

test('every stage has multiple anomaly variants with real gameplay modifiers', () => {
  for (const stageId of STAGES) {
    const list = ANOMALIES[stageId];
    assert.ok(Array.isArray(list), stageId + ' has no anomaly list');
    assert.ok(list.length >= 2, stageId + ' needs multiple variants');
    for (const anomaly of list) {
      assert.ok(anomaly.id);
      assert.ok(anomaly.name);
      assert.ok(anomaly.duration > 0);
      assert.ok(Object.keys(anomaly.modifiers || {}).length > 0);
    }
  }
});

test('challenge rules can force two anomalies in one run', () => {
  const notices = [];
  const game = {
    state: 'playing',
    mode: 'normal',
    challengeRules: { anomalyCount: 2, anomalyChance: 1 },
    stage: { id: 'living' },
    timeLeft: 50,
    inspecting: false,
    stageEvent: { phase: 'idle' },
    hud: { eventNotice: (...args) => notices.push(args) },
  };
  const manager = new AnomalyManager(game);
  manager.timer = 0;
  assert.equal(manager.forceStart(), true);
  assert.equal(manager.info.count, 1);
  assert.ok(manager.info.active);
  assert.equal(manager.info.max, 2);
  assert.ok(notices.length > 0);

  manager.end();
  assert.equal(manager.info.active, null);
  assert.equal(manager.info.count, 1);
});

test('active anomaly exposes neutral defaults plus its modifiers', () => {
  const game = {
    state: 'playing',
    mode: 'normal',
    challengeRules: { anomalyCount: 1, anomalyChance: 1 },
    stage: { id: 'library' },
    timeLeft: 40,
    inspecting: false,
    stageEvent: { phase: 'idle' },
    hud: { eventNotice() {} },
  };
  const manager = new AnomalyManager(game);
  manager.pickSpec = () => ANOMALIES.library[0];
  assert.equal(manager.forceStart(), true);
  assert.equal(manager.info.modifiers.decayScale, 0.52);
  assert.equal(manager.info.modifiers.detectScale, 1);
});
