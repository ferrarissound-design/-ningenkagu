// 鬼NPC：巡回・視界・警戒
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp, randRange, angleDelta } from './utils.js';
import { resolveCollisions } from './stage.js';

export const VIEW = {
  range: 14.0,         // 正面視界の距離
  halfAngle: 0.63,     // 約36度
  periRange: 3.4,      // 至近距離の広い視界
  periHalfAngle: 1.5,  // 約86度
  eyeHeight: 1.62,
};

export const STATE = { PATROL: 'patrol', LOOK: 'look', SUSPECT: 'suspect', FOUND: 'found' };

export class Oni {
  constructor(scene, stage) {
    this.stage = stage;
    this.root = new THREE.Group();
    scene.add(this.root);

    const skin = 0x8e3b52;
    const cloth = 0x2f2536;
    const mk = (c, e = 0x000000) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(c), roughness: 0.6, metalness: 0.1,
      emissive: new THREE.Color(e),
    });
    const box = (w, h, d, y, c, x = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mk(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    // 体（前は +Z）
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.body.add(box(0.62, 0.78, 0.34, 1.22, cloth));
    this.body.add(box(0.2, 0.12, 0.2, 1.68, skin));

    this.head = new THREE.Group();
    this.head.position.y = 1.62;
    this.body.add(this.head);
    const headMesh = box(0.36, 0.36, 0.34, 0.2, skin);
    this.head.add(headMesh);
    // 角
    for (const sx of [-0.11, 0.11]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), mk(0xf0e6d2));
      horn.position.set(sx, 0.45, -0.02);
      this.head.add(horn);
    }
    // 光る目（前方 +Z）
    this.eyeMat = mk(0xffdd55, 0xffcc33);
    for (const sx of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), this.eyeMat);
      eye.position.set(sx, 0.24, 0.18);
      this.head.add(eye);
    }

    this.arms = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.4, 1.5, 0);
      const arm = box(0.16, 0.62, 0.16, -0.31, skin);
      pivot.add(arm);
      this.body.add(pivot);
      this.arms.push({ pivot, side });
    }
    this.legs = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.16, 0.86, 0);
      const leg = box(0.2, 0.86, 0.22, -0.43, cloth);
      pivot.add(leg);
      this.body.add(pivot);
      this.legs.push({ pivot, side });
    }

    // 視界コーン（床のファン）
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.24,
      depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.coneSegments = 26;
    this.cone = new THREE.Mesh(buildFanGeometry(VIEW.halfAngle, VIEW.range, this.coneSegments), this.coneMat);
    this.cone.position.y = 0.03;
    this.root.add(this.cone);

    this.raycaster = new THREE.Raycaster();
    this.coneRay = new THREE.Raycaster();
    this.coneTimer = 0;
    this.coneDist = new Float32Array(this.coneSegments + 1).fill(VIEW.range);
    this._coneOrigin = new THREE.Vector3();
    this._coneDir = new THREE.Vector3();
    this.samples = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    this.reset();
  }

  get position() { return this.root.position; }

  reset() {
    this.root.position.copy(this.stage.oniSpawn);
    // 開始直後はプレイヤーに背を向けて、隠れる時間を少し与える
    const ps = this.stage.playerSpawn;
    this.facing = Math.atan2(this.root.position.x - ps.x, this.root.position.z - ps.z);
    this.headSweep = 0;
    this.state = STATE.LOOK;
    this.wpIndex = 0;
    this.target = this.stage.waypoints[0].clone();
    this.stateTimer = 2.0;
    this.stuckTimer = 0;
    this.walkPhase = 0;
    this.speed = 0;
    this.lastSeen = new THREE.Vector3();
    this.stareTimer = 0;
    this.pickWaypoint();
    this.root.rotation.y = this.facing;
    this.headSweep = 0;
    this.headSweepTarget = 0.6;
  }

  pickWaypoint() {
    const wps = this.stage.waypoints;
    let idx = this.wpIndex;
    for (let i = 0; i < 8; i++) {
      const cand = Math.floor(Math.random() * wps.length);
      if (cand !== this.wpIndex && wps[cand].distanceTo(this.root.position) > 2.5) { idx = cand; break; }
    }
    this.wpIndex = idx;
    this.target.copy(wps[idx]);
    this.stuckTimer = 0;
  }

  /** 現在の視線方向（首振りを含む） */
  get lookAngle() { return this.facing + this.headSweep; }

  eyePos(out) {
    return out.set(this.root.position.x, VIEW.eyeHeight, this.root.position.z);
  }

  /**
   * プレイヤーが見えているか判定する。
   * 距離・角度・遮蔽（Raycaster）を考慮。
   */
  senseTarget(player, occluders) {
    const eye = this.eyePos(this._eye);
    const pp = player.position;
    const dx = pp.x - eye.x, dz = pp.z - eye.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const result = { visible: false, dist, centrality: 0, fraction: 0, peripheral: false };
    if (dist < 0.001) return result;

    const ang = Math.abs(angleDelta(this.lookAngle, Math.atan2(dx, dz)));
    const inMain = ang <= VIEW.halfAngle && dist <= VIEW.range;
    const inPeri = ang <= VIEW.periHalfAngle && dist <= VIEW.periRange;
    if (!inMain && !inPeri) return result;
    result.peripheral = !inMain;

    // 遮蔽チェック：頭・胴・脚の3点
    const pts = player.sightPoints(this.samples);
    let unblocked = 0;
    for (const pt of pts) {
      this._dir.subVectors(pt, eye);
      const len = this._dir.length();
      if (len < 0.001) continue;
      this._dir.divideScalar(len);
      this.raycaster.set(eye, this._dir);
      this.raycaster.far = len - 0.12;
      this.raycaster.near = 0.05;
      const hits = this.raycaster.intersectObjects(occluders, false);
      if (hits.length === 0) unblocked++;
    }
    if (unblocked === 0) return result;

    result.visible = true;
    result.fraction = unblocked / pts.length;
    result.centrality = inMain ? clamp(1 - ang / VIEW.halfAngle, 0, 1) * result.fraction : 0.25 * result.fraction;
    return result;
  }

  /** 壁や家具で視線が止まるところまでコーンを削る（見た目の分かりやすさ用） */
  updateConeShape(dt, occluders) {
    this.coneTimer -= dt;
    if (this.coneTimer > 0) return;
    this.coneTimer = 0.12;
    const n = this.coneSegments;
    const base = this.lookAngle;
    this._coneOrigin.set(this.root.position.x, 1.05, this.root.position.z);
    for (let i = 0; i <= n; i++) {
      const local = -VIEW.halfAngle + (2 * VIEW.halfAngle * i) / n;
      const a = base + local;
      this._coneDir.set(Math.sin(a), 0, Math.cos(a));
      this.coneRay.set(this._coneOrigin, this._coneDir);
      this.coneRay.near = 0.1;
      this.coneRay.far = VIEW.range;
      const hits = this.coneRay.intersectObjects(occluders, false);
      this.coneDist[i] = hits.length > 0 ? Math.max(0.4, hits[0].distance - 0.05) : VIEW.range;
    }
    const attr = this.cone.geometry.getAttribute('position');
    const arr = attr.array;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a0 = -VIEW.halfAngle + (2 * VIEW.halfAngle * i) / n;
      const a1 = -VIEW.halfAngle + (2 * VIEW.halfAngle * (i + 1)) / n;
      arr[k++] = 0; arr[k++] = 0; arr[k++] = 0;
      arr[k++] = Math.sin(a0) * this.coneDist[i]; arr[k++] = 0; arr[k++] = Math.cos(a0) * this.coneDist[i];
      arr[k++] = Math.sin(a1) * this.coneDist[i + 1]; arr[k++] = 0; arr[k++] = Math.cos(a1) * this.coneDist[i + 1];
    }
    attr.needsUpdate = true;
  }

  update(dt, sense, suspicion) {
    // --- 状態遷移 ---
    if (this.state !== STATE.FOUND) {
      if (suspicion >= 0.4 && sense.visible) {
        if (this.state !== STATE.SUSPECT) { this.state = STATE.SUSPECT; this.stareTimer = 0; }
        this.lastSeen.set(sense.px, 0, sense.pz);
      } else if (this.state === STATE.SUSPECT && suspicion < 0.12) {
        this.state = STATE.PATROL;
        this.pickWaypoint();
      }
    }

    switch (this.state) {
      case STATE.PATROL: this.updatePatrol(dt); break;
      case STATE.LOOK: this.updateLook(dt); break;
      case STATE.SUSPECT: this.updateSuspect(dt); break;
      case STATE.FOUND: this.updateFound(dt, sense); break;
    }

    this.root.rotation.y = this.facing;
    this.head.rotation.y = this.headSweep;
    this.cone.rotation.y = this.headSweep;

    // 歩行アニメ
    const moving = this.speed > 0.05;
    this.walkPhase += dt * (moving ? this.speed * 3.0 : 0);
    const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    for (const l of this.legs) l.pivot.rotation.x = damp(l.pivot.rotation.x, l.side * swing, 12, dt);
    for (const a of this.arms) {
      const raise = this.state === STATE.SUSPECT ? -0.35 : 0;
      a.pivot.rotation.x = damp(a.pivot.rotation.x, raise - a.side * swing * 0.7, 12, dt);
      a.pivot.rotation.z = damp(a.pivot.rotation.z, a.side * 0.12, 10, dt);
    }

    // 視界コーンの色
    const c = this.coneMat.color;
    if (this.state === STATE.FOUND) c.setHex(0xff2d2d);
    else if (this.state === STATE.SUSPECT) c.setHex(0xff7043);
    else c.setHex(0xffd166);
    this.coneMat.opacity = 0.22 + suspicion * 0.3;
    this.eyeMat.emissive.setRGB(1, clamp(0.85 - suspicion * 0.8, 0, 1), 0.2);
  }

  moveToward(dt, tx, tz, speed) {
    const p = this.root.position;
    const dx = tx - p.x, dz = tz - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.05) { this.speed = 0; return 0; }
    const nx = dx / d, nz = dz / d;
    const step = Math.min(speed * dt, d);
    const before = { x: p.x, z: p.z };
    p.x += nx * step;
    p.z += nz * step;
    resolveCollisions(p, 0.42, this.stage.solids);
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    this.speed = moved / Math.max(dt, 0.0001);
    // 進行方向を向く
    const want = Math.atan2(nx, nz);
    this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 4.0);
    if (moved < speed * dt * 0.35) this.stuckTimer += dt; else this.stuckTimer = 0;
    return d;
  }

  updatePatrol(dt) {
    this.headSweep = damp(this.headSweep, 0, 4, dt);
    const d = this.moveToward(dt, this.target.x, this.target.z, 2.15);
    if (d < 0.6 || this.stuckTimer > 1.2) {
      this.state = STATE.LOOK;
      this.stateTimer = randRange(1.2, 2.6);
      this.headSweepTarget = (Math.random() < 0.5 ? -1 : 1) * randRange(0.6, 1.15);
      this.speed = 0;
    }
  }

  updateLook(dt) {
    this.speed = damp(this.speed, 0, 10, dt);
    this.stateTimer -= dt;
    // ゆっくり首を振って周囲を見回す
    this.headSweep = damp(this.headSweep, this.headSweepTarget, 2.2, dt);
    if (Math.abs(this.headSweep - this.headSweepTarget) < 0.08) {
      this.headSweepTarget = -this.headSweepTarget;
    }
    if (this.stateTimer <= 0) {
      this.state = STATE.PATROL;
      this.pickWaypoint();
    }
  }

  giveUp() {
    this.state = STATE.PATROL;
    this.stareTimer = 0;
    this.pickWaypoint();
  }

  updateSuspect(dt) {
    this.stareTimer += dt;
    if (this.stareTimer > 14) { this.giveUp(); return; }
    const p = this.root.position;
    const dist = Math.hypot(this.lastSeen.x - p.x, this.lastSeen.z - p.z);
    this.headSweep = damp(this.headSweep, 0, 6, dt);
    if (dist > 2.4) {
      this.moveToward(dt, this.lastSeen.x, this.lastSeen.z, 2.6);
    } else {
      // じっと見つめる
      this.speed = damp(this.speed, 0, 12, dt);
      const want = Math.atan2(this.lastSeen.x - p.x, this.lastSeen.z - p.z);
      this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 6);
    }
  }

  updateFound(dt, sense) {
    this.speed = damp(this.speed, 0, 8, dt);
    this.headSweep = damp(this.headSweep, 0, 8, dt);
    const p = this.root.position;
    const want = Math.atan2(sense.px - p.x, sense.pz - p.z);
    this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 8);
  }
}

/** 床に置く扇形（ローカル +Z 方向が正面） */
function buildFanGeometry(halfAngle, radius, segments) {
  const pos = [];
  for (let i = 0; i < segments; i++) {
    const a0 = -halfAngle + (2 * halfAngle * i) / segments;
    const a1 = -halfAngle + (2 * halfAngle * (i + 1)) / segments;
    pos.push(0, 0, 0);
    pos.push(Math.sin(a0) * radius, 0, Math.cos(a0) * radius);
    pos.push(Math.sin(a1) * radius, 0, Math.cos(a1) * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
