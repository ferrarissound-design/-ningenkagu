// ステージ（部屋と家具）の生成
import * as THREE from '../vendor/three/three.module.min.js';
import { rectDistance } from './utils.js';

export const ROOM = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, height: 3.2 };
const WALL_T = 0.3;

/**
 * 擬態対象の種類ごとの「似合うポーズ」。
 * プレイヤーがこのポーズに合わせると擬態成功度が大きく上がる。
 */
export const POSE_FOR_KIND = {
  wall: 'stand',
  shelf: 'tpose',
  table: 'tpose',
  plant: 'ypose',
  sofa: 'crouch',
  chair: 'crouch',
  box: 'crouch',
  bin: 'crouch',
};

export function buildStage(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const occluders = []; // 視線を遮る物（Raycaster 用）
  const solids = [];    // 当たり判定の矩形
  const targets = [];   // 擬態できる物

  function mat(color, rough = 0.85, metal = 0.0) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: rough,
      metalness: metal,
    });
  }

  function addBox(w, h, d, x, y, z, color, opts = {}) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      mat(color, opts.roughness ?? 0.85, opts.metalness ?? 0)
    );
    m.position.set(x, y, z);
    m.castShadow = opts.castShadow !== false;
    m.receiveShadow = true;
    group.add(m);
    if (opts.occluder !== false) occluders.push(m);
    return m;
  }

  function addCyl(r, h, x, y, z, color, opts = {}) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * (opts.taper ?? 1), h, opts.seg ?? 12),
      mat(color, opts.roughness ?? 0.85, opts.metalness ?? 0)
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    if (opts.occluder !== false) occluders.push(m);
    return m;
  }

  function addSphere(r, x, y, z, color, opts = {}) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      mat(color, opts.roughness ?? 0.9, opts.metalness ?? 0)
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    if (opts.occluder !== false) occluders.push(m);
    return m;
  }

  /** 当たり判定を追加 */
  function solid(cx, cz, w, d) {
    solids.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
  }

  /** 擬態対象を登録 */
  function target(label, kind, color, cx, cz, w, d, topY, opts = {}) {
    targets.push({
      label, kind,
      color: new THREE.Color(color),
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0,
      rect: { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 },
      center: new THREE.Vector3(cx, topY * 0.5, cz),
      topY,
    });
  }

  // ---- 床 ----
  const floorW = ROOM.maxX - ROOM.minX;
  const floorD = ROOM.maxZ - ROOM.minZ;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorD),
    mat(0x8a6a45, 0.95)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // ラグ（飾り。視線は遮らない）
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), mat(0x6d5470, 1.0));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(4.2, 0.012, 0.4);
  rug.receiveShadow = true;
  group.add(rug);

  // ---- 壁 ----
  const wallH = ROOM.height;
  const WALL_MAIN = 0xcfc7b6;
  const WALL_ACCENT = 0x5f7f8c;

  // 奥（-Z）はアクセントカラー
  addBox(floorW + WALL_T * 2, wallH, WALL_T, 0, wallH / 2, ROOM.minZ - WALL_T / 2, WALL_ACCENT, { castShadow: false });
  addBox(floorW + WALL_T * 2, wallH, WALL_T, 0, wallH / 2, ROOM.maxZ + WALL_T / 2, WALL_MAIN, { castShadow: false });
  addBox(WALL_T, wallH, floorD, ROOM.minX - WALL_T / 2, wallH / 2, 0, WALL_MAIN, { castShadow: false });
  addBox(WALL_T, wallH, floorD, ROOM.maxX + WALL_T / 2, wallH / 2, 0, WALL_MAIN, { castShadow: false });

  target('奥の壁（青灰）', 'wall', WALL_ACCENT, 0, ROOM.minZ, floorW, 0.6, 2.2);
  target('壁（ベージュ）', 'wall', WALL_MAIN, 0, ROOM.maxZ, floorW, 0.6, 2.2);
  target('壁（ベージュ）', 'wall', WALL_MAIN, ROOM.minX, 0, 0.6, floorD, 2.2);
  target('壁（ベージュ）', 'wall', WALL_MAIN, ROOM.maxX, 0, 0.6, floorD, 2.2);

  // ---- テーブル（木） ----
  const TBL = 0x8a5a30;
  addBox(2.4, 0.14, 1.3, -4, 0.78, -2, TBL);
  for (const [lx, lz] of [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]]) {
    addBox(0.14, 0.72, 0.14, -4 + lx, 0.36, -2 + lz, TBL);
  }
  solid(-4, -2, 2.4, 1.3);
  target('木のテーブル', 'table', TBL, -4, -2, 2.4, 1.3, 0.85);

  // ---- 椅子 ×2 ----
  const CHR = 0x6d4526;
  for (const cz of [-0.55, -3.45]) {
    addBox(0.52, 0.09, 0.52, -4, 0.46, cz, CHR);
    addBox(0.52, 0.62, 0.1, -4, 0.77, cz + (cz > -2 ? 0.21 : -0.21), CHR);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      addBox(0.07, 0.42, 0.07, -4 + lx, 0.21, cz + lz, CHR);
    }
    solid(-4, cz, 0.52, 0.52);
    target('椅子', 'chair', CHR, -4, cz, 0.52, 0.52, 1.08);
  }

  // ---- ソファ（赤） ----
  const SOF = 0xb8443c;
  addBox(2.8, 0.45, 1.1, 4.5, 0.22, 3.2, SOF, { roughness: 0.95 });
  addBox(2.8, 0.62, 0.26, 4.5, 0.62, 3.62, SOF, { roughness: 0.95 });
  addBox(0.26, 0.36, 1.1, 3.23, 0.53, 3.2, SOF, { roughness: 0.95 });
  addBox(0.26, 0.36, 1.1, 5.77, 0.53, 3.2, SOF, { roughness: 0.95 });
  solid(4.5, 3.3, 2.9, 1.3);
  target('赤いソファ', 'sofa', SOF, 4.5, 3.2, 2.8, 1.1, 0.95, { roughness: 0.95 });

  // ---- 観葉植物 ×2 ----
  const POT = 0xb5642f, LEAF = 0x3f8f4a;
  for (const [px, pz] of [[-6.9, 4.7], [6.7, -4.4]]) {
    addCyl(0.34, 0.5, px, 0.25, pz, POT, { taper: 0.75 });
    addCyl(0.06, 1.0, px, 0.95, pz, 0x4a6b33, { seg: 6 });
    addSphere(0.48, px, 1.45, pz, LEAF);
    addSphere(0.34, px + 0.32, 1.15, pz - 0.18, LEAF);
    addSphere(0.3, px - 0.28, 1.28, pz + 0.24, LEAF);
    solid(px, pz, 0.7, 0.7);
    target('観葉植物', 'plant', LEAF, px, pz, 0.9, 0.9, 1.85, { roughness: 0.9 });
  }

  // ---- 棚（奥の壁ぎわ） ----
  const SHF = 0x5d4030;
  addBox(0.12, 2.1, 0.5, -0.75, 1.05, -5.2, SHF);
  addBox(0.12, 2.1, 0.5, 1.75, 1.05, -5.2, SHF);
  for (const by of [0.35, 1.05, 1.75, 2.08]) {
    addBox(2.62, 0.08, 0.5, 0.5, by, -5.2, SHF);
  }
  addBox(2.62, 2.1, 0.06, 0.5, 1.05, -5.44, 0x4a3226);
  // 棚に置かれた小物
  addBox(0.3, 0.3, 0.3, -0.1, 0.54, -5.2, 0xc69a5e);
  addBox(0.25, 0.42, 0.25, 1.2, 1.3, -5.2, 0x8f9bb0);
  solid(0.5, -5.2, 2.7, 0.55);
  target('木の棚', 'shelf', SHF, 0.5, -5.2, 2.7, 0.55, 2.15);

  // ---- キャビネット（背の高い遮蔽物） ----
  const CAB = 0x4a4f57;
  addBox(0.75, 2.0, 1.9, -7.3, 1.0, 0.5, CAB, { roughness: 0.6, metalness: 0.25 });
  addBox(0.06, 0.5, 0.06, -6.9, 1.2, 0.5, 0x9aa3ad, { roughness: 0.4, metalness: 0.6 });
  solid(-7.3, 0.5, 0.8, 1.95);
  target('鉄のキャビネット', 'shelf', CAB, -7.3, 0.5, 0.8, 1.95, 2.05, { roughness: 0.6, metalness: 0.25 });

  // ---- 柱（部屋の真ん中の遮蔽物） ----
  const PIL = 0x9a9a95;
  addBox(0.85, ROOM.height, 0.85, 0.6, ROOM.height / 2, 2.4, PIL, { roughness: 0.95 });
  solid(0.6, 2.4, 0.9, 0.9);
  target('コンクリの柱', 'wall', PIL, 0.6, 2.4, 0.85, 0.85, 2.4, { roughness: 0.95 });

  // ---- ゴミ箱 ----
  const BIN = 0x667487;
  addCyl(0.33, 0.72, 2.3, 0.36, -4.5, BIN, { taper: 0.82, roughness: 0.5, metalness: 0.3 });
  solid(2.3, -4.5, 0.68, 0.68);
  target('ゴミ箱', 'bin', BIN, 2.3, -4.5, 0.7, 0.7, 0.75, { roughness: 0.5, metalness: 0.3 });

  // ---- 段ボール箱 ----
  const BOX1 = 0xc69a5e, BOX2 = 0xa8804a;
  addBox(0.95, 0.95, 0.95, 1.4, 0.475, 0.9, BOX1);
  solid(1.4, 0.9, 0.95, 0.95);
  target('段ボール箱', 'box', BOX1, 1.4, 0.9, 0.95, 0.95, 0.98);

  addBox(0.62, 0.62, 0.62, 2.35, 0.31, 0.2, BOX2);
  solid(2.35, 0.2, 0.62, 0.62);
  target('小さい箱', 'box', BOX2, 2.35, 0.2, 0.62, 0.62, 0.65);

  addBox(1.05, 1.35, 1.05, 7.0, 0.675, 1.6, BOX1);
  solid(7.0, 1.6, 1.05, 1.05);
  target('大きい箱', 'box', BOX1, 7.0, 1.6, 1.05, 1.05, 1.4);

  return {
    group,
    occluders,
    solids,
    targets,
    playerSpawn: new THREE.Vector3(-6.6, 0, -4.6),
    oniSpawn: new THREE.Vector3(5.0, 0, -2.0),
    waypoints: [
      new THREE.Vector3(-2.0, 0, -2.0),
      new THREE.Vector3(5.0, 0, -2.0),
      new THREE.Vector3(6.6, 0, 4.8),
      new THREE.Vector3(0.0, 0, 4.6),
      new THREE.Vector3(-5.0, 0, 3.6),
      new THREE.Vector3(-6.0, 0, -4.2),
      new THREE.Vector3(2.0, 0, -2.6),
      new THREE.Vector3(3.2, 0, 0.8),
    ],
  };
}

