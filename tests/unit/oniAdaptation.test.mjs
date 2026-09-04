import test from 'node:test';
import assert from 'node:assert/strict';
import { OniHabitModel } from '../../js/oniAdaptation.js';
import { ROOM } from '../../js/stageBuilder.js';

function gameAt(x, z, pose = 'stand', speed = 0) {
  return {
    state: 'playing',
    player: { position: { x, z }, pose, speed },
  };
}

test('oni learns repeated corner camping and raises detection near the edge', () => {
  const model = new OniHabitModel();
  const game = gameAt(ROOM.minX + 0.2, 0);

  for (let i = 0; i < 21; i++) model.update(1, game);

  assert.equal(model.info.learned, 'corner');
  assert.ok(model.detectScale(game) > 1);
  const center = gameAt(0, 0);
  assert.ok(model.detectScale(game) > model.detectScale(center));
});

test('oni can learn crouch movement as the dominant habit', () => {
  const model = new OniHabitModel();
  const game = gameAt(0, 0, 'crouch', 1);

  for (let i = 0; i < 21; i++) model.update(1, game);

  assert.equal(model.info.learned, 'crouch');
  assert.ok(model.noiseScale() > 1);
});

test('early decoy use shortens later distraction time', () => {
  const model = new OniHabitModel();
  const game = gameAt(0, 0);
  for (let i = 0; i < 5; i++) model.update(1, game);
  model.recordDecoy();
  for (let i = 0; i < 16; i++) model.update(1, game);

  assert.equal(model.info.learned, 'decoy');
  assert.ok(model.decoyDurationScale() < 1);
});

test('habit learning resets between runs', () => {
  const model = new OniHabitModel();
  const game = gameAt(ROOM.maxX - 0.2, 0);
  for (let i = 0; i < 21; i++) model.update(1, game);
  assert.ok(model.info.learned);

  model.reset();
  assert.equal(model.info.learned, null);
  assert.equal(model.info.elapsed, 0);
});
