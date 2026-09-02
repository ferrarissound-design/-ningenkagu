// ステージの登録情報を1か所に集める。
//
// 新しいステージを追加するときは、基本的にここへ1項目足す。
// 3Dビルダー・開始カメラ・タイトル表示用メタデータをまとめ、
// main.js / stage.js / startViews.js の定義ズレを防ぐ。
import { buildLivingRoom } from './stages/living.js';
import { buildClassroom } from './stages/classroom.js';
import { buildArtRoom } from './stages/artroom.js';
import { buildLibrary } from './stages/library.js';
import { buildScienceRoom } from './stages/scienceroom.js';

export const STAGE_DEFINITIONS = Object.freeze([
  {
    id: 'living',
    name: 'リビング',
    label: 'STAGE 1　リビング',
    clearNote: 'リビング突破！ 次は机とロッカーだらけの教室。鬼の巡回路も変わる。',
    build: buildLivingRoom,
    startView: {
      position: [-4.8, 0, -3.2],
      yaw: -2.20,
      pitch: 0.48,
    },
  },
  {
    id: 'classroom',
    name: '教室',
    label: 'STAGE 2　教室',
    clearNote: '教室突破！ 次は石膏像とイーゼルが並ぶ美術室。真っ白な像に紛れ込め。',
    build: buildClassroom,
    startView: {
      position: [-2.2, 0, 2.0],
      yaw: -Math.PI / 4,
      pitch: 0.48,
    },
  },
  {
    id: 'artroom',
    name: '美術室',
    label: 'STAGE 3　美術室',
    clearNote: '美術室突破！ 次は本棚が並ぶ図書室。書架の間を縫って逃げ切れ。',
    build: buildArtRoom,
    startView: {
      position: [4.0, 0, -2.4],
      yaw: 2.15,
      pitch: 0.48,
    },
  },
  {
    id: 'library',
    name: '図書室',
    label: 'STAGE 4　図書室',
    clearNote: '図書室突破！ 次は実験台と標本棚が並ぶ理科室。蒸気で鬼の視界が揺らぐ。',
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
    name: '理科室',
    label: 'STAGE 5　理科室',
    clearNote: '',
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
