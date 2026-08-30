// STAGE 2: 教室
import * as THREE from '../../vendor/three/three.module.min.js';
import { ROOM, createBuilder } from '../stageBuilder.js';

export function buildClassroom(scene) {
  const b = createBuilder(scene);
  const { group, occluders, solids, targets, addBox, addCyl, solid, target, addRoomShell } = b;

  const FLOOR = 0xb98b57;
  const WALL = 0xe2dfd2;
  const FRONT = 0xcdd7d0;
  addRoomShell(FLOOR, WALL, FRONT);

  const BOARD = 0x315b4d;
  addBox(6.2, 1.45, 0.11, 0, 1.75, ROOM.minZ + 0.12, BOARD, { roughness: 0.95 });
  addBox(6.55, 0.10, 0.22, 0, 0.98, ROOM.minZ + 0.24, 0x8b6845);
  target('黒板', 'wall', BOARD, 0, ROOM.minZ + 0.2, 6.2, 0.55, 2.5, { roughness: 0.95 });

  const TEACHER = 0x7a5437;
  addBox(2.5, 0.18, 0.9, -3.8, 0.86, -4.55, TEACHER);
  addBox(2.35, 0.75, 0.12, -3.8, 0.44, -4.9, TEACHER);
  addBox(0.16, 0.78, 0.75, -4.85, 0.39, -4.55, TEACHER);
  addBox(0.16, 0.78, 0.75, -2.75, 0.39, -4.55, TEACHER);
  solid(-3.8, -4.55, 2.5, 0.95);
  target('教卓', 'table', TEACHER, -3.8, -4.55, 2.5, 0.95, 0.95);

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

  const LOCKER = 0x8da6a4;
  for (const z of [-3.6, -1.8, 0, 1.8, 3.6]) {
    addBox(0.62, 2.15, 1.1, 7.35, 1.075, z, LOCKER, { roughness: 0.55, metalness: 0.18 });
    addBox(0.04, 0.34, 0.05, 7.02, 1.1, z, 0xd6dddd, { roughness: 0.35, metalness: 0.7 });
    solid(7.35, z, 0.7, 1.15);
    target('ロッカー', 'shelf', LOCKER, 7.35, z, 0.7, 1.15, 2.18, { roughness: 0.55, metalness: 0.18 });
  }

  const BOOKSHELF = 0x6a4934;
  addBox(0.75, 2.25, 2.7, -7.25, 1.125, -2.45, BOOKSHELF);
  for (const y of [0.55, 1.15, 1.75]) addBox(0.82, 0.07, 2.65, -6.88, y, -2.45, 0x8d684c);
  for (const [z, color] of [[-3.25, 0xc85f5f], [-2.75, 0x5679b6], [-2.15, 0xe0b34f], [-1.55, 0x6aa46a]]) {
    addBox(0.2, 0.48, 0.34, -6.82, 1.45, z, color, { occluder: false });
  }
  solid(-7.25, -2.45, 0.82, 2.75);
  target('本棚', 'shelf', BOOKSHELF, -7.25, -2.45, 0.82, 2.75, 2.28);

  const CLEAN = 0xb7b39b;
  addBox(0.8, 2.2, 1.5, -7.15, 1.1, 4.45, CLEAN, { roughness: 0.6, metalness: 0.12 });
  addBox(0.05, 0.42, 0.05, -6.72, 1.1, 4.45, 0x686b67, { metalness: 0.5 });
  solid(-7.15, 4.45, 0.88, 1.55);
  target('掃除用具入れ', 'shelf', CLEAN, -7.15, 4.45, 0.88, 1.55, 2.23, { roughness: 0.6, metalness: 0.12 });

  const BIN = 0x4e6b73;
  addCyl(0.34, 0.72, -5.95, 0.36, 4.85, BIN, { taper: 0.85, roughness: 0.65, metalness: 0.18 });
  solid(-5.95, 4.85, 0.7, 0.7);
  target('教室のゴミ箱', 'bin', BIN, -5.95, 4.85, 0.7, 0.7, 0.75, { roughness: 0.65, metalness: 0.18 });

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
    eventRig: {
      look: new THREE.Vector3(0, 1.7, ROOM.minZ + 0.2),
      spots: [
        new THREE.Vector3(0.6, 0, -4.5),
        new THREE.Vector3(2.2, 0, -4.2),
        new THREE.Vector3(-1.5, 0, -4.3),
        new THREE.Vector3(2.2, 0, -3.2),
        new THREE.Vector3(5.75, 0, -4.3),
        new THREE.Vector3(-5.7, 0, -3.2),
      ],
    },
    playerSpawn: new THREE.Vector3(-2.2, 0, 4.9),
    oniSpawn: new THREE.Vector3(5.8, 0, -4.4),
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
