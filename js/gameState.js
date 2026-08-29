// ゲームの状態（title / playing / paused / win / lose）を配る小さな通知口。
//
// BGM のようにゲーム本体の外側にいる担当が、毎フレームのポーリングや
// ボタンの id 判定に頼らず状態変化を受け取れるようにするためのもの。
// Game だけが setGameState() を呼び、それ以外は購読側に回る。

const listeners = new Set();

let current = 'title';   // 実際の状態（Game が変えた直後の値）
let notified = 'title';  // 最後に購読者へ伝えた状態
let flushQueued = false;

/**
 * 1回のクリックで「ステージを作り直して即開始」のように
 * 状態が連続で変わることがある（title を経由して playing へ）。
 * 途中経過を配ると BGM が一瞬鳴って止まるので、
 * マイクロタスクまでまとめてから最終状態だけを伝える。
 */
function flush() {
  flushQueued = false;
  if (current === notified) return;
  const prev = notified;
  notified = current;
  for (const fn of [...listeners]) {
    try {
      fn(current, prev);
    } catch (err) {
      console.error(err);
    }
  }
}

/** Game 専用。状態が変わったことを知らせる */
export function setGameState(next) {
  current = next;
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flush);
}

/** 今の状態（購読者の初期同期用） */
export function getGameState() {
  return current;
}

/**
 * 状態変化を購読する。コールバックは (next, prev) を受け取る。
 * 戻り値を呼ぶと購読を解除できる。
 */
export function onGameState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
