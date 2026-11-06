const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../js/engine.js');

const one = (income, spend) => [{ from: '', income, spend }];

test('addMonths crosses year boundaries', () => {
  assert.equal(Engine.addMonths('2026-11', 2), '2027-01');
  assert.equal(Engine.addMonths('2026-01', -1), '2025-12');
  assert.equal(Engine.monthsBetween('2026-11', '2027-01'), 2);
});

test('reaches a goal with steady saving and no growth', () => {
  const r = Engine.simulate({ cur: 0, ret: 0, stages: one(200, 100), start: '2026-11', goal: 1200 });
  assert.equal(r.hit, 12);
});

test('already at the goal means zero months', () => {
  const r = Engine.simulate({ cur: 500, ret: 5, stages: one(0, 0), start: '2026-11', goal: 100 });
  assert.equal(r.hit, 0);
});

test('no income runs savings out and never reaches the goal', () => {
  const r = Engine.simulate({ cur: 300, ret: 0, stages: one(0, 100), start: '2026-11', goal: 1000 });
  assert.equal(r.hit, null);
  assert.equal(r.ranOut, 4);
});

test('a later stage changes the path from its start month', () => {
  const stages = [{ from: '', income: 0, spend: 100 }, { from: '2027-01', income: 1100, spend: 100 }];
  const r = Engine.simulate({ cur: 1000, ret: 0, stages, start: '2026-11', goal: 2800 });
  assert.equal(r.series[2].pot, 800);
  assert.equal(r.hit, 4);
});

test('stageAt uses the latest stage that has started', () => {
  const stages = [{ from: '', income: 1 }, { from: '2027-01', income: 2 }, { from: '2028-01', income: 3 }];
  assert.equal(Engine.stageAt(stages, '2026-12').income, 1);
  assert.equal(Engine.stageAt(stages, '2027-06').income, 2);
  assert.equal(Engine.stageAt(stages, '2030-01').income, 3);
});

test('extra income only applies to stages with income', () => {
  const stages = [{ from: '', income: 0, spend: 0 }, { from: '2026-12', income: 100, spend: 0 }];
  const r = Engine.simulate({ cur: 0, ret: 0, stages, start: '2026-11', months: 2, incomeAdd: 50, keepGoing: true });
  assert.equal(r.series[1].pot, 0);
  assert.equal(r.series[2].pot, 150);
});

test('the 4% rule is 25 times yearly costs', () => {
  assert.equal(Engine.potFor(70000, 4), 21000000);
  assert.equal(Engine.potFor(-5, 4), 0);
});

test('runway counts whole months', () => {
  assert.equal(Engine.runway(13400, 730), 18);
  assert.equal(Engine.runway(100, 0), Infinity);
});

test('extraToFinish closes the gap exactly', () => {
  const base = { cur: 1000, ret: 5, stages: one(300, 100), start: '2026-11', goal: 50000, months: 120 };
  const extra = Engine.extraToFinish(base);
  const r = Engine.simulate({ ...base, incomeAdd: extra, keepGoing: true });
  assert.ok(Math.abs(r.series[120].pot - 50000) < 0.01);
});

test('extraToFinish is zero when already on track', () => {
  assert.equal(Engine.extraToFinish({ cur: 1000, ret: 0, stages: one(100, 0), start: '2026-11', goal: 500, months: 12 }), 0);
});
