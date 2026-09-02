// ステージ登録と、全ステージ共通の判定ロジック
import { rectDistance, disposeObject3D } from './utils.js';
import { ROOM } from './stageBuilder.js';
import { getStageDefinition } from './stageRegistry.js';
import { POSE_FOR_KIND } from './furnitureKinds.js';

export { ROOM, POSE_FOR_KIND };

/**
 * main.js が globalThis.__ningenkaguStage に指定したステージを生成する。
 * 未指定・不正なIDは stageRegistry.js 側でリビングへフォールバックする。
 *
 * 新しいステージを足すときは js/stages/ に buildXxx(scene) を追加し、
 * stageRegistry.js へ登録する。家具生成の共通処理は stageBuilder.js が担当する。
 */
export function buildStage(scene) {
  return getStageDefinition(globalThis.__ningenkaguStage).build(scene);
}

/** ステージが確保した GPU リソースを解放する。作り直す前に必ず呼ぶ。 */
export function disposeStage(stage) {
  if (stage) disposeObject3D(stage.group);
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
