import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setMuted, isMuted, onMuteChange } from '../../js/audio.js';

test('setMuted toggles isMuted and notifies subscribers exactly once per change', () => {
  setMuted(false); // 既知の状態から始める

  const seen = [];
  const off = onMuteChange((v) => seen.push(v));

  setMuted(true);
  setMuted(true); // 変化なし。再通知されないはず
  setMuted(false);

  assert.equal(isMuted(), false);
  assert.deepEqual(seen, [true, false]);
  off();
});

test('unsubscribing stops further mute notifications', () => {
  setMuted(false);
  const seen = [];
  const off = onMuteChange((v) => seen.push(v));
  off();
  setMuted(true);
  assert.deepEqual(seen, []);
  setMuted(false);
});

test('setMuted coerces truthy/falsy values to booleans', () => {
  setMuted(1);
  assert.equal(isMuted(), true);
  setMuted(0);
  assert.equal(isMuted(), false);
});
