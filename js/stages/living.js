// STAGE 1: リビング
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM, createBuilder } from '../stageBuilder.js';

export function buildLivingRoom(scene) {
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

  // テレビ（右壁ぎわ）。ステージイベント「テレビがついた！」で画面が光る。
  const TV_BODY = 0x2b2f36;
  const TV_STAND = 0x6b4b32;
  addBox(0.72, 0.46, 2.05, 7.56, 0.23, -1.4, TV_STAND);
  addBox(0.16, 0.95, 1.7, 7.5, 1.12, -1.4, TV_BODY, { roughness: 0.55, metalness: 0.2 });
  const tvScreen = addBox(0.05, 0.76, 1.46, 7.39, 1.14, -1.4, 0x18202a, {
    occluder: false, castShadow: false, roughness: 0.35, metalness: 0.1,
  });
  tvScreen.material.emissive = new THREE.Color(0x000000);
  tvScreen.material.emissiveIntensity = 1;
  solid(7.56, -1.4, 0.85, 2.1);
  target('テレビ', 'shelf', TV_BODY, 7.5, -1.4, 0.8, 1.7, 1.6, { roughness: 0.55, metalness: 0.2 });

  return {
    id: 'living',
    name: 'リビング',
    group,
    occluders,
    solids,
    targets,
    eventRig: {
      tvScreen,
      look: new THREE.Vector3(7.3, 1.1, -1.4),
      spots: [
        new THREE.Vector3(5.9, 0, -1.4),
        new THREE.Vector3(5.6, 0, -2.5),
        new THREE.Vector3(6.1, 0, -0.2),
      ],
    },
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
