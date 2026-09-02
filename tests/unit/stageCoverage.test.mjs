import test from 'node:test';
import assert from 'node:assert/strict';
import '../../js/stage.js';
import { STAGE_DEFINITIONS } from '../../js/stageRegistry.js';
import { START_VIEWS } from '../../js/startViews.js';
import { MISSIONS } from '../../js/mission.js';
import { STAGE_EVENTS } from '../../js/stageEvents.js';

test('every registered stage has its required companion definitions', () => {
  const ids = STAGE_DEFINITIONS.map((stage) => stage.id);

  for (const id of ids) {
    assert.ok(START_VIEWS[id], `${id}: missing start view`);
    assert.ok(MISSIONS[id], `${id}: missing mission`);
    assert.ok(STAGE_EVENTS[id], `${id}: missing stage event`);
  }
});
