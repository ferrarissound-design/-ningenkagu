// 家具種類ごとの共通メタデータ。
//
// 「図鑑名」「似合うポーズ」「固有特性の説明」を同じ場所に置き、種類追加時の定義漏れを防ぐ。
// 実際の数値補正は furnitureTraits.js が担当する。
export const FURNITURE_KINDS = Object.freeze({
  wall: Object.freeze({
    pose: 'stand', icon: '🧱', catalogName: '壁', name: '壁同化',
    desc: '直立して壁際に寄るほど輪郭が消える',
  }),
  shelf: Object.freeze({
    pose: 'tpose', icon: '🗄️', catalogName: '棚・書架', name: '横一直線',
    desc: 'Tポーズで静止すると棚の輪郭に溶け込む',
  }),
  table: Object.freeze({
    pose: 'tpose', icon: '📐', catalogName: 'テーブル・机', name: '天板合わせ',
    desc: 'Tポーズで止まると横長の家具として通りやすい',
  }),
  plant: Object.freeze({
    pose: 'ypose', icon: '🌿', catalogName: '観葉植物', name: '葉っぱのゆらぎ',
    desc: 'Yポーズなら、ゆっくりした移動は少しだけごまかせる',
  }),
  sofa: Object.freeze({
    pose: 'crouch', icon: '🛋️', catalogName: 'ソファ', name: '低姿勢',
    desc: 'しゃがんで静止すると大きな家具に紛れやすい',
  }),
  chair: Object.freeze({
    pose: 'crouch', icon: '🪑', catalogName: 'イス', name: '低姿勢',
    desc: 'しゃがんで静止すると脚と座面の輪郭に合わせやすい',
  }),
  box: Object.freeze({
    pose: 'crouch', icon: '📦', catalogName: '箱・収納', name: '箱になりきる',
    desc: 'しゃがんで止まるほど四角いシルエットが強くなる',
  }),
  bin: Object.freeze({
    pose: 'crouch', icon: '🗑️', catalogName: 'ゴミ箱', name: '遠目は完璧',
    desc: '遠くからは強いが、近くで見られると形の違いがバレやすい',
  }),
  statue: Object.freeze({
    pose: 'ypose', icon: '🗿', catalogName: '像・石膏像', name: '完全静止',
    desc: 'Yポーズでピタ止まりすると強い。動くと一気に不自然になる',
  }),
  easel: Object.freeze({
    pose: 'tpose', icon: '🎨', catalogName: 'イーゼル', name: '輪郭合わせ',
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
