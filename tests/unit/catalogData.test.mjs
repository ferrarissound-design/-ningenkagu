import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG_KEY,
  CATALOG_KIND_IDS,
  catalogEntries,
  catalogProgress,
  discoverFurniture,
  loadCatalog,
  normalizeCatalogKinds,
} from '../../js/catalogData.js';

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

test('catalog normalizes unknown and duplicate kinds', () => {
  assert.deepEqual(
    normalizeCatalogKinds(['chair', 'chair', 'unknown', 123, 'table']),
    ['chair', 'table'],
  );
});

test('malformed catalog data safely falls back to empty', () => {
  const storage = new MemoryStorage({ [CATALOG_KEY]: '{broken' });
  assert.deepEqual(loadCatalog(storage), []);
  assert.equal(catalogProgress(storage).count, 0);
});

test('discoverFurniture records each kind only once', () => {
  const storage = new MemoryStorage();
  const first = discoverFurniture('chair', storage);
  const duplicate = discoverFurniture('chair', storage);

  assert.equal(first.newlyDiscovered, true);
  assert.equal(first.count, 1);
  assert.equal(duplicate.newlyDiscovered, false);
  assert.equal(duplicate.count, 1);
  assert.deepEqual(JSON.parse(storage.getItem(CATALOG_KEY)), ['chair']);
});

test('catalog reaches complete only after every furniture kind is discovered', () => {
  const storage = new MemoryStorage();
  for (const kind of CATALOG_KIND_IDS) discoverFurniture(kind, storage);

  const progress = catalogProgress(storage);
  assert.equal(progress.count, CATALOG_KIND_IDS.length);
  assert.equal(progress.complete, true);
  assert.ok(catalogEntries(storage).every((entry) => entry.discovered));
});
