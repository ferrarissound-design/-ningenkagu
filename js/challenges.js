// ALL CLEAR後の条件付きチャレンジ。
// 既存の通常 / 鬼神モードとは別軸で、ルールを1つ選んで挑戦する。
export const CHALLENGES = Object.freeze({
  noDecoy: Object.freeze({
    id: 'noDecoy', icon: '🚫', name: 'おとり禁止',
    desc: 'おとり0回で60秒生存',
    rules: Object.freeze({ decoyUses: 0 }),
  }),
  oneMimic: Object.freeze({
    id: 'oneMimic', icon: '1️⃣', name: '一発変装',
    desc: '擬態は1回だけ。選んだ家具で最後まで耐える',
    rules: Object.freeze({ maxMimics: 1 }),
  }),
  noCrouch: Object.freeze({
    id: 'noCrouch', icon: '🧍', name: 'しゃがみ禁止',
    desc: 'しゃがみポーズを一度も使わずクリア',
    rules: Object.freeze({ forbidCrouch: true }),
  }),
  anomalyRush: Object.freeze({
    id: 'anomalyRush', icon: '👁', name: '異変ラッシュ',
    desc: '1戦で異変が2回必ず起こる',
    rules: Object.freeze({ anomalyCount: 2, anomalyChance: 1, detectScale: 1.04 }),
  }),
  dangerDance: Object.freeze({
    id: 'dangerDance', icon: '⚠', name: '危険地帯',
    desc: '警戒度75%以上を一度経験してからクリア',
    rules: Object.freeze({ requireMaxSuspicion: 0.75 }),
  }),
});

export const CHALLENGE_IDS = Object.freeze(Object.keys(CHALLENGES));
export const CHALLENGE_CLEAR_PREFIX = 'ningenkagu.challengeClear.';

export function normalizeChallengeId(id) {
  return id && CHALLENGES[id] ? id : null;
}

export function challengeRules(id) {
  const key = normalizeChallengeId(id);
  return key ? CHALLENGES[key].rules : Object.freeze({});
}

export function challengeClearKey(id) {
  return CHALLENGE_CLEAR_PREFIX + String(id || '');
}

export function loadChallengeClear(id, storage = globalThis.localStorage) {
  if (!CHALLENGES[id]) return false;
  try { return storage?.getItem(challengeClearKey(id)) === '1'; }
  catch (e) { return false; }
}

export function saveChallengeClear(id, storage = globalThis.localStorage) {
  if (!CHALLENGES[id]) return false;
  try {
    storage?.setItem(challengeClearKey(id), '1');
    return true;
  } catch (e) {
    return false;
  }
}

export function challengeProgress(storage = globalThis.localStorage) {
  const cleared = CHALLENGE_IDS.filter((id) => loadChallengeClear(id, storage));
  return {
    cleared,
    count: cleared.length,
    total: CHALLENGE_IDS.length,
    complete: cleared.length === CHALLENGE_IDS.length,
  };
}
