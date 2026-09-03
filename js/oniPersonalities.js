// 鬼の性格タイプ：視界・移動速度・検査傾向などの基準値と、3種類の具体的な調整値。

/** 視界の基準値。実際の値は性格タイプで倍率を掛けた this.view を使う */
export const VIEW = {
  range: 14.0,         // 正面視界の距離
  halfAngle: 0.63,     // 約36度
  periRange: 3.4,      // 至近距離の広い視界
  periHalfAngle: 1.5,  // 約86度
  eyeHeight: 1.54,
};

/** 移動速度の基準値（性格タイプの speedScale が掛かる） */
export const MOVE = {
  patrol: 2.15,   // 巡回
  suspect: 2.60,  // 怪しんで詰め寄る
};

/**
 * 足音（聴覚）の基準値。視界と違って壁越しでも届くが、距離で急に減衰する。
 * 「見抜く力」を流用するので、視界の強い性格タイプは耳もよい。
 */
export const HEARING = {
  range: 6.5,      // これを超えると聞こえない（tune.detectFalloffScale が掛かる）
  alertLevel: 0.55, // これを超える大きさで聞こえると、姿が見えなくても音のした方へ向かう
};

/**
 * 性格タイプの既定値。すべて「基準値に対する倍率」で、1 なら今までと同じ挙動。
 * 新しいタイプを足すときは ONI_PERSONALITIES に1行加えて、
 * 変えたい項目だけ書けばよい（書かなかった項目はここの値になる）。
 */
const DEFAULT_TUNE = {
  speedScale: 1,           // 移動速度（巡回・接近・検査中の動き すべて）
  visionRangeScale: 1,     // 正面視界の距離
  visionAngleScale: 1,     // 正面視界の広さ
  periRangeScale: 1,       // 至近距離視界の距離
  detectScale: 1,          // 警戒度のたまりやすさ（＝家具と見抜く力）
  detectFalloffScale: 1,   // 遠距離での見抜く力の落ちにくさ（大きいほど遠くでも強い）
  inspectChanceScale: 1,   // SUSPECT から INSPECT へ進む確率
  inspectCooldownScale: 1, // 検査後クールダウン（小さいほど検査が多い）
  inspectActScale: 1,      // 検査1動作の長さ
  inspectExtraScale: 1,    // 検査に動作をもう1つ足す確率
  lookTimeScale: 1,        // 巡回中に立ち止まって見回す時間
  sweepScale: 1,           // 首振りの大きさ
  sweepRate: 1,            // 首振りの速さ
  furniturePause: 0,       // 家具の前で足を止める確率（0で無効）
  suspectMark: false,      // SUSPECT 中も頭上に「？」を出すか
  // --- ステージイベント（stageEvents.js）への反応 ---
  eventMoveScale: 1,       // イベント地点へ向かうときの速さ
  eventGlance: 0.35,       // イベント中に周囲をちらちら見る強さ（0で一点集中）
  eventDistract: 1,        // 気の取られやすさ（大きいほど視界ペナルティが強い）
  eventLinger: 0,          // イベント後、巡回に戻る前に見回す時間の倍率（0でそのまま巡回）
};

const persona = (id, name, icon, desc, tune) => ({
  id, name, icon, desc, ...DEFAULT_TUNE, ...tune,
});

/**
 * 鬼の性格タイプ。
 * 「強さ」ではなく「攻略法」が変わるように、得意の裏に必ず弱点を置く。
 */
