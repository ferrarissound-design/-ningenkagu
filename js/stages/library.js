// STAGE 4: 図書室
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM, createBuilder } from '../stageBuilder.js';

export function buildLibrary(scene) {
  const b = createBuilder(scene);
  const { group, addBox, addCyl, addSphere, solid, target, addRoomShell } = b;

  const FLOOR = 0x5a3c28;
  const WALL = 0xd9c9a6;
  const ACCENT = 0x33463a;
  addRoomShell(FLOOR, WALL, ACCENT);

  // 返却カウンター。正面の壁ぎわ、教室の教卓にあたる中心の遮蔽物。
  const COUNTER = 0x5a3f28;
  addBox(3.0, 0.86, 0.85, 0, 0.43, -4.6, COUNTER);
  addBox(2.8, 0.08, 0.05, 0, 0.9, -4.19, 0xdcd0b6, { occluder: false });
  solid(0, -4.6, 3.0, 0.85);
  target('返却カウンター', 'table', COUNTER, 0, -4.6, 3.0, 0.85, 0.9);

  // 左右の壁ぎわに並ぶ本棚。3台ずつ、Tポーズで輪郭に溶け込む。
  const BOOK = 0x4a3323;
  const spineColors = [0xb5555a, 0x5a7ba0, 0xc9a24a, 0x5f8f6a, 0x8a6ab0];
  function bookshelf(x, z) {
    addBox(0.8, 2.15, 2.0, x, 1.075, z, BOOK);
    for (const by of [0.5, 1.1, 1.7]) {
      addBox(0.86, 0.06, 2.05, x, by, z, 0x3a271a);
      // 背表紙の色差しは飾りで、当たり判定には数えない
      let bx = z - 0.85;
      for (let i = 0; i < 6; i++) {
        addBox(0.06, 0.32, 0.28, x + (x > 0 ? -0.34 : 0.34), by + 0.2, bx, spineColors[i % spineColors.length], { occluder: false });
        bx += 0.31;
      }
    }
    solid(x, z, 0.85, 2.05);
    target('本棚', 'shelf', BOOK, x, z, 0.8, 2.0, 2.18);
  }
  for (const z of [-3.6, 0, 3.6]) bookshelf(ROOM.minX + 0.7, z);
  for (const z of [-3.6, 0, 3.6]) bookshelf(ROOM.maxX - 0.7, z);

  // 中央の書架アイランド2台。この間を縫うのが図書室ステージの主役。
  function islandShelf(x, z) {
    addBox(0.75, 2.0, 2.3, x, 1.0, z, BOOK);
    for (const by of [0.45, 1.05, 1.65]) addBox(0.82, 0.06, 2.35, x, by, z, 0x3a271a);
    solid(x, z, 0.85, 2.4);
    target('書架', 'shelf', BOOK, x, z, 0.75, 2.3, 2.03);
  }
  islandShelf(-2.2, -1.0);
  islandShelf(2.2, -1.0);

  // 閲覧テーブルと椅子。書架の北側、後方の開けたエリアに2組。
  const READ_TBL = 0x6b4a2e;
  const READ_CHR = 0x7a5a3a;
  for (const tx of [-3.6, 3.6]) {
    addBox(1.8, 0.12, 1.0, tx, 0.78, 2.6, READ_TBL);
    for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]]) {
      addBox(0.1, 0.7, 0.1, tx + lx, 0.36, 2.6 + lz, READ_TBL);
    }
    solid(tx, 2.6, 1.8, 1.0);
    target('閲覧テーブル', 'table', READ_TBL, tx, 2.6, 1.8, 1.0, 0.85);

    for (const cz of [1.75, 3.45]) {
      addBox(0.52, 0.09, 0.52, tx, 0.46, cz, READ_CHR);
      addBox(0.52, 0.6, 0.1, tx, 0.76, cz + (cz < 2.6 ? -0.21 : 0.21), READ_CHR);
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
        addBox(0.06, 0.4, 0.06, tx + lx, 0.2, cz + lz, READ_CHR);
      }
      solid(tx, cz, 0.52, 0.52);
      target('椅子', 'chair', READ_CHR, tx, cz, 0.52, 0.52, 1.06);
    }
  }

  // ブックワゴン。返却待ちの本を積んだカート。
  const CART = 0x9a7a4a;
  addBox(0.7, 0.7, 0.75, 5.4, 0.35, -1.0, CART, { roughness: 0.6 });
  addBox(0.75, 0.06, 0.8, 5.4, 0.73, -1.0, 0x7a5a30);
  solid(5.4, -1.0, 0.75, 0.8);
  target('ブックワゴン', 'box', CART, 5.4, -1.0, 0.7, 0.75, 0.79);

  // 読書用アームチェア。右側の落ち着いた一角。
  const SOFA = 0x6a4a5a;
  addBox(1.1, 0.42, 0.9, 5.3, 0.21, 1.8, SOFA, { roughness: 0.95 });
  addBox(1.1, 0.55, 0.2, 5.3, 0.55, 2.2, SOFA, { roughness: 0.95 });
  addBox(0.2, 0.32, 0.9, 4.78, 0.5, 1.8, SOFA, { roughness: 0.95 });
  addBox(0.2, 0.32, 0.9, 5.82, 0.5, 1.8, SOFA, { roughness: 0.95 });
  solid(5.3, 1.8, 1.15, 0.95);
  target('読書用アームチェア', 'sofa', SOFA, 5.3, 1.8, 1.1, 0.9, 0.85, { roughness: 0.95 });

  // ゴミ箱。カウンターの脇。
  const BIN = 0x5a6b6b;
  addCyl(0.32, 0.68, -5.2, 0.34, -4.6, BIN, { taper: 0.82, roughness: 0.6, metalness: 0.15 });
  solid(-5.2, -4.6, 0.66, 0.66);
  target('ゴミ箱', 'bin', BIN, -5.2, -4.6, 0.66, 0.66, 0.72, { roughness: 0.6, metalness: 0.15 });

  // 観葉植物。奥の壁ぎわ、開架エリアの区切り。
  const POT = 0x8a5a35, LEAF = 0x3f7a4a;
  addCyl(0.34, 0.5, 0, 0.25, 5.0, POT, { taper: 0.75 });
  addCyl(0.06, 1.0, 0, 0.95, 5.0, 0x4a6b33, { seg: 6 });
  addSphere(0.48, 0, 1.45, 5.0, LEAF);
  addSphere(0.34, 0.32, 1.15, 4.82, LEAF);
  addSphere(0.3, -0.28, 1.28, 5.24, LEAF);
  solid(0, 5.0, 0.7, 0.7);
  target('観葉植物', 'plant', LEAF, 0, 5.0, 0.9, 0.9, 1.85, { roughness: 0.9 });

  return {
    id: 'library',
    name: '図書室',
    // 図書室は静かなので、同じ足音でも他ステージより遠くまで届く。
    // 足音そのものの大きさは変えないため、しゃがみ移動の優位性が自然に強くなる。
    hearingRangeScale: 1.45,
    group,
    occluders: b.occluders,
    solids: b.solids,
    targets: b.targets,
    // 「本が崩れた！」で鬼が向かう左の書架アイランドまわり
    eventRig: {
      look: new THREE.Vector3(-2.2, 1.0, -1.0),
      spots: [
        new THREE.Vector3(0, 0, -1.0),
        new THREE.Vector3(-2.2, 0, -3.0),
        new THREE.Vector3(-4.2, 0, -1.0),
      ],
    },
    playerSpawn: new THREE.Vector3(-6.2, 0, 5.0),
    oniSpawn: new THREE.Vector3(6.0, 0, -5.2),
    // 壁ぎわの通路と、書架アイランドを縫う中央の通路を組み合わせた周回路。
    waypoints: [
      new THREE.Vector3(-6.3, 0, -5.3),
      new THREE.Vector3(-6.3, 0, -1.8),
      new THREE.Vector3(-6.3, 0, 1.8),
      new THREE.Vector3(-6.3, 0, 5.2),
      new THREE.Vector3(-1.5, 0, 5.2),
      new THREE.Vector3(2.0, 0, 5.2),
      new THREE.Vector3(6.3, 0, 5.2),
      new THREE.Vector3(6.3, 0, 1.8),
      new THREE.Vector3(6.3, 0, -1.8),
      new THREE.Vector3(6.3, 0, -5.3),
      new THREE.Vector3(0.0, 0, -3.2),
      new THREE.Vector3(0.0, 0, -1.0),
    ],
  };
}
