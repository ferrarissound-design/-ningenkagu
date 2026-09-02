// ALL CLEAR 後も「次に何を狙うか」が分かる、タイトル画面のやりこみ進行表示。
// 既存のSランク・ミッション・鬼攻略を束ね、全達成を MASTER CLEAR と呼ぶ。
import { STAGE_DEFINITIONS } from './stageRegistry.js';
import { MISSIONS } from './mission.js';
import { ONI_PERSONALITIES, ONI_PERSONALITY_IDS } from './oniPersonalities.js';
import { oniClearKey } from './oniProgress.js';
import { COMPLETION_KEY } from './completionUi.js';
import { getGameState, onGameState } from './gameState.js';
import { buildMasterySnapshot, nextMasteryTarget } from './mastery.js';

const RANK_KEY_PREFIX = 'ningenkagu.rank.';
const MISSION_KEY_PREFIX = 'ningenkagu.mission.';
const STAGE_IDS = STAGE_DEFINITIONS.map((stage) => stage.id);

function read(key) {
  try { return localStorage.getItem(key); }
  catch (e) { return null; }
}

function snapshot() {
  return buildMasterySnapshot(STAGE_IDS, ONI_PERSONALITY_IDS, {
    loadRank: (stageId) => read(RANK_KEY_PREFIX + stageId),
    loadMission: (stageId) => read(MISSION_KEY_PREFIX + stageId) === '1',
    loadOniClear: (stageId, oniId) => read(oniClearKey(stageId, oniId)) === '1',
    loadAllClear: () => read(COMPLETION_KEY) === '1',
  });
}

function stageName(stageId) {
  return STAGE_DEFINITIONS.find((stage) => stage.id === stageId)?.name || stageId || 'ステージ';
}

function targetLabel(target) {
  if (!target) return '';
  if (target.type === 'allClear') return `全${STAGE_DEFINITIONS.length}ステージ制覇`;
  if (target.type === 'sRank') return `${stageName(target.stageId)}でSランク`;
  if (target.type === 'mission') {
    const mission = MISSIONS[target.stageId];
    return `${stageName(target.stageId)} MISSION「${mission?.name || '未達成'}」`;
  }
  if (target.type === 'oni') {
    const oni = ONI_PERSONALITIES[target.oniId];
    return `${stageName(target.stageId)} × ${oni?.icon || '👹'} ${oni?.name || target.oniId}`;
  }
  return '';
}

function ensurePanel() {
  let panel = document.getElementById('masteryPanel');
  if (panel) return panel;

  const card = document.getElementById('cardInfo');
  if (!card) return null;

  panel = document.createElement('div');
  panel.id = 'masteryPanel';
  panel.className = 'tcard-p';
  panel.setAttribute('aria-live', 'polite');
  panel.style.marginTop = '10px';

  const title = document.createElement('b');
  title.id = 'masteryTitle';
  title.style.display = 'block';

  const progress = document.createElement('progress');
  progress.id = 'masteryBar';
  progress.style.width = '100%';
  progress.style.height = '10px';
  progress.style.margin = '6px 0 4px';

  const detail = document.createElement('span');
  detail.id = 'masteryDetail';
  detail.style.display = 'block';

  const next = document.createElement('span');
  next.id = 'masteryNext';
  next.style.display = 'block';
  next.style.marginTop = '3px';

  panel.append(title, progress, detail, next);
  card.appendChild(panel);
  return panel;
}

// 右カードはスマホ幅で畳まれるため、タイトル下部にも常時見える短縮表示を置く。
function ensureCompact() {
  let compact = document.getElementById('masteryCompact');
  if (compact) return compact;

  const bottom = document.querySelector('#title .tl-bottom');
  if (!bottom) return null;

  compact = document.createElement('span');
  compact.id = 'masteryCompact';
  compact.className = 'blab';
  compact.style.whiteSpace = 'nowrap';
  compact.setAttribute('aria-live', 'polite');
  bottom.appendChild(compact);
  return compact;
}

let lastSignature = '';
let latestSnapshot = null;

export function syncMasteryUi() {
  const panel = ensurePanel();
  const compact = ensureCompact();
  if (!panel && !compact) return null;

  const data = snapshot();
  latestSnapshot = data;
  const signature = JSON.stringify(data);
  if (signature === lastSignature) return data;
  lastSignature = signature;

  const target = nextMasteryTarget(data);
  const targetText = targetLabel(target);

  if (compact) {
    compact.textContent = data.complete ? `👑 ${data.earned}/${data.total}` : `🏅 ${data.earned}/${data.total}`;
    compact.title = data.complete ? 'MASTER CLEAR' : (targetText ? `次の冠：${targetText}` : 'やりこみ進行');
    compact.setAttribute('aria-label', data.complete
      ? `MASTER CLEAR ${data.earned}/${data.total}`
      : `やりこみ ${data.earned}/${data.total}。${targetText ? `次の冠 ${targetText}` : ''}`);
    compact.dataset.complete = data.complete ? 'true' : 'false';
  }

  if (!panel) return data;

  const title = panel.querySelector('#masteryTitle');
  const bar = panel.querySelector('#masteryBar');
  const detail = panel.querySelector('#masteryDetail');
  const next = panel.querySelector('#masteryNext');

  if (bar) {
    bar.max = Math.max(1, data.total);
    bar.value = data.earned;
    bar.setAttribute('aria-label', `やりこみ進行 ${data.earned}/${data.total}`);
  }

  if (data.complete) {
    if (title) title.textContent = `👑 MASTER CLEAR　${data.earned}/${data.total}`;
    if (detail) detail.textContent = `S ${data.groups.sRank.earned}/${data.groups.sRank.total}　MISSION ${data.groups.mission.earned}/${data.groups.mission.total}　鬼攻略 ${data.groups.oni.earned}/${data.groups.oni.total}`;
    if (next) next.textContent = '全S・全MISSION・全鬼タイプ攻略まで完全制覇！';
    panel.dataset.complete = 'true';
  } else {
    if (title) title.textContent = `🏅 やりこみ　${data.earned}/${data.total}`;
    if (detail) detail.textContent = `S ${data.groups.sRank.earned}/${data.groups.sRank.total}　MISSION ${data.groups.mission.earned}/${data.groups.mission.total}　鬼攻略 ${data.groups.oni.earned}/${data.groups.oni.total}`;
    if (next) next.textContent = target ? `次の冠：${targetText}` : '';
    panel.dataset.complete = 'false';
  }

  return data;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__ningenkaguMastery = {
    snapshot: () => latestSnapshot || syncMasteryUi(),
    sync: syncMasteryUi,
  };

  // 同一タブの localStorage 更新では storage イベントが発火しないため、
  // タイトル表示中だけ低頻度で再集計する。毎フレーム読む実装は避ける。
  window.setInterval(() => {
    const titleVisible = !document.getElementById('title')?.classList.contains('hidden');
    if (titleVisible) syncMasteryUi();
  }, 1200);

  window.addEventListener('storage', syncMasteryUi);
  onGameState((state) => {
    if (state === 'title') window.setTimeout(syncMasteryUi, 0);
    // win直後は missionUi が次フレームで保存するため、少し後にも拾う。
    if (state === 'win') window.setTimeout(syncMasteryUi, 120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncMasteryUi, { once: true });
  } else {
    syncMasteryUi();
  }

  // テストや遅延ロード時の保険。
  if (getGameState() === 'title') window.setTimeout(syncMasteryUi, 0);
}
