// タイトル画面と鬼とのかくれんぼ中のBGMをまとめて管理する。
// title   = behind_the_potted_plant
// playing = gold_medal_morning
// paused  = 戦闘BGMを一時停止
// win/lose = 全BGM停止
//
// 状態はゲーム本体（gameState）と音設定（audio）の通知を購読して受け取る。
// ボタンの id やキーコードは一切見ないので、UI を作り替えても壊れない。
import { isMuted, onMuteChange, getBgmVolume, onBgmVolumeChange } from './audio.js';
import { getGameState, onGameState } from './gameState.js';
import './opening.js';
import './catalog.js';
import './titleMenu.js';
import './missionUi.js';
import './appShell.js';
import './completionUi.js';
import './masteryUi.js';

const TITLE_BGM_URL = new URL('../assets/audio/behind_the_potted_plant.mp3', import.meta.url).href;
const BATTLE_BGM_URL = new URL('../assets/audio/gold_medal_morning.mp3', import.meta.url).href;

// 曲ごとの基準音量。実際に鳴る音量はこれに設定のBGM音量（0..1）を掛けたもの。
const TITLE_BASE_VOLUME = 0.38;
const BATTLE_BASE_VOLUME = 0.42;

function makeBgm(url, baseVolume, autoplay = false) {
  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';
  audio.autoplay = autoplay;
  audio.volume = baseVolume * getBgmVolume();
  audio.setAttribute('playsinline', '');
  if (autoplay) audio.setAttribute('autoplay', '');
  audio.load();
  return audio;
}

// タイトル曲はページ読み込み直後からブラウザ標準の autoplay も使って開始を試す。
const titleBgm = makeBgm(TITLE_BGM_URL, TITLE_BASE_VOLUME, true);
const battleBgm = makeBgm(BATTLE_BGM_URL, BATTLE_BASE_VOLUME, false);

// 設定の BGM 音量スライダーが動くたびに、鳴っている曲へ即反映する。
onBgmVolumeChange(() => {
  const v = getBgmVolume();
  titleBgm.volume = TITLE_BASE_VOLUME * v;
  battleBgm.volume = BATTLE_BASE_VOLUME * v;
});

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
  const state = getGameState();

  if (isMuted()) {
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
}

// ポーズからの再開は曲の続きから。それ以外（開始・リトライ・次のステージ）は頭出しする。
onGameState((state, prev) => {
  syncBgm({ restartBattle: state === 'playing' && prev !== 'paused' });
});

onMuteChange(() => syncBgm());

// ボタン操作を待たず、ページを開いた時点でタイトルBGMの再生を試す。
// 音源の読み込みが少し遅い端末向けに短時間だけ自動リトライする。
function startTitleAutomatically() {
  if (getGameState() !== 'title' || isMuted() || !titleBgm.paused) return;
  playTrack(titleBgm);
}

titleBgm.addEventListener('loadeddata', startTitleAutomatically);
titleBgm.addEventListener('canplay', startTitleAutomatically);
window.addEventListener('pageshow', startTitleAutomatically);
window.addEventListener('focus', startTitleAutomatically);
document.addEventListener('DOMContentLoaded', startTitleAutomatically);

let retries = 0;
function retryTitleAutoplay() {
  if (getGameState() !== 'title' || isMuted() || !titleBgm.paused || retries >= 12) return;
  retries++;
  startTitleAutomatically();
  window.setTimeout(retryTitleAutoplay, 350);
}
window.setTimeout(retryTitleAutoplay, 120);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    syncBgm();
    startTitleAutomatically();
  }
});

// タブを離れたときは、ゲームが自動ポーズされない画面（タイトル等）でも曲を止める。
window.addEventListener('blur', () => {
  pauseTrack(titleBgm);
  pauseTrack(battleBgm);
});

// main.js が保存済みの音設定を反映したあとに読み込まれるので、ここで初期同期する。
syncBgm();
startTitleAutomatically();