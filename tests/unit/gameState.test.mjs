import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setGameState, getGameState, onGameState } from '../../js/gameState.js';

// このモジュールは単一のインスタンス状態を持つため、各テストは
// 直前のテストが残した状態を引き継ぐ。アサーションは絶対値ではなく
// 「このテストの操作で何が変わったか」で書く。

function flushed() {
  // setGameState は queueMicrotask で配信するので、それより後ろの
  // マイクロタスクまで待てば配信が終わっている
  return Promise.resolve().then(() => {});
}

test('getGameState reflects the latest value immediately (before flush)', () => {
  setGameState('playing');
  assert.equal(getGameState(), 'playing');
});

test('onGameState collapses synchronous changes within one microtask into the final state', async () => {
  setGameState('title'); // 前のテストの 'playing' から変更しておく
  await flushed();

  const seen = [];
  const off = onGameState((next, prev) => seen.push([next, prev]));

  setGameState('playing');
  setGameState('paused');
  setGameState('lose');
  await flushed();

  assert.deepEqual(seen, [['lose', 'title']], '途中経過(playing/paused)は配信されない');
  off();
});

test('no notification when the state does not actually change', async () => {
  setGameState('win');
  await flushed();

  const seen = [];
  const off = onGameState((next) => seen.push(next));
  setGameState('win'); // 既に win
  await flushed();

  assert.deepEqual(seen, []);
  off();
});

test('unsubscribing stops further delivery', async () => {
  setGameState('title');
  await flushed();

  const seen = [];
  const off = onGameState((next) => seen.push(next));
  off();
  setGameState('playing');
  await flushed();

  assert.deepEqual(seen, []);
});
