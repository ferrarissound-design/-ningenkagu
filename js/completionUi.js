// 最終ステージを突破したときの「作品としての終わり」を担当する。
// 通常のステージ進行には触れず、ALL CLEAR 表示と制覇済みバッジだけを足す。
import { onGameState, getGameState } from './gameState.js';
import { STAGE_DEFINITIONS } from './stageRegistry.js';
import { GAME_MODE } from './gameModes.js';

export const COMPLETION_KEY = 'ningenkagu.completed';
export const EXPANSION_COMPLETION_KEY = 'ningenkagu.completed6';
const CLASSIC_FINAL_STAGE = STAGE_DEFINITIONS[4] || STAGE_DEFINITIONS[STAGE_DEFINITIONS.length - 1];
const FINAL_STAGE = STAGE_DEFINITIONS[STAGE_DEFINITIONS.length - 1];

export function isFinalStage(stageId) {
  return !!FINAL_STAGE && stageId === FINAL_STAGE.id;
}

export function loadCompleted(storage = globalThis.localStorage) {
  try { return storage?.getItem(COMPLETION_KEY) === '1'; }
  catch (e) { return false; }
}

export function saveCompleted(storage = globalThis.localStorage) {
  try {
    storage?.setItem(COMPLETION_KEY, '1');
    return true;
  } catch (e) {
    return false;
  }
}

export function loadExpansionCompleted(storage = globalThis.localStorage) {
  try { return storage?.getItem(EXPANSION_COMPLETION_KEY) === '1'; }
  catch (e) { return false; }
}

export function saveExpansionCompleted(storage = globalThis.localStorage) {
  try {
    storage?.setItem(COMPLETION_KEY, '1');
    storage?.setItem(EXPANSION_COMPLETION_KEY, '1');
    return true;
  } catch (e) {
    return false;
  }
}

function ensureTitleBadge() {
  const card = document.getElementById('cardInfo');
  if (!card) return null;
  let badge = document.getElementById('allClearBadge');
  if (!badge) {
    badge = document.createElement('p');
    badge.id = 'allClearBadge';
    badge.className = 'tcard-p';
    card.appendChild(badge);
  }
  return badge;
}

function syncTitleBadge() {
  if (!loadCompleted()) return;
  const badge = ensureTitleBadge();
  if (!badge) return;
  if (loadExpansionCompleted()) {
    badge.textContent = `🏆 全${STAGE_DEFINITIONS.length}ステージ制覇済み`;
    badge.setAttribute('aria-label', `全${STAGE_DEFINITIONS.length}ステージ制覇済み`);
  } else {
    badge.textContent = '🏆 クラシック5ステージ制覇済み　STAGE 6 解放';
    badge.setAttribute('aria-label', 'クラシック5ステージ制覇済み。STAGE 6が解放されています');
  }
}

function showFinalClear() {
  const app = window.__ningenkagu;
  const stageId = app?.game?.stage?.id;
  if (app?.game?.mode === GAME_MODE.KISHIN || app?.game?.challengeId) return false;

  const title = document.getElementById('resultTitle');
  const note = document.getElementById('resultNote');

  // STAGE 5は従来の5面制覇として残す。ここで既存の特訓・鬼神・26冠を解放する。
  if (CLASSIC_FINAL_STAGE && stageId === CLASSIC_FINAL_STAGE.id && !isFinalStage(stageId)) {
    saveCompleted();
    if (title) {
      title.textContent = 'CLASSIC CLEAR!';
      title.classList.add('win');
    }
    if (note) note.textContent = '🏆 クラシック5ステージ制覇！ STAGE 6「深夜の家電量販店」が解放された。';
    syncTitleBadge();
    return true;
  }

  if (!isFinalStage(stageId)) return false;
  saveExpansionCompleted();

  if (title) {
    title.textContent = 'ALL CLEAR!';
    title.classList.add('win');
  }
  if (note) note.textContent = FINAL_STAGE.clearNote;

  const retry = document.getElementById('btnRetry');
  if (retry) retry.textContent = `${FINAL_STAGE.name}をもう一度`;

  syncTitleBadge();
  return true;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  onGameState((state) => {
    if (state === 'win') {
      // Hud / main の通常リザルト描画が終わった次フレームで、最終クリアだけ上書きする。
      window.requestAnimationFrame(showFinalClear);
    } else if (state === 'title') {
      syncTitleBadge();
    }
  });

  // 既に制覇済みの保存データなら、初回タイトル表示にもバッジを出す。
  syncTitleBadge();

  // モジュールがゲーム開始後に遅れて評価された場合の保険。
  if (getGameState() === 'win') window.requestAnimationFrame(showFinalClear);
}
