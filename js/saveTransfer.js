// 進行データ・設定をまとめてバックアップ／復元するための純粋ロジック。
// localStorage は同じブラウザ・同じ端末にしか残らないため、機種変更やブラウザの
// 初期化で全記録が消える。ここではファイル1つに書き出し／読み込みできるようにする。
// DOM やダウンロード操作には触れず、appShell.js から呼び出す。

const KEY_PREFIX = 'ningenkagu.';
export const SAVE_FILE_APP_ID = 'ningenkagu';
export const SAVE_FILE_VERSION = 1;

/** 現在保存されているすべての ningenkagu.* キーをプレーンオブジェクトへ集める。 */
export function collectSaveData(storage = globalThis.localStorage) {
  const data = {};
  if (!storage) return data;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (typeof key === 'string' && key.startsWith(KEY_PREFIX)) {
      data[key] = storage.getItem(key);
    }
  }
  return data;
}

/** バックアップファイルの中身（書き出す側）を組み立てる。 */
export function buildSaveFile(storage = globalThis.localStorage, now = new Date()) {
  return {
    app: SAVE_FILE_APP_ID,
    version: SAVE_FILE_VERSION,
    exportedAt: now.toISOString(),
    data: collectSaveData(storage),
  };
}

/**
 * バックアップファイルの中身を検証する（読み込む側）。
 * 壊れたJSON・別アプリのファイル・想定外のキーを弾き、書き込む前に判断できるようにする。
 * 有効なら { ok: true, entries } を返す。entries は [key, value] の配列。
 */
export function parseSaveFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.app !== SAVE_FILE_APP_ID
    || !parsed.data || typeof parsed.data !== 'object') {
    return { ok: false, error: 'format' };
  }
  const entries = Object.entries(parsed.data).filter(
    ([key, value]) => typeof key === 'string' && key.startsWith(KEY_PREFIX) && typeof value === 'string',
  );
  if (entries.length === 0) return { ok: false, error: 'empty' };
  return { ok: true, entries };
}

/**
 * 検証済みのエントリを実際に書き込む。書き込んだ件数を返す。
 * 読み込みは「現在値との合成」ではなくバックアップ時点への置換にする。
 * これにより、バックアップに無い古い冠やミッションが端末側だけ残らない。
 */
export function applySaveEntries(entries, storage = globalThis.localStorage) {
  if (!storage || !Array.isArray(entries)) return 0;
  const safeEntries = entries.filter(
    ([key, value]) => typeof key === 'string' && key.startsWith(KEY_PREFIX) && typeof value === 'string',
  );
  const previous = collectSaveData(storage);

  try {
    for (const key of Object.keys(previous)) storage.removeItem(key);
    for (const [key, value] of safeEntries) storage.setItem(key, value);
    return safeEntries.length;
  } catch (error) {
    // 容量不足などで途中失敗した場合は、可能な限り読み込み前へ戻す。
    try {
      const current = collectSaveData(storage);
      for (const key of Object.keys(current)) storage.removeItem(key);
      for (const [key, value] of Object.entries(previous)) storage.setItem(key, value);
    } catch (rollbackError) { /* 復旧不能でも元の例外を返す */ }
    throw error;
  }
}
