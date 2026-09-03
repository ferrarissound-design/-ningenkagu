import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const swUrl = new URL('../../sw.js', import.meta.url);

test('オフラインキャッシュにタイトル曲と戦闘曲が含まれる', async () => {
  const source = await readFile(swUrl, 'utf8');
  assert.match(source, /\.\/assets\/audio\/behind_the_potted_plant\.mp3/);
  assert.match(source, /\.\/assets\/audio\/gold_medal_morning\.mp3/);
});

test('新しい設定検証モジュールもオフライン起動時に読める', async () => {
  const source = await readFile(swUrl, 'utf8');
  assert.match(source, /\.\/js\/settings\.js/);
});
