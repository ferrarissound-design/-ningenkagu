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
  statue: 'ypose',
  easel: 'tpose',
};

/**
 * main.js が globalThis.__ningenkaguStage に指定したステージを生成する。
 * 未指定時は従来のリビングを使う。
 */
const STAGE_BUILDERS = {
  living: buildLivingRoom,
  classroom: buildClassroom,
  artroom: buildArtRoom,
};

export function buildStage(scene) {
  const stageId = globalThis.__ningenkaguStage;
  const build = STAGE_BUILDERS[stageId] ?? buildLivingRoom;
  return build(scene);
}

function createBuilder(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const occluders = [];
  const solids = [];
  const targets = [];

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
    m.castShadow = opts.castShadow !== false;
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
    m.castShadow = opts.castShadow !== false;
    m.receiveShadow = true;
    group.add(m);
    if (opts.occluder !== false) occluders.push(m);
    return m;
  }

  function solid(cx, cz, w, d) {
    solids.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
  }

  function target(label, kind, color, cx, cz, w, d, topY, opts = {}) {
    targets.push({
      label,
      kind,
      color: new THREE.Color(color),
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0,
      rect: {
        minX: cx - w / 2, maxX: cx + w / 2,
        minZ: cz - d / 2, maxZ: cz + d / 2,
      },
      center: new THREE.Vector3(cx, topY * 0.5, cz),
      topY,
    });
  }

  function addRoomShell(floorColor, wallMain, wallAccent) {
    const floorW = ROOM.maxX - ROOM.minX;
    const floorD = ROOM.maxZ - ROOM.minZ;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), mat(floorColor, 0.95));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const wallH = ROOM.height;
    addBox(floorW + WALL_T * 2, wallH, WALL_T, 0, wallH / 2, ROOM.minZ - WALL_T / 2, wallAccent, { castShadow: false });
    addBox(floorW + WALL_T * 2, wallH, WALL_T, 0, wallH / 2, ROOM.maxZ + WALL_T / 2, wallMain, { castShadow: false });
    addBox(WALL_T, wallH, floorD, ROOM.minX - WALL_T / 2, wallH / 2, 0, wallMain, { castShadow: false });
    addBox(WALL_T, wallH, floorD, ROOM.maxX + WALL_T / 2, wallH / 2, 0, wallMain, { castShadow: false });

    target('奥の壁', 'wall', wallAccent, 0, ROOM.minZ, floorW, 0.6, 2.2);
    target('壁', 'wall', wallMain, 0, ROOM.maxZ, floorW, 0.6, 2.2);
    target('壁', 'wall', wallMain, ROOM.minX, 0, 0.6, floorD, 2.2);
    target('壁', 'wall', wallMain, ROOM.maxX, 0, 0.6, floorD, 2.2);
  }

  return { group, occluders, solids, targets, mat, addBox, addCyl, addSphere, solid, target, addRoomShell };
}

