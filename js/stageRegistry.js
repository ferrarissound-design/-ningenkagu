// ステージの登録情報を1か所に集める。
//
// 新しいステージを追加するときは、基本的にここへ1項目足す。
// build は3Dレイアウト生成、startView はゲーム開始直後のカメラ構図を担当する。
// UI文言やミッションのような別責務は、それぞれの専用モジュールに残す。
import { buildLivingRoom } from './stages/living.js';
import { buildClassroom } from './stages/classroom.js';
import { buildArtRoom } from './stages/artroom.js';
import { buildLibrary } from './stages/library.js';
import { buildScienceRoom } from './stages/scienceroom.js';

export const STAGE_DEFINITIONS = Object.freeze([
  {
    id: 'living',
    build: buildLivingRoom,
    startView: {
      position: [-4.8, 0, -3.2],
      yaw: -2.20,
      pitch: 0.48,
    },
  },
  {
    id: 'classroom',
    build: buildClassroom,
    startView: {
      position: [-2.2, 0, 2.0],
      yaw: -Math.PI / 4,
      pitch: 0.48,
    },
  },
  {
    id: 'artroom',
    build: buildArtRoom,
    startView: {
      position: [4.0, 0, -2.4],
      yaw: 2.15,
      pitch: 0.48,
    },
  },
  {
    id: 'library',
    build: buildLibrary,
    // 図書室・理科室のスポーンは -x/+z の隅。攻略エリアは +x/-z 側にある。
    startView: {
      position: [-5.0, 0, 4.2],
      yaw: -0.76,
      pitch: 0.48,
    },
  },
  {
    id: 'scienceroom',
    build: buildScienceRoom,
    startView: {
      position: [-5.0, 0, 4.0],
      yaw: -Math.PI / 4,
      pitch: 0.48,
    },
  },
]);

export const STAGE_BY_ID = Object.freeze(Object.fromEntries(
  STAGE_DEFINITIONS.map((stage) => [stage.id, stage]),
));

/** 不正・未指定のIDはSTAGE 1へフォールバックする。 */
export function getStageDefinition(id) {
  return STAGE_BY_ID[id] || STAGE_DEFINITIONS[0];
}
