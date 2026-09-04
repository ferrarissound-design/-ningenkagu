// ゲーム本体と追加機能を疎結合につなぐ小さなイベントチャンネル。
//
// 図鑑・実績・将来のチャレンジ機能などが Game.prototype を後付けで
// 差し替えずにゲーム内アクションを購読できるようにする。

export const GAME_EVENT = Object.freeze({
  MIMIC: 'mimic',
});

const listeners = new Map();

export function onGameEvent(type, listener) {
  if (typeof type !== 'string' || !type || typeof listener !== 'function') {
    return () => {};
  }
  let bucket = listeners.get(type);
  if (!bucket) {
    bucket = new Set();
    listeners.set(type, bucket);
  }
  bucket.add(listener);

  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) listeners.delete(type);
  };
}

/**
 * 購読側の不具合でゲーム本体まで止まらないことを優先する。
 * 1つのリスナーが失敗しても、残りのリスナーには通知を続ける。
 */
export function emitGameEvent(type, detail) {
  const bucket = listeners.get(type);
  if (!bucket || bucket.size === 0) return 0;

  let called = 0;
  for (const listener of [...bucket]) {
    try {
      listener(detail);
    } catch (error) {
      console.error('game event listener failed:', type, error);
    }
    called++;
  }
  return called;
}
