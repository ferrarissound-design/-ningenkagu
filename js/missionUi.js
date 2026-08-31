// ステージ別ミッションと鬼タイプ別クリア記録の進行・UI表示。
// 既存Gameへ専用分岐を大量に入れず、公開済みゲーム状態を横から観測する。
import { MISSIONS, evaluateMission } from './mission.js';
import { ONI_PERSONALITIES } from './oniPersonalities.js';
import { oniClearKey, countOniClears, stageOniClears } from './oniProgress.js';

const KEY_PREFIX = 'ningenkagu.mission.';
const ACTIVE_PHASES = new Set(['active', 'warning']);
const HEARING_ALERT_TEXT = '足音が聞こえた…！';
const ONI_META = Object.values(ONI_PERSONALITIES).map(({ id, name, icon }) => ({ id, name, icon }));
const ONI_IDS = ONI_META.map((p) => p.id);

/**
 * タイトルの進行状況表示は毎フレーム呼ばれる。
 * localStorage の読み出しは同期 I/O なので、素直に組むと 1 フレームあたり
 * 20 回以上・毎秒 1000 回以上読むことになり、タイトル画面が重くなる。
 * 記録が動いたときだけ番号を進め、変わっていないフレームは丸ごと省く。
 */
let progressRevision = 0;
window.addEventListener('storage', () => { progressRevision++; });

// Game を作り直すと main.js 側がステージボタンの文字を書き直す（★ が消える）。
// タイトル表示を貼り直す必要があるので、作り直しも「変化」として数える。
let gameRevision = 0;

function loadCompleted(stageId) {
  try { return localStorage.getItem(KEY_PREFIX + stageId) === '1'; }
  catch (e) { return false; }
}

function saveCompleted(stageId) {
  try { localStorage.setItem(KEY_PREFIX + stageId, '1'); } catch (e) { /* 保存できなくても続行 */ }
  progressRevision++;
}

function loadOniClear(stageId, oniId) {
  try { return localStorage.getItem(oniClearKey(stageId, oniId)) === '1'; }
  catch (e) { return false; }
}

function saveOniClear(stageId, oniId) {
  if (!stageId || !ONI_PERSONALITIES[oniId]) return false;
  try {
    localStorage.setItem(oniClearKey(stageId, oniId), '1');
    return true;
  } catch (e) {
    return false;
  } finally {
    progressRevision++;
  }
}

function makeTracker(game) {
  const p = game.player.position;
  return {
    game,
    stageId: game.stage.id,
    maxSuspicion: game.suspicion || 0,
    mimicKinds: new Set(),
    blackoutDistance: 0,
    steamDistance: 0,
    heardAlert: false,
    lastX: p.x,
    lastZ: p.z,
  };
}

/**
 * ポーズ中は位置も統計も動かないので、再開時は最後の座標だけ合わせ直せばよい。
 * トラッカーごと作り直すと、そのプレイで積み上げたミッション統計が消える。
 */
function syncTrackerPosition(t, game) {
  const p = game.player.position;
  t.lastX = p.x;
  t.lastZ = p.z;
}

function trackFrame(t, game) {
  t.maxSuspicion = Math.max(t.maxSuspicion, game.suspicion || 0);

  const target = game.player.mimicTarget;
  if (target?.kind) t.mimicKinds.add(target.kind);

  const p = game.player.position;
  const moved = Math.hypot(p.x - t.lastX, p.z - t.lastZ);
  if (ACTIVE_PHASES.has(game.stageEvent?.phase)) {
    if (t.stageId === 'artroom') t.blackoutDistance += moved;
    if (t.stageId === 'scienceroom') t.steamDistance += moved;
  }
  t.lastX = p.x;
  t.lastZ = p.z;
}

function ensureResultMission() {
  let wrap = document.getElementById('resultMissionStat');
  if (wrap) return wrap;
  const stats = document.querySelector('#result .stats');
  if (!stats) return null;
  wrap = document.createElement('div');
  wrap.id = 'resultMissionStat';
  const label = document.createElement('span');
  label.textContent = 'ミッション';
  const value = document.createElement('b');
  value.id = 'resultMission';
  value.textContent = '—';
  wrap.append(label, value);
  stats.appendChild(wrap);
  return wrap;
}

function showResult(result) {
  const wrap = ensureResultMission();
  if (!wrap || !result) return;
  const value = wrap.querySelector('#resultMission');
  value.textContent = result.completed ? `✓ ${result.name}` : `× ${result.name}`;
  wrap.classList.toggle('best', result.completed);
  wrap.title = result.desc;
}

function ensureResultOni() {
  let wrap = document.getElementById('resultOniClearStat');
  if (wrap) return wrap;
  const stats = document.querySelector('#result .stats');
  if (!stats) return null;
  wrap = document.createElement('div');
  wrap.id = 'resultOniClearStat';
  const label = document.createElement('span');
  label.textContent = '鬼攻略';
  const value = document.createElement('b');
  value.id = 'resultOniClear';
  value.textContent = '—';
  wrap.append(label, value);
  stats.appendChild(wrap);
  return wrap;
}

function showResultOni(game, won) {
  const wrap = ensureResultOni();
  if (!wrap) return;
  const value = wrap.querySelector('#resultOniClear');
  const p = game?.oni?.personality;
  if (!p) {
    value.textContent = '—';
    wrap.classList.remove('best');
    return;
  }
  value.textContent = won ? `✓ ${p.icon} ${p.name}` : `× ${p.icon} ${p.name}`;
  wrap.classList.toggle('best', won);
}

