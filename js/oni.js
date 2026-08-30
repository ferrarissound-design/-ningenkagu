// 鬼NPC：巡回・視界・警戒
//
// 性格タイプの定義は oniPersonalities.js、見た目の組み立ては oniVisuals.js、
// 家具検査モード（INSPECT）の動作は oniInspect.js に分けてある。
// このファイルには状態遷移・移動・知覚など「鬼の本体」だけを残す。
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp, randRange, angleDelta, rectDistance, disposeObject3D } from './utils.js';
import { resolveCollisions } from './stage.js';
import { STATE, EVENT_BREAK_SUSPICION, INSPECT, ONI_RADIUS, PATH_CLEARANCE } from './oniConstants.js';
import { VIEW, MOVE, HEARING, ONI_PERSONALITIES, DEFAULT_ONI_PERSONALITY } from './oniPersonalities.js';
import { buildOniVisuals, ONI_CONE_SEGMENTS } from './oniVisuals.js';
import { applyInspectBehavior } from './oniInspect.js';

export class Oni {
  constructor(scene, stage) {
    this.stage = stage;
    this.root = new THREE.Group();
    scene.add(this.root);

    // 性格タイプ由来の値。setPersonality() で作り直す。
    // コーン生成より前に必要なので、まず既定値で埋めておく。
    this.applyPersonality(DEFAULT_ONI_PERSONALITY);

    Object.assign(this, buildOniVisuals(this.root, this.view));
    this.coneSegments = ONI_CONE_SEGMENTS;

    this.raycaster = new THREE.Raycaster();
    this.coneRay = new THREE.Raycaster();
    this.coneTimer = 0;
    this.coneDist = new Float32Array(this.coneSegments + 1).fill(this.view.range);
    this._coneOrigin = new THREE.Vector3();
    this._coneDir = new THREE.Vector3();
    this.samples = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._legGoal = new THREE.Vector3();

    this.reset();
  }

  get position() { return this.root.position; }

  /**
   * 性格タイプから実際の数値を組み立てる。
   * 既存の巡回・視界・INSPECT はここで作った値を参照するだけなので、
   * 仕組み自体は1つのまま「補正だけ」が変わる。
   */
  applyPersonality(id) {
    const p = ONI_PERSONALITIES[id] || ONI_PERSONALITIES[DEFAULT_ONI_PERSONALITY];
    this.personality = p;
    this.personalityId = p.id;
    this.tune = p;
    // 性格タイプで決まる素の視界。ステージイベント中はここへさらに倍率が掛かる
    this.baseView = {
      range: VIEW.range * p.visionRangeScale,
      halfAngle: VIEW.halfAngle * p.visionAngleScale,
      periRange: VIEW.periRange * p.periRangeScale,
      periHalfAngle: VIEW.periHalfAngle,
      eyeHeight: VIEW.eyeHeight,
    };
    this.eventVision = this.eventVision || { range: 1, angle: 1, peri: 1, detect: 1 };
    this.refreshView();
    this.moveSpeed = {
      patrol: MOVE.patrol * p.speedScale,
      suspect: MOVE.suspect * p.speedScale,
      approach: INSPECT.approachSpeed * p.speedScale,
      flank: INSPECT.flankSpeed * p.speedScale,
    };
    // 既存の INSPECT 設定に倍率を掛けるだけ。極端な 0% / 100% にはしない
    this.inspectChance = clamp(INSPECT.chance * p.inspectChanceScale, 0.05, 0.85);
    return p;
  }

  /** baseView（性格タイプ）×eventVision（ステージイベント）から実効視界を組み立てる */
  refreshView() {
    const b = this.baseView;
    const e = this.eventVision;
    this.view = {
      range: b.range * e.range,
      halfAngle: b.halfAngle * e.angle,
      periRange: b.periRange * e.peri,
      periHalfAngle: b.periHalfAngle,
      eyeHeight: b.eyeHeight,
    };
  }

