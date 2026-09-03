import { FURNITURE_KINDS } from './furnitureKinds.js';

export const CATALOG_KEY = 'ningenkagu.catalog';
export const CATALOG_KIND_IDS = Object.freeze(Object.keys(FURNITURE_KINDS));
const CATALOG_KIND_SET = new Set(CATALOG_KIND_IDS);
let volatileCatalog = [];

function defaultStorage() {
  try { return globalThis.localStorage || null; }
  catch (error) { return null; }
}

function resolveStorage(storage) {
  return storage === undefined ? defaultStorage() : storage;
}

export function normalizeCatalogKinds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((kind) => typeof kind === 'string' && CATALOG_KIND_SET.has(kind)))];
}

export function loadCatalog(storage = undefined) {
  const resolved = resolveStorage(storage);
  if (!resolved) return [...volatileCatalog];
  try {
    const raw = resolved.getItem(CATALOG_KEY);
    if (!raw) return [];
    const discovered = normalizeCatalogKinds(JSON.parse(raw));
    volatileCatalog = discovered;
    return discovered;
  } catch (error) {
    return [...volatileCatalog];
  }
}

export function catalogProgress(storage = undefined) {
  const discovered = loadCatalog(storage);
  return {
    discovered,
    count: discovered.length,
    total: CATALOG_KIND_IDS.length,
    complete: discovered.length === CATALOG_KIND_IDS.length,
  };
}

export function discoverFurniture(kind, storage = undefined) {
  const resolved = resolveStorage(storage);
  const before = loadCatalog(resolved);
  if (!CATALOG_KIND_SET.has(kind)) {
    return {
      newlyDiscovered: false,
      discovered: before,
      count: before.length,
      total: CATALOG_KIND_IDS.length,
      complete: before.length === CATALOG_KIND_IDS.length,
    };
  }

  if (before.includes(kind)) {
    return {
      newlyDiscovered: false,
      discovered: before,
      count: before.length,
      total: CATALOG_KIND_IDS.length,
      complete: before.length === CATALOG_KIND_IDS.length,
    };
  }

  const discovered = [...before, kind];
  volatileCatalog = discovered;
  try {
    resolved?.setItem(CATALOG_KEY, JSON.stringify(discovered));
  } catch (error) {
    // 保存不能でもメモリ上では発見済みにし、同じプレイ中にNEW表示を連打しない。
  }

  return {
    newlyDiscovered: true,
    discovered,
    count: discovered.length,
    total: CATALOG_KIND_IDS.length,
    complete: discovered.length === CATALOG_KIND_IDS.length,
  };
}

export function catalogEntries(storage = undefined) {
  const discovered = new Set(loadCatalog(storage));
  return CATALOG_KIND_IDS.map((kind) => ({
    kind,
    discovered: discovered.has(kind),
    ...FURNITURE_KINDS[kind],
  }));
}
