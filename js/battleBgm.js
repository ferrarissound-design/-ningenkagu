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
    // 勝利・敗北など、かくれんぼが終わった画面では曲を止める。
    stopTrack(titleBgm);
    stopTrack(battleBgm);
  }

  lastState = state;
  lastMuted = muted;
}

// ブラウザが自動再生を許可している環境では、タイトル表示直後から曲を試す。
// iPhone / iPad などでブロックされた場合は、タイトル画面で最初に触れた瞬間に再試行する。
syncBgm();

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('button');
  const id = button?.id ?? '';
  const state = gameState();

  // ゲーム開始・リトライでは、タイトル曲を止めて戦闘曲を頭から流す。
  // main.js 側のボタン処理が先に走るため、この時点では state が playing になっている。
  if (id === 'btnStart' || id === 'btnRetry') {
    syncBgm({ restartBattle: state === 'playing' });
    return;
  }

  // ポーズ・再開・ミュート切替もクリック直後に音へ反映する。
  if (id === 'btnResume' || id === 'pauseBtn' || id === 'muteBtn' || id === 'btnSound') {
    syncBgm();
    return;
  }

  // 「あそびかた」「設定」「ステージ選択」など、タイトル画面での最初の操作で
  // 自動再生制限が解除されたらタイトルBGMを開始する。
  if (state === 'title') syncBgm();
});

// タイトル画面の余白タップでも、iOS の音声再生許可を取りにいく。
document.addEventListener('pointerup', () => {
  if (gameState() === 'title' && titleBgm.paused && !isMuted()) playTrack(titleBgm);
});

// キーボード操作でも開始・再開に追従する。
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code !== 'Escape' && event.code !== 'KeyP' && event.code !== 'Enter' && event.code !== 'Space') return;
  queueMicrotask(() => {
    const state = gameState();
    syncBgm({ restartBattle: (event.code === 'Enter' || event.code === 'Space') && state === 'playing' });
  });
});

document.addEventListener('visibilitychange', syncBgm);
window.addEventListener('blur', () => {
  pauseTrack(titleBgm);
  pauseTrack(battleBgm);
});

// 勝敗や自動ポーズなど、ゲームループ側で state が変わった場合にも追従する。
function frame() {
  const state = gameState();
  const muted = isMuted();
  if (state !== lastState || muted !== lastMuted) syncBgm();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
