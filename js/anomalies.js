// 低確率で起こる「異変」。既存ステージイベントとは別レイヤで、
// 同じ60秒に違う判断を要求してリプレイ性を増やす。
import { randRange } from './utils.js';
import { GAME_EVENT, emitGameEvent } from './gameEvents.js';
import { GAME_MODE } from './gameModes.js';

export const ANOMALIES = Object.freeze({
  living: Object.freeze([
    { id: 'tv-eye', icon: '👁', name: 'テレビの中に目がある', sub: '見られている気がする', duration: 8, modifiers: { detectScale: 1.16 } },
    { id: 'cold-room', icon: '🥶', name: '部屋だけ急に冷えた', sub: '警戒がなかなか冷めない', duration: 9, modifiers: { decayScale: 0.58 } },
  ]),
  classroom: Object.freeze([
    { id: 'desk-creak', icon: '🪑', name: '机が一斉に軋んだ', sub: '足音が妙に響く', duration: 8, modifiers: { noiseScale: 1.35 } },
    { id: 'wrong-bell', icon: '🔔', name: '誰もいないのに終業ベル', sub: '鬼が神経質になった', duration: 8, modifiers: { detectScale: 1.10, decayScale: 0.75 } },
  ]),
  artroom: Object.freeze([
    { id: 'statue-turn', icon: '🗿', name: '石膏像の向きが変わった', sub: '形の違いを見抜かれやすい', duration: 9, modifiers: { mimicScale: 0.84 } },
    { id: 'red-light', icon: '🔴', name: '赤い非常灯だけ点いた', sub: '鬼の視線が鋭い', duration: 7, modifiers: { detectScale: 1.18 } },
  ]),
  library: Object.freeze([
    { id: 'page-whisper', icon: '📖', name: '本が勝手にめくれている', sub: '警戒が残り続ける', duration: 9, modifiers: { decayScale: 0.52 } },
    { id: 'shelf-knock', icon: '📚', name: '書架の奥でノック音', sub: '小さな足音まで拾われる', duration: 8, modifiers: { noiseScale: 1.28 } },
  ]),
  scienceroom: Object.freeze([
    { id: 'specimen-look', icon: '🧫', name: '標本がこちらを向いた', sub: '視線と足音の両方が危険', duration: 8, modifiers: { detectScale: 1.10, noiseScale: 1.18 } },
    { id: 'blue-flame', icon: '🔥', name: '消したはずの青い炎', sub: '擬態の色が浮いて見える', duration: 8, modifiers: { mimicScale: 0.88 } },
  ]),
  electronics: Object.freeze([
    { id: 'all-screens', icon: '📺', name: '展示テレビが全部ついた', sub: '画面の光で輪郭が浮く', duration: 9, modifiers: { mimicScale: 0.86, detectScale: 1.08 } },
    { id: 'demo-voice', icon: '🔊', name: '無人の売場から接客音声', sub: '音が売場じゅうに反響する', duration: 8, modifiers: { noiseScale: 1.32 } },
  ]),
});

const NEUTRAL = Object.freeze({ detectScale: 1, decayScale: 1, noiseScale: 1, mimicScale: 1 });

export class AnomalyManager {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.active = null;
    this.modifiers = { ...NEUTRAL };
    this.count = 0;
    this.lastId = null;
    const challengeRules = this.game.challengeRules || {};
    this.maxPerRun = Math.max(0, challengeRules.anomalyCount ?? (this.game.mode === GAME_MODE.KISHIN ? 2 : 1));
    const chance = challengeRules.anomalyChance ?? (this.game.mode === GAME_MODE.KISHIN ? 1 : 0.62);
    this.armed = this.maxPerRun > 0 && Math.random() < chance;
    this.timer = randRange(16, 28);
  }

  abort() {
    if (this.active) emitGameEvent(GAME_EVENT.ANOMALY_END, { game: this.game, anomaly: this.active.spec });
    this.active = null;
    this.modifiers = { ...NEUTRAL };
    this.armed = false;
  }

  canStart() {
    const g = this.game;
    if (g.state !== 'playing' || g.timeLeft <= 9) return false;
    if (g.inspecting) return false;
    const p = g.stageEvent?.phase;
    return p !== 'active' && p !== 'warning';
  }

  pickSpec() {
    const list = ANOMALIES[this.game.stage.id] || [];
    if (!list.length) return null;
    const pool = list.filter((spec) => spec.id !== this.lastId);
    const choices = pool.length ? pool : list;
    return choices[Math.floor(Math.random() * choices.length)] || null;
  }

  begin() {
    const spec = this.pickSpec();
    if (!spec) { this.armed = false; return false; }
    this.lastId = spec.id;
    this.active = { spec, left: spec.duration || 8 };
    this.modifiers = { ...NEUTRAL, ...(spec.modifiers || {}) };
    this.count++;
    this.game.hud.eventNotice(`⚠ 異変　${spec.icon} ${spec.name}`, spec.sub, 'alarm', 2300);
    emitGameEvent(GAME_EVENT.ANOMALY_START, { game: this.game, anomaly: spec });
    return true;
  }

  end() {
    const spec = this.active?.spec;
    if (spec) emitGameEvent(GAME_EVENT.ANOMALY_END, { game: this.game, anomaly: spec });
    this.active = null;
    this.modifiers = { ...NEUTRAL };
    if (this.count < this.maxPerRun) {
      this.armed = true;
      this.timer = randRange(10, 17);
    } else {
      this.armed = false;
    }
  }

  update(dt) {
    if (this.active) {
      this.active.left -= dt;
      if (this.active.left <= 0) this.end();
      return;
    }
    if (!this.armed) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.canStart()) this.begin();
    else this.timer = 0.8;
  }

  forceStart() {
    if (this.active) return false;
    this.armed = true;
    this.timer = 0;
    return this.canStart() ? this.begin() : false;
  }

  get info() {
    return {
      active: this.active?.spec?.id || null,
      count: this.count,
      max: this.maxPerRun,
      left: this.active ? Number(this.active.left.toFixed(2)) : 0,
      modifiers: { ...this.modifiers },
    };
  }
}
