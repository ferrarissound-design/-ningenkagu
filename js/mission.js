// ステージ別ミッションの定義と判定。
// DOM・localStorage・Three.js には触れない純粋ロジックにして、Unitテストしやすくする。

export const MISSIONS = {
  living: {
    id: 'calm',
    name: '冷静沈着',
    desc: '警戒度62%未満のままクリア',
    check(stats) { return (stats.maxSuspicion ?? 1) < 0.62; },
  },
  classroom: {
    id: 'mimic-master',
    name: '変装名人',
    desc: '3種類以上の家具に擬態してクリア',
    check(stats) { return mimicKindCount(stats) >= 3; },
  },
  artroom: {
    id: 'dark-runner',
    name: '闇を駆ける',
    desc: '消灯中に6m以上移動してクリア',
    check(stats) { return (stats.blackoutDistance ?? 0) >= 6; },
  },
  library: {
    id: 'silent-reader',
    name: '完全静音',
    desc: '足音で一度も鬼を警戒させずクリア',
    check(stats) { return !stats.heardAlert; },
  },
  scienceroom: {
    id: 'steam-runner',
    name: '白煙突破',
    desc: '蒸気発生中に7m以上移動してクリア',
    check(stats) { return (stats.steamDistance ?? 0) >= 7; },
  },
  electronics: {
    id: 'demo-dash',
    name: 'デモ横断',
    desc: '展示デモ再生中に8m以上移動してクリア',
    check(stats) { return (stats.retailRushDistance ?? 0) >= 8; },
  },
};

function mimicKindCount(stats) {
  const v = stats.mimicKinds;
  if (v instanceof Set) return v.size;
  if (Array.isArray(v)) return new Set(v).size;
  if (Number.isFinite(stats.mimicKindCount)) return stats.mimicKindCount;
  return 0;
}

/**
 * @param {string} stageId
 * @param {object} stats 1プレイ中に収集したミッション用統計
 * @param {boolean} win クリアしていない場合は必ず未達成
 */
export function evaluateMission(stageId, stats = {}, win = false) {
  const mission = MISSIONS[stageId];
  if (!mission) return null;
  return {
    stageId,
    id: mission.id,
    name: mission.name,
    desc: mission.desc,
    completed: !!win && mission.check(stats),
  };
}
