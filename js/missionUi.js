// ステージ別ミッションの進行記録とUI表示。
// 既存Gameへミッション専用分岐を大量に入れず、公開済みゲーム状態を横から観測する。
import { MISSIONS, evaluateMission } from './mission.js';

const KEY_PREFIX = 'ningenkagu.mission.';
const ACTIVE_PHASES = new Set(['active', 'warning']);

function loadCompleted(stageId) {
  try { return localStorage.getItem(KEY_PREFIX + stageId) === '1'; }
  catch (e) { return false; }
}

function saveCompleted(stageId) {
  try { localStorage.setItem(KEY_PREFIX + stageId, '1'); } catch (e) { /* 保存できなくても続行 */ }
}

function makeTracker(game) {
  const p = game.player.position;
  return {
    game,
    stageId: game.stage.id,
    maxSuspicion: game.suspicion || 0,
    mimicKinds: new Set(),
    blackoutDistance: 0,
    heardAlert: false,
    lastX: p.x,
    lastZ: p.z,
  };
}

function trackFrame(t, game) {
  t.maxSuspicion = Math.max(t.maxSuspicion, game.suspicion || 0);

  const target = game.player.mimicTarget;
  if (target?.kind) t.mimicKinds.add(target.kind);

  if (t.stageId === 'library' && game.noiseWarned) t.heardAlert = true;

  const p = game.player.position;
  if (t.stageId === 'artroom' && ACTIVE_PHASES.has(game.stageEvent?.phase)) {
    t.blackoutDistance += Math.hypot(p.x - t.lastX, p.z - t.lastZ);
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

function syncTitleUi(app) {
  const game = app?.game;
  const stages = app?.stages;
  if (!game || !Array.isArray(stages)) return;

  const stageId = game.stage.id;
  const mission = MISSIONS[stageId];
  const el = ensureTitleMission();
  if (el && mission) {
    const done = loadCompleted(stageId);
    el.textContent = `MISSION「${mission.name}」 ${done ? '✅ 達成済み' : '⬜ 未達成'}　${mission.desc}`;
  }

  for (const btn of document.querySelectorAll('[data-stage]')) {
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

function frame() {
  const app = window.__ningenkagu;
  const game = app?.game;

  if (game) {
    if (game !== lastGame) {
      tracker = game.state === 'playing' ? makeTracker(game) : null;
      lastGame = game;
      lastState = game.state;
    } else {
      if (game.state === 'playing' && lastState !== 'playing') tracker = makeTracker(game);

      if (tracker && tracker.game === game) trackFrame(tracker, game);

      if (tracker && lastState === 'playing' && (game.state === 'win' || game.state === 'lose')) {
        const result = evaluateMission(tracker.stageId, tracker, game.state === 'win');
        if (result?.completed) saveCompleted(result.stageId);
        showResult(result);
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
    heardAlert: tracker.heardAlert,
  } : null,
};

requestAnimationFrame(frame);
