import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three/three.module.min.js';
import {
  clamp, lerp, damp, angleDelta, rectDistance, colorDistance, colorMatchScore,
  prefersReducedMotion, applyDeadzone, applyLookSettings,
} from '../../js/utils.js';

test('clamp confines a value to [a, b]', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('lerp interpolates linearly', () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('damp moves toward the target and reaches it at dt=Infinity', () => {
  const near = damp(0, 10, 5, 0.016);
  assert.ok(near > 0 && near < 10, `expected 0 < ${near} < 10`);
  assert.equal(damp(0, 10, 5, 1e9), 10);
  assert.equal(damp(5, 5, 5, 0.1), 5, '目標と同じ値では動かない');
});

test('angleDelta normalizes to (-PI, PI]', () => {
  const d = angleDelta(0, Math.PI * 1.5);
  assert.ok(d > -Math.PI && d <= Math.PI, `${d} should be in (-PI, PI]`);
  // 半周先へ回るより、逆向きに半周のほうが近いはず
  assert.ok(Math.abs(d - (-Math.PI / 2)) < 1e-9);
});

test('angleDelta(a, a) is zero', () => {
  assert.equal(angleDelta(1.23, 1.23), 0);
});

test('rectDistance is zero inside the rect, positive outside', () => {
  const rect = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
  assert.equal(rectDistance(rect, 1, 1), 0);
  assert.equal(rectDistance(rect, 3, 1), 1);
  assert.equal(rectDistance(rect, 3, 4), Math.hypot(1, 2));
});

test('colorDistance is 0 for identical colors, positive otherwise', () => {
  const white = new THREE.Color(0xffffff);
  const black = new THREE.Color(0x000000);
  assert.equal(colorDistance(white, white), 0);
  assert.ok(colorDistance(white, black) > 0);
});

test('colorMatchScore is 1 for identical colors and clamped to [0, 1]', () => {
  const c = new THREE.Color(0x7dffd0);
  assert.equal(colorMatchScore(c, c), 1);
  const white = new THREE.Color(0xffffff);
  const black = new THREE.Color(0x000000);
  const score = colorMatchScore(white, black);
  assert.ok(score >= 0 && score <= 1, `${score} should be within [0, 1]`);
});

test('prefersReducedMotion is false when window/matchMedia is unavailable (Node環境)', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(prefersReducedMotion(), false);
});

test('prefersReducedMotion reflects a stubbed matchMedia result', () => {
  const origWindow = globalThis.window;
  try {
    globalThis.window = {
      matchMedia: (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
    };
    assert.equal(prefersReducedMotion(), true);

    globalThis.window = { matchMedia: () => ({ matches: false }) };
    assert.equal(prefersReducedMotion(), false);
  } finally {
    if (origWindow === undefined) delete globalThis.window;
    else globalThis.window = origWindow;
  }
});

test('applyDeadzone snaps small input to 0', () => {
  assert.deepEqual(applyDeadzone(0.1, 0, 0.18), { x: 0, y: 0 });
  assert.deepEqual(applyDeadzone(0, 0, 0.18), { x: 0, y: 0 });
});

test('applyDeadzone stretches the outer range back to 0..1', () => {
  const { x, y } = applyDeadzone(1, 0, 0.18);
  assert.ok(Math.abs(x - 1) < 1e-9, `expected x≈1, got ${x}`);
  assert.equal(y, 0);
});

test('applyDeadzone preserves direction and clamps magnitude to <=1', () => {
  const { x, y } = applyDeadzone(0.6, 0.6, 0.18);
  const mag = Math.hypot(x, y);
  assert.ok(mag <= 1 + 1e-9, `expected magnitude <= 1, got ${mag}`);
  assert.ok(Math.abs(x - y) < 1e-9, '入力が等しいなら出力も等しいはず（方向を保つ）');
});

test('applyLookSettings scales dx/dy by sensitivity', () => {
  assert.deepEqual(applyLookSettings(10, -6, 1, false), { dx: 10, dy: -6 });
  assert.deepEqual(applyLookSettings(10, -6, 2, false), { dx: 20, dy: -12 });
  assert.deepEqual(applyLookSettings(10, -6, 0.5, false), { dx: 5, dy: -3 });
});

test('applyLookSettings flips only dy when invertY is true', () => {
  const r = applyLookSettings(10, -6, 1, true);
  assert.equal(r.dx, 10, 'dxはinvertYの影響を受けない');
  assert.equal(r.dy, 6);
});
