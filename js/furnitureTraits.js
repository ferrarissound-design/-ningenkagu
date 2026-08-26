// 家具ごとの「擬態のクセ」。
//
// 鬼側だけでなくプレイヤー側にも攻略の選択肢を作るため、
// 家具の種類ごとに小さな得意・不得意を与える。
// Game 本体は触らず、prototype を薄く拡張する形で既存ロジックへ重ねる。
import { Game } from './game.js';
import { POSE_FOR_KIND } from './stage.js';
import { clamp, colorMatchScore, rectDistance } from './utils.js';

export const FURNITURE_TRAITS = {
  wall: {
    icon: '🧱', name: '壁同化',
    desc: '直立して壁際に寄るほど輪郭が消える',
  },
  shelf: {
    icon: '🗄️', name: '横一直線',
    desc: 'Tポーズで静止すると棚の輪郭に溶け込む',
  },
  table: {
    icon: '📐', name: '天板合わせ',
    desc: 'Tポーズで止まると横長の家具として通りやすい',
  },
  plant: {
    icon: '🌿', name: '葉っぱのゆらぎ',
    desc: 'Yポーズなら、ゆっくりした移動は少しだけごまかせる',
  },
  sofa: {
    icon: '🛋️', name: '低姿勢',
    desc: 'しゃがんで静止すると大きな家具に紛れやすい',
  },
  chair: {
    icon: '🪑', name: '低姿勢',
    desc: 'しゃがんで静止すると脚と座面の輪郭に合わせやすい',
  },
  box: {
    icon: '📦', name: '箱になりきる',
    desc: 'しゃがんで止まるほど四角いシルエットが強くなる',
  },
  bin: {
    icon: '🗑️', name: '遠目は完璧',
    desc: '遠くからは強いが、近くで見られると形の違いがバレやすい',
  },
  statue: {
    icon: '🗿', name: '完全静止',
    desc: 'Yポーズでピタ止まりすると強い。動くと一気に不自然になる',
  },
  easel: {
    icon: '🎨', name: '輪郭合わせ',
    desc: 'Tポーズで静止するとキャンバスの形に紛れやすい',
  },
};

function nearestKindDistance(targets, kind, x, z) {
  let best = Infinity;
  for (const t of targets) {
    if (t.kind !== kind) continue;
    best = Math.min(best, rectDistance(t.rect, x, z));
  }
  return Number.isFinite(best) ? best : 99;
}

function traitFor(game) {
  const kind = game.player?.mimicTarget?.kind;
  return kind ? FURNITURE_TRAITS[kind] || null : null;
}

/**
 * 元の擬態計算をそのまま再現したうえで、家具固有のクセを最後に重ねる。
 * 上限94%は維持するので、固有能力が「絶対安全」にはならない。
 */
Game.prototype.computeMimicry = function computeMimicryWithFurnitureTraits() {
  const color = colorMatchScore(this.player.currentColor, this.backdropColor);
  let still = this.player.stillness;
  const t = this.player.mimicTarget;
  let pose = 0.25;
  let context = 0.15;
  let distance = 99;

  if (t) {
    pose = POSE_FOR_KIND[t.kind] === this.player.pose ? 1.0 : 0.2;
    distance = nearestKindDistance(
      this.stage.targets,
      t.kind,
      this.player.position.x,
      this.player.position.z
    );
    context = clamp(1.15 - distance / 5.0, 0.15, 1);
  }

  let bonus = 0;
  if (t) {
    const matched = POSE_FOR_KIND[t.kind] === this.player.pose;
    const speed = this.player.speed;

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
        const dx = this.oni.position.x - this.player.position.x;
        const dz = this.oni.position.z - this.player.position.z;
        const oniDist = Math.hypot(dx, dz);
        if (matched && oniDist > 5.0) bonus += 0.075;
        if (oniDist < 2.7) bonus -= 0.085;
        break;
      }

      case 'statue':
        if (matched && speed < 0.08) {
          // 石膏像は止まった瞬間から「それっぽい」。静止完成までの待ちを少し短縮。
          still = clamp(still + 0.28, 0, 1);
          bonus += 0.035;
        }
        if (speed > 0.12) bonus -= 0.14;
        break;

      case 'easel':
        if (matched && still > 0.6) bonus += 0.075;
        break;
    }
  }

  let v = 0.34 * color + 0.26 * still + 0.20 * pose + 0.20 * context;
  if (!t) v *= 0.6;
  return clamp(v + bonus, 0, 0.94);
};

// 擬態した瞬間だけ特性を知らせる。常設UIを増やさず、覚えれば見なくて済む情報にする。
const baseTryMimic = Game.prototype.tryMimic;
Game.prototype.tryMimic = function tryMimicWithTraitNotice() {
  const target = this.nearTarget;
  baseTryMimic.call(this);
  if (!target || this.player.mimicTarget !== target) return;
  const trait = FURNITURE_TRAITS[target.kind];
  if (trait) this.hud.toast(`${trait.icon} ${trait.name}：${trait.desc}`);
};

// コンソールから調整値を確認できるようにしておく。通常UIには出さない。
globalThis.__ningenFurnitureTraits = FURNITURE_TRAITS;
