// 家具種類ごとの共通メタデータ。
//
// 「図鑑名」「似合うポーズ」「固有特性の説明」を同じ場所に置き、種類追加時の定義漏れを防ぐ。
// 実際の数値補正は furnitureTraits.js が担当する。
export const FURNITURE_KINDS = Object.freeze({
  wall: Object.freeze({
    pose: 'stand', icon: '🧱', catalogName: '壁', name: '壁同化',
    desc: '直立して壁際に寄るほど輪郭が消える',
    strategy: '👁◎ 💨○ 🧐△　見張り鬼に強い。壁際で完全静止が基本。',
  }),
  shelf: Object.freeze({
    pose: 'tpose', icon: '🗄️', catalogName: '棚・書架', name: '横一直線',
    desc: 'Tポーズで静止すると棚の輪郭に溶け込む',
    strategy: '👁○ 💨◎ 🧐○　横長の輪郭が安定。巡回路沿いで使いやすい。',
  }),
  table: Object.freeze({
    pose: 'tpose', icon: '📐', catalogName: 'テーブル・机', name: '天板合わせ',
    desc: 'Tポーズで止まると横長の家具として通りやすい',
    strategy: '👁○ 💨◎ 🧐△　移動後すぐ止まれる場所で強い。検査には慎重に。',
  }),
  plant: Object.freeze({
    pose: 'ypose', icon: '🌿', catalogName: '観葉植物', name: '葉っぱのゆらぎ',
    desc: 'Yポーズなら、ゆっくりした移動は少しだけごまかせる',
    strategy: '👁△ 💨◎ 🧐○　唯一ゆっくり動きを許す。猪突猛進鬼の位置替え向き。',
  }),
  sofa: Object.freeze({
    pose: 'crouch', icon: '🛋️', catalogName: 'ソファ', name: '低姿勢',
    desc: 'しゃがんで静止すると大きな家具に紛れやすい',
    strategy: '👁○ 💨○ 🧐◎　低く大きい輪郭。検査を耐える拠点に向く。',
  }),
  chair: Object.freeze({
    pose: 'crouch', icon: '🪑', catalogName: 'イス', name: '低姿勢',
    desc: 'しゃがんで静止すると脚と座面の輪郭に合わせやすい',
    strategy: '👁△ 💨◎ 🧐○　数が多く乗り換えやすい。短時間の避難先。',
  }),
  box: Object.freeze({
    pose: 'crouch', icon: '📦', catalogName: '箱・収納', name: '箱になりきる',
    desc: 'しゃがんで止まるほど四角いシルエットが強くなる',
    strategy: '👁○ 💨○ 🧐◎　形が単純で検査向き。同じ箱の再利用には注意。',
  }),
  bin: Object.freeze({
    pose: 'crouch', icon: '🗑️', catalogName: 'ゴミ箱', name: '遠目は完璧',
    desc: '遠くからは強いが、近くで見られると形の違いがバレやすい',
    strategy: '👁◎ 💨○ 🧐×　遠距離専用。疑り深い鬼の近距離検査は避ける。',
  }),
  statue: Object.freeze({
    pose: 'ypose', icon: '🗿', catalogName: '像・石膏像', name: '完全静止',
    desc: 'Yポーズでピタ止まりすると強い。動くと一気に不自然になる',
    strategy: '👁○ 💨△ 🧐◎　完全静止なら最高峰。移動を始める瞬間が弱点。',
  }),
  easel: Object.freeze({
    pose: 'tpose', icon: '🎨', catalogName: 'イーゼル', name: '輪郭合わせ',
    desc: 'Tポーズで静止するとキャンバスの形に紛れやすい',
    strategy: '👁○ 💨○ 🧐◎　輪郭が明確で検査向き。背景色も合わせると強い。',
  }),
  tv: Object.freeze({
    pose: 'stand', icon: '📺', catalogName: 'テレビ', name: '黒画面同化',
    desc: '直立で止まると暗い画面と細い展示台に紛れやすい',
    strategy: '👁◎ 💨○ 🧐△　暗い壁際で強い。点灯系の異変中は輪郭が浮く。',
  }),
  fridge: Object.freeze({
    pose: 'stand', icon: '🧊', catalogName: '冷蔵庫', name: '大型家電',
    desc: '直立して側面へ寄ると大きな四角い輪郭を作りやすい',
    strategy: '👁○ 💨△ 🧐◎　完全静止で検査に強い。通路を塞ぐので逃げ出しは遅い。',
  }),
  washer: Object.freeze({
    pose: 'crouch', icon: '🧺', catalogName: '洗濯機', name: '白物同化',
    desc: 'しゃがんで止まると低い箱型家電として紛れやすい',
    strategy: '👁○ 💨◎ 🧐○　売場で数が多く乗り換えやすい。白い背景で特に強い。',
  }),
  massage: Object.freeze({
    pose: 'crouch', icon: '💺', catalogName: 'マッサージチェア', name: '深い低姿勢',
    desc: 'しゃがみ静止で大きな座面と背もたれの影へ溶け込む',
    strategy: '👁△ 💨○ 🧐◎　検査に強いが目立つ。売場奥の暗所で使うと安定。',
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
