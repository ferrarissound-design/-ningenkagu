import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_MODE,
  gameModeRules,
  kishinProgress,
  loadKishinClear,
  normalizeGameMode,
  saveKishinClear,
} from '../../js/gameModes.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test('unknown game modes fall back to normal', () => {
  assert.equal(normalizeGameMode('broken'), GAME_MODE.NORMAL);
  assert.equal(gameModeRules('broken').id, GAME_MODE.NORMAL);
});

test('Kishin mode is tougher and has exactly two personality shifts', () => {
  const normal = gameModeRules(GAME_MODE.NORMAL);
  const kishin = gameModeRules(GAME_MODE.KISHIN);

  assert.ok(kishin.detectScale > normal.detectScale);
  assert.ok(kishin.suspicionDecayScale < normal.suspicionDecayScale);
  assert.ok(kishin.noiseScale > normal.noiseScale);
  assert.equal(kishin.decoyUses, 1);
  assert.deepEqual(kishin.personalityShiftAt, [40, 20]);
});

test('Kishin clears are recorded once per stage and complete at all stages', () => {
  const storage = new MemoryStorage();
  const stages = ['living', 'classroom', 'artroom', 'library', 'scienceroom'];

  assert.equal(loadKishinClear('living', storage), false);
  assert.equal(saveKishinClear('living', storage), true);
  assert.equal(loadKishinClear('living', storage), true);
  assert.equal(kishinProgress(stages, storage).count, 1);

  for (const stage of stages) saveKishinClear(stage, storage);
  const progress = kishinProgress(stages, storage);
  assert.equal(progress.count, 5);
  assert.equal(progress.total, 5);
  assert.equal(progress.complete, true);
});
