// ステージ固有のランダムイベント
//
// ステージID → そのステージ専用イベント、という対応だけをここに持たせる。
// game.js には「毎フレーム update するマネージャ」しか置かないので、
// ステージ4・5を足すときは STAGE_EVENTS に1項目書き足すだけでよい。
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp, randRange, prefersReducedMotion } from './utils.js';
import { STATE } from './oniConstants.js';
import { sfx } from './audio.js';

/** イベントの進行状態。二重発火を防ぐため、状態はここだけで持つ */
export const EVENT_PHASE = {
  IDLE: 'idle',         // 予定なし（もう起きない・または未武装）
  ARMED: 'armed',       // 発生待ち
  ACTIVE: 'active',     // 発生中
  WARNING: 'warning',   // 終了予告中（美術室の「明かりが戻る！」）
  ENDING: 'ending',     // 終了処理の直後
  COOLDOWN: 'cooldown', // 連続発生させないための待ち
};

export const EVENT_TIMING = {
  firstMin: 10,      // 最初のイベントまで（開始直後には起こさない）
  firstMax: 20,
  repeatMin: 12,     // 前のイベント終了から次まで
  repeatMax: 20,
  cooldown: 6,       // 終了直後の完全な待ち時間
  endingHold: 0.5,   // ENDING 表示を一瞬だけ挟む
  maxPerGame: 2,     // 1ゲーム 1〜2回
  minTimeLeft: 5,    // 残りがこれ以下なら新規開始しない
  retry: 0.7,        // 条件が整わなかったときの再試行間隔
};

/** 消灯中のライト倍率。真っ暗にはせず、家具の輪郭は必ず残す */
const DARK_LIGHT = { hemi: 0.45, sun: 0.30, fill: 0.55 };
const DARK_BG = new THREE.Color(0x080a11);

/**
 * ステージごとの専用イベント。
 * 追加するときは stage.js の eventRig（目印）と対にして書く。
 */
export const STAGE_EVENTS = {
  // ---------------- STAGE 1：リビング ----------------
  living: {
    id: 'tv',
    name: 'テレビがついた！',
    durationMin: 6.5,
    durationMax: 8.5,
    // 気を取られていたのを中断したら、視界ペナルティも即解除する
    liftVisionOnBreak: true,
    onStart(m) {
      const rig = m.stage.eventRig || {};
      m.setTv(true);
      m.applyVision({ range: 0.62, angle: 0.78, peri: 0.82, detect: 0.45 });
      m.focusOni({ look: rig.look, spots: rig.spots, stand: 0.4 });
      m.hud.eventNotice('📺 テレビがついた！', '鬼が気を取られている');
      sfx.eventTv();
    },
    onUpdate(m, dt) { m.animateTv(dt); },
    onEnd(m) { m.setTv(false); },
  },

  // ---------------- STAGE 2：教室 ----------------
  classroom: {
    id: 'chime',
    name: 'チャイムが鳴った！',
    durationMin: 6.0,
    durationMax: 7.5,
    liftVisionOnBreak: true,
    onStart(m) {
      const rig = m.stage.eventRig || {};
      // 位置が大きく動くこと自体が本命なので、視界ペナルティは控えめ
      m.applyVision({ range: 0.88, angle: 0.92, peri: 0.95, detect: 0.7 });
      m.focusOni({ look: rig.look, spots: rig.spots, stand: 0.4, glance: 0.8 });
      m.hud.eventNotice('🔔 チャイム！', '鬼が黒板へ向かった');
      sfx.eventChime();
    },
    onUpdate(m) {
      // 黒板前に着いたら、そこから2〜4秒だけ黒板側を見て、通常AIへ自然に戻る
      const f = m.oni.eventFocus;
      if (!f || !f.arrived || m.mark) return;
      m.mark = true;
      m.duration = clamp(m.elapsed + randRange(2.4, 3.8), 4.0, 11);
    },
  },

  // ---------------- STAGE 3：美術室 ----------------
  artroom: {
    id: 'blackout',
    name: '照明が消えた！',
    durationMin: 7.0,
    durationMax: 9.0,
    warnLead: 1.1,
    // 暗いのは部屋の都合なので、鬼が気づいて動き出しても暗いままにする
    liftVisionOnBreak: false,
    onStart(m) {
      m.applyVision({ range: 0.55, angle: 0.72, peri: 0.72, detect: 0.45 });
      m.setDim(1);
      m.hud.eventNotice('💡 照明が消えた！', '今のうちに動こう');
      sfx.eventLightsOut();
    },
    onWarn(m) {
      m.hud.eventNotice('⚠ 明かりが戻る！', '止まれ！', 'alarm', 1300);
      sfx.inspectTell();
    },
    onEnd(m) {
      m.setDim(0);
      sfx.eventLightsOn();
      // 点灯の瞬間に大きく動いていたら「しまった」程度の警戒ペナルティ
      const sp = m.game.player.speed;
      if (sp > 1.55) {
        const add = clamp(0.10 + (sp / 3.3) * 0.13, 0.10, 0.23);
        m.game.suspicion = Math.min(0.92, m.game.suspicion + add);
        m.hud.popup('明るくなった瞬間に動いてた！', 'bad');
        sfx.danger();
      }
    },
  },

  // ---------------- STAGE 4：図書室 ----------------
  library: {
    id: 'bookfall',
    name: '本が崩れた！',
    durationMin: 6.0,
    durationMax: 8.0,
    liftVisionOnBreak: true,
    onStart(m) {
      const rig = m.stage.eventRig || {};
      m.applyVision({ range: 0.62, angle: 0.78, peri: 0.82, detect: 0.5 });
      m.focusOni({ look: rig.look, spots: rig.spots, stand: 0.4 });
      m.hud.eventNotice('📚 本が崩れた！', '鬼が書架へ向かった');
      sfx.eventBookfall();
    },
  },
};

