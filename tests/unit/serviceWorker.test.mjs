import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const swUrl = new URL('../../sw.js', import.meta.url);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function escapeRegExp(value) {
  // ここで扱うのは ./js/foo-bar.js のようなパスだけなので、
  // 正規表現上意味を持つ文字を明示的にエスケープすれば十分。
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}

async function collectReachableJs(entryRelPaths) {
  const pending = entryRelPaths.map((rel) => path.join(repoRoot, rel));
  const seen = new Set();

  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);

    const source = await readFile(file, 'utf8');
    const specs = [];
    const fromRe = /(?:import|export)\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g;
    const sideEffectRe = /import\s*['"]([^'"]+)['"]/g;
    for (const re of [fromRe, sideEffectRe]) {
      let match;
      while ((match = re.exec(source))) specs.push(match[1]);
    }

    for (const spec of specs) {
      if (!spec.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), spec);
      if (!resolved.startsWith(path.join(repoRoot, 'js') + path.sep)) continue;
      if (!resolved.endsWith('.js')) continue;
      pending.push(resolved);
    }
  }
  return [...seen].filter((file) => file.startsWith(path.join(repoRoot, 'js') + path.sep));
}

test('オフラインキャッシュにタイトル曲と戦闘曲が含まれる', async () => {
  const source = await readFile(swUrl, 'utf8');
  assert.match(source, /\.\/assets\/audio\/behind_the_potted_plant\.mp3/);
  assert.match(source, /\.\/assets\/audio\/gold_medal_morning\.mp3/);
});

test('新しい設定検証モジュールもオフライン起動時に読める', async () => {
  const source = await readFile(swUrl, 'utf8');
  assert.match(source, /\.\/js\/settings\.js/);
});


test('three.js が分割して読み込む実体ファイルもオフラインキャッシュ対象になっている', async () => {
  // three.module.min.js は薄い re-export で、実体は three.core.min.js 側にある。
  // 片方だけキャッシュしてもオフラインでは import が解決できず起動しない。
  const swSource = await readFile(swUrl, 'utf8');
  const entryRel = 'vendor/three/three.module.min.js';
  const source = await readFile(path.join(repoRoot, entryRel), 'utf8');

  const specs = new Set(
    [...source.matchAll(/from\s*['"](\.[^'"]+)['"]/g)].map((match) => match[1]),
  );
  assert.ok(specs.size > 0, 'three.module.min.js の相対importを検出できなかった');

  for (const spec of specs) {
    const rel = './' + path.posix.join(path.posix.dirname(entryRel), spec);
    // 参照先が実在することまで確かめてから、キャッシュ対象かを見る
    await readFile(path.join(repoRoot, rel));
    assert.match(swSource, new RegExp(escapeRegExp(rel)), `${rel} が CORE_PATHS にない`);
  }
});

test('起動時に到達する全JSモジュールがオフラインキャッシュ対象になっている', async () => {
  const swSource = await readFile(swUrl, 'utf8');
  const reachable = await collectReachableJs(['js/main.js', 'js/battleBgm.js']);

  for (const file of reachable) {
    const rel = './' + path.relative(repoRoot, file).split(path.sep).join('/');
    assert.match(swSource, new RegExp(escapeRegExp(rel)), `${rel} が CORE_PATHS にない`);
  }
});
