import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { buildStage, disposeStage } from '../../js/stage.js';

test('buildStage は scienceroom を登録済みで、理科室を生成できる', () => {
  const prev = globalThis.__ningenkaguStage;
  const scene = new THREE.Scene();
  globalThis.__ningenkaguStage = 'scienceroom';
  try {
    const stage = buildStage(scene);
    assert.equal(stage.id, 'scienceroom');
    assert.equal(stage.name, '理科室');
    assert.ok(scene.children.includes(stage.group));
    disposeStage(stage);
  } finally {
    globalThis.__ningenkaguStage = prev;
  }
});
