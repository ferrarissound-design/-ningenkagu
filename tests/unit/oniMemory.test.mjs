import test from 'node:test';
import assert from 'node:assert/strict';
import { OniMemory, applyOniMemoryBehavior } from '../../js/oniMemory.js';

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

test('oni behavior remembers only disguises that were actually visible', () => {
  const proto = {
    applyPersonality(id) {
      this.inspectChance = 0.4;
      return { id };
    },
    reset() {},
    senseTarget(player) { return { visible: !!player.visible }; },
  };
  applyOniMemoryBehavior(proto);

  const oni = Object.create(proto);
  oni.eventVision = { detect: 1 };
  oni.applyPersonality('watcher');
  oni.reset();

  const sofa = furniture('sofa', 'ソファ');
  const shelf = furniture('shelf', '棚');

  oni.senseTarget({ mimicTarget: sofa, visible: true });
  oni.senseTarget({ mimicTarget: shelf, visible: false });
  oni.senseTarget({ mimicTarget: sofa, visible: true });
  assert.equal(oni.eventDetectScale, 1, 'hidden disguise changes must not leak into oni memory');

  oni.senseTarget({ mimicTarget: shelf, visible: true });
  oni.senseTarget({ mimicTarget: sofa, visible: true });
  assert.ok(oni.eventDetectScale > 1);
  assert.ok(oni.inspectChance > oni.baseInspectChance);
});
