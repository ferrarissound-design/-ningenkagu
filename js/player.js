// プレイヤー（人型キャラクター）
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp } from './utils.js';

export const POSES = ['stand', 'tpose', 'ypose', 'crouch'];
export const POSE_LABEL = {
  stand: '直立',
  tpose: 'Tポーズ',
  ypose: 'Yポーズ',
  crouch: 'しゃがみ',
};

const SKIN = 0xe8b48c;
const CLOTH = 0x4a6fa5;

export class Player {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.body = new THREE.Group(); // ポーズによる拡縮はここに掛ける
    this.root.add(this.body);

    this.materials = [];
    const mk = (color) => {
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color), roughness: 0.7, metalness: 0.0,
        emissive: new THREE.Color(0x000000),
      });
      this.materials.push(m);
      return m;
    };

    const mesh = (w, h, d, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mk(color));
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // 胴体
    this.torso = mesh(0.5, 0.66, 0.28, CLOTH);
    this.torso.position.y = 1.14;
    this.body.add(this.torso);

    // 首と頭
    const neck = mesh(0.14, 0.1, 0.14, SKIN);
    neck.position.y = 1.51;
    this.body.add(neck);
    this.head = mesh(0.3, 0.3, 0.28, SKIN);
    this.head.position.y = 1.7;
    this.body.add(this.head);
    // 顔の向きが分かるように前髪
    const hair = mesh(0.32, 0.1, 0.3, 0x3a2b22);
    hair.position.set(0, 1.87, 0);
    this.body.add(hair);

    // 腕（肩を軸に回す）
    this.arms = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.32, 1.42, 0);
      const arm = mesh(0.14, 0.56, 0.14, SKIN);
      arm.position.y = -0.28;
      pivot.add(arm);
      this.body.add(pivot);
      this.arms.push({ pivot, side });
    }

    // 脚
    this.legs = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.13, 0.82, 0);
      const leg = mesh(0.18, 0.82, 0.19, 0x3d4a63);
      leg.position.y = -0.41;
      pivot.add(leg);
      this.body.add(pivot);
      this.legs.push({ pivot, side });
    }

    this.height = 1.85;
    this.radius = 0.32;
    this.pose = 'stand';
    this.poseIndex = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.yaw = 0;
    this.stillTime = 0;
    this.flash = 0;

    // 擬態状態
    this.mimicTarget = null;
    this.baseColors = this.materials.map((m) => m.color.clone());
    this.currentColor = new THREE.Color(SKIN);
  }

  get position() { return this.root.position; }

  reset(pos) {
    this.root.position.copy(pos);
    this.yaw = 0;
    this.root.rotation.y = 0;
    this.pose = 'stand';
    this.poseIndex = 0;
    this.stillTime = 0;
    this.speed = 0;
    this.flash = 0;
    this.mimicTarget = null;
    this.materials.forEach((m, i) => {
      m.color.copy(this.baseColors[i]);
      m.roughness = 0.7;
      m.metalness = 0.0;
      m.emissive.setHex(0x000000);
    });
    this.currentColor.setHex(SKIN);
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
  }

  cyclePose() {
    this.poseIndex = (this.poseIndex + 1) % POSES.length;
    this.pose = POSES[this.poseIndex];
    return this.pose;
  }

  /** 移動と姿勢の更新 */
  update(dt, moveDir, moveSpeed) {
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

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.2);
      const e = this.flash * this.flash * 0.9;
      for (const m of this.materials) m.emissive.setRGB(e * 0.6, e, e * 0.8);
    }
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
    out[0].set(p.x, 1.72 * s, p.z);
    out[1].set(p.x, 1.12 * s, p.z);
    out[2].set(p.x, 0.45 * s, p.z);
    return out;
  }
}
