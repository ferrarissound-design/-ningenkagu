// 鬼タイプ別クリア記録の純粋ロジック。
// 保存やDOM操作は missionUi.js 側に任せ、このファイルは組み合わせと集計だけ扱う。

export const ONI_CLEAR_KEY_PREFIX = 'ningenkagu.oniClear.';

export function oniClearKey(stageId, oniId) {
  return `${ONI_CLEAR_KEY_PREFIX}${stageId}.${oniId}`;
}

export function countOniClears(stageIds, oniIds, isCompleted) {
  let cleared = 0;
  for (const stageId of stageIds) {
    for (const oniId of oniIds) {
      if (isCompleted(stageId, oniId)) cleared += 1;
    }
  }
  return {
    cleared,
    total: stageIds.length * oniIds.length,
    complete: stageIds.length > 0 && oniIds.length > 0 && cleared === stageIds.length * oniIds.length,
  };
}

export function stageOniClears(stageId, oniIds, isCompleted) {
  return oniIds.map((oniId) => ({ oniId, completed: !!isCompleted(stageId, oniId) }));
}
