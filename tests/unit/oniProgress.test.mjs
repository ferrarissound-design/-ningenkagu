import test from 'node:test';
import assert from 'node:assert/strict';
import { oniClearKey, countOniClears, stageOniClears } from '../../js/oniProgress.js';

const STAGES = ['living', 'classroom', 'artroom', 'library'];
const ONIS = ['watcher', 'charger', 'suspicious'];

test('4ステージ×3鬼で攻略枠は12個になる', () => {
  const result = countOniClears(STAGES, ONIS, () => false);
  assert.equal(result.cleared, 0);
  assert.equal(result.total, 12);
  assert.equal(result.complete, false);
});

test('12組すべて攻略済みなら完全制覇になる', () => {
  const result = countOniClears(STAGES, ONIS, () => true);
  assert.deepEqual(result, { cleared: 12, total: 12, complete: true });
});

test('攻略数はステージ×鬼の組み合わせ単位で数える', () => {
  const done = new Set([
    'living:watcher',
    'living:charger',
    'library:suspicious',
  ]);
  const result = countOniClears(STAGES, ONIS, (stageId, oniId) => done.has(`${stageId}:${oniId}`));
  assert.equal(result.cleared, 3);
  assert.equal(result.total, 12);
  assert.equal(result.complete, false);
});

test('選択中ステージの3鬼攻略状況を順番どおり返す', () => {
  const status = stageOniClears('library', ONIS, (_stageId, oniId) => oniId !== 'charger');
  assert.deepEqual(status, [
    { oniId: 'watcher', completed: true },
    { oniId: 'charger', completed: false },
    { oniId: 'suspicious', completed: true },
  ]);
});

test('保存キーはステージと鬼タイプを衝突しない形で含む', () => {
  assert.equal(oniClearKey('library', 'watcher'), 'ningenkagu.oniClear.library.watcher');
  assert.notEqual(oniClearKey('living', 'watcher'), oniClearKey('living', 'charger'));
});
