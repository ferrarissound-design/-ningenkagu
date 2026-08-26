// 鬼とのかくれんぼ中だけ流す戦闘BGM。
// ゲーム本体の state を監視し、playing=再生 / paused=一時停止 / win・lose・title=停止 とする。
import { isMuted } from './audio.js';

const BGM_URL = new URL('../css/gold_medal_morning.mp3', import.meta.url).href;
const bgm = new Audio(BGM_URL);
bgm.loop = true;
bgm.preload = 'auto';
bgm.volume = 0.42;
bgm.setAttribute('playsinline', '');

let lastState = null;
let playAttempt = null;

function gameState() {
  return globalThis.__ningenkagu?.game?.state ?? 'title';
}

function playBgm({ restart = false } = {}) {
  if (isMuted()) {
    bgm.pause();
    return;
  }

  if (restart) {
    try { bgm.currentTime = 0; } catch (e) { /* 読み込み前でも続行 */ }
  }

  if (!bgm.paused) return;
  try {
    const p = bgm.play();
    if (p && typeof p.catch === 'function') {
      playAttempt = p;
      p.catch(() => {}).finally(() => {
        if (playAttempt === p) playAttempt = null;
      });
    }
  } catch (e) { /* BGMが鳴らなくてもゲームは続行 */ }
}

function pauseBgm() {
  bgm.pause();
}

function stopBgm() {
  bgm.pause();
  try { bgm.currentTime = 0; } catch (e) { /* noop */ }
}

function syncBgm() {
  const state = gameState();

  if (state === 'playing') {
    if (isMuted()) pauseBgm();
    else playBgm();
  } else if (state === 'paused') {
    pauseBgm();
  } else {
    stopBgm();
  }

  lastState = state;
}

// iPhone / iPad では音声再生にユーザー操作が必要なため、
// 開始・リトライ・再開・ミュート解除はクリックと同じタスク内で再生を試す。
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('button');
  if (!button) return;

  const id = button.id;
  if (id === 'btnStart' || id === 'btnRetry') {
    queueMicrotask(() => {
      if (gameState() === 'playing') playBgm({ restart: true });
      else syncBgm();
    });
    return;
  }

  if (id === 'btnResume' || id === 'pauseBtn' || id === 'muteBtn' || id === 'btnSound') {
    queueMicrotask(syncBgm);
  }
});

// キーボード操作でも、再開時の play() をユーザー操作中に試せるようにする。
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code !== 'Escape' && event.code !== 'KeyP' && event.code !== 'Enter' && event.code !== 'Space') return;
  queueMicrotask(syncBgm);
});

document.addEventListener('visibilitychange', syncBgm);
window.addEventListener('blur', pauseBgm);

// 勝敗や自動ポーズはゲームループ側で state が変わるため、軽量に追従する。
function frame() {
  const state = gameState();
  if (state !== lastState || (state === 'playing' && isMuted() !== bgm.paused)) {
    syncBgm();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
