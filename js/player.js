// プレイヤー（家具に化ける丸い生き物「カグミン」）
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp } from './utils.js';

export const POSES = ['stand', 'tpose', 'ypose', 'crouch'];
export const POSE_LABEL = {
  stand: '直立',
  tpose: 'Tポーズ',
  ypose: 'Yポーズ',
  crouch: 'しゃがみ',
};

const CREAM = 0xffdfb5;
const MINT = 0x49c9a9;
const MINT_DARK = 0x247f78;
const BELLY = 0xfff1d6;
const FACE = 0x26343b;
const CHEEK = 0xff8fa3;

export class Player {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.body = new THREE.Group(); // ポーズによる拡縮はここに掛ける
    this.root.add(this.body);
    this.visual = new THREE.Group(); // 歩行時の弾み・揺れはここに掛ける
    this.body.add(this.visual);

    this.materials = [];
    this.faceMaterials = [];
    const mk = (color, opts = {}) => {
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: opts.roughness ?? 0.78,
        metalness: opts.metalness ?? 0.0,
        emissive: new THREE.Color(opts.emissive ?? 0x000000),
      });
      (opts.face ? this.faceMaterials : this.materials).push(m);
      return m;
    };

    const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
    const orb = (rx, ry, rz, color, opts = {}) => {
      const m = new THREE.Mesh(sphereGeo, mk(color, opts));
      m.scale.set(rx, ry, rz);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // 小さな丸い胴体と、お腹のワンポイント
    this.torso = orb(0.32, 0.39, 0.25, MINT);
    this.torso.position.y = 1.02;
    this.visual.add(this.torso);
    const belly = orb(0.19, 0.23, 0.035, BELLY);
    belly.position.set(0, 1.0, 0.235);
    this.visual.add(belly);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), mk(0xffcf58));
    badge.position.set(0, 1.01, 0.273);
    badge.castShadow = true;
    this.visual.add(badge);

    // 大きな丸い頭
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.55;
    this.visual.add(this.headGroup);
    this.head = orb(0.38, 0.35, 0.33, CREAM);
    this.headGroup.add(this.head);

    // 柔らかいアンテナ。走ると頭と一緒に揺れる
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.23, 8), mk(MINT));
    antenna.position.set(0.025, 0.43, -0.015);
    antenna.rotation.z = -0.18;
    antenna.castShadow = true;
    this.headGroup.add(antenna);
    const antennaTip = orb(0.085, 0.075, 0.085, MINT);
    antennaTip.position.set(0.065, 0.55, -0.015);
    this.headGroup.add(antennaTip);

    // 表情。擬態すると顔が「シュポッ」と引っ込む
    this.face = new THREE.Group();
    this.face.position.z = 0.31;
    this.headGroup.add(this.face);
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = orb(0.065, 0.085, 0.026, FACE, { face: true, roughness: 0.45 });
      eye.position.set(side * 0.13, 0.055, 0.025);
      this.face.add(eye);
      this.eyes.push({ mesh: eye, base: eye.scale.clone() });
      const cheek = orb(0.055, 0.03, 0.018, CHEEK, { face: true });
      cheek.position.set(side * 0.205, -0.055, 0.018);
      this.face.add(cheek);
    }
    this.mouth = orb(0.048, 0.026, 0.018, FACE, { face: true, roughness: 0.5 });
    this.mouth.position.set(0, -0.105, 0.025);
    this.mouthBaseScale = this.mouth.scale.clone();
    this.face.add(this.mouth);

    // 短いカプセル状の腕（肩を軸に回す）
    this.arms = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.34, 1.2, 0);
      const arm = orb(0.105, 0.27, 0.105, CREAM);
      arm.position.y = -0.24;
      pivot.add(arm);
      const cuff = orb(0.125, 0.105, 0.12, MINT);
      cuff.position.y = -0.04;
      pivot.add(cuff);
      this.visual.add(pivot);
      this.arms.push({ pivot, side });
    }

    // 短い脚と大きめの足
    this.legs = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.16, 0.73, 0);
      const leg = orb(0.13, 0.3, 0.14, MINT_DARK);
      leg.position.y = -0.27;
      pivot.add(leg);
      const foot = orb(0.17, 0.115, 0.23, MINT_DARK);
      foot.position.set(0, -0.54, 0.07);
      pivot.add(foot);
      this.visual.add(pivot);
      this.legs.push({ pivot, side });
    }

    this.height = 2.05;
    this.radius = 0.34;
    this.pose = 'stand';
    this.poseIndex = 0;
    this.walkPhase = 0;
    this.idlePhase = 0;
    this.speed = 0;
    this.yaw = 0;
    this.stillTime = 0;
    this.flash = 0;
    this.faceScale = 1;
    this.faceTarget = 1;
    this.blinkTimer = 2 + Math.random() * 2;
    this.blinkHold = 0;
    this.reaction = 'normal';

    // 擬態状態
    this.mimicTarget = null;
    this.baseLooks = this.materials.map((m) => ({
      color: m.color.clone(), roughness: m.roughness, metalness: m.metalness,
    }));
    this.currentColor = new THREE.Color(MINT);
  }

  get position() { return this.root.position; }

  reset(pos) {
    this.root.position.copy(pos);
    this.yaw = 0;
    this.root.rotation.y = 0;
    this.pose = 'stand';
    this.poseIndex = 0;
    this.walkPhase = 0;
    this.idlePhase = 0;
    this.stillTime = 0;
    this.speed = 0;
    this.flash = 0;
    this.faceScale = 1;
    this.faceTarget = 1;
    this.face.scale.setScalar(1);
    this.blinkTimer = 2 + Math.random() * 2;
    this.blinkHold = 0;
    this.reaction = 'normal';
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
    this.mimicTarget = null;
    this.materials.forEach((m, i) => {
      m.color.copy(this.baseLooks[i].color);
      m.roughness = this.baseLooks[i].roughness;
      m.metalness = this.baseLooks[i].metalness;
      m.emissive.setHex(0x000000);
    });
    this.currentColor.setHex(MINT);
    for (const e of this.eyes) e.mesh.scale.copy(e.base);
    this.mouth.scale.copy(this.mouthBaseScale);
    this.body.scale.set(1, 1, 1);
    this.applyPoseInstant();
  }

  /** 対象の見た目をコピーする */
  mimic(target) {
    this.mimicTarget = target;
    for (const m of this.materials) {
      m.color.copy(target.color);
      m.roughness = target.roughness;
      m.metalness = target.metalness;
    }
    this.currentColor.copy(target.color);
    this.flash = 1;
    this.faceTarget = 0.04;
  }

  cyclePose() {
    this.poseIndex = (this.poseIndex + 1) % POSES.length;
    this.pose = POSES[this.poseIndex];
    return this.pose;
  }

  /** 移動と姿勢の更新 */
  update(dt, moveDir, moveSpeed) {
    this.idlePhase += dt;
    const moving = moveDir.lengthSq() > 0.0001;
    if (moving) {
      this.root.position.x += moveDir.x * moveSpeed * dt;
      this.root.position.z += moveDir.z * moveSpeed * dt;
      const targetYaw = Math.atan2(moveDir.x, moveDir.z);
      // 最短方向に回転
      let d = targetYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 12);
      this.root.rotation.y = this.yaw;
      this.speed = moveSpeed;
      this.stillTime = 0;
      this.walkPhase += dt * moveSpeed * 3.2;
    } else {
      this.speed = damp(this.speed, 0, 14, dt);
      if (this.speed < 0.1) this.speed = 0;
      this.stillTime += dt;
      this.walkPhase = damp(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 8, dt);
    }

    this.updatePoseTransforms(dt, moving);

    // カグミンらしい、軽い弾みと左右のプニプニ揺れ
    const bob = moving
      ? Math.abs(Math.sin(this.walkPhase)) * 0.055
      : Math.sin(this.idlePhase * 2.1) * 0.016;
    const lean = moving
      ? Math.sin(this.walkPhase) * 0.045
      : Math.sin(this.idlePhase * 1.35) * 0.012;
    this.visual.position.y = damp(this.visual.position.y, bob, 12, dt);
    this.visual.rotation.z = damp(this.visual.rotation.z, lean, 10, dt);

    // 擬態中は顔を引っ込める。通常時は時々まばたきする
    this.faceScale = damp(this.faceScale, this.faceTarget, 15, dt);
    this.face.scale.setScalar(this.faceScale);
    if (this.reaction === 'normal' && this.faceTarget > 0.5) {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0 && this.blinkHold <= 0) {
        this.blinkHold = 0.11;
        this.blinkTimer = 2.2 + Math.random() * 2.8;
      }
      if (this.blinkHold > 0) this.blinkHold -= dt;
      const blinkY = this.blinkHold > 0 ? 0.12 : 1;
      for (const e of this.eyes) {
        e.mesh.scale.y = damp(e.mesh.scale.y, e.base.y * blinkY, 28, dt);
      }
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.2);
      const e = this.flash * this.flash * 0.9;
      for (const m of this.materials) m.emissive.setRGB(e * 0.6, e, e * 0.8);
    }
  }

  /** 見つかった瞬間、顔が飛び出して体が驚いた形に潰れる */
  reactFound() {
    this.reaction = 'found';
    this.faceTarget = 1;
    this.faceScale = 1;
    this.face.scale.setScalar(1);
    for (const e of this.eyes) {
      e.mesh.scale.set(e.base.x * 1.18, e.base.y * 1.3, e.base.z);
    }
    this.mouth.scale.set(
      this.mouthBaseScale.x * 0.65,
      this.mouthBaseScale.y * 2.1,
      this.mouthBaseScale.z
    );
    this.body.scale.set(1.16, 0.76, 1.12);
    for (const a of this.arms) a.pivot.rotation.z = a.side * 2.35;
  }

  /** 生き残ったら顔を戻してYポーズで喜ぶ */
  reactWin() {
    this.reaction = 'win';
    this.faceTarget = 1;
    this.faceScale = 1;
    this.face.scale.setScalar(1);
    for (const e of this.eyes) e.mesh.scale.copy(e.base);
    this.mouth.scale.set(
      this.mouthBaseScale.x * 1.55,
      this.mouthBaseScale.y * 0.65,
      this.mouthBaseScale.z
    );
    this.pose = 'ypose';
    this.poseIndex = POSES.indexOf('ypose');
    this.body.scale.set(1, 1, 1);
    this.applyPoseInstant();
    this.visual.position.y = 0.08;
  }

  /** 静止度 0..1（止まっているほど1） */
  get stillness() { return clamp(this.stillTime / 0.9, 0, 1); }

  poseTargets() {
    const swing = Math.sin(this.walkPhase) * 0.55;
    switch (this.pose) {
      case 'tpose':
        return { armZ: Math.PI / 2, armX: 0, legX: 0, scaleY: 1, scaleXZ: 1, swing: swing * 0.2 };
      case 'ypose':
        return { armZ: 2.36, armX: 0, legX: 0, scaleY: 1.0, scaleXZ: 1, swing: swing * 0.2 };
      case 'crouch':
        return { armZ: 0.5, armX: -0.5, legX: 0, scaleY: 0.6, scaleXZ: 1.14, swing: swing * 0.3 };
      default:
        return { armZ: 0.1, armX: 0, legX: 0, scaleY: 1, scaleXZ: 1, swing };
    }
  }

  updatePoseTransforms(dt, moving) {
    const t = this.poseTargets();
    const k = 10;
    for (const a of this.arms) {
      a.pivot.rotation.z = damp(a.pivot.rotation.z, a.side * t.armZ, k, dt);
      a.pivot.rotation.x = damp(a.pivot.rotation.x, t.armX + (moving ? -a.side * t.swing * 0.6 : 0), k, dt);
    }
    for (const l of this.legs) {
      l.pivot.rotation.x = damp(l.pivot.rotation.x, t.legX + (moving ? l.side * t.swing : 0), k, dt);
    }
    this.body.scale.y = damp(this.body.scale.y, t.scaleY, k, dt);
    this.body.scale.x = damp(this.body.scale.x, t.scaleXZ, k, dt);
    this.body.scale.z = damp(this.body.scale.z, t.scaleXZ, k, dt);
  }

  applyPoseInstant() {
    const t = this.poseTargets();
    for (const a of this.arms) {
      a.pivot.rotation.set(0, 0, a.side * t.armZ);
      a.pivot.rotation.x = t.armX;
    }
    for (const l of this.legs) l.pivot.rotation.x = 0;
    this.body.scale.set(t.scaleXZ, t.scaleY, t.scaleXZ);
  }

  /** 現在の実際の身長（しゃがみを反映） */
  get currentHeight() { return this.height * this.body.scale.y; }

  /** 視線判定に使うサンプル点 */
  sightPoints(out) {
    const p = this.root.position;
    const s = this.body.scale.y;
    out[0].set(p.x, 1.78 * s, p.z);
    out[1].set(p.x, 1.08 * s, p.z);
    out[2].set(p.x, 0.45 * s, p.z);
    return out;
  }
}
