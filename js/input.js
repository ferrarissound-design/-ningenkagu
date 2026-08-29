// 入力（キーボード / マウス / タッチ / ゲームパッド）
import { applyDeadzone, applyLookSettings } from './utils.js';

/**
 * スティックの遊び。
 * 指を軽く置いたままの微小な傾きで「静止」が途切れて擬態成功度が落ちるのを防ぐ。
 */
const STICK_DEADZONE = 0.18;

// --- ゲームパッド ---
const PAD_MOVE_DEADZONE = 0.2;
const PAD_LOOK_DEADZONE = 0.15;
// 右スティック全開時の視点移動量。ポインタ操作と同じ「px相当/フレーム」の
// スケールに揃えることで、視点感度スライダーがどちらにも同じように効く。
const PAD_LOOK_SPEED = 1400;
// 標準マッピング（Xbox/PS系）のボタン番号
const PAD_BTN = { mimic: 0, pose: 1, decoy: 2, pauseA: 8, pauseB: 9 };

export class Input {
  constructor(canvas, opts = {}) {
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mimicCount = 0;
    this.poseCount = 0;
    this.pauseCount = 0;
    this.decoyCount = 0;
    this.stick = { x: 0, y: 0 };
    this.enabled = false;

    // 設定カードから変更される値。デフォルトは「今まで通り」。
    this.lookSensitivity = 1;
    this.invertY = false;

    this.canvas = canvas;
    this.stickEl = opts.stickEl;
    this.knobEl = opts.knobEl;
    this.stickRadius = 46;
    this._stickPointer = null;
    this._lookPointer = null;
    this._lastLook = { x: 0, y: 0 };

    // ゲームパッド。接続の有無に関わらず毎フレーム updateGamepad() で読み直す。
    this._padMove = { x: 0, y: 0 };
    this._padPrevButtons = null;
    this._confirmPressed = false;

    this.bindKeyboard();
    this.bindLook();
    this.bindStick();
  }

  setEnabled(v) {
    this.enabled = v;
    // タイトル・リザルト中に入った入力を次のゲームへ持ち越さない
    this.keys.clear();
    this.lookDX = 0; this.lookDY = 0;
    this.mimicCount = 0;
    this.poseCount = 0;
    this.pauseCount = 0;
    this.decoyCount = 0;
    this.stick.x = 0; this.stick.y = 0;
    this._stickPointer = null;
    this._lookPointer = null;
    this._padMove.x = 0; this._padMove.y = 0;
    this._padPrevButtons = null;
    this._confirmPressed = false;
    this.resetKnob();
  }

