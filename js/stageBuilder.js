// 各ステージ共通のビルダー。部屋の寸法と、家具を組み立てるための小さな関数群だけを持つ。
// ステージ固有のレイアウトは js/stages/*.js 側に書く。
import * as THREE from '../vendor/three/three.module.min.js';

export const ROOM = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, height: 3.2 };
const WALL_T = 0.3;

/** 1ステージ分の group / occluders / solids / targets と、それらを積む小さな関数群を作る */
export function createBuilder(scene) {
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
