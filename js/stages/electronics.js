// STAGE 6: 深夜の家電量販店
import * as THREE from '../../vendor/three/three.module.min.js';
import { createBuilder } from '../stageBuilder.js';

export function buildElectronicsStore(scene) {
  const b = createBuilder(scene);
  const { group, addBox, addCyl, solid, target, addRoomShell } = b;

  const FLOOR = 0x353b42;
  const WALL = 0xd9dcdf;
  const ACCENT = 0x1d3150;
  addRoomShell(FLOOR, WALL, ACCENT);

  // 北側の大型テレビ展示壁
  const screens = [];
  for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) {
    const stand = addBox(2.05, 0.72, 0.55, x, 0.36, -4.95, 0x22272b, { roughness: 0.55, metalness: 0.2 });
    const screen = addBox(2.15, 1.22, 0.16, x, 1.52, -5.05, 0x090b0e, { roughness: 0.22, metalness: 0.08 });
    screens.push(screen);
    solid(x, -4.95, 2.15, 0.62);
    target('展示テレビ', 'tv', 0x11151a, x, -4.95, 2.15, 0.65, 2.16, { roughness: 0.28, metalness: 0.08 });
  }

  // 左側は冷蔵庫の列
  for (const [z, color] of [[-2.8,0xe5e8e8],[-0.9,0x9ca7aa],[1.0,0xf3f1eb],[2.9,0x4b555b]]) {
    addBox(1.02, 2.12, 0.92, -6.55, 1.06, z, color, { roughness: 0.58, metalness: 0.08 });
    addBox(0.03, 1.72, 0.04, -6.02, 1.08, z, 0x555e62, { occluder: false, metalness: 0.5 });
    solid(-6.55, z, 1.05, 0.96);
    target('冷蔵庫', 'fridge', color, -6.55, z, 1.05, 0.96, 2.15, { roughness: 0.58, metalness: 0.08 });
  }

  // 右側はドラム式・縦型洗濯機
  for (const [z, color] of [[-2.8,0xf0f2f1],[-0.9,0xc9d0d1],[1.0,0xf4f0e7],[2.9,0x77848a]]) {
    addBox(1.08, 1.12, 0.92, 6.25, 0.56, z, color, { roughness: 0.62, metalness: 0.04 });
    addCyl(0.27, 0.05, 5.70, 0.60, z, 0x22272d, { seg: 18, roughness: 0.25, metalness: 0.1, occluder: false });
    solid(6.25, z, 1.12, 0.96);
    target('洗濯機', 'washer', color, 6.25, z, 1.12, 0.96, 1.15, { roughness: 0.62, metalness: 0.04 });
  }

  // 中央のスマホ・PC展示台。見通しを切りすぎない低めの島にする
  for (const [x, z] of [[-2.3,-1.8],[2.3,-1.8],[-2.3,0.45],[2.3,0.45]]) {
    addBox(2.25, 0.78, 0.82, x, 0.39, z, 0x8e9495, { roughness: 0.65, metalness: 0.08 });
    addBox(2.35, 0.08, 0.90, x, 0.82, z, 0xe1e3df, { roughness: 0.45 });
    for (const dx of [-0.65, 0, 0.65]) {
      addBox(0.28, 0.04, 0.18, x + dx, 0.91, z, 0x22272c, { occluder: false, roughness: 0.3, metalness: 0.15 });
    }
    solid(x, z, 2.35, 0.90);
    target('展示台', 'table', 0x8e9495, x, z, 2.35, 0.90, 0.88);
  }

  // 南側は体験コーナー
  for (const x of [-3.2, 0, 3.2]) {
    addBox(1.35, 0.48, 1.55, x, 0.38, 3.85, 0x3b3030, { roughness: 0.82 });
    addBox(1.20, 1.25, 0.42, x, 1.18, 4.32, 0x463737, { roughness: 0.82 });
    solid(x, 4.0, 1.45, 1.72);
    target('マッサージチェア', 'massage', 0x3b3030, x, 4.0, 1.45, 1.72, 1.55, { roughness: 0.82 });
  }

  // レジ脇の棚と段ボール
  for (const x of [-5.3, 5.0]) {
    addBox(1.7, 1.75, 0.62, x, 0.875, 5.15, 0x53616b, { roughness: 0.75 });
    solid(x, 5.15, 1.75, 0.68);
    target('在庫棚', 'shelf', 0x53616b, x, 5.15, 1.75, 0.68, 1.78);
  }
  addBox(1.0, 0.78, 0.86, 5.8, 0.39, -4.05, 0xa98758, { roughness: 0.9 });
  solid(5.8, -4.05, 1.0, 0.86);
  target('配送箱', 'box', 0xa98758, 5.8, -4.05, 1.0, 0.86, 0.8);

  return {
    id: 'electronics',
    name: '家電量販店',
    group,
    occluders: b.occluders,
    solids: b.solids,
    targets: b.targets,
    hearingRangeScale: 1.08,
    eventRig: {
      look: new THREE.Vector3(0, 0, -4.6),
      screens,
      spots: [
        new THREE.Vector3(-3.2, 0, -3.6),
        new THREE.Vector3(0, 0, -3.4),
        new THREE.Vector3(3.2, 0, -3.6),
      ],
    },
    playerSpawn: new THREE.Vector3(-6.0, 0, 4.5),
    oniSpawn: new THREE.Vector3(4.8, 0, -3.8),
    waypoints: [
      new THREE.Vector3(-6.1, 0, -4.2),
      new THREE.Vector3(-4.0, 0, -3.4),
      new THREE.Vector3(0, 0, -3.35),
      new THREE.Vector3(4.0, 0, -3.4),
      new THREE.Vector3(6.0, 0, -4.0),
      new THREE.Vector3(5.2, 0, 0.0),
      new THREE.Vector3(5.2, 0, 4.3),
      new THREE.Vector3(1.6, 0, 2.25),
      new THREE.Vector3(-1.6, 0, 2.25),
      new THREE.Vector3(-5.2, 0, 4.3),
      new THREE.Vector3(-5.2, 0, 0.0),
      new THREE.Vector3(0, 0, 1.55),
    ],
  };
}
