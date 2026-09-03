import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPENING_CUES,
  OPENING_SEEN_KEY,
  hasSeenOpening,
  markOpeningSeen,
  clearOpeningSeen,
  cueDuration,
} from '../../js/opening.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

test('初回は未視聴で、視聴済み保存後は再生対象から外せる', () => {
  const storage = new MemoryStorage();
  assert.equal(hasSeenOpening(storage), false);
  assert.equal(markOpeningSeen(storage), true);
  assert.equal(storage.getItem(OPENING_SEEN_KEY), '1');
  assert.equal(hasSeenOpening(storage), true);
});

test('視聴済みフラグを消すと再び初回状態へ戻せる', () => {
  const storage = new MemoryStorage();
  markOpeningSeen(storage);
  assert.equal(clearOpeningSeen(storage), true);
  assert.equal(hasSeenOpening(storage), false);
});

test('ストーリーは5カットで、通常時は約10秒の短編になる', () => {
  assert.equal(OPENING_CUES.length, 5);
  const total = OPENING_CUES.reduce((sum, cue) => sum + cueDuration(cue), 0);
  assert.ok(total >= 8_000 && total <= 11_000, `total=${total}`);
  assert.match(OPENING_CUES.at(-1).text, /ニンゲン家具/);
});

test('動きを減らす設定では各カットを短縮する', () => {
  for (const cue of OPENING_CUES) {
    assert.ok(cueDuration(cue, true) <= 650);
    assert.ok(cueDuration(cue, true) <= cueDuration(cue, false));
  }
});

test('storageが利用不能でもゲーム起動を妨げない', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(hasSeenOpening(broken), false);
  assert.equal(markOpeningSeen(broken), false);
  assert.equal(clearOpeningSeen(broken), false);
});
