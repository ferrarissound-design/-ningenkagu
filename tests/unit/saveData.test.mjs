import test from 'node:test';
import assert from 'node:assert/strict';
import { clearProgressData, isProgressKey } from '../../js/saveData.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test('progress key classifier covers every saved progression family', () => {
  assert.equal(isProgressKey('ningenkagu.stageIndex'), true);
  assert.equal(isProgressKey('ningenkagu.best.living'), true);
  assert.equal(isProgressKey('ningenkagu.rank.library'), true);
  assert.equal(isProgressKey('ningenkagu.mission.artroom'), true);
  assert.equal(isProgressKey('ningenkagu.oniClear.living.watcher'), true);
  assert.equal(isProgressKey('ningenkagu.bgmVolume'), false);
  assert.equal(isProgressKey('ningenkagu.lookSensitivity'), false);
});

test('clearProgressData removes progression but preserves player settings', () => {
  const storage = new MemoryStorage({
    'ningenkagu.stageIndex': '4',
    'ningenkagu.best.living': '1234',
    'ningenkagu.rank.living': 'S',
    'ningenkagu.mission.living': '1',
    'ningenkagu.oniClear.living.watcher': '1',
    'ningenkagu.muted': '1',
    'ningenkagu.bgmVolume': '40',
    'ningenkagu.sfxVolume': '70',
    'ningenkagu.lookSensitivity': '130',
    'ningenkagu.invertY': '1',
  });

  const removed = clearProgressData(storage);
  assert.equal(removed.length, 5);
  assert.equal(storage.getItem('ningenkagu.stageIndex'), null);
  assert.equal(storage.getItem('ningenkagu.best.living'), null);
  assert.equal(storage.getItem('ningenkagu.rank.living'), null);
  assert.equal(storage.getItem('ningenkagu.mission.living'), null);
  assert.equal(storage.getItem('ningenkagu.oniClear.living.watcher'), null);

  assert.equal(storage.getItem('ningenkagu.muted'), '1');
  assert.equal(storage.getItem('ningenkagu.bgmVolume'), '40');
  assert.equal(storage.getItem('ningenkagu.sfxVolume'), '70');
  assert.equal(storage.getItem('ningenkagu.lookSensitivity'), '130');
  assert.equal(storage.getItem('ningenkagu.invertY'), '1');
});
