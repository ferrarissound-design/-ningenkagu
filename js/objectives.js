// プレイ中の目標。達成判定は既存ミッションと共有し、条件成立と勝利を区別する。
import { MISSIONS } from './mission.js';
import { CHALLENGES, normalizeChallengeId } from './challenges.js';

export function objectiveProgress(game) {
  const stats = game.stats;
  const challenge = CHALLENGES[normalizeChallengeId(game.challengeId)];
  if (challenge) {
    const name = `${challenge.icon} ${challenge.name}`;
    if (game.challengeFailed) return { name, state: 'failed', detail: `条件失敗：${game.challengeFailureReason}（生存は続行可）` };
    switch (challenge.id) {
      case 'dangerDance': {
        const ready = stats.maxSuspicion >= challenge.rules.requireMaxSuspicion;
        return { name, state: ready ? 'ready' : 'active', detail: ready
          ? '✓ 75%到達！ 警戒を下げて生き残ろう'
          : `最高警戒 ${Math.floor(stats.maxSuspicion * 100)} / 75%` };
      }
      case 'oneMimic':
        return { name, state: 'active', detail: `擬態 あと${Math.max(0, 1 - game.mimicUses)}回・60秒生存` };
      case 'anomalyRush':
        return { name, state: 'active', detail: `異変 ${game.anomalies.count} / 2回・60秒生存` };
      case 'noCrouch':
        return { name, state: 'active', detail: 'しゃがまずに60秒生存' };
      default:
        return { name, state: 'active', detail: 'おとりなしで60秒生存' };
    }
  }

  const mission = MISSIONS[game.stage.id];
  if (!mission) return null;
  const name = `★ ${mission.name}`;
  const met = mission.check(stats);
  if (game.stage.id === 'living') return { name, state: met ? 'active' : 'failed', detail: met
    ? `最高警戒 ${Math.floor(stats.maxSuspicion * 100)}%・62%未満を維持`
    : '条件失敗：警戒62%以上（生存は続行可）' };
  if (game.stage.id === 'library') return { name, state: met ? 'active' : 'failed', detail: met
    ? '足音で警戒されずに生き残ろう'
    : '条件失敗：足音を聞かれた（生存は続行可）' };
  if (met) return { name, state: 'ready', detail: '✓ 条件OK！ あとは生き残ろう' };
  if (game.stage.id === 'classroom') return { name, state: 'active', detail: `家具 ${stats.mimicKinds.size} / 3種類に擬態` };
  const distances = {
    artroom: ['blackoutDistance', 6, '消灯中'],
    scienceroom: ['steamDistance', 7, '蒸気中'],
    electronics: ['retailRushDistance', 8, 'デモ中'],
  };
  const [key, goal, label] = distances[game.stage.id];
  // 四捨五入で達成前に目標値へ見えるのを防ぐ。
  const distance = (Math.floor((stats[key] || 0) * 10) / 10).toFixed(1);
  return { name, state: 'active', detail: `${label}の移動 ${distance} / ${goal}m` };
}
