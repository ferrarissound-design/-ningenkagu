// 設定値をDOMやlocalStorageから切り離して検証するための小さな純粋関数。

/** 数値化できない値は既定値へ戻し、有効な値はUIの許容範囲へ収める。 */
export function normalizeSettingNumber(value, { min, max, fallback }) {
  const number = Number.parseInt(value, 10);
  const safe = Number.isFinite(number) ? number : fallback;
  return Math.max(min, Math.min(max, safe));
}