/**
 * ステージイベントの進行役。
 * 1ゲームに1つだけ持ち、同時に2つのイベントは絶対に走らせない。
 */
export class StageEventManager {
  constructor(game) {
    this.game = game;
    this.spec = STAGE_EVENTS[game.stage.id] || null;
    // ライトは main.js が scene.userData.stageLights に元の明るさ付きで置いている
    this.lights = game.scene.userData.stageLights || null;
    this.dim = 0;
    this.dimTarget = 0;
    this.flicker = 0;
    this.bgBase = null;
    this.bgWork = new THREE.Color();
    this.phase = EVENT_PHASE.IDLE;
    this.active = null;
    this.reset();
  }

  get oni() { return this.game.oni; }
  get hud() { return this.game.hud; }
  get stage() { return this.game.stage; }

  /** リトライ・ステージ移行のたびに完全な初期状態へ戻す */
  reset() {
    this.abort();
    this.count = 0;
    this.timer = randRange(EVENT_TIMING.firstMin, EVENT_TIMING.firstMax);
    this.phase = this.spec ? EVENT_PHASE.ARMED : EVENT_PHASE.IDLE;
  }

  /** 決着・中断時。演出（明るさ・テレビ・鬼の視界）を確実に戻す */
  abort() {
    if (this.active && this.oniFocused) this.releaseOni();
    this.active = null;
    this.oniFocused = false;
    this.elapsed = 0;
    this.duration = 0;
    this.warned = false;
    this.mark = false;
    this.timer = 0;
    this.flicker = 0;
    this.phase = EVENT_PHASE.IDLE;
    this.setTv(false);
    this.setSteam(false);
    this.dim = 0;
    this.dimTarget = 0;
    this.applyLights();
    if (this.game.oni) this.game.oni.clearEventVision();
  }

  /** デバッグ表示用（画面には出さない） */
  get info() {
    return {
      stage: this.stage.id,
      event: this.spec ? this.spec.id : null,
      phase: this.phase,
      count: this.count,
      timer: Number(this.timer.toFixed(2)),
      left: this.active ? Number((this.duration - this.elapsed).toFixed(2)) : 0,
      oniFocused: !!this.oniFocused,
    };
  }

  // ---------------- 進行 ----------------

  update(dt) {
    this.updateVisuals(dt);
    if (!this.spec) return;

    switch (this.phase) {
      case EVENT_PHASE.ARMED:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.canStart()) this.begin();
        else if (this.game.timeLeft <= EVENT_TIMING.minTimeLeft) this.phase = EVENT_PHASE.IDLE;
        else this.timer = EVENT_TIMING.retry;
        break;

      case EVENT_PHASE.ACTIVE:
      case EVENT_PHASE.WARNING:
        this.updateActive(dt);
        break;

      case EVENT_PHASE.ENDING:
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = EVENT_PHASE.COOLDOWN;
          this.timer = EVENT_TIMING.cooldown;
        }
        break;