  /**
   * ステージイベント中の一時的な視界補正。
   * 元の視界（性格タイプ）は baseView に残るので、解除すれば必ず元へ戻る。
   */
  setEventVision(scales = {}) {
    this.eventVision = {
      range: scales.range ?? 1,
      angle: scales.angle ?? 1,
      peri: scales.peri ?? 1,
      detect: scales.detect ?? 1,
    };
    this.refreshView();
    if (this.cone) this.refreshCone();
  }

  clearEventVision() {
    if (this.eventVision.range === 1 && this.eventVision.angle === 1
      && this.eventVision.peri === 1 && this.eventVision.detect === 1) return;
    this.setEventVision();
  }

  /** イベント中の「見抜く力」倍率。game.js の警戒度計算が参照する */
  get eventDetectScale() { return this.eventVision.detect; }

  /** ゲーム開始時に呼ぶ。視界コーンの見た目もここで作り直す */
  setPersonality(id) {
    const p = this.applyPersonality(id);
    if (this.cone) this.refreshCone();
    return p;
  }

  /** 視界コーンを今の視界設定でいったん最大まで伸ばし直す */
  refreshCone() {
    this.coneDist.fill(this.view.range);
    this.writeConeGeometry();
    this.coneTimer = 0;
  }

  reset() {
    this.root.position.copy(this.stage.oniSpawn);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.eyeGroup.scale.copy(this.eyeBaseScale);
    this.mouth.scale.copy(this.mouthBaseScale);
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
    this.idlePhase = 0;
    this.speed = 0;
    this.lastSeen = new THREE.Vector3();
    this.stareTimer = 0;

    // --- 家具検査モード ---
    this.inspectAnchor = new THREE.Vector3();
    this.inspectActs = [];
    this.inspectAct = null;
    this.inspectWatching = true;   // 今プレイヤーを見ているか（フェイント中は false）
    this.inspectFinished = false;  // 検査完走。game 側の判定待ち
    this.inspectPending = false;   // この SUSPECT は検査に進む予定か
    this.inspectCooldown = INSPECT.firstDelay * this.tune.inspectCooldownScale;
    this.furnitureTimer = 0.8;     // 家具の前で足を止めるかの判定間隔
    this.inspectShort = false;     // 残り時間が少ないときは短縮する
    this.inspectTimeout = 0;
    this.inspectDoneHold = 0;
    this.inspectCue = null;        // 'start' | 'telegraph' | 'turnback'
    this.inspectFlash = 0;

    // --- ステージイベント ---
    this.eventFocus = null;        // イベント中に注目している場所
    this.setEventVision();         // 視界補正を必ず素へ戻す

    this.seenX = this.root.position.x;
    this.seenZ = this.root.position.z;
    this.head.rotation.set(0, 0, 0);
    this.head.position.z = 0;
    for (const k in this.marks) this.marks[k].visible = false;

    this.pickWaypoint();
    this.root.rotation.y = this.facing;
    this.headSweep = 0;
    this.headSweepTarget = 0.6;
  }

  pickWaypoint() {
    const wps = this.stage.waypoints;
    const candidates = [];
    for (let i = 0; i < wps.length; i++) {
      const dist = wps[i].distanceTo(this.root.position);
      if (i !== this.wpIndex && dist > 1.2 && this.canWalkDirectly(wps[i])) candidates.push(i);
    }
    // 追跡後など、直前の目的地しか見通せない位置ではそれも候補に戻す
    if (candidates.length === 0) {
      for (let i = 0; i < wps.length; i++) {
        if (wps[i].distanceTo(this.root.position) > 0.4 && this.canWalkDirectly(wps[i])) candidates.push(i);
      }
    }
    const idx = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : this.wpIndex;
    this.wpIndex = idx;
    this.target.copy(wps[idx]);
    this.stuckTimer = 0;
  }

