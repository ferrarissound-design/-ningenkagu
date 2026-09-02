import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { applyFurnitureTraitBonus, furnitureTraitMessage } from '../../js/furnitureTraits.js';

function fakeGame({ kind, pose, stillness = 1, speed = 0, playerX = 0, playerZ = 0, oniX = 10, oniZ = 0 }) {
  return {
    player: {
      mimicTarget: {
        kind,
        rect: { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 },
      },
      pose,
      stillness,
      speed,
      position: new THREE.Vector3(playerX, 0, playerZ),
    },
    oni: { position: new THREE.Vector3(oniX, 0, oniZ) },
  };
}

test('chair keeps the same matched-pose bonus without prototype patching', () => {
  const game = fakeGame({ kind: 'chair', pose: 'crouch', stillness: 0.8 });
  assert.equal(applyFurnitureTraitBonus(game, 0.5), 0.555);
});

test('bin is stronger at range and weaker up close', () => {
  const far = fakeGame({ kind: 'bin', pose: 'crouch', oniX: 8 });
  const near = fakeGame({ kind: 'bin', pose: 'crouch', oniX: 2 });
  assert.equal(applyFurnitureTraitBonus(far, 0.5), 0.575);
  assert.equal(applyFurnitureTraitBonus(near, 0.5), 0.415);
});

test('trait bonus never exceeds the global 94 percent cap', () => {
  const game = fakeGame({ kind: 'easel', pose: 'tpose', stillness: 1 });
  assert.equal(applyFurnitureTraitBonus(game, 0.93), 0.94);
});

test('trait notice is derived from furniture metadata', () => {
  assert.match(furnitureTraitMessage('plant'), /葉っぱのゆらぎ/);
  assert.equal(furnitureTraitMessage('unknown'), '');
});
