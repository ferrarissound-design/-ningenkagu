// STAGE 5: 理科室
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM, createBuilder } from '../stageBuilder.js';
import { STAGE_EVENTS } from '../stageEvents.js';
import { sfx } from '../audio.js';

// 理科室は「視界のステージ」。実験器具から蒸気が噴き出すと、
// 鬼の視界が大きく落ち、発生源にも気を取られる。白煙の時間が移動チャンスになる。
STAGE_EVENTS.scienceroom = {
  id: 'steam',
  name: '蒸気が噴き出した！',
  durationMin: 6.5,
  durationMax: 8.5,
  // 蒸気は部屋側の現象なので、鬼が途中でプレイヤーを怪しんでも視界低下は残す。
  liftVisionOnBreak: false,
  onStart(m) {
    const rig = m.stage.eventRig || {};
    m.applyVision({ range: 0.48, angle: 0.62, peri: 0.72, detect: 0.38 });
    m.focusOni({ look: rig.look, spots: rig.spots, stand: 0.45, glance: 0.65 });
    m.setSteam(true);
    m.hud.eventNotice('🧪 蒸気が噴き出した！', '白煙の間に移動しろ');
    sfx.eventSteam();
  },
  onUpdate(m, dt) { m.animateSteam(dt); },
  onEnd(m) { m.setSteam(false); },
};

