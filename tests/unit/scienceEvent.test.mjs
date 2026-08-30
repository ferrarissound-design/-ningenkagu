import test from 'node:test';
import assert from 'node:assert/strict';
import '../../js/stages/scienceroom.js';
import { STAGE_EVENTS } from '../../js/stageEvents.js';

test('理科室には蒸気イベントが登録される', () => {
  const event = STAGE_EVENTS.scienceroom;
  assert.ok(event);
  assert.equal(event.id, 'steam');
  assert.equal(event.name, '蒸気が噴き出した！');
  assert.ok(event.durationMin >= 6);
  assert.ok(event.durationMax > event.durationMin);
  assert.equal(event.liftVisionOnBreak, false);
  assert.equal(typeof event.onStart, 'function');
});