function ensureTitleMission() {
  let el = document.getElementById('selStageMission');
  if (el) return el;
  const card = document.getElementById('cardInfo');
  if (!card) return null;
  el = document.createElement('p');
  el.id = 'selStageMission';
  el.className = 'tcard-p';
  card.appendChild(el);
  return el;
}

function ensureTitleOniProgress() {
  let el = document.getElementById('selOniProgress');
  if (el) return el;
  const card = document.getElementById('cardInfo');
  if (!card) return null;
  el = document.createElement('p');
  el.id = 'selOniProgress';
  el.className = 'tcard-p';
  card.appendChild(el);
  return el;
}

let lastTitleSync = '';

function syncTitleUi(app) {
  const game = app?.game;
  const stages = app?.stages;
  if (!game || !Array.isArray(stages)) return;

  const stageId = game.stage.id;
  // ステージ選択・記録更新・ステージボタンの生成のいずれかが動いたときだけ描き直す
  const stageBtns = document.querySelectorAll('[data-stage]');
  const key = `${stageId}|${progressRevision}|${gameRevision}|${stages.length}|${stageBtns.length}`;
  if (key === lastTitleSync) return;
  lastTitleSync = key;
  const mission = MISSIONS[stageId];
  const el = ensureTitleMission();
  if (el && mission) {
    const done = loadCompleted(stageId);
    el.textContent = `MISSION「${mission.name}」 ${done ? '✅ 達成済み' : '⬜ 未達成'}　${mission.desc}`;
  }

  const progressEl = ensureTitleOniProgress();
  if (progressEl) {
    const stageIds = stages.map((s) => s.id).filter(Boolean);
    const progress = countOniClears(stageIds, ONI_IDS, loadOniClear);
    const stageStatus = stageOniClears(stageId, ONI_IDS, loadOniClear)
      .map(({ oniId, completed }) => {
        const p = ONI_PERSONALITIES[oniId];
        return `${p.icon}${completed ? '✓' : '—'}`;
      })
      .join(' ');
    progressEl.textContent = progress.complete
      ? `鬼攻略 ${progress.cleared}/${progress.total}　${stageStatus}　👑 完全制覇`
      : `鬼攻略 ${progress.cleared}/${progress.total}　${stageStatus}`;
    progressEl.title = ONI_META.map((p) => `${p.icon} ${p.name}`).join(' / ');
  }

  for (const btn of stageBtns) {
    const i = Number(btn.dataset.stage);
    const id = stages[i]?.id;
    if (!id) continue;
    const base = btn.textContent.replace(/\s+★$/, '');
    const marked = loadCompleted(id) ? base + '　★' : base;
    if (btn.textContent !== marked) btn.textContent = marked;
  }
}

let tracker = null;
let lastGame = null;
let lastState = null;
let hookedHud = null;

/**
 * 図書室の「完全静音」は一瞬だけ立つ noiseWarned を毎フレーム監視せず、
 * 実際にプレイヤーへ出た足音警告をイベントとしてラッチする。
 * これなら同じフレーム内で noiseWarned が戻っても、一度聞かれた事実は失われない。
 */
function ensureHearingAlertHook(app) {
  const hud = app?.hud;
  if (!hud || hud === hookedHud) return;
  hookedHud = hud;
  const originalToast = hud.toast.bind(hud);
  hud.toast = (text) => {
    if (tracker?.stageId === 'library' && text === HEARING_ALERT_TEXT) {
      tracker.heardAlert = true;
    }
    return originalToast(text);
  };
}

function frame() {
  const app = window.__ningenkagu;
  const game = app?.game;

  if (game) {
    ensureHearingAlertHook(app);

    if (game !== lastGame) {
      tracker = game.state === 'playing' ? makeTracker(game) : null;
      gameRevision++;
      lastGame = game;
      lastState = game.state;
    } else {
      if (game.state === 'playing' && lastState !== 'playing') {
        // ポーズからの再開は同じプレイの続き。ここで作り直すと
        // 擬態した家具の種類・消灯中の移動距離・足音の有無がすべて 0 に戻り、
        // 一時停止するだけでミッション判定をやり直せてしまう。
        if (lastState === 'paused' && tracker && tracker.game === game) syncTrackerPosition(tracker, game);
        else tracker = makeTracker(game);
      }

      if (tracker && tracker.game === game) trackFrame(tracker, game);

      if (tracker && lastState === 'playing' && (game.state === 'win' || game.state === 'lose')) {
        const won = game.state === 'win';
        const result = evaluateMission(tracker.stageId, tracker, won);
        if (result?.completed) saveCompleted(result.stageId);
        showResult(result);

        const oniId = game.oni?.personality?.id;
        if (won && oniId) saveOniClear(tracker.stageId, oniId);
        showResultOni(game, won);

        tracker = null;
      }
      lastState = game.state;
    }

    if (!document.getElementById('title')?.classList.contains('hidden')) syncTitleUi(app);
  }

  requestAnimationFrame(frame);
}

// テスト・デバッグ用。ゲーム画面には何も増やさない。
window.__ningenkaguMissions = {
  definitions: MISSIONS,
  completed: loadCompleted,
  tracker: () => tracker ? {
    stageId: tracker.stageId,
    maxSuspicion: tracker.maxSuspicion,
    mimicKinds: [...tracker.mimicKinds],
    blackoutDistance: tracker.blackoutDistance,
    steamDistance: tracker.steamDistance,
    heardAlert: tracker.heardAlert,
  } : null,
  oniProgress: {
    completed: loadOniClear,
    ids: [...ONI_IDS],
    count: () => {
      const stages = window.__ningenkagu?.stages || [];
      return countOniClears(stages.map((s) => s.id), ONI_IDS, loadOniClear);
    },
  },
};

requestAnimationFrame(frame);
