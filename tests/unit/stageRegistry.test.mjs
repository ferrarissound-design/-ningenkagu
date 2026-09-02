import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGE_DEFINITIONS, STAGE_BY_ID, getStageDefinition } from '../../js/stageRegistry.js';
import { START_VIEWS } from '../../js/startViews.js';

test('stage registry has unique ids and complete definitions', () => {
  const ids = STAGE_DEFINITIONS.map((stage) => stage.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 5);

  for (const stage of STAGE_DEFINITIONS) {
    assert.equal(typeof stage.id, 'string');
    assert.equal(typeof stage.name, 'string');
    assert.ok(stage.name.length > 0);
    assert.equal(typeof stage.label, 'string');
    assert.ok(stage.label.startsWith('STAGE '));
    assert.equal(typeof stage.clearNote, 'string');
    assert.equal(typeof stage.build, 'function');
    assert.ok(Array.isArray(stage.startView?.position));
    assert.equal(stage.startView.position.length, 3);
    assert.equal(typeof stage.startView.yaw, 'number');
    assert.equal(typeof stage.startView.pitch, 'number');
    assert.equal(STAGE_BY_ID[stage.id], stage);
    assert.equal(START_VIEWS[stage.id], stage.startView);
  }
});

test('unknown stage falls back to the first stage', () => {
  assert.equal(getStageDefinition('does-not-exist'), STAGE_DEFINITIONS[0]);
  assert.equal(getStageDefinition(null), STAGE_DEFINITIONS[0]);
});