/** (x,z) に最も近い擬態対象を返す */
export function nearestTarget(targets, x, z, maxDist = Infinity) {
  let best = null;
  let bestD = maxDist;
  for (const t of targets) {
    const d = rectDistance(t.rect, x, z);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best ? { target: best, dist: bestD } : null;
}

/** 円が矩形群にめり込まないよう押し出す。pos は Vector3(x,_,z) */
export function resolveCollisions(pos, radius, solids) {
  for (const s of solids) {
    const minX = s.minX - radius, maxX = s.maxX + radius;
    const minZ = s.minZ - radius, maxZ = s.maxZ + radius;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      // 一番浅い方向へ押し出す
      const dl = pos.x - minX, dr = maxX - pos.x;
      const db = pos.z - minZ, df = maxZ - pos.z;
      const m = Math.min(dl, dr, db, df);
      if (m === dl) pos.x = minX;
      else if (m === dr) pos.x = maxX;
      else if (m === db) pos.z = minZ;
      else pos.z = maxZ;
    }
  }
  const pad = radius + 0.05;
  pos.x = Math.max(ROOM.minX + pad, Math.min(ROOM.maxX - pad, pos.x));
  pos.z = Math.max(ROOM.minZ + pad, Math.min(ROOM.maxZ - pad, pos.z));
}
