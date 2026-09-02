import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSaveData, buildSaveFile, parseSaveFile, applySaveEntries } from '../../js/saveTransfer.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test('collectSaveData only gathers ningenkagu.* keys, ignoring unrelated storage', () => {
  const storage = new MemoryStorage({
    'ningenkagu.best.living': '1234',
    'ningenkagu.rank.living': 'S',
    'someOtherApp.token': 'secret',
  });
  const data = collectSaveData(storage);
  assert.deepEqual(data, {
    'ningenkagu.best.living': '1234',
    'ningenkagu.rank.living': 'S',
  });
});

test('buildSaveFile wraps the collected data with app id, version and timestamp', () => {
  const storage = new MemoryStorage({ 'ningenkagu.completed': '1' });
  const now = new Date('2026-09-02T00:00:00.000Z');
  const file = buildSaveFile(storage, now);
  assert.equal(file.app, 'ningenkagu');
  assert.equal(typeof file.version, 'number');
  assert.equal(file.exportedAt, '2026-09-02T00:00:00.000Z');
  assert.deepEqual(file.data, { 'ningenkagu.completed': '1' });
});

test('parseSaveFile round-trips a file produced by buildSaveFile', () => {
  const storage = new MemoryStorage({
    'ningenkagu.stageIndex': '4',
    'ningenkagu.rank.living': 'S',
  });
  const file = buildSaveFile(storage);
  const result = parseSaveFile(JSON.stringify(file));
  assert.equal(result.ok, true);
  assert.deepEqual(new Map(result.entries), new Map([
    ['ningenkagu.stageIndex', '4'],
    ['ningenkagu.rank.living', 'S'],
  ]));
});

test('parseSaveFile rejects invalid JSON', () => {
  const result = parseSaveFile('{not json');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'json');
});

test('parseSaveFile rejects a file from a different app', () => {
  const result = parseSaveFile(JSON.stringify({ app: 'someOtherApp', data: { 'ningenkagu.completed': '1' } }));
  assert.equal(result.ok, false);
  assert.equal(result.error, 'format');
});

test('parseSaveFile rejects a file with no ningenkagu keys', () => {
  const result = parseSaveFile(JSON.stringify({ app: 'ningenkagu', data: { 'other.key': '1' } }));
  assert.equal(result.ok, false);
  assert.equal(result.error, 'empty');
});

test('parseSaveFile drops non-string values and foreign keys mixed into data', () => {
  const result = parseSaveFile(JSON.stringify({
    app: 'ningenkagu',
    data: {
      'ningenkagu.stageIndex': '4',
      'ningenkagu.bad': 123,
      'notNingenkagu.key': 'x',
    },
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries, [['ningenkagu.stageIndex', '4']]);
});

test('applySaveEntries writes every entry and reports the count written', () => {
  const storage = new MemoryStorage();
  const written = applySaveEntries([
    ['ningenkagu.stageIndex', '4'],
    ['ningenkagu.rank.living', 'S'],
  ], storage);
  assert.equal(written, 2);
  assert.equal(storage.getItem('ningenkagu.stageIndex'), '4');
  assert.equal(storage.getItem('ningenkagu.rank.living'), 'S');
});

test('applySaveEntries is a no-op without a storage or entries', () => {
  assert.equal(applySaveEntries([['a', 'b']], null), 0);
  assert.equal(applySaveEntries(null, new MemoryStorage()), 0);
});
