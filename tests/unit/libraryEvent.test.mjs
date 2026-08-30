import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_EVENTS } from '../../js/stageEvents.js';

test('図書室イベントは bookfall として登録される', () => {
  const e = STAGE_EVENTS.library;
  assert.ok(e);
  assert.equal(e.id, 'bookfall');
  assert.equal(e.name, '本が崩れた！');
  assert.ok(e.durationMin > 0);
  assert.ok(e.durationMax >= e.durationMin);
  assert.equal(typeof e.onStart, 'function');
});
