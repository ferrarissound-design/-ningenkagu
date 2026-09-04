import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETION_KEY, EXPANSION_COMPLETION_KEY, isFinalStage, loadCompleted, loadExpansionCompleted, saveCompleted, saveExpansionCompleted } from '../../js/completionUi.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
}

test('only the expansion final stage triggers full all-clear completion', () => {
  assert.equal(isFinalStage('electronics'), true);
  assert.equal(isFinalStage('scienceroom'), false);
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


test('six-stage completion preserves the backward-compatible classic flag', () => {
  const storage = new MemoryStorage();
  assert.equal(loadExpansionCompleted(storage), false);
  assert.equal(saveExpansionCompleted(storage), true);
  assert.equal(storage.getItem(COMPLETION_KEY), '1');
  assert.equal(storage.getItem(EXPANSION_COMPLETION_KEY), '1');
  assert.equal(loadCompleted(storage), true);
  assert.equal(loadExpansionCompleted(storage), true);
});
