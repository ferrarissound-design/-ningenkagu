// WebAudio で合成する効果音（音素材ファイル不要）
let ctx = null;
let muted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  } catch (e) {
    ctx = null;
  }
}

export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }

function tone(freq, dur, { type = 'sine', gain = 0.16, slideTo = null, delay = 0 } = {}) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  } catch (e) { /* 音が出なくてもゲームは続行 */ }
}

export const sfx = {
  mimic() { tone(520, 0.16, { type: 'triangle', slideTo: 980, gain: 0.14 }); tone(780, 0.2, { type: 'sine', gain: 0.08, delay: 0.06 }); },
  pose() { tone(300, 0.08, { type: 'square', gain: 0.05 }); },
  deny() { tone(180, 0.14, { type: 'sawtooth', gain: 0.06, slideTo: 110 }); },
  warn() { tone(660, 0.09, { type: 'square', gain: 0.05 }); },
  danger() { tone(300, 0.14, { type: 'sawtooth', gain: 0.07, slideTo: 240 }); },
  found() {
    tone(240, 0.5, { type: 'sawtooth', gain: 0.18, slideTo: 70 });
    tone(120, 0.6, { type: 'square', gain: 0.12 });
  },
  evade() { tone(880, 0.12, { type: 'sine', gain: 0.1 }); tone(1320, 0.18, { type: 'sine', gain: 0.09, delay: 0.09 }); },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.13, delay: i * 0.11 }));
  },
  tick() { tone(880, 0.05, { type: 'sine', gain: 0.05 }); },
};
