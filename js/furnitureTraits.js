// 家具ごとの「擬態のクセ」。
//
// 鬼側だけでなくプレイヤー側にも攻略の選択肢を作るため、
// 家具の種類ごとに小さな得意・不得意を与える。
// 元の Game ロジックはそのまま使い、固有特性だけを上乗せする。
import { Game } from './game.js';
import { POSE_FOR_KIND } from './stage.js';
import { clamp, rectDistance } from './utils.js';

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

/**
 * 既存の「色・静止・ポーズ・距離」計算を先に呼び、家具固有の補正だけを加える。
 * これなら game.js 側の基礎バランスを今後変えても、特性側へ自動で反映される。
 * 上限94%は維持するので、固有能力だけで絶対安全にはならない。
 */
const baseComputeMimicry = Game.prototype.computeMimicry;
Game.prototype.computeMimicry = function computeMimicryWithFurnitureTraits() {
  const base = baseComputeMimicry.call(this);
  const t = this.player.mimicTarget;
  if (!t) return base;

  const matched = POSE_FOR_KIND[t.kind] === this.player.pose;
  const still = this.player.stillness;
  const speed = this.player.speed;
  const distance = rectDistance(t.rect, this.player.position.x, this.player.position.z);
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
      const dx = this.oni.position.x - this.player.position.x;
      const dz = this.oni.position.z - this.player.position.z;
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

// コンソールから一覧を確認できるようにしておく。通常UIには出さない。
globalThis.__ningenFurnitureTraits = FURNITURE_TRAITS;
