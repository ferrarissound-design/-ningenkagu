import { FURNITURE_KINDS } from './furnitureKinds.js';

export const CATALOG_KEY = 'ningenkagu.catalog';

export const CATALOG_NAMES = Object.freeze({
  wall: '壁',
  shelf: '棚・書架',
  table: 'テーブル・机',
  plant: '観葉植物',
  sofa: 'ソファ',
  chair: 'イス',
  box: '箱・収納',
  bin: 'ゴミ箱',
  statue: '像・石膏像',
  easel: 'イーゼル',
});

export const CATALOG_KIND_IDS = Object.freeze(Object.keys(FURNITURE_KINDS));
const CATALOG_KIND_SET = new Set(CATALOG_KIND_IDS);

export function normalizeCatalogKinds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((kind) => typeof kind === 'string' && CATALOG_KIND_SET.has(kind)))];
}

export function loadCatalog(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CATALOG_KEY);
    if (!raw) return [];
    return normalizeCatalogKinds(JSON.parse(raw));
  } catch (error) {
    return [];
  }
}

export function catalogProgress(storage = globalThis.localStorage) {
  const discovered = loadCatalog(storage);
  return {
    discovered,
    count: discovered.length,
    total: CATALOG_KIND_IDS.length,
    complete: discovered.length === CATALOG_KIND_IDS.length,
  };
}

export function discoverFurniture(kind, storage = globalThis.localStorage) {
  const before = loadCatalog(storage);
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
  try {
    storage?.setItem(CATALOG_KEY, JSON.stringify(discovered));
  } catch (error) {
    // 保存不能でもゲーム本体は止めない。今回のプレイ中の発見演出だけは出せる。
  }

  return {
    newlyDiscovered: true,
    discovered,
    count: discovered.length,
    total: CATALOG_KIND_IDS.length,
    complete: discovered.length === CATALOG_KIND_IDS.length,
  };
}

export function catalogEntries(storage = globalThis.localStorage) {
  const discovered = new Set(loadCatalog(storage));
  return CATALOG_KIND_IDS.map((kind) => ({
    kind,
    discovered: discovered.has(kind),
    catalogName: CATALOG_NAMES[kind] || kind,
    ...FURNITURE_KINDS[kind],
  }));
}
