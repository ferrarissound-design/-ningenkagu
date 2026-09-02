// 家具種類ごとの共通メタデータ。
//
// 「似合うポーズ」と「固有特性の説明」を同じ場所に置き、種類追加時の定義漏れを防ぐ。
// 実際の数値補正は furnitureTraits.js が担当する。
export const FURNITURE_KINDS = Object.freeze({
  wall: Object.freeze({
    pose: 'stand', icon: '🧱', name: '壁同化',
    desc: '直立して壁際に寄るほど輪郭が消える',
  }),
  shelf: Object.freeze({
    pose: 'tpose', icon: '🗄️', name: '横一直線',
    desc: 'Tポーズで静止すると棚の輪郭に溶け込む',
  }),
  table: Object.freeze({
    pose: 'tpose', icon: '📐', name: '天板合わせ',
    desc: 'Tポーズで止まると横長の家具として通りやすい',
  }),
  plant: Object.freeze({
    pose: 'ypose', icon: '🌿', name: '葉っぱのゆらぎ',
    desc: 'Yポーズなら、ゆっくりした移動は少しだけごまかせる',
  }),
  sofa: Object.freeze({
    pose: 'crouch', icon: '🛋️', name: '低姿勢',
    desc: 'しゃがんで静止すると大きな家具に紛れやすい',
  }),
  chair: Object.freeze({
    pose: 'crouch', icon: '🪑', name: '低姿勢',
    desc: 'しゃがんで静止すると脚と座面の輪郭に合わせやすい',
  }),
  box: Object.freeze({
    pose: 'crouch', icon: '📦', name: '箱になりきる',
    desc: 'しゃがんで止まるほど四角いシルエットが強くなる',
  }),
  bin: Object.freeze({
    pose: 'crouch', icon: '🗑️', name: '遠目は完璧',
    desc: '遠くからは強いが、近くで見られると形の違いがバレやすい',
  }),
  statue: Object.freeze({
    pose: 'ypose', icon: '🗿', name: '完全静止',
    desc: 'Yポーズでピタ止まりすると強い。動くと一気に不自然になる',
  }),
  easel: Object.freeze({
    pose: 'tpose', icon: '🎨', name: '輪郭合わせ',
    desc: 'Tポーズで静止するとキャンバスの形に紛れやすい',
  }),
});

export const POSE_FOR_KIND = Object.freeze(Object.fromEntries(
  Object.entries(FURNITURE_KINDS).map(([kind, definition]) => [kind, definition.pose]),
));

export const FURNITURE_TRAITS = Object.freeze(Object.fromEntries(
  Object.entries(FURNITURE_KINDS).map(([kind, { icon, name, desc }]) => [
    kind,
    Object.freeze({ icon, name, desc }),
  ]),
));
