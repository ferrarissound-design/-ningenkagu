// プレイヤーの「クセ」を1プレイ内だけ観察して、鬼が1度だけ対策する。
// 永続学習にはせず、毎回リセットすることで理不尽な難化を防ぐ。
import { ROOM } from './stageBuilder.js';
import { GAME_EVENT, emitGameEvent } from './gameEvents.js';

export const HABITS = Object.freeze({
  corner: Object.freeze({
    id: 'corner',
    icon: '📐',
    name: '隅待ち',
    desc: '鬼が部屋の端を重点的に見るようになった',
  }),
  crouch: Object.freeze({
    id: 'crouch',
    icon: '🐾',
    name: 'しゃがみ移動',
    desc: '鬼が小さな足音まで聞こうとしている',
  }),
  decoy: Object.freeze({
    id: 'decoy',
    icon: '🪤',
    name: '早いおとり',
    desc: '鬼がおとりに長く釣られなくなった',
  }),
});

export class OniHabitModel {
  constructor() { this.reset(); }

  reset() {
    this.elapsed = 0;
    this.cornerTime = 0;
    this.crouchTime = 0;
    this.earlyDecoys = 0;
    this.learned = null;
    this.evaluated = false;
  }

  nearEdge(player) {
    const p = player.position;
    const edge = 1.35;
    return p.x < ROOM.minX + edge || p.x > ROOM.maxX - edge
      || p.z < ROOM.minZ + edge || p.z > ROOM.maxZ - edge;
  }

  recordDecoy() {
    if (this.elapsed <= 22) this.earlyDecoys++;
  }

  update(dt, game) {
    if (this.learned || game.state !== 'playing') return null;
    this.elapsed += dt;
    if (this.nearEdge(game.player)) this.cornerTime += dt;
    if (game.player.pose === 'crouch' && game.player.speed > 0.12) this.crouchTime += dt;

    if (this.elapsed < 20) return null;
    this.evaluated = true;

    const scores = [
      { id: 'corner', score: this.cornerTime / Math.max(1, this.elapsed), threshold: 0.34 },
      { id: 'crouch', score: this.crouchTime / Math.max(1, this.elapsed), threshold: 0.28 },
      { id: 'decoy', score: this.earlyDecoys > 0 ? 0.55 + this.earlyDecoys * 0.15 : 0, threshold: 0.5 },
    ].sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (!best || best.score < best.threshold) return null;
    this.learned = HABITS[best.id];
    emitGameEvent(GAME_EVENT.HABIT_LEARNED, { game, habit: this.learned });
    return this.learned;
  }

  detectScale(game) {
    if (this.learned?.id !== 'corner') return 1;
    return this.nearEdge(game.player) ? 1.16 : 1.03;
  }

  noiseScale() {
    return this.learned?.id === 'crouch' ? 1.24 : 1;
  }

  decoyDurationScale() {
    return this.learned?.id === 'decoy' ? 0.62 : 1;
  }

  get info() {
    return {
      elapsed: this.elapsed,
      cornerTime: this.cornerTime,
      crouchTime: this.crouchTime,
      earlyDecoys: this.earlyDecoys,
      learned: this.learned?.id || null,
    };
  }
}
