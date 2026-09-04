import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_EVENT, emitGameEvent, onGameEvent } from '../../js/gameEvents.js';

test('game event listeners receive mimic details and can unsubscribe', () => {
  const received = [];
  const off = onGameEvent(GAME_EVENT.MIMIC, (detail) => received.push(detail));

  assert.equal(emitGameEvent(GAME_EVENT.MIMIC, { kind: 'chair' }), 1);
  assert.deepEqual(received, [{ kind: 'chair' }]);

  off();
  assert.equal(emitGameEvent(GAME_EVENT.MIMIC, { kind: 'table' }), 0);
  assert.deepEqual(received, [{ kind: 'chair' }]);
});

test('one broken listener does not block the remaining game event listeners', () => {
  const originalError = console.error;
  console.error = () => {};

  let called = 0;
  const offBroken = onGameEvent(GAME_EVENT.MIMIC, () => { throw new Error('boom'); });
  const offHealthy = onGameEvent(GAME_EVENT.MIMIC, () => { called++; });

  try {
    assert.equal(emitGameEvent(GAME_EVENT.MIMIC, { kind: 'sofa' }), 2);
    assert.equal(called, 1);
  } finally {
    offBroken();
    offHealthy();
    console.error = originalError;
  }
});
