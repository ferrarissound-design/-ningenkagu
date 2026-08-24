// 鬼NPC：巡回・視界・警戒
import * as THREE from '../vendor/three/three.module.min.js';
import { clamp, damp, randRange, angleDelta, rectDistance } from './utils.js';
import { resolveCollisions } from './stage.js';

/** 視界の基準値。実際の値は性格タイプで倍率を掛けた this.view を使う */
export const VIEW = {
  range: 14.0,         // 正面視界の距離
  halfAngle: 0.63,     // 約36度
  periRange: 3.4,      // 至近距離の広い視界
  periHalfAngle: 1.5,  // 約86度
  eyeHeight: 1.54,
};

/** 移動速度の基準値（性格タイプの speedScale が掛かる） */
export const MOVE = {
  patrol: 2.15,   // 巡回
  suspect: 2.60,  // 怪しんで詰め寄る
};

export const STATE = {
  PATROL: 'patrol', LOOK: 'look', SUSPECT: 'suspect',
  INSPECT: 'inspect', FOUND: 'found',
};

/** 家具検査モード（INSPECT）の調整値 */
export const INSPECT = {
  chance: 0.42,          // SUSPECT に入ったとき検査へ移行する確率
  startDist: 3.2,        // この距離まで詰めてから検査を始める
  startStare: 0.7,       // SUSPECT でこれだけ見つめてから検査へ
  cooldownMin: 9.0,      // 検査後クールダウン（連続で起きないように）
  cooldownMax: 14.0,
  firstDelay: 6.0,       // 開始直後は検査しない
  extraActChance: 0.6,   // 接近のあと、もう1つ動作を足す確率
  approachSpeed: 1.35,
  flankSpeed: 1.55,
};

/**
 * 性格タイプの既定値。すべて「基準値に対する倍率」で、1 なら今までと同じ挙動。
 * 新しいタイプを足すときは ONI_PERSONALITIES に1行加えて、
 * 変えたい項目だけ書けばよい（書かなかった項目はここの値になる）。
 */
const DEFAULT_TUNE = {
  speedScale: 1,           // 移動速度（巡回・接近・検査中の動き すべて）
  visionRangeScale: 1,     // 正面視界の距離
  visionAngleScale: 1,     // 正面視界の広さ
  periRangeScale: 1,       // 至近距離視界の距離
  detectScale: 1,          // 警戒度のたまりやすさ（＝家具と見抜く力）
  detectFalloffScale: 1,   // 遠距離での見抜く力の落ちにくさ（大きいほど遠くでも強い）
  inspectChanceScale: 1,   // SUSPECT から INSPECT へ進む確率
  inspectCooldownScale: 1, // 検査後クールダウン（小さいほど検査が多い）
  inspectActScale: 1,      // 検査1動作の長さ
  inspectExtraScale: 1,    // 検査に動作をもう1つ足す確率
  lookTimeScale: 1,        // 巡回中に立ち止まって見回す時間
  sweepScale: 1,           // 首振りの大きさ
  sweepRate: 1,            // 首振りの速さ
  furniturePause: 0,       // 家具の前で足を止める確率（0で無効）
  suspectMark: false,      // SUSPECT 中も頭上に「？」を出すか
};

const persona = (id, name, icon, desc, tune) => ({
  id, name, icon, desc, ...DEFAULT_TUNE, ...tune,
});

/**
 * 鬼の性格タイプ。
 * 「強さ」ではなく「攻略法」が変わるように、得意の裏に必ず弱点を置く。
 */
