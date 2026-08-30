import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sfx } from '../../js/audio.js';

test('図書室イベント用SEが公開されている', () => {
  assert.equal(typeof sfx.eventBookfall, 'function');
});
