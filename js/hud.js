// 画面表示（DOM）
import { POSE_LABEL } from './player.js';

const $ = (id) => document.getElementById(id);

const BEST_KEY_PREFIX = 'ningenkagu.best.';
const LEGACY_BEST_KEY = 'ningenkagu.best';

/** localStorage が使えない環境（プライベートモード等）でも落ちないようにする */
function loadBest(stageId) {
  try {
    const raw = localStorage.getItem(BEST_KEY_PREFIX + stageId);
    // 旧バージョン（ステージ区別なし）のスコアは living のベストとして引き継ぐ
    const fallback = stageId === 'living' ? localStorage.getItem(LEGACY_BEST_KEY) : null;
    const v = parseInt(raw ?? fallback ?? '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(stageId, v) {
  try { localStorage.setItem(BEST_KEY_PREFIX + stageId, String(v)); } catch (e) { /* 保存できなくても続行 */ }
}

export class Hud {
  constructor() {
    this.elTime = $('time');
    this.elScore = $('score');
    this.elRisk = $('risk');
    this.elRiskChip = $('riskChip');
    this.elMimic = $('mimicName');
    this.elPoseOk = $('poseOk');
    this.elPose = $('poseName');
    this.elStealth = $('stealthBar');
    this.elStealthVal = $('stealthVal');
    this.elAlert = $('alertBar');
    this.elAlertName = $('alertName');
    this.elWarn = $('warn');
    this.elPopups = $('popups');
    this.elToast = $('toast');
    this.elNotice = $('notice');
    this.elNoticeText = $('noticeText');
    this.elResult = $('result');
    this.elResultTitle = $('resultTitle');
    this.elResultScore = $('resultScore');
    this.elResultTime = $('resultTime');
    this.elResultNote = $('resultNote');
    this.elBest = $('bestScore');
    this.elPause = $('pause');
    this.elOniPtr = $('oniPtr');

    this._toastTimer = null;
    this._noticeTimer = null;
    this._lastTime = -1;
    this._lastScore = -1;
    this._lastAlertCls = '';
    // 毎フレームの無駄な DOM 書き込み（＝スタイル再計算）を避けるためのキャッシュ
    this._lastRisk = '';
    this._lastRiskOn = null;
    this._lastRiskHot = null;
    this._lastMimicLabel = '';
    this._lastPoseOk = null;
    this._lastPose = '';
    this._lastStealth = -1;
    this._lastAlertPct = -1;
    this._lastWarn = -1;
    this._lastWarnPulse = null;
    this._ptrShown = false;
    this._ptrState = '';
    this.stageId = 'living';
    this.best = loadBest(this.stageId);
    this.elBest.textContent = this.best.toLocaleString('en-US');
    this.onResultChange = null;
  }

  /** 表示中のベストスコアを、そのステージのものに切り替える */
  setStage(stageId) {
    this.stageId = stageId;
    this.best = loadBest(stageId);
    this.elBest.textContent = this.best.toLocaleString('en-US');
    this.elBest.parentElement.classList.remove('best');
  }

  setTime(sec) {
    const s = Math.ceil(sec);
    if (s === this._lastTime) return;
    this._lastTime = s;
    this.elTime.textContent = s;
    this.elTime.classList.toggle('urgent', s <= 10);
  }

  setScore(n) {
    if (n === this._lastScore) return;
    this._lastScore = n;
    this.elScore.textContent = n.toLocaleString('en-US');
  }

  setRisk(mult, active) {
    const text = 'x' + mult.toFixed(1);
    if (text !== this._lastRisk) {
      this._lastRisk = text;
      this.elRisk.textContent = text;
    }
    const hot = active && mult > 4;
    if (active !== this._lastRiskOn) {
      this._lastRiskOn = active;
      this.elRiskChip.classList.toggle('on', active);
      this.elRiskChip.classList.toggle('dim', !active);
    }
    if (hot !== this._lastRiskHot) {
      this._lastRiskHot = hot;
      this.elRiskChip.classList.toggle('hot', hot);
    }
  }

  setMimic(target, poseOk) {
    const label = target ? target.label : 'なし（カグミン）';
    if (label !== this._lastMimicLabel) {
      this._lastMimicLabel = label;
      this.elMimic.textContent = label;
      this.elMimic.classList.toggle('none', !target);
    }
    const ok = target ? !!poseOk : null;
    if (ok !== this._lastPoseOk) {
      this._lastPoseOk = ok;
      this.elPoseOk.textContent = target ? (poseOk ? 'ポーズ◎' : 'ポーズ△') : '';
      this.elPoseOk.className = target ? (poseOk ? 'ok' : 'ng') : '';
    }
  }

  setPose(pose) {
    if (!this.elPose || pose === this._lastPose) return;
    this._lastPose = pose;
    this.elPose.textContent = POSE_LABEL[pose] || '';
  }

  setStealth(v) {
    const p = Math.round(v * 100);
    if (p === this._lastStealth) return;
    this._lastStealth = p;
    this.elStealth.style.width = p + '%';
    this.elStealth.className = p >= 70 ? 'good' : p >= 40 ? 'mid' : 'bad';
    if (this.elStealthVal) this.elStealthVal.textContent = p + '%';
  }

  setAlert(v, level) {
    const p = Math.round(v * 100);
    if (p !== this._lastAlertPct) {
      this._lastAlertPct = p;
      this.elAlert.style.width = p + '%';
    }
    if (level.cls !== this._lastAlertCls) {
      this._lastAlertCls = level.cls;
      this.elAlert.className = level.cls;
      this.elAlertName.textContent = level.label;
      this.elAlertName.className = level.cls;
    }
  }

  setWarn(v) {
    const o = v < 0.3 ? 0 : Math.min(1, (v - 0.3) / 0.7);
    const q = Math.round(o * 50);
    if (q !== this._lastWarn) {
      this._lastWarn = q;
      this.elWarn.style.opacity = (q / 50).toFixed(2);
    }
    const pulse = v > 0.62;
    if (pulse !== this._lastWarnPulse) {
      this._lastWarnPulse = pulse;
      this.elWarn.classList.toggle('pulse', pulse);
    }
  }

  /**
   * 画面外にいる鬼の方向を示す。
   * @param {number|null} angle 画面中心から見た向き（ラジアン・上が +）。null で非表示
   * @param {string} state 鬼の状態（色分けに使う）
   */
  setOniPointer(angle, state) {
    const el = this.elOniPtr;
    if (!el) return;
    if (angle === null) {
      if (this._ptrShown) {
        this._ptrShown = false;
        el.classList.remove('show');
      }
      return;
    }
    if (!this._ptrShown) {
      this._ptrShown = true;
      el.classList.add('show');
    }
    // 画面中央を原点とした楕円上に置く
    el.style.left = (50 + Math.cos(angle) * 40).toFixed(1) + '%';
    el.style.top = (50 - Math.sin(angle) * 37).toFixed(1) + '%';
    el.style.setProperty('--ang', (-angle).toFixed(3) + 'rad');
    if (state !== this._ptrState) {
      this._ptrState = state;
      el.dataset.state = state;
    }
  }

  setPaused(on) {
    this.elPause.classList.toggle('hidden', !on);
  }

  popup(text, cls) {
    const d = document.createElement('div');
    d.className = 'popup ' + (cls || '');
    d.textContent = text;
    this.elPopups.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  /**
   * 画面中央付近に少しの間だけ出す大きめの通知。
   * スマホでも操作を隠さないよう、常設せず短時間で消す。
   */
  notice(text, cls, ms = 1500) {
    const el = this.elNotice;
    if (!el) return;
    this.elNoticeText.textContent = text;
    el.className = 'show ' + (cls || '');
    clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => { el.className = ''; }, ms);
  }

  hideNotice() {
    clearTimeout(this._noticeTimer);
    if (this.elNotice) this.elNotice.className = '';
  }

  toast(text) {
    this.elToast.textContent = text;
    this.elToast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.elToast.classList.remove('show'), 1100);
  }

  showResult(win, score, survived, note) {
    const isBest = score > this.best;
    if (isBest) {
      this.best = score;
      saveBest(this.stageId, this.best);
    }
    this.elResultTitle.textContent = win ? 'SURVIVED!' : 'FOUND!';
    this.elResultTitle.className = win ? 'win' : 'lose';
    this.elResultScore.textContent = score.toLocaleString('en-US');
    this.elResultTime.textContent = survived.toFixed(1) + ' 秒';
    this.elBest.textContent = this.best.toLocaleString('en-US');
    this.elBest.parentElement.classList.toggle('best', isBest && score > 0);
    this.elResultNote.textContent = note || '';
    this.elResult.classList.remove('hidden');
    if (this.onResultChange) this.onResultChange(true);
  }

  hideResult() {
    this.elResult.classList.add('hidden');
    if (this.onResultChange) this.onResultChange(false);
  }

  resetVisuals() {
    this._lastTime = -1;
    this._lastScore = -1;
    this._lastAlertCls = '';
    this._lastRisk = '';
    this._lastRiskOn = null;
    this._lastRiskHot = null;
    this._lastMimicLabel = '';
    this._lastPoseOk = null;
    this._lastPose = '';
    this._lastStealth = -1;
    this._lastAlertPct = -1;
    this._lastWarn = -1;
    this._lastWarnPulse = null;
    this.setWarn(0);
    this.setOniPointer(null);
    this.setPaused(false);
    this.hideNotice();
    this.elPopups.innerHTML = '';
  }
}
