// 最終ステージを突破したときの「作品としての終わり」を担当する。
// 通常のステージ進行には触れず、ALL CLEAR 表示と制覇済みバッジだけを足す。
import { onGameState, getGameState } from './gameState.js';
import { STAGE_DEFINITIONS } from './stageRegistry.js';

export const COMPLETION_KEY = 'ningenkagu.completed';
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

function ensureTitleBadge() {
  const card = document.getElementById('cardInfo');
  if (!card || document.getElementById('allClearBadge')) return;
  const badge = document.createElement('p');
  badge.id = 'allClearBadge';
  badge.className = 'tcard-p';
  badge.textContent = `🏆 全${STAGE_DEFINITIONS.length}ステージ制覇済み`;
  badge.setAttribute('aria-label', `全${STAGE_DEFINITIONS.length}ステージ制覇済み`);
  card.appendChild(badge);
}

function syncTitleBadge() {
  if (loadCompleted()) ensureTitleBadge();
}

function showFinalClear() {
  const app = window.__ningenkagu;
  const stageId = app?.game?.stage?.id;
  if (!isFinalStage(stageId)) return false;

  saveCompleted();

  const title = document.getElementById('resultTitle');
  if (title) {
    title.textContent = 'ALL CLEAR!';
    title.classList.add('win');
  }

  const note = document.getElementById('resultNote');
  if (note) {
    note.textContent = `全${STAGE_DEFINITIONS.length}ステージ制覇！ カグミンはすべての部屋で鬼を出し抜いた。次はSランク、ミッション、全鬼タイプ攻略を狙おう。`;
  }

  const retry = document.getElementById('btnRetry');
  if (retry) retry.textContent = `${FINAL_STAGE.name}をもう一度`;

  ensureTitleBadge();
  return true;
}

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