export const ONI_PERSONALITIES = {
  // 遠くまで見えるが足が遅い。遮蔽物と擬態の完成度で距離を稼ぐ相手。
  watcher: persona('watcher', '見張り鬼', '👁', '遠くまでよく見える。動きは少し遅い。', {
    speedScale: 0.85,
    visionRangeScale: 1.20,
    visionAngleScale: 1.14,
    periRangeScale: 1.10,
    detectFalloffScale: 1.50,
    lookTimeScale: 1.30,
    sweepScale: 1.25,
  }),
  // 速いが大雑把。見つかりそうになってから移動する「逃げ」が通る相手。
  charger: persona('charger', '猪突猛進鬼', '💨', '足が速い。でも家具の見分けは少し雑。', {
    speedScale: 1.25,
    visionRangeScale: 0.82,
    visionAngleScale: 0.94,
    detectScale: 0.78,
    detectFalloffScale: 0.85,
    inspectChanceScale: 0.55,
    inspectCooldownScale: 1.30,
    inspectActScale: 0.90,
    inspectExtraScale: 0.50,
    lookTimeScale: 0.55,
    sweepScale: 0.85,
    sweepRate: 1.40,
  }),
  // すぐ検査に来る。色・ポーズ・静止をきちんと合わせないと耐えられない相手。
  suspicious: persona('suspicious', '疑り深い鬼', '🧐', 'すぐ家具を疑う。擬態の完成度が重要。', {
    speedScale: 0.88,
    visionRangeScale: 0.92,
    visionAngleScale: 0.94,
    detectScale: 0.95,
    inspectChanceScale: 1.90,
    inspectCooldownScale: 0.70,
    inspectActScale: 1.15,
    inspectExtraScale: 1.40,
    lookTimeScale: 1.10,
    furniturePause: 0.50,
    suspectMark: true,
  }),
};

export const ONI_PERSONALITY_IDS = Object.keys(ONI_PERSONALITIES);
export const DEFAULT_ONI_PERSONALITY = ONI_PERSONALITY_IDS[0];

// 開発用：次のゲームで使うタイプを固定する（通常プレイでは null）
let forcedPersonality = null;

/** 開発用。不正な id や null で通常のランダムに戻す。設定した id を返す */
export function setForcedOniPersonality(id) {
  forcedPersonality = id && ONI_PERSONALITIES[id] ? id : null;
  return forcedPersonality;
}

export function getForcedOniPersonality() { return forcedPersonality; }

/** ゲーム開始の瞬間に呼ぶ。3種類から均等確率で1つ選ぶ */
export function pickOniPersonality() {
  if (forcedPersonality) return forcedPersonality;
  return ONI_PERSONALITY_IDS[Math.floor(Math.random() * ONI_PERSONALITY_IDS.length)];
}

const ONI_RADIUS = 0.42;
const PATH_CLEARANCE = ONI_RADIUS;

