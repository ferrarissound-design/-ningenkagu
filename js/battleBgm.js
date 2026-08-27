// タイトル画面と鬼とのかくれんぼ中のBGMをまとめて管理する。
// title   = behind_the_potted_plant
// playing = gold_medal_morning
// paused  = 戦闘BGMを一時停止
// win/lose = 全BGM停止
import { isMuted } from './audio.js';
import './titleMenu.js';

const TITLE_BGM_URL = new URL('../css/behind_the_potted_plant.mp3', import.meta.url).href;
const BATTLE_BGM_URL = new URL('../css/gold_medal_morning.mp3', import.meta.url).href;

function makeBgm(url, volume, autoplay = false) {
  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';
  audio.autoplay = autoplay;
  audio.volume = volume;
  audio.setAttribute('playsinline', '');
  if (autoplay) audio.setAttribute('autoplay', '');
  audio.load();
  return audio;
}

// タイトル曲はページ読み込み直後からブラウザ標準の autoplay も使って開始を試す。
const titleBgm = makeBgm(TITLE_BGM_URL, 0.38, true);
const battleBgm = makeBgm(BATTLE_BGM_URL, 0.42, false);

let lastState = null;
let lastMuted = null;
let titleRetryTimer = 0;

function gameState() {
  return globalThis.__ningenkagu?.game?.state ?? 'title';
}

function playTrack(audio, { restart = false } = {}) {
  if (isMuted()) {
    audio.pause();
    return Promise.resolve(false);
  }

  if (restart) {
    try { audio.currentTime = 0; } catch (e) { /* 読み込み前でも続行 */ }
  }

  if (!audio.paused) return Promise.resolve(true);
  try {
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      return p.then(() => true).catch(() => false);
    }
    return Promise.resolve(true);
  } catch (e) {
    return Promise.resolve(false);
  }
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

// ボタン操作を待たず、ページを開いた時点でタイトルBGMの再生を試す。
// 音源の読み込みが少し遅い端末向けに短時間だけ自動リトライする。
function startTitleAutomatically() {
  if (gameState() !== 'title' || isMuted() || !titleBgm.paused) return;
  playTrack(titleBgm);
}

startTitleAutomatically();
titleBgm.addEventListener('loadeddata', startTitleAutomatically);
titleBgm.addEventListener('canplay', startTitleAutomatically);
window.addEventListener('pageshow', startTitleAutomatically);
window.addEventListener('focus', startTitleAutomatically);
document.addEventListener('DOMContentLoaded', startTitleAutomatically);

let retries = 0;
function retryTitleAutoplay() {
  if (gameState() !== 'title' || isMuted() || !titleBgm.paused || retries >= 12) return;
  retries++;
  startTitleAutomatically();
  titleRetryTimer = window.setTimeout(retryTitleAutoplay, 350);
}
titleRetryTimer = window.setTimeout(retryTitleAutoplay, 120);

// ゲーム開始後はタイトル曲を止め、戦闘曲へ切り替える。
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('button');
  const id = button?.id ?? '';

  if (id === 'btnStart' || id === 'btnRetry') {
    queueMicrotask(() => syncBgm({ restartBattle: gameState() === 'playing' }));
    return;
  }

  if (id === 'btnResume' || id === 'pauseBtn' || id === 'muteBtn' || id === 'btnSound') {
    queueMicrotask(syncBgm);
  }
}, true);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code !== 'Escape' && event.code !== 'KeyP' && event.code !== 'Enter' && event.code !== 'Space') return;
  queueMicrotask(() => {
    const state = gameState();
    syncBgm({ restartBattle: (event.code === 'Enter' || event.code === 'Space') && state === 'playing' });
  });
}, true);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    syncBgm();
    startTitleAutomatically();
  }
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
