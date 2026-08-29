import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import { disposeObject3D } from '../../js/utils.js';

function countDisposeCalls(fn) {
  let calls = 0;
  const orig = fn;
  return { spy: (...a) => { calls++; return orig(...a); }, get calls() { return calls; } };
}

test('disposeObject3D disposes geometry and material across the whole tree', () => {
  const root = new THREE.Group();
  const child = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  );
  const grandchild = new THREE.Mesh(
    new THREE.SphereGeometry(1),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
  );
  child.add(grandchild);
  root.add(child);

  let geoDisposed = 0;
  let matDisposed = 0;
  child.geometry.dispose = () => { geoDisposed++; };
  grandchild.geometry.dispose = () => { geoDisposed++; };
  child.material.dispose = () => { matDisposed++; };
  grandchild.material.dispose = () => { matDisposed++; };

  disposeObject3D(root);

  assert.equal(geoDisposed, 2);
  assert.equal(matDisposed, 2);
});

test('disposeObject3D disposes every material and its textures in a multi-material mesh', () => {
  // CanvasTexture は DOM の canvas を要求するため、Node 環境ではプレーンな
  // Texture で代用する（dispose() の対象になるかどうかだけを見たいので十分）
  const tex1 = new THREE.Texture({ width: 1, height: 1 });
  const tex2 = new THREE.Texture({ width: 1, height: 1 });
  const mat1 = new THREE.MeshStandardMaterial({ map: tex1 });
  const mat2 = new THREE.MeshStandardMaterial({ emissiveMap: tex2 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [mat1, mat2]);

  let tex1Disposed = false;
  let tex2Disposed = false;
  let mat1Disposed = false;
  let mat2Disposed = false;
  tex1.dispose = () => { tex1Disposed = true; };
  tex2.dispose = () => { tex2Disposed = true; };
  mat1.dispose = () => { mat1Disposed = true; };
  mat2.dispose = () => { mat2Disposed = true; };

  disposeObject3D(mesh);

  assert.ok(tex1Disposed && tex2Disposed, 'テクスチャは配列マテリアルのどちらからも解放される');
  assert.ok(mat1Disposed && mat2Disposed);
});

test('disposeObject3D removes the root from its parent', () => {
  const parent = new THREE.Group();
  const child = new THREE.Group();
  parent.add(child);
  assert.equal(child.parent, parent);

  disposeObject3D(child);
  assert.equal(child.parent, null);
});

test('disposeObject3D is a no-op for null/undefined', () => {
  assert.doesNotThrow(() => disposeObject3D(null));
  assert.doesNotThrow(() => disposeObject3D(undefined));
});
