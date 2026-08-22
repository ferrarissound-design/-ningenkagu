// ゲーム本体（DOMには触らない。UIは hud インターフェース経由）
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp, colorMatchScore } from './utils.js';
import { buildStage, nearestTarget, resolveCollisions, POSE_FOR_KIND } from './stage.js';
import { Player, POSE_LABEL } from './player.js';
import { Oni, STATE } from './oni.js';
import { Effects } from './effects.js';
import { sfx } from './audio.js';

export const CONFIG = {
  timeLimit: 60,
  mimicRange: 2.6,
  detectBase: 0.55,
  suspicionDecay: 0.45,
  scoreRate: 22,
  surviveBonus: 300,
  evadeBonus: 300,
  evadeAfter: 4.0,
  speed: { stand: 3.3, tpose: 2.6, ypose: 2.6, crouch: 1.7 },
};

export const ALERT_LEVELS = [
  { t: 0.00, label: '安全',       cls: 'safe' },
  { t: 0.30, label: '怪しい',     cls: 'warn' },
  { t: 0.62, label: 'かなり怪しい', cls: 'danger' },
  { t: 1.00, label: '発見',       cls: 'found' },
];

export function alertLevel(v) {
  let out = ALERT_LEVELS[0];
  for (const l of ALERT_LEVELS) if (v >= l.t) out = l;
  return out;
}

export class Game {
  constructor(scene, camera, hud) {
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;

    this.stage = buildStage(scene);
    this.player = new Player(scene);
    this.oni = new Oni(scene, this.stage);
    this.fx = new Effects(scene);

    this.state = 'title';
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.camDist = 5.4;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();

    this._move = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._dir2 = new THREE.Vector3();
    this._orig = new THREE.Vector3();
    this.backdropColor = new THREE.Color(0xcfc7b6);
    this.defaultBackdrop = new THREE.Color(0xcfc7b6);

    this.reset();
  }

  reset() {
    this.timeLeft = CONFIG.timeLimit;
    this.score = 0;
    this.suspicion = 0;
    this.mimicry = 0;
    this.risk = 1;
    this.seenTime = 0;
    this.survived = 0;
    this.lastAlertCls = 'safe';
    this.warnBeep = 0;
    this.tickBeep = 0;
    this.stareHold = 0;
    this.evades = 0;
    this.player.reset(this.stage.playerSpawn);
    this.oni.reset();
    this.camYaw = -Math.PI * 0.75;
    this.camPitch = 0.42;
    this.updateCamera(0.5, true);
    this.hud.setMimic(null, false);
    this.hud.setPose(this.player.pose);
    this.hud.setStealth(0);
    this.hud.setAlert(0, alertLevel(0));
    this.hud.setScore(0);
    this.hud.setTime(this.timeLeft);
    this.hud.setRisk(1, false);
    this.hud.setWarn(0);
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.hud.toast('隠れろ！');
  }

  /** タイトル画面用：部屋全体をゆっくり見せるカメラ */
  updateTitleCamera(dt) {
    this.titleAngle = (this.titleAngle || 0) + dt * 0.16;
    const a = this.titleAngle;
    this.camera.position.set(Math.sin(a) * 6.6, 4.4, Math.cos(a) * 4.6);
    this.camera.lookAt(0, 0.9, 0);
  }