export function buildScienceRoom(scene) {
  const b = createBuilder(scene);
  const { group, addBox, addCyl, addSphere, solid, target, addRoomShell } = b;

  const FLOOR = 0x667078;
  const WALL = 0xd9dedc;
  const ACCENT = 0x2f5f66;
  addRoomShell(FLOOR, WALL, ACCENT);

  const LAB = 0x54606a;
  const TOP = 0x30383d;
  addBox(3.2, 0.78, 1.0, 0, 0.39, -4.55, LAB, { roughness: 0.75, metalness: 0.1 });
  addBox(3.3, 0.10, 1.08, 0, 0.83, -4.55, TOP, { roughness: 0.42, metalness: 0.18 });
  solid(0, -4.55, 3.3, 1.08);
  target('教師用実験台', 'table', LAB, 0, -4.55, 3.2, 1.0, 0.9, { roughness: 0.75, metalness: 0.1 });

  const BENCH = 0x69767d;
  for (const [x, z] of [[-3.2, -1.8], [3.2, -1.8], [-3.2, 2.0], [3.2, 2.0]]) {
    addBox(2.35, 0.16, 1.2, x, 0.78, z, TOP, { roughness: 0.4, metalness: 0.12 });
    addBox(2.15, 0.62, 0.92, x, 0.38, z, BENCH, { roughness: 0.75, metalness: 0.1 });
    addCyl(0.05, 0.45, x + 0.72, 1.04, z, 0xb9c6c9, { seg: 10, roughness: 0.35, metalness: 0.7, occluder: false });
    addBox(0.34, 0.05, 0.05, x + 0.88, 1.22, z, 0xb9c6c9, { roughness: 0.35, metalness: 0.7, occluder: false });
    solid(x, z, 2.35, 1.2);
    target('実験台', 'table', BENCH, x, z, 2.35, 1.2, 0.92, { roughness: 0.75, metalness: 0.1 });
  }

  const STOOL = 0x4f5960;
  for (const [x, z] of [
    [-4.75, -1.8], [-1.65, -1.8], [1.65, -1.8], [4.75, -1.8],
    [-4.75, 2.0], [-1.65, 2.0], [1.65, 2.0], [4.75, 2.0],
  ]) {
    addCyl(0.34, 0.10, x, 0.48, z, STOOL, { seg: 16, roughness: 0.65, metalness: 0.1 });
    addCyl(0.06, 0.82, x, 0.23, z, 0x77848b, { seg: 10, roughness: 0.4, metalness: 0.5 });
    addBox(0.58, 0.05, 0.08, x, 0.18, z, 0x77848b, { roughness: 0.4, metalness: 0.5, occluder: false });
    solid(x, z, 0.68, 0.68);
    target('丸イス', 'chair', STOOL, x, z, 0.68, 0.68, 0.60, { roughness: 0.65, metalness: 0.1 });
  }

  const CAB = 0x566b69;
  const GLASS = 0x8aa7aa;
  function specimenCabinet(x, z) {
    addBox(0.75, 2.25, 1.7, x, 1.125, z, CAB, { roughness: 0.72 });
    addBox(0.05, 1.82, 1.42, x + (x < 0 ? 0.39 : -0.39), 1.18, z, GLASS, { roughness: 0.2, metalness: 0.05, occluder: false });
    for (const sy of [0.55, 1.15, 1.75]) addBox(0.80, 0.05, 1.72, x, sy, z, 0x405250, { occluder: false });
    for (const [dy, dz] of [[0.7, -0.45], [1.25, 0.1], [1.75, 0.48]]) {
      addCyl(0.12, 0.30, x + (x < 0 ? 0.30 : -0.30), dy, z + dz, 0xc6d8cf, { seg: 12, roughness: 0.25, occluder: false });
    }
    solid(x, z, 0.8, 1.75);
    target('標本棚', 'shelf', CAB, x, z, 0.75, 1.7, 2.28, { roughness: 0.72 });
  }
  specimenCabinet(ROOM.minX + 0.72, -3.2);
  specimenCabinet(ROOM.minX + 0.72, 3.2);
  specimenCabinet(ROOM.maxX - 0.72, -3.2);
  specimenCabinet(ROOM.maxX - 0.72, 3.2);

  const CHEM = 0x7f8d76;
  addBox(1.45, 1.05, 0.72, 5.5, 0.525, -4.45, CHEM, { roughness: 0.75 });
  for (const bx of [5.15, 5.50, 5.85]) {
    addCyl(0.10, 0.28, bx, 1.18, -4.45, 0xd7d2a2, { seg: 12, roughness: 0.3, occluder: false });
  }
  solid(5.5, -4.45, 1.45, 0.72);
  target('薬品棚', 'box', CHEM, 5.5, -4.45, 1.45, 0.72, 1.08, { roughness: 0.75 });

  const BONE = 0xe6dfc7;
  addSphere(0.22, -5.25, 1.75, -4.30, BONE, { roughness: 0.9 });
  addCyl(0.055, 1.18, -5.25, 1.05, -4.30, BONE, { seg: 10, roughness: 0.9 });
  addBox(0.92, 0.07, 0.07, -5.25, 1.45, -4.30, BONE, { roughness: 0.9 });
  addBox(0.07, 0.92, 0.07, -5.25, 0.48, -4.30, BONE, { roughness: 0.9 });
  addBox(0.62, 0.06, 0.06, -5.25, 0.56, -4.30, BONE, { roughness: 0.9, occluder: false });
  solid(-5.25, -4.30, 0.85, 0.65);
  target('骨格模型', 'statue', BONE, -5.25, -4.30, 0.9, 0.7, 2.0, { roughness: 0.9 });

  const STEAM_RIG = new THREE.Vector3(0.0, 0.8, -2.6);
  addCyl(0.20, 0.42, STEAM_RIG.x, 0.21, STEAM_RIG.z, 0x8c9aa0, { seg: 14, roughness: 0.55, metalness: 0.25 });
  addSphere(0.18, STEAM_RIG.x, 0.54, STEAM_RIG.z, 0xb6c4c7, { roughness: 0.5, occluder: false });

  // 噴き出す白煙。イベント中だけ表示する。
  // occluders にも solids にも入れないので、視線も移動も邪魔しない
  // （鬼の視界低下は stageEvents.js の倍率が担当する）。
  // ジオメトリは1つを共有し、ステージ解放時は group ごと disposeStage が落とす。
  const steamGroup = new THREE.Group();
  steamGroup.visible = false;
  group.add(steamGroup);
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const puffs = [];
  const PUFF_COUNT = 8;
  for (let i = 0; i < PUFF_COUNT; i++) {
    const mesh = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({
      color: 0xeef3f5, transparent: true, opacity: 0, depthWrite: false,
    }));
    mesh.position.set(STEAM_RIG.x, 0.6, STEAM_RIG.z);
    steamGroup.add(mesh);
    puffs.push({
      mesh,
      // 位相をずらして、途切れずに立ちのぼり続ける煙にする
      phase: i / PUFF_COUNT,
      driftX: Math.cos((i / PUFF_COUNT) * Math.PI * 2) * 0.42,
      driftZ: Math.sin((i / PUFF_COUNT) * Math.PI * 2) * 0.42,
    });
  }

  return {
    id: 'scienceroom',
    name: '理科室',
    group,
    occluders: b.occluders,
    solids: b.solids,
    targets: b.targets,
    eventRig: {
      look: STEAM_RIG.clone(),
      steam: { group: steamGroup, puffs, origin: STEAM_RIG.clone() },
      spots: [
        new THREE.Vector3(-2.0, 0, -3.0),
        new THREE.Vector3(2.0, 0, -3.0),
        new THREE.Vector3(0, 0, 0.0),
      ],
    },
    playerSpawn: new THREE.Vector3(-6.1, 0, 5.0),
    oniSpawn: new THREE.Vector3(6.1, 0, -5.1),
    waypoints: [
      new THREE.Vector3(-6.25, 0, -5.20),
      new THREE.Vector3(-6.25, 0, 0.00),
      new THREE.Vector3(-6.25, 0, 5.20),
      new THREE.Vector3(-1.20, 0, 5.20),
      new THREE.Vector3(1.20, 0, 5.20),
      new THREE.Vector3(6.25, 0, 5.20),
      new THREE.Vector3(6.25, 0, 0.00),
      new THREE.Vector3(6.25, 0, -5.20),
      new THREE.Vector3(1.30, 0, -3.10),
      new THREE.Vector3(0.00, 0, 0.10),
      new THREE.Vector3(-1.30, 0, 3.10),
    ],
  };
}
