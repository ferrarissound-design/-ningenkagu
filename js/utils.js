// 汎用ユーティリティ

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** フレームレート非依存の補間 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const randRange = (a, b) => a + Math.random() * (b - a);

/** 角度差を -PI..PI に正規化 */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 点(x,z)から XZ 平面上の矩形までの距離 */
export function rectDistance(rect, x, z) {
  const dx = Math.max(rect.minX - x, 0, x - rect.maxX);
  const dz = Math.max(rect.minZ - z, 0, z - rect.maxZ);
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * 色の近さ (0 = 同色, 1 = 正反対)。
 * 人間の目は緑に敏感なので重み付きRGB距離を使う。
 */
export function colorDistance(c1, c2) {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
}

/** 擬態の色一致度 0..1 */
export function colorMatchScore(c1, c2) {
  return clamp(1 - colorDistance(c1, c2) * 1.9, 0, 1);
}

/** OS/ブラウザの「アニメーションを減らす」設定。matchMedia が無い環境では false 扱い */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * アナログスティックの遊びを取り除く。|x|,|y| が threshold 以下なら 0、
 * それより外側だけを 0..1 に引き伸ばして返す（タッチスティック・ゲームパッド共通）。
 */
export function applyDeadzone(x, y, threshold) {
  const m = Math.hypot(x, y);
  if (m <= threshold) return { x: 0, y: 0 };
  const k = (m - threshold) / (1 - threshold) / m;
  return { x: x * k, y: y * k };
}

/**
 * 視点入力の感度・Y軸反転設定を、マウス/タッチ/ゲームパッドいずれの
 * dx・dy にも同じ場所で一様に適用する。
 */
export function applyLookSettings(dx, dy, sensitivity, invertY) {
  return { dx: dx * sensitivity, dy: dy * sensitivity * (invertY ? -1 : 1) };
}

/**
 * マテリアルとそこにぶら下がるテクスチャを解放する。
 * テクスチャは map / emissiveMap など名前が様々なので、
 * プロパティを走査して isTexture のものをすべて落とす。
 */
function disposeMaterial(material) {
  for (const value of Object.values(material)) {
    if (value && value.isTexture) value.dispose();
  }
  material.dispose();
}

/**
 * Three.js のオブジェクトツリーが確保した GPU リソースを解放し、親から外す。
 *
 * scene.remove() は表示から外すだけで、ジオメトリ・マテリアル・テクスチャは
 * GPU に残り続ける。ステージを作り直すたびに部屋一式が積み上がるため、
 * 捨てる側は必ずここを通す。
 */
export function disposeObject3D(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const material = obj.material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else disposeMaterial(material);
  });
  root.removeFromParent();
}
