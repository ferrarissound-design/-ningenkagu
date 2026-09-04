// 通常プレイとALL CLEAR後の高難度「鬼神モード」をまとめる純粋ロジック。
//
// UIやDOMには触れず、Game は mode id を受け取ってルールだけ参照する。
// 鬼神クリア記録もここでキーを一元管理し、タイトル表示側とテストで共有する。

export const GAME_MODE = Object.freeze({
  NORMAL: 'normal',
  KISHIN: 'kishin',
});

export const GAME_MODE_RULES = Object.freeze({
  [GAME_MODE.NORMAL]: Object.freeze({
    id: GAME_MODE.NORMAL,
    name: '通常',
    icon: '🎲',
    detectScale: 1,
    suspicionDecayScale: 1,
    noiseScale: 1,
    decoyUses: 2,
    personalityShiftAt: Object.freeze([]),
  }),
  [GAME_MODE.KISHIN]: Object.freeze({
    id: GAME_MODE.KISHIN,
    name: '鬼神',
    icon: '🔥',
    detectScale: 1.12,
    suspicionDecayScale: 0.78,
    noiseScale: 1.12,
    decoyUses: 1,
    // 60秒の1戦で 3人格を全部体験する。残り40秒 / 20秒で変貌。
    personalityShiftAt: Object.freeze([40, 20]),
  }),
});

export const KISHIN_CLEAR_PREFIX = 'ningenkagu.kishinClear.';

export function normalizeGameMode(id) {
  return GAME_MODE_RULES[id] ? id : GAME_MODE.NORMAL;
}

export function gameModeRules(id) {
  return GAME_MODE_RULES[normalizeGameMode(id)];
}

export function kishinClearKey(stageId) {
  return KISHIN_CLEAR_PREFIX + String(stageId || '');
}

export function loadKishinClear(stageId, storage = globalThis.localStorage) {
  if (!stageId) return false;
  try { return storage?.getItem(kishinClearKey(stageId)) === '1'; }
  catch (e) { return false; }
}

export function saveKishinClear(stageId, storage = globalThis.localStorage) {
  if (!stageId) return false;
  try {
    storage?.setItem(kishinClearKey(stageId), '1');
    return true;
  } catch (e) {
    return false;
  }
}

export function kishinProgress(stageIds, storage = globalThis.localStorage) {
  const stages = [...new Set((stageIds || []).filter((id) => typeof id === 'string' && id))];
  const cleared = stages.filter((stageId) => loadKishinClear(stageId, storage));
  return {
    cleared,
    count: cleared.length,
    total: stages.length,
    complete: stages.length > 0 && cleared.length === stages.length,
  };
}
