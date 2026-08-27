// STAGE 3: 美術室
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM, createBuilder } from '../stageBuilder.js';

export function buildArtRoom(scene) {
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
    // 消灯イベントは鬼を移動させないので、目印は持たない
    eventRig: {},
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