  bindKeyboard() {
    const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (block.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Enter') this.mimicCount++;
      if (e.code === 'KeyQ' || e.code === 'Space' || e.code === 'ShiftLeft') this.poseCount++;
      if (e.code === 'KeyR') this.decoyCount++;
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseCount++;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  bindLook() {
    const down = (e) => {
      if (!this.enabled || this._lookPointer !== null) return;
      this._lookPointer = e.pointerId;
      this._lastLook.x = e.clientX;
      this._lastLook.y = e.clientY;
      if (this.canvas.setPointerCapture) {
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
    };
    const move = (e) => {
      if (e.pointerId !== this._lookPointer) return;
      this.lookDX += e.clientX - this._lastLook.x;
      this.lookDY += e.clientY - this._lastLook.y;
      this._lastLook.x = e.clientX;
      this._lastLook.y = e.clientY;
    };
    const up = (e) => {
      if (e.pointerId !== this._lookPointer) return;
      this._lookPointer = null;
    };
    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('lostpointercapture', up);
  }

  bindStick() {
    const el = this.stickEl;
    if (!el) return;
    const set = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // ピンチ拡大時は UI レイヤが縮小表示されているので、
      // 指の移動量をスティック自身の座標系へ戻してから使う（等倍なら k = 1）
      const k = el.offsetWidth && r.width ? el.offsetWidth / r.width : 1;
      let dx = (e.clientX - cx) * k;
      let dy = (e.clientY - cy) * k;
      const d = Math.hypot(dx, dy);
      const max = this.stickRadius;
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      this.stick.x = dx / max;
      this.stick.y = -dy / max; // 上方向を前進に
      if (this.knobEl) this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      this._stickPointer = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      set(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._stickPointer) return;
      e.preventDefault();
      set(e);
    });
    const end = (e) => {
      if (e.pointerId !== this._stickPointer) return;
      this._stickPointer = null;
      this.stick.x = 0; this.stick.y = 0;
      this.resetKnob();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  resetKnob() {
    if (this.knobEl) this.knobEl.style.transform = 'translate(0px, 0px)';
  }

  /**
   * ゲームパッドを毎フレーム読み直す。ボタンイベントが無い API なので、
   * 前フレームの押下状態と比較して「押した瞬間」を自分で検出する。
   * ゲーム状態に関わらず（タイトルやリザルトでも）呼ばれる想定なので、
   * enabled チェックはこの中では行わない箇所がある
   * （確認ボタンだけは画面遷移にも使うため）。
   */
  updateGamepad(dt) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = pads && [...pads].find((p) => p && p.connected !== false);
    if (!pad) {
      this._padPrevButtons = null;
      return;
    }

    const buttons = pad.buttons || [];
    const pressed = (i) => !!(buttons[i] && buttons[i].pressed);
    const prev = this._padPrevButtons;
    const justPressed = (i) => pressed(i) && !(prev && prev[i]);

    // 確認ボタン（擬態と同じボタン）はタイトル・ポーズ・リザルトの進行にも使う
    this._confirmPressed = this._confirmPressed || justPressed(PAD_BTN.mimic);

    if (this.enabled) {
      const axes = pad.axes || [];
      const mv = applyDeadzone(axes[0] || 0, -(axes[1] || 0), PAD_MOVE_DEADZONE);
      this._padMove.x = mv.x;
      this._padMove.y = mv.y;

      const lk = applyDeadzone(axes[2] || 0, axes[3] || 0, PAD_LOOK_DEADZONE);
      if (lk.x || lk.y) {
        this.lookDX += lk.x * PAD_LOOK_SPEED * dt;
        this.lookDY += lk.y * PAD_LOOK_SPEED * dt;
      }

      if (justPressed(PAD_BTN.mimic)) this.mimicCount++;
      if (justPressed(PAD_BTN.pose)) this.poseCount++;
      if (justPressed(PAD_BTN.decoy)) this.decoyCount++;
      if (justPressed(PAD_BTN.pauseA) || justPressed(PAD_BTN.pauseB)) this.pauseCount++;
    } else {
      this._padMove.x = 0;
      this._padMove.y = 0;
    }

    this._padPrevButtons = buttons.map((b) => !!(b && b.pressed));
  }

  /** タイトル・ポーズ・リザルト画面をゲームパッドの確認ボタンで進められるように */
  consumeConfirm() {
    const v = this._confirmPressed;
    this._confirmPressed = false;
    return v;
  }

  pressMimic() { if (this.enabled) this.mimicCount++; }
  pressPose() { if (this.enabled) this.poseCount++; }
  pressDecoy() { if (this.enabled) this.decoyCount++; }
  pressPause() { if (this.enabled) this.pauseCount++; }

  /** {x: 右, y: 前} を -1..1 で返す */
  get move() {
    if (!this.enabled) return { x: 0, y: 0 };
    // 遊びの外側だけを 0..1 に引き伸ばして使う
    let { x, y } = applyDeadzone(this.stick.x, this.stick.y, STICK_DEADZONE);
    x += this._padMove.x;
    y += this._padMove.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  consumeLook() {
    const r = applyLookSettings(this.lookDX, this.lookDY, this.lookSensitivity, this.invertY);
    this.lookDX = 0; this.lookDY = 0;
    return r;
  }

  /** 押された回数を返して0に戻す（フレーム落ち時も取りこぼさない） */
  consumeMimic() { const v = this.mimicCount; this.mimicCount = 0; return v; }
  consumePose() { const v = Math.min(this.poseCount, 4); this.poseCount = 0; return v; }
  consumeDecoy() { const v = this.decoyCount; this.decoyCount = 0; return v; }
  /** 連打しても1回だけ効かせる（ポーズと再開が同フレームで打ち消し合わない） */
  consumePause() { const v = this.pauseCount > 0; this.pauseCount = 0; return v; }

  /** 溜まっているアクション入力を捨てる（再開時の暴発防止） */
  clearActions() {
    this.mimicCount = 0;
    this.poseCount = 0;
    this.pauseCount = 0;
    this.decoyCount = 0;
    this.lookDX = 0;
    this.lookDY = 0;
  }
}
