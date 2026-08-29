import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertLevel, ALERT_LEVELS } from '../../js/game.js';

test('alertLevel picks the highest threshold not exceeding v', () => {
  assert.equal(alertLevel(0).label, '安全');
  assert.equal(alertLevel(0.29).label, '安全');
  assert.equal(alertLevel(0.30).label, '怪しい');
  assert.equal(alertLevel(0.61).label, '怪しい');
  assert.equal(alertLevel(0.62).label, 'かなり怪しい');
  assert.equal(alertLevel(0.99).label, 'かなり怪しい');
  assert.equal(alertLevel(1).label, '発見');
  assert.equal(alertLevel(999).label, '発見', '上限を超えても最高段階のまま');
});

test('ALERT_LEVELS thresholds are sorted ascending', () => {
  for (let i = 1; i < ALERT_LEVELS.length; i++) {
    assert.ok(ALERT_LEVELS[i].t > ALERT_LEVELS[i - 1].t);
  }
});
