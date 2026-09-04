import test from 'node:test';
import assert from 'node:assert/strict';
import { FURNITURE_KINDS, POSE_FOR_KIND, FURNITURE_TRAITS } from '../../js/furnitureKinds.js';

const VALID_POSES = new Set(['stand', 'tpose', 'ypose', 'crouch']);

test('furniture metadata stays in sync', () => {
  const kinds = Object.keys(FURNITURE_KINDS);
  assert.ok(kinds.length > 0);
  assert.deepEqual(Object.keys(POSE_FOR_KIND), kinds);
  assert.deepEqual(Object.keys(FURNITURE_TRAITS), kinds);

  for (const kind of kinds) {
    const definition = FURNITURE_KINDS[kind];
    assert.ok(VALID_POSES.has(definition.pose), `${kind} has an invalid pose`);
    assert.equal(typeof definition.catalogName, 'string');
    assert.ok(definition.catalogName.length > 0, `${kind} has no catalog name`);
    assert.equal(POSE_FOR_KIND[kind], definition.pose);
    assert.equal(FURNITURE_TRAITS[kind].icon, definition.icon);
    assert.equal(FURNITURE_TRAITS[kind].name, definition.name);
    assert.equal(FURNITURE_TRAITS[kind].desc, definition.desc);
    assert.equal(typeof definition.strategy, 'string');
    assert.ok(definition.strategy.length > 0, kind + ' has no strategy guide');
  }
});


test('electronics-store appliance kinds are registered', () => {
  for (const kind of ['tv', 'fridge', 'washer', 'massage']) {
    assert.ok(FURNITURE_KINDS[kind], kind + ' should exist');
  }
});
