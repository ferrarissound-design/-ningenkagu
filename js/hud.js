// 画面表示（DOM）
import { POSE_LABEL } from './player.js';

const $ = (id) => document.getElementById(id);

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
    this.elResult = $('result');
    this.elResultTitle = $('resultTitle');
    this.elResultScore = $('resultScore');
    this.elResultTime = $('resultTime');
    this.elResultNote = $('resultNote');
    this.elBest = $('bestScore');

    this._toastTimer = null;
    this._lastTime = -1;
    this._lastScore = -1;
    this._lastAlertCls = '';
    this.best = 0;
    this.onResultChange = null;
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
    this.elRisk.textContent = 'x' + mult.toFixed(1);
    this.elRiskChip.classList.toggle('on', active);
    this.elRiskChip.classList.toggle('hot', active && mult > 4);
    this.elRiskChip.classList.toggle('dim', !active);
  }

  setMimic(target, poseOk) {
    this.elMimic.textContent = target ? target.label : 'なし（カグミン）';
    this.elMimic.classList.toggle('none', !target);
    this.elPoseOk.textContent = target ? (poseOk ? 'ポーズ◎' : 'ポーズ△') : '';
    this.elPoseOk.className = target ? (poseOk ? 'ok' : 'ng') : '';
  }

  setPose(pose) {
    if (this.elPose) this.elPose.textContent = POSE_LABEL[pose] || '';
  }

  setStealth(v) {
    const p = Math.round(v * 100);
    this.elStealth.style.width = p + '%';
    this.elStealth.className = p >= 70 ? 'good' : p >= 40 ? 'mid' : 'bad';
    if (this.elStealthVal) this.elStealthVal.textContent = p + '%';
  }

  setAlert(v, level) {
    this.elAlert.style.width = Math.round(v * 100) + '%';
    if (level.cls !== this._lastAlertCls) {
      this._lastAlertCls = level.cls;
      this.elAlert.className = level.cls;
      this.elAlertName.textContent = level.label;
      this.elAlertName.className = level.cls;
    }
  }

  setWarn(v) {
    const o = v < 0.3 ? 0 : Math.min(1, (v - 0.3) / 0.7);
    this.elWarn.style.opacity = o.toFixed(3);
    this.elWarn.classList.toggle('pulse', v > 0.62);
  }

  popup(text, cls) {
    const d = document.createElement('div');
    d.className = 'popup ' + (cls || '');
    d.textContent = text;
    this.elPopups.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  toast(text) {
    this.elToast.textContent = text;
    this.elToast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.elToast.classList.remove('show'), 1100);
  }

  showResult(win, score, survived, note) {
    const isBest = score > this.best;
    if (isBest) this.best = score;
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
    this.setWarn(0);
    this.elPopups.innerHTML = '';
  }
}
