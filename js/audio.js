// WebAudio で合成する効果音（音素材ファイル不要）
import { clamp } from './utils.js';

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

const muteListeners = new Set();

export function setMuted(v) {
  const next = !!v;
  if (next === muted) return;
  muted = next;
  for (const fn of [...muteListeners]) {
    try {
      fn(muted);
    } catch (err) {
      console.error(err);
    }
  }
}

export function isMuted() { return muted; }

/**
 * 音のオン / オフ切替を購読する。
 * BGM のように audio.js の外で鳴らしているものが追従するために使う。
 * 戻り値を呼ぶと購読を解除できる。
 */
export function onMuteChange(fn) {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

// --- 効果音（SE）の音量 ---
// tone() は毎回すぐ鳴らして終わる一発ものなので、購読は不要。
// 呼ばれた瞬間の音量を読んで gain に掛けるだけでよい。
let sfxVolume = 1;
export function setSfxVolume(v) { sfxVolume = clamp(v, 0, 1); }
export function getSfxVolume() { return sfxVolume; }

// --- BGM の音量 ---
// こちらは battleBgm.js が生成した <audio> が鳴りっぱなしなので、
// 設定変更をその場に反映させるための購読口が要る。
let bgmVolume = 1;
const bgmVolumeListeners = new Set();
export function setBgmVolume(v) {
  bgmVolume = clamp(v, 0, 1);
  for (const fn of [...bgmVolumeListeners]) {
    try {
      fn(bgmVolume);
    } catch (err) {
      console.error(err);
    }
  }
}
export function getBgmVolume() { return bgmVolume; }
export function onBgmVolumeChange(fn) {
  bgmVolumeListeners.add(fn);
  return () => bgmVolumeListeners.delete(fn);
}

function tone(freq, dur, { type = 'sine', gain = 0.16, slideTo = null, delay = 0 } = {}) {
  if (!ctx || muted || sfxVolume <= 0) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * sfxVolume, t0 + 0.012);
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
  /** おとり：物を投げて音を立てる、軽いコツンという音 */
  decoy() {
    tone(240, 0.09, { type: 'square', gain: 0.09, slideTo: 110 });
    tone(100, 0.16, { type: 'sine', gain: 0.1, delay: 0.05 });
  },
  // --- 家具検査モード ---
  /** 検査開始：「んん？」と覗き込む感じの2音 */
  inspect() {
    tone(430, 0.13, { type: 'triangle', gain: 0.1, slideTo: 620 });
    tone(620, 0.16, { type: 'triangle', gain: 0.09, slideTo: 520, delay: 0.13 });
  },
  /** 振り返る直前の予兆。短くコツッと鳴らして「くるぞ」と伝える */
  inspectTell() {
    tone(1150, 0.05, { type: 'square', gain: 0.05 });
    tone(1150, 0.05, { type: 'square', gain: 0.05, delay: 0.12 });
  },
  /** 振り返った瞬間 */
  inspectTurn() { tone(880, 0.14, { type: 'sawtooth', gain: 0.08, slideTo: 300 }); },
  /** 検査を耐え切った（見逃しボーナスとは別の、明るい上昇音） */
  inspectPass() {
    [660, 880, 1100, 1480].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.11, delay: i * 0.07 }));
  },
  /** 検査に失敗（発見ではないので重すぎない音にする） */
  inspectFail() {
    tone(420, 0.16, { type: 'square', gain: 0.08, slideTo: 250 });
    tone(250, 0.2, { type: 'sawtooth', gain: 0.06, delay: 0.1 });
  },
  // --- ステージイベント ---
  /** テレビON：短いブラウン管の起動音（ポンッ＋低いハム） */
  eventTv() {
    tone(1400, 0.06, { type: 'square', gain: 0.05, slideTo: 2400 });
    tone(320, 0.22, { type: 'triangle', gain: 0.07, slideTo: 210, delay: 0.05 });
    tone(120, 0.3, { type: 'sine', gain: 0.05, delay: 0.06 });
  },
  /** チャイム：電子ベル風の4音（合成のみ・音源ファイルは使わない） */
  eventChime() {
    [659, 523, 587, 392].forEach((f, i) => {
      tone(f, 0.5, { type: 'sine', gain: 0.11, delay: i * 0.34 });
      tone(f * 2, 0.34, { type: 'triangle', gain: 0.04, delay: i * 0.34 });
    });
  },
  /** 消灯：電気が落ちる短い音 */
  eventLightsOut() {
    tone(520, 0.26, { type: 'sawtooth', gain: 0.09, slideTo: 80 });
    tone(150, 0.22, { type: 'square', gain: 0.05, delay: 0.04 });
  },
  /** 点灯：軽いクリック音 */
  eventLightsOn() {
    tone(1700, 0.04, { type: 'square', gain: 0.05 });
    tone(2300, 0.05, { type: 'square', gain: 0.04, delay: 0.05 });
  },
  /** 蒸気：高い方から下がっていく「シューッ」という噴出音 */
  eventSteam() {
    tone(2600, 0.55, { type: 'sawtooth', gain: 0.035, slideTo: 900 });
    tone(1750, 0.62, { type: 'triangle', gain: 0.03, slideTo: 700, delay: 0.04 });
    tone(320, 0.28, { type: 'sine', gain: 0.04, slideTo: 190, delay: 0.02 });
  },
  /** 本が崩れる：ドサッという低い音の後、パラパラと数回鳴らす */
  eventBookfall() {
    tone(160, 0.22, { type: 'square', gain: 0.1, slideTo: 80 });
    [0.06, 0.13, 0.19, 0.24].forEach((d, i) => {
      tone(320 - i * 30, 0.05, { type: 'triangle', gain: 0.05, delay: d });
    });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.13, delay: i * 0.11 }));
  },
  tick() { tone(880, 0.05, { type: 'sine', gain: 0.05 }); },
};
