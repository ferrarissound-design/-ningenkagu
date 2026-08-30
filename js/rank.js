// クリア評価ランク。
// 敗北時はランクを付けず、60秒生存したプレイだけを S/A/B/C で評価する。

export const RANK_THRESHOLDS = Object.freeze([
  { rank: 'S', minScore: 2400 },
  { rank: 'A', minScore: 1500 },
  { rank: 'B', minScore: 800 },
  { rank: 'C', minScore: 0 },
]);

const RANK_VALUE = Object.freeze({ C: 1, B: 2, A: 3, S: 4 });

/** 勝利時のスコアから S/A/B/C を返す。敗北は null。 */
export function rankForResult(win, score) {
  if (!win) return null;
  const value = Number.isFinite(score) ? Math.max(0, score) : 0;
  for (const r of RANK_THRESHOLDS) {
    if (value >= r.minScore) return r.rank;
  }
  return 'C';
}

/** next が current より上位なら true。未記録(null)より C は上位。 */
export function isBetterRank(next, current) {
  if (!next || !RANK_VALUE[next]) return false;
  return RANK_VALUE[next] > (RANK_VALUE[current] || 0);
}

export function isRank(value) {
  return !!RANK_VALUE[value];
}
