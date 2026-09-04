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
const CLASSIC_STAGES = STAGE_DEFINITIONS.slice(0, 5);
const STAGE_IDS = CLASSIC_STAGES.map((stage) => stage.id);

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
  if (target.type === 'allClear') return `全${STAGE_IDS.length}ステージ制覇（クラシック）`;
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

// ALL CLEAR 前も特訓モードの存在は見せる。
// 「まだ入れない報酬」が視覚で分かるよう、KEEP OUT テープ風に封印する。
function ensureTrainingSealStyle() {
  let style = document.getElementById('trainingSealStyle');
  if (style) return style;

  style = document.createElement('style');
  style.id = 'trainingSealStyle';
  style.textContent = `
    #btnTraining.training-sealed.hidden {
      display: block !important;
      position: relative;
      color: #ffe16a;
      border-color: rgba(255, 214, 50, .92);
      background:
        repeating-linear-gradient(-45deg,
          rgba(255, 210, 40, .18) 0 10px,
          rgba(0, 0, 0, .42) 10px 20px),
        rgba(16, 18, 20, .9);
      box-shadow:
        0 2px 14px rgba(0, 0, 0, .62),
        inset 0 0 0 1px rgba(255, 214, 50, .18);
      cursor: not-allowed;
      opacity: .94;
    }
    #btnTraining.training-sealed.hidden::after {
      content: 'KEEP OUT  •  ALL CLEARで解放';
      display: block;
      margin-top: 6px;
      padding: 3px 6px;
      border: 1px solid #111;
      border-radius: 2px;
      background: repeating-linear-gradient(-45deg,
        #ffd633 0 8px,
        #171717 8px 16px);
      color: #fff4b2;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .08em;
      line-height: 1.2;
      text-shadow: 0 1px 2px #000;
      transform: rotate(-1deg);
    }
    #btnTraining.training-sealed.hidden:hover,
    #btnTraining.training-sealed.hidden:focus-visible {
      color: #ffe16a;
      background:
        repeating-linear-gradient(-45deg,
          rgba(255, 210, 40, .18) 0 10px,
          rgba(0, 0, 0, .42) 10px 20px),
        rgba(16, 18, 20, .9);
      box-shadow:
        0 2px 14px rgba(0, 0, 0, .62),
        inset 0 0 0 1px rgba(255, 214, 50, .18);
    }
  `;
  document.head.appendChild(style);
  return style;
}

function syncTrainingSeal(allClear) {
  const button = document.getElementById('btnTraining');
  if (!button) return;

  ensureTrainingSealStyle();
  const locked = !allClear;
  button.classList.toggle('training-sealed', locked);
  button.disabled = locked;
  button.setAttribute('aria-disabled', String(locked));
  button.textContent = locked ? '🔒 特訓モード' : '特訓モード';
  button.title = locked
    ? `クラシック${STAGE_IDS.length}ステージをクリアすると解放されます`
    : '攻略したい鬼を指名して特訓できます';
}

function ensurePanel() {
  let panel = document.getElementById('masteryPanel');
  if (panel) return panel;

  const card = document.getElementById('cardInfo');
  if (!card) return null;

  // 既存のミッション・鬼攻略・制覇済み表示に本パネルが加わると、
  // 横長で高さの低い端末ではカードが画面外へ伸びることがある。
  // 右カード自身を必要なときだけ縦スクロール可能にして操作不能を防ぐ。
  card.style.maxHeight = 'calc(100vh - 96px)';
  card.style.overflowY = 'auto';
  card.style.overscrollBehaviorY = 'contain';

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

// 最後の1冠を取った瞬間をタイトルへ戻るまで隠さない。
// 既存リザルトの stats に1枠だけ追加し、現在の総進行を見せる。
function ensureResultMastery() {
  let wrap = document.getElementById('resultMasteryStat');
  if (wrap) return wrap;
  const stats = document.querySelector('#result .stats');
  if (!stats) return null;

  wrap = document.createElement('div');
  wrap.id = 'resultMasteryStat';
  const label = document.createElement('span');
  label.textContent = 'やりこみ';
  const value = document.createElement('b');
  value.id = 'resultMastery';
  value.textContent = '—';
  wrap.append(label, value);
  stats.appendChild(wrap);
  return wrap;
}

function syncResultMastery(data = snapshot()) {
  const wrap = ensureResultMastery();
  if (!wrap || !data) return data;
  const value = wrap.querySelector('#resultMastery');
  if (value) {
    value.textContent = data.complete
      ? `👑 MASTER CLEAR ${data.earned}/${data.total}`
      : `🏅 ${data.earned}/${data.total}`;
  }
  wrap.classList.toggle('best', data.complete);
  wrap.title = data.complete ? '全冠達成' : 'Sランク・MISSION・鬼攻略・ALL CLEARの合計';
  return data;
}

let lastSignature = '';
let latestSnapshot = null;

export function syncMasteryUi() {
  const panel = ensurePanel();
  const compact = ensureCompact();
  const data = snapshot();
  latestSnapshot = data;
  syncTrainingSeal(data.allClear);
  if (!panel && !compact) return data;

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
    syncResult: () => syncResultMastery(latestSnapshot || snapshot()),
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
    if (state === 'win' || state === 'lose') {
      // rank / mission / oniClear / completed は他モジュールがリザルト遷移直後に保存する。
      // それらが揃った後に再集計して、今回獲得した冠までリザルトへ反映する。
      window.setTimeout(() => {
        const data = syncMasteryUi() || snapshot();
        syncResultMastery(data);
      }, 160);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncMasteryUi, { once: true });
  } else {
    syncMasteryUi();
  }

  // テストや遅延ロード時の保険。
  if (getGameState() === 'title') window.setTimeout(syncMasteryUi, 0);
}
