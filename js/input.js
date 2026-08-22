// 入力（キーボード / マウス / タッチ）
export class Input {
  constructor(canvas, opts = {}) {
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mimicCount = 0;
    this.poseCount = 0;
    this.stick = { x: 0, y: 0 };
    this.enabled = false;

    this.canvas = canvas;
    this.stickEl = opts.stickEl;
    this.knobEl = opts.knobEl;
    this.stickRadius = 46;
    this._stickPointer = null;
    this._lookPointer = null;
    this._lastLook = { x: 0, y: 0 };

    this.bindKeyboard();
    this.bindLook();
    this.bindStick();
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this.keys.clear();
      this.mimicCount = 0;
      this.poseCount = 0;
      this.stick.x = 0; this.stick.y = 0;
      this._stickPointer = null;
      this._lookPointer = null;
      this.resetKnob();
    }
  }

  bindKeyboard() {
    const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.enabled) return;
      if (e.code === 'KeyE' || e.code === 'Enter') this.mimicCount++;
      if (e.code === 'KeyQ' || e.code === 'Space' || e.code === 'ShiftLeft') this.poseCount++;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  bindLook() {
    const down = (e) => {
      if (this._lookPointer !== null) return;
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
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const max = this.stickRadius;
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      this.stick.x = dx / max;
      this.stick.y = -dy / max; // 上方向を前進に
      if (this.knobEl) this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    el.addEventListener('pointerdown', (e) => {
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

  pressMimic() { if (this.enabled) this.mimicCount++; }
  pressPose() { if (this.enabled) this.poseCount++; }

  /** {x: 右, y: 前} を -1..1 で返す */
  get move() {
    let x = this.stick.x;
    let y = this.stick.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  consumeLook() {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return r;
  }

  /** 押された回数を返して0に戻す（フレーム落ち時も取りこぼさない） */
  consumeMimic() { const v = this.mimicCount; this.mimicCount = 0; return v; }
  consumePose() { const v = Math.min(this.poseCount, 4); this.poseCount = 0; return v; }
}
