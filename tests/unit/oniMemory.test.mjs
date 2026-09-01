import test from 'node:test';
import assert from 'node:assert/strict';
import { OniMemory } from '../../js/oniMemory.js';

const furniture = (kind, label) => ({ kind, label });

test('first use is neutral and returning to the same furniture raises detection', () => {
  const memory = new OniMemory('watcher');
  const sofa = furniture('sofa', 'ソファ');
  const shelf = furniture('shelf', '棚');

  assert.equal(memory.observe(sofa).detectScale, 1);
  memory.observe(shelf);
  const remembered = memory.observe(sofa);

  assert.equal(remembered.targetUses, 2);
  assert.equal(remembered.remembered, true);
  assert.ok(remembered.detectScale > 1);
  assert.ok(remembered.inspectScale > 1);
});

test('staying on the same furniture does not farm memory stacks', () => {
  const memory = new OniMemory('watcher');
  const sofa = furniture('sofa', 'ソファ');

  memory.observe(sofa);
  memory.observe(sofa);
  memory.observe(sofa);

  assert.equal(memory.info().targetUses, 1);
  assert.equal(memory.info().detectScale, 1);
});

test('personality changes how strongly repeat disguises are remembered', () => {
  const a = furniture('chair', 'イスA');
  const b = furniture('desk', '机');

  const revisit = (id) => {
    const memory = new OniMemory(id);
    memory.observe(a);
    memory.observe(b);
    return memory.observe(a);
  };

  const watcher = revisit('watcher');
  const charger = revisit('charger');
  const suspicious = revisit('suspicious');

  assert.ok(suspicious.detectScale > watcher.detectScale);
  assert.ok(watcher.detectScale > charger.detectScale);
  assert.ok(suspicious.inspectScale > watcher.inspectScale);
  assert.ok(watcher.inspectScale > charger.inspectScale);
});

test('suspicious oni also starts distrusting other furniture of the same kind', () => {
  const memory = new OniMemory('suspicious');
  const chairA = furniture('chair', 'イスA');
  const chairB = furniture('chair', 'イスB');

  memory.observe(chairA);
  const result = memory.observe(chairB);

  assert.equal(result.targetUses, 1);
  assert.equal(result.kindUses, 2);
  assert.equal(result.remembered, true);
  assert.ok(result.detectScale > 1);
});

test('reset makes the oni forget the previous round', () => {
  const memory = new OniMemory('watcher');
  const sofa = furniture('sofa', 'ソファ');
  const shelf = furniture('shelf', '棚');

  memory.observe(sofa);
  memory.observe(shelf);
  assert.ok(memory.observe(sofa).detectScale > 1);

  memory.reset();
  const fresh = memory.observe(sofa);
  assert.equal(fresh.targetUses, 1);
  assert.equal(fresh.detectScale, 1);
  assert.equal(fresh.remembered, false);
});