  update(dt, input) {
    this.fx.update(dt);
    if (this.state !== 'playing') {
      if (this.state === 'title') this.updateTitleCamera(dt);
      else this.updateCamera(dt, false);
      if (this.state === 'lose' || this.state === 'win') {
        // 決着後も鬼は少し動く
        this.oni.update(dt, { visible: false, px: this.player.position.x, pz: this.player.position.z }, this.suspicion);
      }
      return;
    }

    // --- 入力 ---
    const look = input.consumeLook();
    this.camYaw -= look.dx * 0.0045;
    this.camPitch = clamp(this.camPitch + look.dy * 0.0035, 0.05, 1.05);

    const poseHits = input.consumePose();
    if (poseHits) {
      let p = this.player.pose;
      for (let i = 0; i < poseHits; i++) p = this.player.cyclePose();
      sfx.pose();
      this.hud.toast('ポーズ：' + POSE_LABEL[p]);
      this.twitch(0.06);
    }
    if (input.consumeMimic()) this.tryMimic();

    // --- 移動 ---
    const mv = input.move;
    this._move.set(0, 0, 0);
    let inputMag = 0;
    if (Math.abs(mv.x) > 0.001 || Math.abs(mv.y) > 0.001) {
      const s = Math.sin(this.camYaw), c = Math.cos(this.camYaw);
      // カメラ前方 = (-s, 0, -c)、右 = (c, 0, -s)
      this._move.x = -s * mv.y + c * mv.x;
      this._move.z = -c * mv.y - s * mv.x;
      const len = Math.hypot(this._move.x, this._move.z);
      if (len > 0.001) {
        inputMag = Math.min(1, len);
        // 方向と入力強度を分離し、アナログ入力を二重に掛けない
        this._move.x /= len;
        this._move.z /= len;
      }
    }
    const speed = CONFIG.speed[this.player.pose] ?? CONFIG.speed.stand;
    this.player.update(dt, this._move, speed * inputMag);
    resolveCollisions(this.player.position, this.player.radius, this.stage.solids);

    // --- 擬態対象マーカー ---
    const near = nearestTarget(this.stage.targets, this.player.position.x, this.player.position.z, CONFIG.mimicRange);
    if (near) this.fx.showMarker(near.target, this.player.position.x, this.player.position.z);
    else this.fx.hideMarker();
    this.nearTarget = near ? near.target : null;

    // --- 視界判定 ---
    // Raycaster は最新のワールド行列を必要とする（描画前に自前で更新する）
    this.scene.updateMatrixWorld();
    const sense = this.oni.senseTarget(this.player, this.stage.occluders);
    sense.px = this.player.position.x;
    sense.pz = this.player.position.z;

    // --- 擬態成功度 ---
    this.updateBackdropColor();
    this.mimicry = this.computeMimicry();

    // --- 警戒度 ---
    if (sense.visible) {
      const distF = clamp(1.7 - sense.dist / 12, 0.35, 1.7);
      const centerF = 0.4 + 0.6 * sense.centrality;
      const moveF = 1 + 1.5 * clamp(this.player.speed / 3.3, 0, 1);
      const gain = CONFIG.detectBase * distF * centerF * moveF * (1 - this.mimicry) * sense.fraction;
      this.suspicion += gain * dt;
      this.seenTime += dt;

      // 見落としポイント：見られているのに気づかれていない時間ほど高得点
      const closeness = clamp(1 - sense.dist / 10, 0, 1);
      this.risk = (1 + 2.5 * closeness) * (1 + 1.0 * sense.centrality) * (1 + 1.2 * clamp(this.suspicion, 0, 1));
      const add = CONFIG.scoreRate * this.risk * sense.fraction * dt;
      this.score += add;
      this.hud.setRisk(this.risk, true);
    } else {
      this.suspicion -= CONFIG.suspicionDecay * dt;
      this.risk = 1;
      this.hud.setRisk(1, false);
    }
    this.suspicion = clamp(this.suspicion, 0, 1);

    // --- 鬼の更新 ---
    this.oni.update(dt, sense, this.suspicion);
    this.oni.updateConeShape(dt, this.stage.occluders);

    // 目の前で見つめられても正体がバレなければ「見逃し」ボーナス
    if (this.oni.state === STATE.SUSPECT && sense.visible && sense.dist < 4.2) {
      this.stareHold += dt;
    } else {
      this.stareHold = Math.max(0, this.stareHold - dt * 2);
    }
    if (this.stareHold > CONFIG.evadeAfter) {
      this.stareHold = 0;
      this.oni.giveUp();
      this.suspicion *= 0.25;
      this.evades++;
      const bonus = CONFIG.evadeBonus * this.evades;
      this.score += bonus;
      this.hud.popup('見逃された！ +' + bonus, 'good');
      sfx.evade();
    }

    // --- 演出と音 ---
    const lv = alertLevel(this.suspicion);
    if (lv.cls !== this.lastAlertCls) {
      if (lv.cls === 'warn') sfx.warn();
      if (lv.cls === 'danger') sfx.danger();
      this.lastAlertCls = lv.cls;
    }
    if (this.suspicion > 0.62) {
      this.warnBeep -= dt;
      if (this.warnBeep <= 0) { sfx.warn(); this.warnBeep = 0.28; }
    }

    // --- 時間と勝敗 ---
    this.timeLeft -= dt;
    this.survived = CONFIG.timeLimit - Math.max(0, this.timeLeft);
    if (this.timeLeft <= 10.5 && this.timeLeft > 0) {
      this.tickBeep -= dt;
      if (this.tickBeep <= 0) { sfx.tick(); this.tickBeep = 1.0; }
    }

    // --- HUD ---
    this.hud.setTime(Math.max(0, this.timeLeft));
    this.hud.setScore(Math.floor(this.score));
    this.hud.setStealth(this.mimicry);
    this.hud.setAlert(this.suspicion, lv);
    this.hud.setWarn(this.suspicion);
    this.hud.setMimic(this.player.mimicTarget, this.isPoseMatched());
    this.hud.setPose(this.player.pose);

    this.updateCamera(dt, false);

    if (this.suspicion >= 1) this.lose();
    else if (this.timeLeft <= 0) this.win();
  }