  /** 2点を結ぶ直線が家具に当たらないかを軽量に調べる */
  segmentClear(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.18));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + dx * t;
      const z = az + dz * t;
      for (const s of this.stage.solids) {
        if (
          x > s.minX - PATH_CLEARANCE && x < s.maxX + PATH_CLEARANCE &&
          z > s.minZ - PATH_CLEARANCE && z < s.maxZ + PATH_CLEARANCE
        ) return false;
      }
    }
    return true;
  }

  /** 家具を避けて目的地まで直進できるかを軽量に調べる */
  canWalkDirectly(target) {
    const p = this.root.position;
    return this.segmentClear(p.x, p.z, target.x, target.z);
  }

  /**
   * 直進、または巡回ポイント1つの経由で目的地まで行けるか。
   * イベント地点を選ぶときだけ使う（毎フレームは呼ばない）。
   */
  canReachEventSpot(target) {
    if (this.canWalkDirectly(target)) return true;
    for (const w of this.stage.waypoints) {
      if (!this.canWalkDirectly(w)) continue;
      if (this.segmentClear(w.x, w.z, target.x, target.z)) return true;
    }
    return false;
  }

  /** 現在の視線方向（首振りを含む） */
  get lookAngle() { return this.facing + this.headSweep; }

  eyePos(out) {
    return out.set(this.root.position.x, this.view.eyeHeight, this.root.position.z);
  }

  /** 一番近い「家具」（壁以外の擬態対象）までの距離 */
  nearestFurnitureDist() {
    const p = this.root.position;
    let best = Infinity;
    for (const t of this.stage.targets) {
      if (t.kind === 'wall') continue;
      const d = rectDistance(t.rect, p.x, p.z);
      if (d < best) best = d;
    }
    return best;
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
    const inMain = ang <= this.view.halfAngle && dist <= this.view.range;
    const inPeri = ang <= this.view.periHalfAngle && dist <= this.view.periRange;
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
    result.centrality = inMain ? clamp(1 - ang / this.view.halfAngle, 0, 1) * result.fraction : 0.25 * result.fraction;
    return result;
  }

  /**
   * 足音の判定。視界と違って遮蔽物は見ない（壁越しでも聞こえる）が、
   * 距離だけで急速に減衰する。loudness はプレイヤー側の「どれだけ音を立てているか」(0..1)。
   */
  hearTarget(player, loudness) {
    const p = player.position;
    if (loudness <= 0) return { level: 0, x: p.x, z: p.z };
    const dx = p.x - this.root.position.x, dz = p.z - this.root.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const range = HEARING.range * this.tune.detectFalloffScale;
    const falloff = clamp(1 - dist / range, 0, 1);
    return { level: loudness * falloff * this.tune.detectScale, x: p.x, z: p.z };
  }

  /** 壁や家具で視線が止まるところまでコーンを削る（見た目の分かりやすさ用） */
  updateConeShape(dt, occluders) {
    this.coneTimer -= dt;
    if (this.coneTimer > 0) return;
    this.coneTimer = 0.12;
    const n = this.coneSegments;
    const half = this.view.halfAngle;
    const base = this.lookAngle;
    this._coneOrigin.set(this.root.position.x, 1.05, this.root.position.z);
    for (let i = 0; i <= n; i++) {
      const local = -half + (2 * half * i) / n;
      const a = base + local;
      this._coneDir.set(Math.sin(a), 0, Math.cos(a));
      this.coneRay.set(this._coneOrigin, this._coneDir);
      this.coneRay.near = 0.1;
      this.coneRay.far = this.view.range;
      const hits = this.coneRay.intersectObjects(occluders, false);
      this.coneDist[i] = hits.length > 0 ? Math.max(0.4, hits[0].distance - 0.05) : this.view.range;
    }
    this.writeConeGeometry();
  }

  /** coneDist の内容を扇形メッシュへ書き戻す */
  writeConeGeometry() {
    const n = this.coneSegments;
    const half = this.view.halfAngle;
    const attr = this.cone.geometry.getAttribute('position');
    const arr = attr.array;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a0 = -half + (2 * half * i) / n;
      const a1 = -half + (2 * half * (i + 1)) / n;
      arr[k++] = 0; arr[k++] = 0; arr[k++] = 0;
      arr[k++] = Math.sin(a0) * this.coneDist[i]; arr[k++] = 0; arr[k++] = Math.cos(a0) * this.coneDist[i];
      arr[k++] = Math.sin(a1) * this.coneDist[i + 1]; arr[k++] = 0; arr[k++] = Math.cos(a1) * this.coneDist[i + 1];
    }
    attr.needsUpdate = true;
  }

  update(dt, sense, suspicion) {
    this.idlePhase += dt;
    if (this.inspectCooldown > 0) this.inspectCooldown -= dt;
    if (this.inspectFlash > 0) this.inspectFlash -= dt;
    if (typeof sense.px === 'number') { this.seenX = sense.px; this.seenZ = sense.pz; }

    // --- 状態遷移 ---
    if (this.state !== STATE.FOUND) {
      if (this.state === STATE.INSPECT) {
        // 検査中は自前のシナリオで動く。見えている間だけ位置を更新する
        if (sense.visible) this.lastSeen.set(this.seenX, 0, this.seenZ);
      } else if (this.state === STATE.EVENT) {
        // イベントに気を取られていても、派手に動かれれば気づく。
        // ここを通ると「気を取られている時間」は即終了する＝無敵時間にはしない。
        if (sense.visible && suspicion >= EVENT_BREAK_SUSPICION) {
          this.lastSeen.set(sense.px, 0, sense.pz);
          this.endEventFocus(false);
          this.enterSuspect();
        }
      } else if (suspicion >= 0.4 && sense.visible) {
        if (this.state !== STATE.SUSPECT) this.enterSuspect();
        this.lastSeen.set(sense.px, 0, sense.pz);
      } else if (suspicion >= 0.4 && (sense.heard || 0) >= HEARING.alertLevel) {
        // 姿は見えていないが、足音で位置がバレた＝そこへ向かう
        if (this.state !== STATE.SUSPECT) this.enterSuspect();
        this.lastSeen.set(sense.hx, 0, sense.hz);
      } else if (this.state === STATE.SUSPECT && suspicion < 0.12) {
        this.state = STATE.PATROL;
        this.inspectPending = false;
        this.pickWaypoint();
      }
    }

    switch (this.state) {
      case STATE.PATROL: this.updatePatrol(dt); break;
      case STATE.LOOK: this.updateLook(dt); break;
      case STATE.SUSPECT: this.updateSuspect(dt); break;
      case STATE.INSPECT: this.updateInspect(dt); break;
      case STATE.EVENT: this.updateEventFocus(dt); break;
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
      const raise = this.state === STATE.INSPECT ? -0.55 : this.state === STATE.SUSPECT ? -0.35 : 0;
      a.pivot.rotation.x = damp(a.pivot.rotation.x, raise - a.side * swing * 0.7, 12, dt);
      a.pivot.rotation.z = damp(a.pivot.rotation.z, a.side * 0.12, 10, dt);
    }

    // 丸い体を弾ませ、状態に応じて一つ目の表情を変える
    const bob = moving
      ? Math.abs(Math.sin(this.walkPhase)) * 0.05
      : Math.sin(this.idlePhase * 1.8) * 0.022;
    const lean = moving ? Math.sin(this.walkPhase) * 0.035 : 0;
    this.body.position.y = damp(this.body.position.y, bob, 10, dt);
    this.body.rotation.z = damp(this.body.rotation.z, lean, 9, dt);

    let eyeX = 1, eyeY = 1, mouthX = 1, mouthY = 1;
    let headTilt = 0, headLean = 0;
    if (this.state === STATE.SUSPECT) {
      eyeX = 1.12; eyeY = 0.72;
      mouthX = 1.25; mouthY = 0.72;
    } else if (this.state === STATE.INSPECT) {
      // 目を細めて首をかしげる「なんだこの家具？」の顔
      eyeX = 1.22; eyeY = 0.46;
      mouthX = 0.78; mouthY = 1.35;
      headTilt = Math.sin(this.idlePhase * 1.7) * 0.26;
      headLean = this.inspectWatching ? 0.13 : 0;
      if (this.inspectFlash > 0) { eyeY = 1.3; eyeX = 1.3; headTilt *= 0.25; }
    } else if (this.state === STATE.FOUND) {
      eyeX = 1.28; eyeY = 1.22;
      mouthX = 0.72; mouthY = 2.0;
    }
    this.head.rotation.z = damp(this.head.rotation.z, headTilt, 7, dt);
    this.head.position.z = damp(this.head.position.z, headLean, 8, dt);
    this.updateMarks();
    this.eyeGroup.scale.x = damp(this.eyeGroup.scale.x, this.eyeBaseScale.x * eyeX, 12, dt);
    this.eyeGroup.scale.y = damp(this.eyeGroup.scale.y, this.eyeBaseScale.y * eyeY, 12, dt);
    this.mouth.scale.x = damp(this.mouth.scale.x, this.mouthBaseScale.x * mouthX, 12, dt);
    this.mouth.scale.y = damp(this.mouth.scale.y, this.mouthBaseScale.y * mouthY, 12, dt);

    // 視界コーンの色
    const c = this.coneMat.color;
    if (this.state === STATE.FOUND) c.setHex(0xff2d2d);
    else if (this.state === STATE.EVENT) c.setHex(0x74c7ff);
    else if (this.state === STATE.INSPECT) c.setHex(0xff9020);
    else if (this.state === STATE.SUSPECT) c.setHex(0xff7043);
    else c.setHex(0xffd166);
    this.coneMat.opacity = 0.22 + suspicion * 0.3
      // 検査中はコーンを脈打たせて「調べられている」ことを伝える
      + (this.state === STATE.INSPECT ? 0.12 + Math.sin(this.idlePhase * 7) * 0.07 : 0);
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
    resolveCollisions(p, ONI_RADIUS, this.stage.solids);
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    this.speed = moved / Math.max(dt, 0.0001);
    // 進行方向を向く
    const want = Math.atan2(nx, nz);
    this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 4.0);
    if (moved < speed * dt * 0.35) this.stuckTimer += dt; else this.stuckTimer = 0;
    return d;
  }

  /** 立ち止まって見回す。scale で「ちょっとだけ足を止める」も表せる */
  enterLook(scale = 1) {
    this.state = STATE.LOOK;
    this.stateTimer = randRange(1.2, 2.6) * this.tune.lookTimeScale * scale;
    this.headSweepTarget = (Math.random() < 0.5 ? -1 : 1) * randRange(0.6, 1.15) * this.tune.sweepScale;
    this.speed = 0;
  }

  updatePatrol(dt) {
    this.headSweep = damp(this.headSweep, 0, 4, dt);
    const d = this.moveToward(dt, this.target.x, this.target.z, this.moveSpeed.patrol);
    if (d < 0.6 || this.stuckTimer > 1.2) {
      this.enterLook();
      return;
    }
    // 疑り深い鬼は、通りすがりの家具の前でもつい足を止めて確かめる
    if (this.tune.furniturePause > 0) {
      this.furnitureTimer -= dt;
      if (this.furnitureTimer <= 0) {
        this.furnitureTimer = 0.7;
        if (this.nearestFurnitureDist() < 2.0 && Math.random() < this.tune.furniturePause) {
          this.enterLook(0.7);
        }
      }
    }
  }

  updateLook(dt) {
    this.speed = damp(this.speed, 0, 10, dt);
    this.stateTimer -= dt;
    // ゆっくり首を振って周囲を見回す
    this.headSweep = damp(this.headSweep, this.headSweepTarget, 2.2 * this.tune.sweepRate, dt);
    if (Math.abs(this.headSweep - this.headSweepTarget) < 0.08) {
      this.headSweepTarget = -this.headSweepTarget;
    }
    if (this.stateTimer <= 0) {
      this.state = STATE.PATROL;
      this.pickWaypoint();
    }
  }

  // ---------------- ステージイベント中の一時行動（EVENT） ----------------

  /**
   * イベント地点に気を取られる。既存の巡回・移動・衝突処理をそのまま使う。
   * @returns {boolean} 実際に切り替えたか（FOUND / INSPECT 中は割り込まない）
   */
  beginEventFocus(opts) {
    if (this.state === STATE.FOUND || this.state === STATE.INSPECT) return false;
    this.eventFocus = {
      lookX: opts.lookX, lookZ: opts.lookZ,
      moveX: typeof opts.moveX === 'number' ? opts.moveX : null,
      moveZ: typeof opts.moveZ === 'number' ? opts.moveZ : null,
      stand: opts.stand ?? 0.35,
      moveScale: opts.moveScale ?? 1,
      glance: opts.glance ?? 0,
      arrived: false,
      leg: null,      // 直進できないときに経由する巡回ポイント
      legTimer: 0,
      bounces: 0,
    };
    this.state = STATE.EVENT;
    this.inspectPending = false;
    this.stareTimer = 0;
    this.stuckTimer = 0;
    return true;
  }

  /**
   * イベントの注目をやめる。
   * @param {boolean} resume 通常AIへ自分で復帰するか。false なら呼び出し側が次の状態を決める
   */
  endEventFocus(resume = true) {
    this.eventFocus = null;
    if (this.state !== STATE.EVENT) return;
    if (!resume) return;
    const linger = this.tune.eventLinger || 0;
    // 疑り深い鬼はすぐ巡回に戻らず、その場でぐるりと確認してから動き出す
    if (linger > 0) this.enterLook(linger);
    else {
      this.state = STATE.PATROL;
      this.pickWaypoint();
    }
  }

  /**
   * イベント地点まで直進できないとき、既存の巡回ポイントを経由点に使う。
   * 机の列などに阻まれても、途中で立ち往生せず黒板前まで行けるようにする。
   */
  pickEventLeg(f, exclude = null) {
    const p = this.root.position;
    this._legGoal.set(f.moveX, 0, f.moveZ);
    if (this.canWalkDirectly(this._legGoal)) { f.leg = null; return; }
    const here = Math.hypot(f.moveX - p.x, f.moveZ - p.z);
    let best = null;
    let bestScore = Infinity;
    for (const w of this.stage.waypoints) {
      if (exclude && Math.abs(w.x - exclude.x) < 0.01 && Math.abs(w.z - exclude.z) < 0.01) continue;
      const toGoal = Math.hypot(w.x - f.moveX, w.z - f.moveZ);
      if (toGoal >= here - 0.3) continue;          // 目的地に近づかない経由点は使わない
      if (!this.canWalkDirectly(w)) continue;
      const score = toGoal + 0.35 * w.distanceTo(p);
      if (score < bestScore) { bestScore = score; best = w; }
    }
    f.leg = best ? { x: best.x, z: best.z } : null;
  }

  updateEventFocus(dt) {
    const f = this.eventFocus;
    if (!f) { this.endEventFocus(true); return; }
    const p = this.root.position;

    if (f.moveX !== null && !f.arrived) {
      const d = Math.hypot(f.moveX - p.x, f.moveZ - p.z);
      if (d <= f.stand + 0.12) {
        f.arrived = true;
      } else {
        f.legTimer -= dt;
        const legDone = f.leg && Math.hypot(f.leg.x - p.x, f.leg.z - p.z) < 0.6;
        if (f.legTimer <= 0 || legDone) {
          this.pickEventLeg(f);
          f.legTimer = 0.5;
        }
        const tx = f.leg ? f.leg.x : f.moveX;
        const tz = f.leg ? f.leg.z : f.moveZ;
        this.moveToward(dt, tx, tz, this.moveSpeed.patrol * f.moveScale);
        // 家具に阻まれたら経由点を選び直す。それでも駄目ならその場から見る
        if (this.stuckTimer > 0.8) {
          this.stuckTimer = 0;
          f.bounces++;
          this.pickEventLeg(f, f.leg);
          f.legTimer = 0.5;
          if (f.bounces >= 3) f.arrived = true;
        }
      }
    } else {
      this.speed = damp(this.speed, 0, 10, dt);
    }

    // 到着するまでは進行方向（moveToward が向けた向き）のまま歩き、
    // 着いてからイベント対象へ向き直る。歩きながら横を向く不自然さを避ける。
    if (f.arrived || f.moveX === null) {
      const want = Math.atan2(f.lookX - p.x, f.lookZ - p.z);
      this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 4.5);
    }

    // 首は性格タイプしだい。見張り鬼はテレビを見ながらも周囲を気にする
    const sweep = f.glance > 0.01
      ? Math.sin(this.idlePhase * 1.5) * 1.0 * f.glance
      : 0;
    this.headSweep = damp(this.headSweep, sweep, 2.4 * this.tune.sweepRate, dt);
  }

  giveUp() {
    this.eventFocus = null;
    this.state = STATE.PATROL;
    this.stareTimer = 0;
    this.inspectPending = false;
    this.pickWaypoint();
  }

  /**
   * 怪しみ始めた瞬間に「今回は家具検査をするか」をくじ引きする。
   * 確率は性格タイプ補正込みの this.inspectChance（疑り深い鬼は高く、猪突猛進鬼は低い）。
   * クールダウン中は今までどおり抽選しない＝検査は連続しない。
   */
  enterSuspect() {
    this.state = STATE.SUSPECT;
    this.stareTimer = 0;
    this.inspectPending = this.inspectCooldown <= 0 && Math.random() < this.inspectChance;
  }

  /** 検査後クールダウン。性格タイプで検査の間隔が変わる */
  rollInspectCooldown() {
    return randRange(INSPECT.cooldownMin, INSPECT.cooldownMax) * this.tune.inspectCooldownScale;
  }

  updateSuspect(dt) {
    this.stareTimer += dt;
    if (this.stareTimer > 14) { this.giveUp(); return; }
    const p = this.root.position;
    const dist = Math.hypot(this.lastSeen.x - p.x, this.lastSeen.z - p.z);
    this.headSweep = damp(this.headSweep, 0, 6, dt);
    // 近くまで詰めて、ひと呼吸おいてから検査モードへ
    if (this.inspectPending && this.inspectCooldown <= 0
      && this.stareTimer > INSPECT.startStare && dist < INSPECT.startDist) {
      this.beginInspect();
      return;
    }
    if (dist > 2.4) {
      this.moveToward(dt, this.lastSeen.x, this.lastSeen.z, this.moveSpeed.suspect);
    } else {
      // じっと見つめる
      this.speed = damp(this.speed, 0, 12, dt);
      const want = Math.atan2(this.lastSeen.x - p.x, this.lastSeen.z - p.z);
      this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 6);
    }
  }

  /** 頭上の「？」「！」マーク */
  updateMarks() {
    // 疑り深い鬼は、検査に入る前の「怪しんでいる」段階から「？」を浮かべる
    const suspecting = this.tune.suspectMark
      && this.state === STATE.SUSPECT && this.stareTimer > 0.3;
    const on = this.state === STATE.INSPECT || suspecting;
    const ex = on && this.inspectFlash > 0;
    const q = this.marks.q, e = this.marks.ex;
    if (q.visible !== (on && !ex)) q.visible = on && !ex;
    if (e.visible !== ex) e.visible = ex;
    if (!on) return;
    const s = ex ? 0.74 : 0.6 + Math.sin(this.idlePhase * 5) * 0.045;
    const m = ex ? e : q;
    m.scale.set(s, s, 1);
    m.position.y = 2.6 + Math.sin(this.idlePhase * 3.2) * 0.05;
  }

  updateFound(dt, sense) {
    this.speed = damp(this.speed, 0, 8, dt);
    this.headSweep = damp(this.headSweep, 0, 8, dt);
    const p = this.root.position;
    const want = Math.atan2(sense.px - p.x, sense.pz - p.z);
    this.facing += angleDelta(this.facing, want) * Math.min(1, dt * 8);
  }

  /** 見た目一式（「？」「！」のテクスチャや視界コーンを含む）を解放する */
  dispose() {
    disposeObject3D(this.root);
  }
}

// 家具検査モード（INSPECT）の一連のメソッドを後付けする
applyInspectBehavior(Oni.prototype);
