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

/**
 * 円が矩形群にめり込まないよう押し出す。pos は Vector3(x,_,z)
 *
 * 壁ぎわの家具（本棚・ロッカー・標本棚など）は、半径ぶん膨らませた矩形が
 * 部屋の可動範囲をはみ出す。そちら側へ押し出すと直後のクランプで引き戻され、
 * 家具の中にめり込んだ座標が確定してしまうため、
 * 「押し出した先が可動範囲に収まる向き」だけを候補にする。
 */
export function resolveCollisions(pos, radius, solids) {
  const pad = radius + 0.05;
  const limitMinX = ROOM.minX + pad, limitMaxX = ROOM.maxX - pad;
  const limitMinZ = ROOM.minZ + pad, limitMaxZ = ROOM.maxZ - pad;

  for (const s of solids) {
    const minX = s.minX - radius, maxX = s.maxX + radius;
    const minZ = s.minZ - radius, maxZ = s.maxZ + radius;
    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      const dl = minX >= limitMinX ? pos.x - minX : Infinity;
      const dr = maxX <= limitMaxX ? maxX - pos.x : Infinity;
      const db = minZ >= limitMinZ ? pos.z - minZ : Infinity;
      const df = maxZ <= limitMaxZ ? maxZ - pos.z : Infinity;
      const m = Math.min(dl, dr, db, df);
      // 4方向とも部屋の外（＝部屋を横断する家具）なら、従来どおり最短側へ逃がす
      if (m === Infinity) {
        const fl = pos.x - minX, fr = maxX - pos.x;
        const fb = pos.z - minZ, ff = maxZ - pos.z;
        const fm = Math.min(fl, fr, fb, ff);
        if (fm === fl) pos.x = minX;
        else if (fm === fr) pos.x = maxX;
        else if (fm === fb) pos.z = minZ;
        else pos.z = maxZ;
      } else if (m === dl) pos.x = minX;
      else if (m === dr) pos.x = maxX;
      else if (m === db) pos.z = minZ;
      else pos.z = maxZ;
    }
  }

  pos.x = Math.max(limitMinX, Math.min(limitMaxX, pos.x));
  pos.z = Math.max(limitMinZ, Math.min(limitMaxZ, pos.z));
}