/** 頭の上に出す「？」「！」用のテクスチャ（外部画像を使わない） */
function makeMarkTexture(ch, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 104px system-ui, -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#2b2033';
  g.strokeText(ch, 64, 68);
  g.fillStyle = color;
  g.fillText(ch, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Oni {
  constructor(scene, stage) {
    this.stage = stage;
    this.root = new THREE.Group();
    scene.add(this.root);

    // 性格タイプ由来の値。setPersonality() で作り直す。
    // コーン生成より前に必要なので、まず既定値で埋めておく。
    this.applyPersonality(DEFAULT_ONI_PERSONALITY);

    const purple = 0x7658c9;
    const purpleLight = 0x9a79df;
    const purpleDark = 0x413661;
    const mk = (c, e = 0x000000, roughness = 0.72) => new THREE.MeshStandardMaterial({
      color: new THREE.Color(c), roughness, metalness: 0.05,
      emissive: new THREE.Color(e),
    });
    const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
    const orb = (rx, ry, rz, c, e = 0x000000, roughness = 0.72) => {
      const m = new THREE.Mesh(sphereGeo, mk(c, e, roughness));
      m.scale.set(rx, ry, rz);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // 丸い一つ目の見回りモンスター（前は +Z）
    this.body = new THREE.Group();
    this.root.add(this.body);
    const torso = orb(0.5, 0.59, 0.4, purple);
    torso.position.y = 0.96;
    this.body.add(torso);
    const belly = orb(0.31, 0.36, 0.04, purpleLight);
    belly.position.set(0, 0.9, 0.385);
    this.body.add(belly);

    this.head = new THREE.Group();
    this.head.position.y = 1.48;
    this.body.add(this.head);
    const headMesh = orb(0.44, 0.4, 0.4, purpleLight);
    this.head.add(headMesh);
    // 短く丸みのある角
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.23, 8), mk(0xffe2a8));
      horn.position.set(side * 0.24, 0.4, -0.02);
      horn.rotation.z = side * -0.25;
      horn.castShadow = true;
      this.head.add(horn);
    }

    // 表情豊かな一つ目。目全体を伸縮して警戒状態を伝える
    this.eyeGroup = new THREE.Group();
    this.eyeGroup.position.set(0, 0.055, 0.39);
    this.head.add(this.eyeGroup);
    const eyeWhite = orb(0.225, 0.18, 0.058, 0xfff7e7, 0x15100a, 0.45);
    this.eyeGroup.add(eyeWhite);
    this.eyeMat = mk(0xffcf45, 0xffa91f, 0.38);
    const iris = new THREE.Mesh(sphereGeo, this.eyeMat);
    iris.scale.set(0.12, 0.13, 0.038);
    iris.position.z = 0.055;
    this.eyeGroup.add(iris);
    const pupil = orb(0.052, 0.076, 0.026, 0x21192c, 0x08050c, 0.4);
    pupil.position.z = 0.086;
    this.eyeGroup.add(pupil);
    this.eyeBaseScale = this.eyeGroup.scale.clone();

    this.mouth = orb(0.075, 0.027, 0.022, purpleDark, 0x08050c, 0.5);
    this.mouth.position.set(0, -0.205, 0.392);
    this.mouthBaseScale = this.mouth.scale.clone();
    this.head.add(this.mouth);

    this.arms = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.48, 1.16, 0);
      const arm = orb(0.12, 0.27, 0.12, purpleLight);
      arm.position.y = -0.24;
      pivot.add(arm);
      const hand = orb(0.145, 0.13, 0.14, purpleLight);
      hand.position.y = -0.49;
      pivot.add(hand);
      this.body.add(pivot);
      this.arms.push({ pivot, side });
    }
    this.legs = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.18, 0.62, 0);
      const leg = orb(0.14, 0.28, 0.16, purpleDark);
      leg.position.y = -0.24;
      pivot.add(leg);
      const foot = orb(0.18, 0.12, 0.24, purpleDark);
      foot.position.set(0, -0.48, 0.065);
      pivot.add(foot);
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
    this.cone = new THREE.Mesh(buildFanGeometry(this.view.halfAngle, this.view.range, this.coneSegments), this.coneMat);
    this.cone.position.y = 0.03;
    this.root.add(this.cone);

    // 検査中に頭の上へ出すマーク（子供にも状態が分かるように）
    this.marks = {};
    for (const [key, ch, color] of [['q', '?', '#ffd166'], ['ex', '!', '#ff8a2b']]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeMarkTexture(ch, color), transparent: true, depthWrite: false,
      }));
      sp.scale.set(0.6, 0.6, 1);
      sp.position.set(0, 2.6, 0);
      sp.visible = false;
      this.root.add(sp);
      this.marks[key] = sp;
    }

    this.raycaster = new THREE.Raycaster();
    this.coneRay = new THREE.Raycaster();
    this.coneTimer = 0;
    this.coneDist = new Float32Array(this.coneSegments + 1).fill(this.view.range);
    this._coneOrigin = new THREE.Vector3();
    this._coneDir = new THREE.Vector3();
    this.samples = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();

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
    this.view = {
      range: VIEW.range * p.visionRangeScale,
      halfAngle: VIEW.halfAngle * p.visionAngleScale,
      periRange: VIEW.periRange * p.periRangeScale,
      periHalfAngle: VIEW.periHalfAngle,
      eyeHeight: VIEW.eyeHeight,
    };
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

  /** 家具を避けて目的地まで直進できるかを軽量に調べる */
  canWalkDirectly(target) {
    const p = this.root.position;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.18));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = p.x + dx * t;
      const z = p.z + dz * t;
      for (const s of this.stage.solids) {
        if (
          x > s.minX - PATH_CLEARANCE && x < s.maxX + PATH_CLEARANCE &&
          z > s.minZ - PATH_CLEARANCE && z < s.maxZ + PATH_CLEARANCE
        ) return false;
      }
    }
    return true;
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
      } else if (suspicion >= 0.4 && sense.visible) {
        if (this.state !== STATE.SUSPECT) this.enterSuspect();
        this.lastSeen.set(sense.px, 0, sense.pz);
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

  giveUp() {
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

  // ---------------- 家具検査モード（INSPECT） ----------------

  /** 検査の1動作を作る。s は残り時間が少ないときの短縮率 */
  makeInspectAct(kind, s) {
    switch (kind) {
      case 'flank':
        return {
          kind, e: 0, t: randRange(2.2, 2.9) * s,
          dir: Math.random() < 0.5 ? -1 : 1,
          goal: randRange(1.1, 1.9), swept: 0, bounces: 0,
        };
      case 'feint': {
        const a = {
          kind, e: 0, tAway: 0.4, tHold: randRange(0.9, 1.6) * s,
          tTele: 0.32, tSnap: 0.24, tStare: 0.7 * s, cued: 0,
        };
        a.t = a.tAway + a.tHold + a.tTele + a.tSnap + a.tStare;
        return a;
      }
      case 'peek': {
        const a = {
          kind, e: 0, tAway: 0.3, tHold: randRange(0.6, 1.1) * s,
          tTele: 0.26, tSnap: 0.16, tStare: 0.5 * s, cued: 0,
          side: Math.random() < 0.5 ? -1 : 1,
        };
        a.t = a.tAway + a.tHold + a.tTele + a.tSnap + a.tStare;
        return a;
      }
      default:
        return { kind: 'approach', e: 0, t: randRange(1.9, 2.5) * s, stop: randRange(1.6, 2.3) };
    }
  }

  beginInspect() {
    const short = !!this.inspectShort;
    // 短縮率に性格タイプの「検査の丁寧さ」を掛ける（疑り深い鬼は少し長い）
    const s = (short ? 0.68 : 1) * this.tune.inspectActScale;
    // 必ず「接近して凝視」から入り、そのあとを毎回ランダムに変える
    const rest = ['flank', 'feint', 'peek'];
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const kinds = ['approach', rest[0]];
    const extraChance = clamp(INSPECT.extraActChance * this.tune.inspectExtraScale, 0, 0.95);
    if (!short && Math.random() < extraChance) kinds.push(rest[1]);

    this.inspectActs = kinds.map((k) => this.makeInspectAct(k, s));
    this.inspectAct = this.inspectActs.shift();
    this.state = STATE.INSPECT;
    this.inspectWatching = true;
    this.inspectFinished = false;
    this.inspectDoneHold = 0;
    this.inspectPending = false;
    this.inspectFlash = 0;
    this.inspectAnchor.set(this.seenX, 0, this.seenZ);
    this.lastSeen.copy(this.inspectAnchor);
    this.stuckTimer = 0;
    // 万一どこかで詰まっても必ず抜けられるようにする保険
    this.inspectTimeout = this.inspectActs.reduce((n, a) => n + a.t, this.inspectAct.t) + 3.0;
    this.inspectCue = 'start';
  }

  /** game 側が音・HUD に使う合図を1回だけ取り出す */
  consumeInspectCue() {
    const c = this.inspectCue;
    this.inspectCue = null;
    return c;
  }

  /** 検査を終える。success なら巡回へ、失敗ならもう一度じっと見張る */
  endInspect(success) {
    this.inspectActs.length = 0;
    this.inspectAct = null;
    this.inspectFinished = false;
    this.inspectDoneHold = 0;
    this.inspectWatching = true;
    this.inspectPending = false;
    this.inspectFlash = 0;
    this.inspectCooldown = this.rollInspectCooldown();
    if (this.state === STATE.FOUND) return;
    if (success) {
      this.state = STATE.PATROL;
      this.stareTimer = 0;
      this.pickWaypoint();
    } else {
      // 失敗しても即発見にはしない。もう少しだけ見張ってから諦める
      this.state = STATE.SUSPECT;
      this.stareTimer = 6;
    }
  }

  /** 決着・ステージ切替などで検査を強制終了する */
  abortInspect() {
    if (this.state === STATE.INSPECT) this.state = STATE.SUSPECT;
    this.inspectActs.length = 0;
    this.inspectAct = null;
    this.inspectFinished = false;
    this.inspectDoneHold = 0;
    this.inspectWatching = true;
    this.inspectPending = false;
    this.inspectCue = null;
    this.inspectFlash = 0;
    this.inspectCooldown = this.rollInspectCooldown();
  }

  /** 対象の方をどれだけ速く向くか */
  faceAnchor(dt, rate, back = false) {
    const p = this.root.position;
    let want = Math.atan2(this.inspectAnchor.x - p.x, this.inspectAnchor.z - p.z);
    if (back) want += Math.PI;
    this.facing += angleDelta(this.facing, want) * Math.min(1, dt * rate);
    return want;
  }

  updateInspect(dt) {
    this.inspectTimeout -= dt;
    // 見ている間だけ「調べている場所」がプレイヤーに追従する
    if (this.inspectWatching) {
      this.inspectAnchor.x = damp(this.inspectAnchor.x, this.seenX, 5, dt);
      this.inspectAnchor.z = damp(this.inspectAnchor.z, this.seenZ, 5, dt);
      this.lastSeen.copy(this.inspectAnchor);
    }

    if (this.inspectFinished) {
      // game 側の判定待ち。放置されても止まったままにならないよう自分で切り上げる
      this.updateInspectStare(dt);
      this.inspectDoneHold += dt;
      if (this.inspectDoneHold > 1.5) this.endInspect(true);
      return;
    }
    if (this.inspectTimeout <= 0) { this.inspectFinished = true; return; }

    const a = this.inspectAct;
    if (!a) { this.inspectFinished = true; return; }
    a.e += dt;
    switch (a.kind) {
      case 'flank': this.actFlank(dt, a); break;
      case 'feint': this.actFeint(dt, a); break;
      case 'peek': this.actPeek(dt, a); break;
      default: this.actApproach(dt, a); break;
    }
    if (a.e >= a.t || a.done) {
      this.inspectAct = this.inspectActs.shift() || null;
      this.stuckTimer = 0;
      if (!this.inspectAct) this.inspectFinished = true;
    }
  }

  /** 動かずに正面から見つめる */
  updateInspectStare(dt) {
    this.speed = damp(this.speed, 0, 12, dt);
    this.headSweep = damp(this.headSweep, 0, 8, dt);
    this.faceAnchor(dt, 6);
  }

  /** 1. 接近して凝視：1.5〜2.5m まで近づいて数秒じっと見る */
  actApproach(dt, a) {
    this.inspectWatching = true;
    this.headSweep = damp(this.headSweep, 0, 8, dt);
    const p = this.root.position;
    let dx = p.x - this.inspectAnchor.x;
    let dz = p.z - this.inspectAnchor.z;
    const d = Math.hypot(dx, dz);
    if (d > a.stop + 0.15 && a.e < a.t * 0.7) {
      const tx = this.inspectAnchor.x + (dx / d) * a.stop;
      const tz = this.inspectAnchor.z + (dz / d) * a.stop;
      this.moveToward(dt, tx, tz, this.moveSpeed.approach);
      this.faceAnchor(dt, 5);
      // 家具に阻まれたら無理に詰めず、その場から観察する
      if (this.stuckTimer > 0.8) { a.e = Math.max(a.e, a.t * 0.7); this.stuckTimer = 0; }
    } else {
      this.updateInspectStare(dt);
    }
  }

  /** 2. 横から確認：対象のまわりを半周するように回り込む */
  actFlank(dt, a) {
    this.inspectWatching = true;
    this.headSweep = damp(this.headSweep, 0, 8, dt);
    const p = this.root.position;
    const ax = this.inspectAnchor.x, az = this.inspectAnchor.z;
    const before = Math.atan2(p.x - ax, p.z - az);
    const r = clamp(Math.hypot(p.x - ax, p.z - az), 1.5, 2.6);
    // 少し先の点を目標にすると、既存の移動＋衝突判定だけで円弧を描ける
    const lead = before + a.dir * 0.5;
    this.moveToward(dt, ax + Math.sin(lead) * r, az + Math.cos(lead) * r, this.moveSpeed.flank);
    // 移動方向ではなく、常に調べている物を見る
    this.faceAnchor(dt, 5);
    a.swept += Math.abs(angleDelta(before, Math.atan2(p.x - ax, p.z - az)));
    if (a.swept > a.goal) a.done = true;
    // 壁や家具に当たったら反対回り。2回ぶつかったら諦めてその場で見る
    if (this.stuckTimer > 0.45) {
      this.stuckTimer = 0;
      a.dir *= -1;
      a.bounces++;
      if (a.bounces >= 2) a.done = true;
    }
  }

  /** 3. 背中を向けるフェイント：やめたふりをして、急に振り返る */
  actFeint(dt, a) {
    const e = a.e;
    const tAway = a.tAway, tHold = tAway + a.tHold, tTele = tHold + a.tTele;
    const tSnap = tTele + a.tSnap;
    this.speed = damp(this.speed, 0, 12, dt);
    this.headSweep = damp(this.headSweep, 0, 8, dt);
    if (e < tHold) {
      // 背を向ける（プレイヤーからは「検査をやめた」ように見える）
      this.inspectWatching = false;
      this.faceAnchor(dt, 4, true);
    } else if (e < tTele) {
      // 振り返る前の予備動作。ここで気づけば止まれる
      this.inspectWatching = false;
      if (!a.cued) { a.cued = 1; this.inspectCue = 'telegraph'; this.inspectFlash = 0.45; }
      this.faceAnchor(dt, 1.2, true);
    } else if (e < tSnap) {
      if (a.cued < 2) { a.cued = 2; this.inspectCue = 'turnback'; }
      this.faceAnchor(dt, 14);
    } else {
      this.inspectWatching = true;
      this.updateInspectStare(dt);
    }
  }

  /** 4. 突然の振り返り：よそ見からの素早い向き直り（予備動作つき） */
  actPeek(dt, a) {
    const e = a.e;
    const tAway = a.tAway, tHold = tAway + a.tHold, tTele = tHold + a.tTele;
    const tSnap = tTele + a.tSnap;
    this.speed = damp(this.speed, 0, 12, dt);
    this.faceAnchor(dt, 3);
    if (e < tHold) {
      this.inspectWatching = false;
      this.headSweep = damp(this.headSweep, a.side * 1.0, 5, dt);
    } else if (e < tTele) {
      this.inspectWatching = false;
      if (!a.cued) { a.cued = 1; this.inspectCue = 'telegraph'; this.inspectFlash = 0.4; }
      this.headSweep = damp(this.headSweep, a.side * 1.15, 3, dt);
    } else if (e < tSnap) {
      if (a.cued < 2) { a.cued = 2; this.inspectCue = 'turnback'; }
      this.headSweep = damp(this.headSweep, 0, 22, dt);
    } else {
      this.inspectWatching = true;
      this.updateInspectStare(dt);
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
