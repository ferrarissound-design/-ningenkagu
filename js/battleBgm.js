// タイトル画面と鬼とのかくれんぼ中のBGMをまとめて管理する。
// title   = behind_the_potted_plant
// playing = gold_medal_morning
// paused  = 戦闘BGMを一時停止
// win/lose = 全BGM停止
import { isMuted } from './audio.js';

const TITLE_BGM_URL = new URL('../css/behind_the_potted_plant.mp3', import.meta.url).href;
const BATTLE_BGM_URL = new URL('../css/gold_medal_morning.mp3', import.meta.url).href;

function makeBgm(url, volume) {
  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = volume;
  audio.setAttribute('playsinline', '');
  return audio;
}

const titleBgm = makeBgm(TITLE_BGM_URL, 0.38);
const battleBgm = makeBgm(BATTLE_BGM_URL, 0.42);

let lastState = null;
let lastMuted = null;

function gameState() {
  return globalThis.__ningenkagu?.game?.state ?? 'title';
}

function playTrack(audio, { restart = false } = {}) {
  if (isMuted()) {
    audio.pause();
    return;
  }

  if (restart) {
    try { audio.currentTime = 0; } catch (e) { /* 読み込み前でも続行 */ }
  }

  if (!audio.paused) return;
  try {
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* BGMが鳴らなくてもゲームは続行 */ }
}

function pauseTrack(audio) {
  audio.pause();
}

function stopTrack(audio) {
  audio.pause();
  try { audio.currentTime = 0; } catch (e) { /* noop */ }
}

function syncBgm({ restartBattle = false } = {}) {
  const state = gameState();
  const muted = isMuted();

  if (muted) {
    pauseTrack(titleBgm);
    pauseTrack(battleBgm);
  } else if (state === 'title') {
    stopTrack(battleBgm);
    playTrack(titleBgm);
  } else if (state === 'playing') {
    stopTrack(titleBgm);
    playTrack(battleBgm, { restart: restartBattle });
  } else if (state === 'paused') {
    stopTrack(titleBgm);
    pauseTrack(battleBgm);
  } else {
    stopTrack(titleBgm);
    stopTrack(battleBgm);
  }

  lastState = state;
  lastMuted = muted;
}

// 自動再生が許可されているブラウザでは、タイトル表示直後から開始する。
syncBgm();

// iPhone / iPad は「ユーザー操作そのもの」の最中に play() を呼ばないと
// 音声開始を拒否することがある。main.js のボタン処理は stopPropagation() を使うため、
// バブリングを待たず capture 段階でタイトルBGMを解錠する。
function unlockTitleBgm() {
  if (gameState() !== 'title' || isMuted() || !titleBgm.paused) return;
  playTrack(titleBgm);
}

document.addEventListener('pointerdown', unlockTitleBgm, { capture: true, passive: true });
document.addEventListener('touchstart', unlockTitleBgm, { capture: true, passive: true });
document.addEventListener('mousedown', unlockTitleBgm, { capture: true, passive: true });

// ボタンの状態変更後は queueMicrotask で現在の game.state に合わせて曲を切り替える。
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('button');
  const id = button?.id ?? '';

  if (id === 'btnStart' || id === 'btnRetry') {
    queueMicrotask(() => syncBgm({ restartBattle: gameState() === 'playing' }));
    return;
  }

  if (id === 'btnResume' || id === 'pauseBtn' || id === 'muteBtn' || id === 'btnSound') {
    queueMicrotask(syncBgm);
    return;
  }

  if (gameState() === 'title') unlockTitleBgm();
}, true);

// キーボード操作でも、ユーザー操作中にタイトルBGMの解錠を試す。
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (gameState() === 'title') unlockTitleBgm();
  if (event.code !== 'Escape' && event.code !== 'KeyP' && event.code !== 'Enter' && event.code !== 'Space') return;
  queueMicrotask(() => {
    const state = gameState();
    syncBgm({ restartBattle: (event.code === 'Enter' || event.code === 'Space') && state === 'playing' });
  });
}, true);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncBgm();
});
window.addEventListener('blur', () => {
  pauseTrack(titleBgm);
  pauseTrack(battleBgm);
});

// 勝敗・自動ポーズなどゲームループ側で state が変わった場合にも追従する。
function frame() {
  const state = gameState();
  const muted = isMuted();
  if (state !== lastState || muted !== lastMuted) syncBgm();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
