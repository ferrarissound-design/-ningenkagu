// ステージ登録と、全ステージ共通の判定ロジック
import { rectDistance, disposeObject3D } from './utils.js';
import { ROOM } from './stageBuilder.js';
import { buildLivingRoom } from './stages/living.js';
import { buildClassroom } from './stages/classroom.js';
import { buildArtRoom } from './stages/artroom.js';
import { buildLibrary } from './stages/library.js';

export { ROOM };

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
 * 未指定時はリビングを使う。
 *
 * 新しいステージを足すときは js/stages/ に buildXxx(scene) を追加し、
 * ここへ登録する。家具生成の共通処理は stageBuilder.js が担当する。
 */
const STAGE_BUILDERS = {
  living: buildLivingRoom,
  classroom: buildClassroom,
  artroom: buildArtRoom,
  library: buildLibrary,
};

export function buildStage(scene) {
  const stageId = globalThis.__ningenkaguStage;
  const build = STAGE_BUILDERS[stageId] ?? buildLivingRoom;
  return build(scene);
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
