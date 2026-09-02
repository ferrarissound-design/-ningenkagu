// 家具ごとの「擬態のクセ」。
//
// Game.prototype を後から書き換えず、Game 本体から明示的に呼べる補正関数だけを提供する。
// これで読み込み順によってゲームルールが変わる暗黙依存をなくす。
import { clamp, rectDistance } from './utils.js';
import { FURNITURE_TRAITS, POSE_FOR_KIND } from './furnitureKinds.js';

export { FURNITURE_TRAITS };

/** 家具固有の擬態補正を既存の擬態成功度へ加える。 */
export function applyFurnitureTraitBonus(game, base) {
  const t = game.player.mimicTarget;
  if (!t) return clamp(base, 0, 0.94);

  const matched = POSE_FOR_KIND[t.kind] === game.player.pose;
  const still = game.player.stillness;
  const speed = game.player.speed;
  const distance = rectDistance(t.rect, game.player.position.x, game.player.position.z);
  let bonus = 0;

  switch (t.kind) {
    case 'wall':
      if (matched && distance < 0.55) bonus += 0.045;
      break;

    case 'shelf':
      if (matched && still > 0.65) bonus += 0.055;
      break;

    case 'table':
      if (matched && still > 0.55) bonus += 0.045;
      break;

    case 'plant':
      // 植物だけは「完全静止」以外にも逃げ道を作る。
      // Yポーズでノロノロ動く程度なら、葉の揺れとして一部を吸収する。
      if (matched && speed > 0.12 && speed < 1.05) {
        const sway = clamp(1 - (speed - 0.12) / 0.93, 0, 1);
        bonus += 0.055 + 0.045 * sway;
      } else if (matched && still > 0.7) {
        bonus += 0.035;
      }
      break;

    case 'sofa':
    case 'chair':
    case 'box':
      if (matched && still > 0.6 && distance < 1.2) bonus += 0.055;
      break;

    case 'bin': {
      const dx = game.oni.position.x - game.player.position.x;
      const dz = game.oni.position.z - game.player.position.z;
      const oniDist = Math.hypot(dx, dz);
      if (matched && oniDist > 5.0) bonus += 0.075;
      if (oniDist < 2.7) bonus -= 0.085;
      break;
    }

    case 'statue':
      if (matched && speed < 0.08) {
        // 止まり始めから像らしく見える。まだ静止度が低いほど補正を大きくする。
        bonus += 0.035 + (1 - still) * 0.07;
      }
      if (speed > 0.12) bonus -= 0.14;
      break;

    case 'easel':
      if (matched && still > 0.6) bonus += 0.075;
      break;
  }

  return clamp(base + bonus, 0, 0.94);
}

/** 擬態成功時に一度だけ出す家具特性の説明文。 */
export function furnitureTraitMessage(kind) {
  const trait = FURNITURE_TRAITS[kind];
  return trait ? `${trait.icon} ${trait.name}：${trait.desc}` : '';
}

// 開発コンソール向けの互換表示。ゲームルール自体には影響しない。
globalThis.__ningenFurnitureTraits = FURNITURE_TRAITS;
