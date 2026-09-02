import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETION_KEY, isFinalStage, loadCompleted, saveCompleted } from '../../js/completionUi.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
}

test('only the registered final stage triggers all-clear completion', () => {
  assert.equal(isFinalStage('scienceroom'), true);
  assert.equal(isFinalStage('library'), false);
  assert.equal(isFinalStage('living'), false);
  assert.equal(isFinalStage('missing'), false);
});

test('completion flag persists as a simple backward-compatible storage key', () => {
  const storage = new MemoryStorage();
  assert.equal(loadCompleted(storage), false);
  assert.equal(saveCompleted(storage), true);
  assert.equal(storage.getItem(COMPLETION_KEY), '1');
  assert.equal(loadCompleted(storage), true);
});
