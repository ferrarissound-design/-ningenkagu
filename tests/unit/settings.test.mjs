import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettingNumber } from '../../js/settings.js';

test('音量は0〜100、視点感度は50〜200へ収める', () => {
  assert.equal(normalizeSettingNumber('-900', { min: 0, max: 100, fallback: 100 }), 0);
  assert.equal(normalizeSettingNumber('999', { min: 0, max: 100, fallback: 100 }), 100);
  assert.equal(normalizeSettingNumber('15', { min: 0, max: 100, fallback: 100 }), 15);
  assert.equal(normalizeSettingNumber('1', { min: 50, max: 200, fallback: 100 }), 50);
  assert.equal(normalizeSettingNumber('500', { min: 50, max: 200, fallback: 100 }), 200);
});

test('壊れた設定値は既定値へ戻す', () => {
  assert.equal(normalizeSettingNumber('not-a-number', { min: 0, max: 100, fallback: 70 }), 70);
  assert.equal(normalizeSettingNumber(null, { min: 50, max: 200, fallback: 100 }), 100);
});