function buildLivingRoom(scene) {
  const b = createBuilder(scene);
  const { group, occluders, solids, targets, mat, addBox, addCyl, addSphere, solid, target, addRoomShell } = b;

  addRoomShell(0x8a6a45, 0xcfc7b6, 0x5f7f8c);

  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), mat(0x6d5470, 1.0));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(4.2, 0.012, 0.4);
  rug.receiveShadow = true;
  group.add(rug);

  const TBL = 0x8a5a30;
  addBox(2.4, 0.14, 1.3, -4, 0.78, -2, TBL);
  for (const [lx, lz] of [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]]) {
    addBox(0.14, 0.72, 0.14, -4 + lx, 0.36, -2 + lz, TBL);
  }
  solid(-4, -2, 2.4, 1.3);
  target('木のテーブル', 'table', TBL, -4, -2, 2.4, 1.3, 0.85);

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

  const SOF = 0xb8443c;
  addBox(2.8, 0.45, 1.1, 4.5, 0.22, 3.2, SOF, { roughness: 0.95 });
  addBox(2.8, 0.62, 0.26, 4.5, 0.62, 3.62, SOF, { roughness: 0.95 });
  addBox(0.26, 0.36, 1.1, 3.23, 0.53, 3.2, SOF, { roughness: 0.95 });
  addBox(0.26, 0.36, 1.1, 5.77, 0.53, 3.2, SOF, { roughness: 0.95 });
  solid(4.5, 3.3, 2.9, 1.3);
  target('赤いソファ', 'sofa', SOF, 4.5, 3.2, 2.8, 1.1, 0.95, { roughness: 0.95 });

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

  const SHF = 0x5d4030;
  addBox(0.12, 2.1, 0.5, -0.75, 1.05, -5.2, SHF);
  addBox(0.12, 2.1, 0.5, 1.75, 1.05, -5.2, SHF);
  for (const by of [0.35, 1.05, 1.75, 2.08]) addBox(2.62, 0.08, 0.5, 0.5, by, -5.2, SHF);
  addBox(2.62, 2.1, 0.06, 0.5, 1.05, -5.44, 0x4a3226);
  addBox(0.3, 0.3, 0.3, -0.1, 0.54, -5.2, 0xc69a5e);
  addBox(0.25, 0.42, 0.25, 1.2, 1.3, -5.2, 0x8f9bb0);
  solid(0.5, -5.2, 2.7, 0.55);
  target('木の棚', 'shelf', SHF, 0.5, -5.2, 2.7, 0.55, 2.15);

  const CAB = 0x4a4f57;
  addBox(0.75, 2.0, 1.9, -7.3, 1.0, 0.5, CAB, { roughness: 0.6, metalness: 0.25 });
  addBox(0.06, 0.5, 0.06, -6.9, 1.2, 0.5, 0x9aa3ad, { roughness: 0.4, metalness: 0.6 });
  solid(-7.3, 0.5, 0.8, 1.95);
  target('鉄のキャビネット', 'shelf', CAB, -7.3, 0.5, 0.8, 1.95, 2.05, { roughness: 0.6, metalness: 0.25 });

  const PIL = 0x9a9a95;
  addBox(0.85, ROOM.height, 0.85, 0.6, ROOM.height / 2, 2.4, PIL, { roughness: 0.95 });
  solid(0.6, 2.4, 0.9, 0.9);
  target('コンクリの柱', 'wall', PIL, 0.6, 2.4, 0.85, 0.85, 2.4, { roughness: 0.95 });

  const BIN = 0x667487;
  addCyl(0.33, 0.72, 2.3, 0.36, -4.5, BIN, { taper: 0.82, roughness: 0.5, metalness: 0.3 });
  solid(2.3, -4.5, 0.68, 0.68);
  target('ゴミ箱', 'bin', BIN, 2.3, -4.5, 0.7, 0.7, 0.75, { roughness: 0.5, metalness: 0.3 });

  const BOX1 = 0xc69a5e, BOX2 = 0xa8804a;
  for (const box of [
    [1.4, 0.9, 0.95, 0.95, 0.95, BOX1, '段ボール箱'],
    [2.35, 0.2, 0.62, 0.62, 0.62, BOX2, '小さい箱'],
    [7.0, 1.6, 1.05, 1.35, 1.05, BOX1, '大きい箱'],
  ]) {
    const [x, z, w, h, d, color, label] = box;
    addBox(w, h, d, x, h / 2, z, color);
    solid(x, z, w, d);
    target(label, 'box', color, x, z, w, d, h + 0.03);
  }

  return {
    id: 'living',
    name: 'リビング',
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

function buildClassroom(scene) {
  const b = createBuilder(scene);
  const { group, occluders, solids, targets, addBox, addCyl, solid, target, addRoomShell } = b;

  const FLOOR = 0xb98b57;
  const WALL = 0xe2dfd2;
  const FRONT = 0xcdd7d0;
  addRoomShell(FLOOR, WALL, FRONT);

  // 黒板。奥の壁と同系統だが、より濃い緑で「壁に溶ける」攻略を作る。
  const BOARD = 0x315b4d;
  addBox(6.2, 1.45, 0.11, 0, 1.75, ROOM.minZ + 0.12, BOARD, { roughness: 0.95 });
  addBox(6.55, 0.10, 0.22, 0, 0.98, ROOM.minZ + 0.24, 0x8b6845);
  target('黒板', 'wall', BOARD, 0, ROOM.minZ + 0.2, 6.2, 0.55, 2.5, { roughness: 0.95 });

  // 教卓。前方に強い遮蔽物を置き、黒板と組み合わせたハイリスク地帯にする。
  const TEACHER = 0x7a5437;
  addBox(2.5, 0.18, 0.9, -3.8, 0.86, -4.55, TEACHER);
  addBox(2.35, 0.75, 0.12, -3.8, 0.44, -4.9, TEACHER);
  addBox(0.16, 0.78, 0.75, -4.85, 0.39, -4.55, TEACHER);
  addBox(0.16, 0.78, 0.75, -2.75, 0.39, -4.55, TEACHER);
  solid(-3.8, -4.55, 2.5, 0.95);
  target('教卓', 'table', TEACHER, -3.8, -4.55, 2.5, 0.95, 0.95);

  // 生徒机 3列×3。机の列を縫うルートが教室ステージの主役。
  const DESK = 0xc9955f;
  const METAL = 0x6f7b83;
  const CHAIR = 0x5e7a9a;
  const xs = [-4.4, 0, 4.4];
  const zs = [-2.1, 0.55, 3.2];
  for (const x of xs) {
    for (const z of zs) {
      addBox(1.35, 0.12, 0.72, x, 0.78, z, DESK);
      for (const dx of [-0.53, 0.53]) {
        for (const dz of [-0.25, 0.25]) addBox(0.07, 0.7, 0.07, x + dx, 0.36, z + dz, METAL, { metalness: 0.35, roughness: 0.55 });
      }
      solid(x, z, 1.42, 0.82);
      target('生徒机', 'table', DESK, x, z, 1.35, 0.72, 0.86);

      const cz = z + 0.92;
      addBox(0.58, 0.10, 0.55, x, 0.48, cz, CHAIR);
      addBox(0.58, 0.68, 0.10, x, 0.80, cz + 0.22, CHAIR);
      for (const dx of [-0.21, 0.21]) {
        for (const dz of [-0.20, 0.20]) addBox(0.06, 0.42, 0.06, x + dx, 0.22, cz + dz, METAL, { metalness: 0.35 });
      }
      solid(x, cz, 0.62, 0.62);
      target('青い椅子', 'chair', CHAIR, x, cz, 0.62, 0.62, 1.14);
    }
  }

  // 右壁のロッカー。Tポーズ擬態の強い場所だが、鬼の巡回路にも近い。
  const LOCKER = 0x8da6a4;
  for (const z of [-3.6, -1.8, 0, 1.8, 3.6]) {
    addBox(0.62, 2.15, 1.1, 7.35, 1.075, z, LOCKER, { roughness: 0.55, metalness: 0.18 });
    addBox(0.04, 0.34, 0.05, 7.02, 1.1, z, 0xd6dddd, { roughness: 0.35, metalness: 0.7 });
    solid(7.35, z, 0.7, 1.15);
    target('ロッカー', 'shelf', LOCKER, 7.35, z, 0.7, 1.15, 2.18, { roughness: 0.55, metalness: 0.18 });
  }

  // 左奥の本棚。黒板と違う濃色なので、色選択を間違えると目立つ。
  const BOOKSHELF = 0x6a4934;
  addBox(0.75, 2.25, 2.7, -7.25, 1.125, -2.45, BOOKSHELF);
  for (const y of [0.55, 1.15, 1.75]) addBox(0.82, 0.07, 2.65, -6.88, y, -2.45, 0x8d684c);
  for (const [z, color] of [[-3.25, 0xc85f5f], [-2.75, 0x5679b6], [-2.15, 0xe0b34f], [-1.55, 0x6aa46a]]) {
    addBox(0.2, 0.48, 0.34, -6.82, 1.45, z, color, { occluder: false });
  }
  solid(-7.25, -2.45, 0.82, 2.75);
  target('本棚', 'shelf', BOOKSHELF, -7.25, -2.45, 0.82, 2.75, 2.28);

  // 掃除用具入れとゴミ箱。後方の逃げ込み先。
  const CLEAN = 0xb7b39b;
  addBox(0.8, 2.2, 1.5, -7.15, 1.1, 4.45, CLEAN, { roughness: 0.6, metalness: 0.12 });
  addBox(0.05, 0.42, 0.05, -6.72, 1.1, 4.45, 0x686b67, { metalness: 0.5 });
  solid(-7.15, 4.45, 0.88, 1.55);
  target('掃除用具入れ', 'shelf', CLEAN, -7.15, 4.45, 0.88, 1.55, 2.23, { roughness: 0.6, metalness: 0.12 });

  const BIN = 0x4e6b73;
  addCyl(0.34, 0.72, -5.95, 0.36, 4.85, BIN, { taper: 0.85, roughness: 0.65, metalness: 0.18 });
  solid(-5.95, 4.85, 0.7, 0.7);
  target('教室のゴミ箱', 'bin', BIN, -5.95, 4.85, 0.7, 0.7, 0.75, { roughness: 0.65, metalness: 0.18 });

  // 窓は飾り。視線や当たり判定には使わない。
  for (const z of [-3.5, 0, 3.5]) {
    addBox(0.08, 1.25, 2.2, ROOM.minX + 0.1, 1.85, z, 0x9bc4d4, { occluder: false, roughness: 0.25, metalness: 0.05 });
    addBox(0.10, 1.38, 0.08, ROOM.minX + 0.04, 1.85, z, 0xf0f0e8, { occluder: false });
  }

  return {
    id: 'classroom',
    name: '教室',
    group,
    occluders,
    solids,
    targets,
    playerSpawn: new THREE.Vector3(-2.2, 0, 4.9),
    oniSpawn: new THREE.Vector3(5.8, 0, -4.4),
    // 机の間の通路だけを巡回候補にし、列の読み合いを作る。
    waypoints: [
      new THREE.Vector3(2.2, 0, -4.2),
      new THREE.Vector3(5.8, 0, -2.2),
      new THREE.Vector3(2.2, 0, -3.2),
      new THREE.Vector3(-2.2, 0, -3.2),
      new THREE.Vector3(-5.7, 0, -3.2),
      new THREE.Vector3(-2.2, 0, -0.5),
      new THREE.Vector3(-2.2, 0, 2.0),
      new THREE.Vector3(-2.2, 0, 4.9),
      new THREE.Vector3(2.2, 0, 4.9),
      new THREE.Vector3(2.2, 0, 2.0),
      new THREE.Vector3(2.2, 0, -0.5),
      new THREE.Vector3(5.75, 0, 4.65),
    ],
  };
}

function buildArtRoom(scene) {
  const b = createBuilder(scene);
  const { group, occluders, solids, targets, addBox, addCyl, addSphere, solid, target, addRoomShell } = b;

  const FLOOR = 0xb08a5a;
  const WALL = 0xe4ddc9;
  const WINDOW_WALL = 0xcdd6d2;
  addRoomShell(FLOOR, WALL, WINDOW_WALL);

  // 北側の大窓（飾り）。奥の壁が明るい色なのはこのため。
  for (const wx of [-5.0, 0, 5.0]) {
    addBox(1.8, 1.15, 0.08, wx, 2.05, ROOM.minZ + 0.1, 0xcfe4ea, { occluder: false, roughness: 0.25, metalness: 0.05 });
    addBox(1.9, 0.08, 0.1, wx, 2.6, ROOM.minZ + 0.05, 0xf0ece0, { occluder: false });
  }

  // 石膏像。真っ白なので色は合わせやすいが、Yポーズを外すと一気にバレる。
  const PLASTER = 0xefe7d6;
  const statues = [[-2.4, -1.2], [2.6, -0.6], [0.2, 1.8], [-3.4, 3.0], [4.0, 2.6]];
  for (const [sx, sz] of statues) {
    addCyl(0.34, 0.36, sx, 0.18, sz, PLASTER, { roughness: 0.95 });
    addCyl(0.3, 0.62, sx, 0.67, sz, PLASTER, { taper: 0.75, roughness: 0.95, seg: 10 });
    addSphere(0.19, sx, 1.14, sz, PLASTER, { roughness: 0.95 });
    solid(sx, sz, 0.7, 0.7);
    target('石膏像', 'statue', PLASTER, sx, sz, 0.7, 0.7, 1.33, { roughness: 0.95 });
  }

  // イーゼル。窓際に並び、Tポーズで合わせるとキャンバスに化ける。
  const EASEL_WOOD = 0x8a6a45;
  const CANVAS = 0xf0ead8;
  const easelX = -6.9;
  for (const ez of [-3.5, 0, 3.5]) {
    addBox(0.07, 1.5, 0.07, easelX - 0.35, 0.75, ez, EASEL_WOOD);
    addBox(0.07, 1.5, 0.07, easelX + 0.35, 0.75, ez, EASEL_WOOD);
    addBox(0.07, 1.1, 0.07, easelX, 0.95, ez + 0.4, EASEL_WOOD, { occluder: false });
    addBox(0.9, 1.15, 0.06, easelX, 1.15, ez - 0.05, CANVAS);
    addBox(0.95, 0.08, 0.22, easelX, 0.55, ez - 0.02, EASEL_WOOD);
    solid(easelX, ez, 1.0, 0.5);
    target('イーゼル', 'easel', CANVAS, easelX, ez, 0.95, 0.4, 1.15);
  }

  // 中央の画材テーブルと丸椅子。
  const TABLE = 0x7a5a3a;
  addBox(2.6, 0.12, 1.0, 0, 0.86, -3.3, TABLE);
  for (const [lx, lz] of [[-1.15, -0.4], [1.15, -0.4], [-1.15, 0.4], [1.15, 0.4]]) {
    addBox(0.12, 0.8, 0.12, lx, 0.4, -3.3 + lz, TABLE);
  }
  solid(0, -3.3, 2.6, 1.0);
  target('画材テーブル', 'table', TABLE, 0, -3.3, 2.6, 1.0, 0.92);

  const STOOL = 0x9c7a4e;
  for (const stx of [-1.6, 1.6]) {
    addCyl(0.26, 0.09, stx, 0.5, -4.6, STOOL);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      addCyl(0.035, 0.46, stx + lx, 0.23, -4.6 + lz, STOOL, { seg: 6 });
    }
    solid(stx, -4.6, 0.5, 0.5);
    target('丸椅子', 'chair', STOOL, stx, -4.6, 0.5, 0.5, 0.56);
  }

  // 右壁の画材棚。彩色ジャーは飾りで当たり判定なし。
  const RACK = 0x6b5636;
  addBox(0.14, 2.0, 3.4, 7.3, 1.0, -1.0, RACK);
  for (const by of [0.35, 1.0, 1.65]) addBox(0.55, 0.07, 3.4, 7.02, by, -1.0, RACK, { occluder: false });
  const jarColors = [0xc85f5f, 0x5679b6, 0xe0b34f, 0x6aa46a, 0xa669c8];
  let ji = 0;
  for (const jz of [-2.2, -1.5, -0.8, -0.1, 0.6, 1.3]) {
    addCyl(0.05, 0.16, 6.95, 1.72, jz, jarColors[ji % jarColors.length], { occluder: false, seg: 6 });
    ji++;
  }
  solid(7.3, -1.0, 0.6, 3.4);
  target('画材棚', 'shelf', RACK, 7.3, -1.0, 0.6, 3.4, 2.0);

  // 奥の道具入れ。ロッカーと同系統の金属質感。
  const CAB = 0x54606a;
  addBox(0.8, 2.15, 1.4, 7.2, 1.075, 4.5, CAB, { roughness: 0.55, metalness: 0.15 });
  addBox(0.05, 0.4, 0.05, 6.85, 1.1, 4.5, 0xd6dddd, { roughness: 0.35, metalness: 0.7 });
  solid(7.2, 4.5, 0.85, 1.45);
  target('道具入れ', 'shelf', CAB, 7.2, 4.5, 0.85, 1.45, 2.18, { roughness: 0.55, metalness: 0.15 });

  const BIN = 0x77675a;
  addCyl(0.32, 0.68, -6.4, 0.34, -4.6, BIN, { taper: 0.82, roughness: 0.6, metalness: 0.1 });
  solid(-6.4, -4.6, 0.66, 0.66);
  target('美術室のゴミ箱', 'bin', BIN, -6.4, -4.6, 0.66, 0.66, 0.72, { roughness: 0.6, metalness: 0.1 });

  return {
    id: 'artroom',
    name: '美術室',
    group,
    occluders,
    solids,
    targets,
    playerSpawn: new THREE.Vector3(6.6, 0, -4.6),
    oniSpawn: new THREE.Vector3(-5.4, 0, 4.8),
    // 石膏像・イーゼル・画材テーブルを避けながら壁沿いを大きく周回する。
    waypoints: [
      new THREE.Vector3(-5.2, 0, -4.6),
      new THREE.Vector3(0.0, 0, -5.0),
      new THREE.Vector3(5.3, 0, -4.6),
      new THREE.Vector3(5.3, 0, -2.0),
      new THREE.Vector3(5.3, 0, 1.0),
      new THREE.Vector3(5.3, 0, 4.6),
      new THREE.Vector3(2.4, 0, 4.6),
      new THREE.Vector3(-1.2, 0, 4.6),
      new THREE.Vector3(-5.2, 0, 3.0),
      new THREE.Vector3(-5.2, 0, -1.0),
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