      case EVENT_PHASE.COOLDOWN:
        this.timer -= dt;
        if (this.timer > 0) break;
        if (this.count >= EVENT_TIMING.maxPerGame || this.game.timeLeft <= EVENT_TIMING.minTimeLeft) {
          this.phase = EVENT_PHASE.IDLE;
        } else {
          this.phase = EVENT_PHASE.ARMED;
          this.timer = Math.max(
            0,
            randRange(EVENT_TIMING.repeatMin, EVENT_TIMING.repeatMax) - EVENT_TIMING.cooldown
          );
        }
        break;
    }
  }

  /** 今このタイミングでイベントを始めてよいか */
  canStart() {
    const g = this.game;
    if (g.state !== 'playing') return false;
    if (g.timeLeft <= EVENT_TIMING.minTimeLeft) return false;
    // 発見・家具検査中は割り込まない（既存の遊びを壊さない）
    if (this.oni.state === STATE.FOUND || this.oni.state === STATE.INSPECT) return false;
    // プレイヤーの「おとり」など、別の場所からすでに気を引いている最中は重ねない
    if (this.oni.eventFocus) return false;
    if (g.suspicion >= 0.8) return false;
    return true;
  }

  /** 現在ステージのイベントを開始する。二重発火はここで止める */
  begin() {
    if (!this.spec) return false;
    if (this.phase === EVENT_PHASE.ACTIVE || this.phase === EVENT_PHASE.WARNING) return false;
    const e = this.spec;
    this.active = e;
    this.count++;
    this.phase = EVENT_PHASE.ACTIVE;
    this.elapsed = 0;
    this.duration = randRange(e.durationMin, e.durationMax);
    this.warned = false;
    this.mark = false;
    this.oniFocused = false;
    if (e.onStart) e.onStart(this);
    return true;
  }

  updateActive(dt) {
    const e = this.active;
    if (!e) { this.finish(); return; }
    this.elapsed += dt;

    // 鬼が自分でイベントを振り切った（＝あやしまれた）ときの後始末
    if (this.oniFocused && !this.oni.eventFocus) {
      this.oniFocused = false;
      if (e.liftVisionOnBreak) this.oni.clearEventVision();
    }

    if (e.onUpdate) e.onUpdate(this, dt);

    const left = this.duration - this.elapsed;
    const lead = e.warnLead || 0;
    if (!this.warned && lead > 0 && left <= lead) {
      this.warned = true;
      this.phase = EVENT_PHASE.WARNING;
      if (e.onWarn) e.onWarn(this);
    }
    if (left <= 0) this.finish();
  }

  finish() {
    const e = this.active;
    this.phase = EVENT_PHASE.ENDING;
    this.timer = EVENT_TIMING.endingHold;
    if (e && e.onEnd) e.onEnd(this);
    this.releaseOni();
    this.oni.clearEventVision();
    this.active = null;
    this.warned = false;
    this.mark = false;
  }

  /** 開発用：今すぐ発生させる */
  forceStart() {
    if (!this.spec) return false;
    if (this.game.state !== 'playing') return false;
    if (this.phase === EVENT_PHASE.ACTIVE || this.phase === EVENT_PHASE.WARNING) return false;
    return this.begin();
  }

  // ---------------- 鬼への影響 ----------------

  /**
   * 視界ペナルティを鬼へ渡す。
   * 性格タイプの eventDistract で「気の取られやすさ」が変わる。
   */
  applyVision(scales) {
    const d = this.oni.tune.eventDistract ?? 1;
    const soft = (s) => clamp(1 - (1 - s) * d, 0.25, 1.2);
    this.oni.setEventVision({
      range: soft(scales.range ?? 1),
      angle: soft(scales.angle ?? 1),
      peri: soft(scales.peri ?? 1),
      detect: soft(scales.detect ?? 1),
    });
  }

  /** イベント地点へ鬼の注意を向ける（移動先は既存の衝突判定で歩ける点を選ぶ） */
  focusOni({ look, spots, stand = 0.4, glance = 1 }) {
    if (!look) return false;
    const spot = this.pickSpot(spots, look);
    const tune = this.oni.tune;
    this.oniFocused = this.oni.beginEventFocus({
      lookX: look.x, lookZ: look.z,
      moveX: spot ? spot.x : null,
      moveZ: spot ? spot.z : null,
      stand,
      moveScale: tune.eventMoveScale ?? 1,
      glance: (tune.eventGlance ?? 0.35) * glance,
    });
    return this.oniFocused;
  }

  /**
   * 立ち位置を選ぶ。
   * 「イベント対象に近い点」を優先しつつ、実際に歩いて行ける点を選ぶ。
   * （鬼が今いる場所がそのまま採用されると、イベントで位置が変わらなくなるため）
   */
  pickSpot(spots, look) {
    if (!spots || spots.length === 0) return null;
    const oni = this.oni;
    const scored = spots.map((s) => ({
      s,
      score: (look ? Math.hypot(s.x - look.x, s.z - look.z) : 0) + s.distanceTo(oni.position) * 0.22,
    })).sort((a, b) => a.score - b.score);
    for (const c of scored) {
      if (oni.canReachEventSpot(c.s)) return c.s;
    }
    return scored[0].s;
  }

  releaseOni() {
    if (this.oniFocused) this.oni.endEventFocus(true);
    this.oniFocused = false;
  }

  // ---------------- 演出 ----------------

  updateVisuals(dt) {
    // 明るさは必ず補間で戻す（イベントが途中で終わっても元に戻り切る）。
    // 点滅（ストロボ）は光過敏の観点で prefers-reduced-motion では出さない。
    // 明滅の代わりに setDim() 由来の dim → dimTarget のなめらかな補間だけが残る。
    const wasFlicker = this.flicker;
    this.flicker = this.phase === EVENT_PHASE.WARNING && !prefersReducedMotion()
      ? Math.max(0, Math.sin(this.elapsed * 17)) * 0.34
      : 0;
    const changed = Math.abs(this.dim - this.dimTarget) > 0.001 || this.flicker !== wasFlicker;
    if (Math.abs(this.dim - this.dimTarget) > 0.001) {
      this.dim = damp(this.dim, this.dimTarget, 7, dt);
      if (Math.abs(this.dim - this.dimTarget) <= 0.004) this.dim = this.dimTarget;
    }
    if (changed) this.applyLights();
  }

  setDim(v) { this.dimTarget = clamp(v, 0, 1); }

  applyLights() {
    const L = this.lights;
    const k = clamp(this.dim - this.flicker, 0, 1);
    if (L) {
      for (const key of ['hemi', 'sun', 'fill']) {
        const rec = L[key];
        if (!rec || !rec.light) continue;
        rec.light.intensity = rec.base * (1 - (1 - DARK_LIGHT[key]) * k);
      }
    }
    const scene = this.game.scene;
    const bg = scene.background;
    if (bg && bg.isColor && bg !== this.bgWork) this.bgBase = bg;
    if (!this.bgBase) return;
    scene.background = k > 0.002
      ? this.bgWork.copy(this.bgBase).lerp(DARK_BG, k)
      : this.bgBase;
  }

  /** テレビ画面のON / OFF（外部素材を使わない簡単な発光演出） */
  setTv(on) {
    const screen = this.stage.eventRig && this.stage.eventRig.tvScreen;
    if (!screen) return;
    const mat = screen.material;
    this.tvOn = on;
    if (on) {
      mat.emissive.setHex(0x6fa8d8);
      mat.emissiveIntensity = 0.75;
    } else {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 1;
    }
  }

  /**
   * 理科室の白煙の ON / OFF。
   * 3Dオブジェクトはステージ側（eventRig.steam）が持っているので、
   * ここは表示切替とアニメーションだけを担当する。
   */
  setSteam(on) {
    const rig = this.stage.eventRig && this.stage.eventRig.steam;
    if (!rig) return;
    this.steamOn = on;
    rig.group.visible = on;
    if (on) {
      this.steamPhase = 0;
    } else {
      // 消すときは必ず透明へ戻す（次の発生が前回の濃さから始まらないように）
      for (const p of rig.puffs) p.mesh.material.opacity = 0;
    }
  }

  /** 白煙が立ちのぼって薄れていくループ。位相をずらして途切れさせない */
  animateSteam(dt) {
    const rig = this.stage.eventRig && this.stage.eventRig.steam;
    if (!rig || !this.steamOn) return;
    this.steamPhase = (this.steamPhase || 0) + dt * 0.42;
    // 終わりぎわは全体を薄くして、点灯イベントと同じく「戻る」予感を出す
    const left = this.duration - this.elapsed;
    const fade = clamp(Math.min(this.elapsed / 0.8, left / 1.2), 0, 1);
    for (const p of rig.puffs) {
      const t = (this.steamPhase + p.phase) % 1;
      const mesh = p.mesh;
      mesh.position.set(
        rig.origin.x + p.driftX * t,
        0.6 + t * 1.9,
        rig.origin.z + p.driftZ * t
      );
      const s = 0.22 + t * 0.72;
      mesh.scale.set(s, s * 0.85, s);
      // 出た直後に濃くなり、上がりきるほど薄れる
      mesh.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * fade;
    }
  }

  animateTv(dt) {
    const screen = this.stage.eventRig && this.stage.eventRig.tvScreen;
    if (!screen || !this.tvOn) return;
    this.tvPhase = (this.tvPhase || 0) + dt;
    screen.material.emissiveIntensity = 0.62 + Math.sin(this.tvPhase * 9) * 0.13
      + Math.sin(this.tvPhase * 23) * 0.05;
  }
}
