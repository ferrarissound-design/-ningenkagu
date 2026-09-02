// ALL CLEAR の先にある「やりこみ完全制覇」を集計する純粋ロジック。
// DOM / localStorage に直接触れず、表示側から読み出し関数を渡して使う。

function uniqueIds(values) {
  return [...new Set((values || []).filter((v) => typeof v === 'string' && v))];
}

/**
 * Sランク・ミッション・鬼タイプ別クリア・ALL CLEARを1本の進行度へまとめる。
 * ステージ数や鬼タイプ数から総数を自動計算するため、将来の追加にも追従する。
 */
export function buildMasterySnapshot(stageIds, oniIds, loaders = {}) {
  const stages = uniqueIds(stageIds);
  const onis = uniqueIds(oniIds);
  const loadRank = loaders.loadRank || (() => null);
  const loadMission = loaders.loadMission || (() => false);
  const loadOniClear = loaders.loadOniClear || (() => false);
  const loadAllClear = loaders.loadAllClear || (() => false);

  const sRanks = stages.filter((stageId) => loadRank(stageId) === 'S');
  const missions = stages.filter((stageId) => !!loadMission(stageId));
  const oniClears = [];
  for (const stageId of stages) {
    for (const oniId of onis) {
      if (loadOniClear(stageId, oniId)) oniClears.push({ stageId, oniId });
    }
  }

  const allClear = !!loadAllClear();
  const total = stages.length + stages.length + (stages.length * onis.length) + 1;
  const earned = sRanks.length + missions.length + oniClears.length + (allClear ? 1 : 0);

  return {
    earned,
    total,
    complete: total > 0 && earned === total,
    allClear,
    groups: {
      sRank: { earned: sRanks.length, total: stages.length },
      mission: { earned: missions.length, total: stages.length },
      oni: { earned: oniClears.length, total: stages.length * onis.length },
      allClear: { earned: allClear ? 1 : 0, total: 1 },
    },
    missing: {
      sRanks: stages.filter((stageId) => !sRanks.includes(stageId)),
      missions: stages.filter((stageId) => !missions.includes(stageId)),
      oniClears: stages.flatMap((stageId) => onis
        .filter((oniId) => !oniClears.some((v) => v.stageId === stageId && v.oniId === oniId))
        .map((oniId) => ({ stageId, oniId }))),
      allClear: !allClear,
    },
  };
}

/** タイトル画面で「次に何を狙えばいいか」を1件だけ返す。 */
export function nextMasteryTarget(snapshot) {
  if (!snapshot || snapshot.complete) return null;
  if (snapshot.missing?.allClear) return { type: 'allClear' };

  const sRankStage = snapshot.missing?.sRanks?.[0];
  if (sRankStage) return { type: 'sRank', stageId: sRankStage };

  const missionStage = snapshot.missing?.missions?.[0];
  if (missionStage) return { type: 'mission', stageId: missionStage };

  const oni = snapshot.missing?.oniClears?.[0];
  if (oni) return { type: 'oni', stageId: oni.stageId, oniId: oni.oniId };

  return null;
}
