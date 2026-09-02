// 進行データだけを安全に初期化するための小さな保存ユーティリティ。
// 音量・視点感度などの設定は残し、ベスト・ランク・ミッション・鬼攻略・到達ステージだけを消す。

export const PROGRESS_EXACT_KEYS = Object.freeze([
  'ningenkagu.best', // 旧バージョン互換
  'ningenkagu.stageIndex',
  'ningenkagu.completed',
]);

export const PROGRESS_PREFIXES = Object.freeze([
  'ningenkagu.best.',
  'ningenkagu.rank.',
  'ningenkagu.mission.',
  'ningenkagu.oniClear.',
]);

export function isProgressKey(key) {
  if (typeof key !== 'string') return false;
  return PROGRESS_EXACT_KEYS.includes(key)
    || PROGRESS_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * localStorage 互換オブジェクトから進行データだけを削除する。
 * 設定値まで消さないのが重要。削除したキー一覧を返すので、UIやテストでも確認できる。
 */
export function clearProgressData(storage = globalThis.localStorage) {
  if (!storage) return [];
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (isProgressKey(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys;
}
