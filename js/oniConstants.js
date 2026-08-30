// 鬼の状態・当たり判定など、oni.js 本体と oniInspect.js の両方から参照する定数。
// 循環 import を避けるため、STATE / INSPECT はこの独立したファイルに置く。

export const STATE = {
  PATROL: 'patrol', LOOK: 'look', SUSPECT: 'suspect',
  INSPECT: 'inspect', FOUND: 'found',
  // ステージイベント中の一時的な行動（巡回より優先、FOUND より下）
  EVENT: 'event',
};

/**
 * ステージイベント中でも、これ以上あやしまれたら気を取られていられない。
 * ＝イベント中に鬼の目の前を走り抜ければ、ちゃんと気づかれる。
 */
export const EVENT_BREAK_SUSPICION = 0.7;

/** 家具検査モード（INSPECT）の調整値 */
export const INSPECT = {
  chance: 0.42,          // SUSPECT に入ったとき検査へ移行する確率
  startDist: 3.2,        // この距離まで詰めてから検査を始める
  startStare: 0.7,       // SUSPECT でこれだけ見つめてから検査へ
  cooldownMin: 9.0,      // 検査後クールダウン（連続で起きないように）
  cooldownMax: 14.0,
  firstDelay: 6.0,       // 開始直後は検査しない
  extraActChance: 0.6,   // 接近のあと、もう1つ動作を足す確率
  approachSpeed: 1.35,
  flankSpeed: 1.55,
};

export const ONI_RADIUS = 0.42;
export const PATH_CLEARANCE = ONI_RADIUS;