  /** 擬態・ポーズ変更などの「動き」で一瞬あやしまれる */
  twitch(amount) {
    if (this.state !== 'playing') return;
    this.suspicion = clamp(this.suspicion + amount, 0, 1);
  }

  tryMimic() {
    const t = this.nearTarget;
    if (!t) {
      this.hud.toast('近くに擬態できる物がない');
      sfx.deny();
      return;
    }
    this.player.mimic(t);
    this.fx.burst(this.player.position, t.color);
    this.hud.popup(t.label + 'に擬態！', 'good');
    sfx.mimic();
    this.twitch(0.08);
  }

  isPoseMatched() {
    const t = this.player.mimicTarget;
    if (!t) return false;
    return POSE_FOR_KIND[t.kind] === this.player.pose;
  }

  /**
   * 鬼から見てプレイヤーの「背景」になっている物の色を調べる。
   * これが擬態成功度の色判定に使われる（＝立ち位置が重要）。
   */
  updateBackdropColor() {
    const p = this.player.position;
    const eye = this.oni.position;
    let dx = p.x - eye.x, dz = p.z - eye.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) { this.backdropColor.copy(this.defaultBackdrop); return; }
    dx /= len; dz /= len;
    // プレイヤーの胸の高さから、鬼→プレイヤーの延長線上を水平に飛ばす。
    // 大きく後方へずらすと、密着中の家具・壁の内部からレイが始まり
    // 表面を拾えなくなるため、ごく小さいオフセットだけを与える。
    const h = 1.05 * this.player.body.scale.y;
    this._orig.set(p.x + dx * 0.04, h, p.z + dz * 0.04);
    this._dir2.set(dx, 0, dz);
    this._ray.set(this._orig, this._dir2);
    this._ray.near = 0;
    this._ray.far = 40;
    const hits = this._ray.intersectObjects(this.stage.occluders, false);
    if (hits.length > 0 && hits[0].object.material && hits[0].object.material.color) {
      this.backdropColor.copy(hits[0].object.material.color);
    } else {
      this.backdropColor.copy(this.defaultBackdrop);
    }
  }

  /**
   * 擬態成功度 0..1。
   * 色の一致・静止・ポーズ・その物の近くにいるか、の4要素。
   */
  computeMimicry() {
    const color = colorMatchScore(this.player.currentColor, this.backdropColor);
    const still = this.player.stillness;
    const t = this.player.mimicTarget;
    let pose = 0.25;
    let context = 0.15;
    if (t) {
      pose = POSE_FOR_KIND[t.kind] === this.player.pose ? 1.0 : 0.2;
      const d = nearestKindDistance(this.stage.targets, t.kind, this.player.position.x, this.player.position.z);
      context = clamp(1.15 - d / 5.0, 0.15, 1);
    }
    let v = 0.34 * color + 0.26 * still + 0.20 * pose + 0.20 * context;
    if (!t) v *= 0.6; // 擬態していない生身は目立つ
    return clamp(v, 0, 0.94); // 100%にはしない＝絶対安全は無い
  }

  /** 指定のピッチでカメラ位置を求め、遮蔽があれば手前に寄せた距離を返す */
  placeCamera(pitch) {
    const cp = Math.cos(pitch);
    this.camPos.set(
      this.camTarget.x + Math.sin(this.camYaw) * cp * this.camDist,
      this.camTarget.y + Math.sin(pitch) * this.camDist,
      this.camTarget.z + Math.cos(this.camYaw) * cp * this.camDist
    );
    const dir = this._v.subVectors(this.camPos, this.camTarget);
    const dist = dir.length();
    if (dist < 0.01) return dist;
    dir.divideScalar(dist);
    this._ray.set(this.camTarget, dir);
    this._ray.near = 0;
    this._ray.far = dist;
    const hits = this._ray.intersectObjects(this.stage.occluders, false);
    if (hits.length === 0) return dist;
    const d = Math.max(0.9, Math.min(dist, hits[0].distance - 0.3));
    this.camPos.copy(this.camTarget).addScaledVector(dir, d);
    return d;
  }

  updateCamera(dt, instant) {
    const p = this.player.position;
    this.camTarget.set(p.x, 1.15, p.z);

    let d = this.placeCamera(this.camPitch);
    // 壁ぎわでカメラが潰れるときは見下ろし角を上げて視界を確保する
    const want = this.camDist * 0.75;
    if (d < want) {
      const extra = clamp((want - d) / want, 0, 1) * 0.6;
      this.placeCamera(Math.min(1.25, this.camPitch + extra));
    }

    this.camPos.y = Math.max(0.6, this.camPos.y);
    if (instant) this.camera.position.copy(this.camPos);
    else {
      this.camera.position.x = damp(this.camera.position.x, this.camPos.x, 12, dt);
      this.camera.position.y = damp(this.camera.position.y, this.camPos.y, 12, dt);
      this.camera.position.z = damp(this.camera.position.z, this.camPos.z, 12, dt);
    }
    this.camera.lookAt(this.camTarget);
  }

  /** 負けた理由から次に試すヒントを出す（もう一度遊びたくさせる） */
  loseHint() {
    const t = this.player.mimicTarget;
    if (!t) return '生身のままだった。家具のそばで「擬態」を押して色をコピーしよう。';
    if (!this.isPoseMatched()) return `${t.label}には今のポーズが合っていない。「ポーズ◎」になる形を探そう。`;
    if (this.player.speed > 0.2) return '動いていると一気にバレる。鬼が見ている間は完全に止まろう。';
    if (colorMatchScore(this.player.currentColor, this.backdropColor) < 0.5) {
      return '鬼から見た背景の色と合っていなかった。擬態した物を背にして立とう。';
    }
    return '擬態しても100%安全にはならない。長く見られる前に視線の外へ。';
  }

  winHint() {
    if (this.score < 900) return '隠れきった。次は鬼の目の前で家具になりきるとスコアが跳ね上がる。';
    if (this.evades > 0) return '目の前で見逃させるのが最高効率。もっと際どい場所を狙える。';
    return '見事。もっと鬼に近い場所で粘ればさらに高得点。';
  }

  lose() {
    this.state = 'lose';
    this.oni.state = STATE.FOUND;
    this.suspicion = 1;
    this.player.reactFound();
    this.hud.setWarn(1);
    sfx.found();
    this.hud.showResult(false, Math.floor(this.score), this.survived, this.loseHint());
  }

  win() {
    this.state = 'win';
    this.timeLeft = 0;
    this.survived = CONFIG.timeLimit;
    this.score += CONFIG.surviveBonus;
    this.player.reactWin();
    sfx.win();
    this.hud.setWarn(0);
    this.hud.showResult(true, Math.floor(this.score), this.survived, this.winHint());
  }
}

function nearestKindDistance(targets, kind, x, z) {
  let best = Infinity;
  for (const t of targets) {
    if (t.kind !== kind) continue;
    const dx = Math.max(t.rect.minX - x, 0, x - t.rect.maxX);
    const dz = Math.max(t.rect.minZ - z, 0, z - t.rect.maxZ);
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best === Infinity ? 99 : best;
}
