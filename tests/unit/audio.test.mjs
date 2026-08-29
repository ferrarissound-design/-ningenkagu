import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setMuted, isMuted, onMuteChange,
  setSfxVolume, getSfxVolume,
  setBgmVolume, getBgmVolume, onBgmVolumeChange,
} from '../../js/audio.js';

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

test('setSfxVolume clamps to [0, 1]', () => {
  setSfxVolume(0.5);
  assert.equal(getSfxVolume(), 0.5);
  setSfxVolume(-1);
  assert.equal(getSfxVolume(), 0);
  setSfxVolume(2);
  assert.equal(getSfxVolume(), 1);
  setSfxVolume(1); // 既定値に戻しておく
});

test('setBgmVolume clamps to [0, 1] and notifies subscribers', () => {
  setBgmVolume(1);
  const seen = [];
  const off = onBgmVolumeChange((v) => seen.push(v));

  setBgmVolume(0.3);
  setBgmVolume(-5); // 0にクランプされる
  setBgmVolume(9); // 1にクランプされる

  assert.equal(getBgmVolume(), 1);
  assert.deepEqual(seen, [0.3, 0, 1]);
  off();
  setBgmVolume(1);
});

test('unsubscribing stops further bgm volume notifications', () => {
  setBgmVolume(1);
  const seen = [];
  const off = onBgmVolumeChange((v) => seen.push(v));
  off();
  setBgmVolume(0.5);
  assert.deepEqual(seen, []);
  setBgmVolume(1);
});