export const ONI_PERSONALITIES = {
  // 遠くまで見えるが足が遅い。遮蔽物と擬態の完成度で距離を稼ぐ相手。
  watcher: persona('watcher', '見張り鬼', '👁', '遠くまでよく見える。動きは少し遅い。', {
    speedScale: 0.85,
    visionRangeScale: 1.20,
    visionAngleScale: 1.14,
    periRangeScale: 1.10,
    detectFalloffScale: 1.50,
    lookTimeScale: 1.30,
    sweepScale: 1.25,
    // テレビを見ながらも周囲を警戒し続ける＝チャンスタイムが少し短く感じる
    eventGlance: 0.95,
    eventDistract: 0.75,
  }),
  // 速いが大雑把。見つかりそうになってから移動する「逃げ」が通る相手。
  charger: persona('charger', '猪突猛進鬼', '💨', '足が速い。でも家具の見分けは少し雑。', {
    speedScale: 1.25,
    visionRangeScale: 0.82,
    visionAngleScale: 0.94,
    detectScale: 0.78,
    detectFalloffScale: 0.85,
    inspectChanceScale: 0.55,
    inspectCooldownScale: 1.30,
    inspectActScale: 0.90,
    inspectExtraScale: 0.50,
    lookTimeScale: 0.55,
    sweepScale: 0.85,
    sweepRate: 1.40,
    // 何かあれば真っ先に飛んでいく。その分うしろががら空きになる
    eventMoveScale: 1.45,
    eventGlance: 0.12,
    eventDistract: 1.15,
  }),
  // すぐ検査に来る。色・ポーズ・静止をきちんと合わせないと耐えられない相手。
  suspicious: persona('suspicious', '疑り深い鬼', '🧐', 'すぐ家具を疑う。擬態の完成度が重要。', {
    speedScale: 0.88,
    visionRangeScale: 0.92,
    visionAngleScale: 0.94,
    detectScale: 0.95,
    inspectChanceScale: 1.90,
    inspectCooldownScale: 0.70,
    inspectActScale: 1.15,
    inspectExtraScale: 1.40,
    lookTimeScale: 1.10,
    furniturePause: 0.50,
    suspectMark: true,
    // イベントが終わってもすぐには巡回へ戻らず、その場で周囲を確かめる
    eventGlance: 0.55,
    eventDistract: 0.9,
    eventLinger: 1.2,
  }),
};

export const ONI_PERSONALITY_IDS = Object.keys(ONI_PERSONALITIES);
export const DEFAULT_ONI_PERSONALITY = ONI_PERSONALITY_IDS[0];
export const ONI_CYCLE_KEY = 'ningenkagu.oniCycle';

// 開発用：次のゲームで使うタイプを固定する（通常プレイでは null）
let forcedPersonality = null;

/** 開発用。不正な id や null で通常のランダムに戻す。設定した id を返す */
export function setForcedOniPersonality(id) {
  forcedPersonality = id && ONI_PERSONALITIES[id] ? id : null;
  return forcedPersonality;
}

export function getForcedOniPersonality() { return forcedPersonality; }

function cycleStorage() {
  try { return globalThis.localStorage || null; }
  catch (e) { return null; }
}

function shuffle(ids, random) {
  const values = [...ids];
  for (let i = values.length - 1; i > 0; i--) {
    const raw = Number(random());
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999, raw)) : 0;
    const j = Math.floor(normalized * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

/** 保存済み抽選袋を検証する。壊れた値や廃止された鬼IDはここで捨てる。 */
export function parseOniCycle(raw) {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const last = ONI_PERSONALITIES[value?.last] ? value.last : null;
    const remaining = [];
    for (const id of Array.isArray(value?.remaining) ? value.remaining : []) {
      if (ONI_PERSONALITIES[id] && !remaining.includes(id)) remaining.push(id);
    }
    return { remaining, last };
  } catch (e) {
    return { remaining: [], last: null };
  }
}

/**
 * ゲーム開始の瞬間に呼ぶ。通常は「抽選袋」から1体ずつ取り出すため、
 * 3戦すれば必ず3タイプと戦える。袋を補充するときだけ順番をシャッフルする。
 * 特訓モードの固定指定は袋を消費しない。
 */
export function pickOniPersonality({ storage = cycleStorage(), random = Math.random } = {}) {
  if (forcedPersonality) return forcedPersonality;

  let state = { remaining: [], last: null };
  try { state = parseOniCycle(storage?.getItem(ONI_CYCLE_KEY)); }
  catch (e) { /* 保存不能でもメモリなしの抽選として続行 */ }

  if (state.remaining.length === 0) {
    state.remaining = shuffle(ONI_PERSONALITY_IDS, random);
    // 周回の境目でも同じ鬼が連続しないよう、先頭だけ入れ替える。
    if (state.remaining.length > 1 && state.remaining[0] === state.last) {
      [state.remaining[0], state.remaining[1]] = [state.remaining[1], state.remaining[0]];
    }
  }

  const selected = state.remaining.shift() || DEFAULT_ONI_PERSONALITY;
  state.last = selected;
  try { storage?.setItem(ONI_CYCLE_KEY, JSON.stringify(state)); }
  catch (e) { /* 保存できなくてもゲームは続行 */ }
  return selected;
}
