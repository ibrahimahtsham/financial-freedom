const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../js/engine.js');

const near = (a, b, within = 1e-6) => assert.ok(Math.abs(a - b) < within, `${a} is not near ${b}`);

test('addMonths crosses year boundaries', () => {
  assert.equal(Engine.addMonths('2026-11', 2), '2027-01');
  assert.equal(Engine.addMonths('2026-01', -1), '2025-12');
  assert.equal(Engine.monthsBetween('2026-11', '2027-01'), 2);
});

test('monthly rates compound back to the yearly return', () => {
  near(Math.pow(1 + Engine.monthlyRate(5), 12), 1.05);
});

test('reaches a goal with steady saving and no growth', () => {
  assert.equal(Engine.project({ cur: 0, ret: 0, save: 100, goal: 1200 }).hit, 12);
});

test('already at the goal means zero months', () => {
  assert.equal(Engine.project({ cur: 500, ret: 5, save: 0, goal: 100 }).hit, 0);
});

test('with no saving and no return the goal is never reached', () => {
  assert.equal(Engine.project({ cur: 100, ret: 0, save: 0, goal: 1000 }).hit, null);
});

test('the series starts at current savings', () => {
  const { series } = Engine.project({ cur: 50, ret: 0, save: 10, months: 3 });
  assert.deepEqual(series, [50, 60, 70, 80]);
});

test('savingFor reaches the goal exactly on time', () => {
  const need = Engine.savingFor({ cur: 1000, ret: 5, goal: 50000, months: 120 });
  near(Engine.project({ cur: 1000, ret: 5, save: need, months: 120 }).series[120], 50000, 1e-6);
});

test('savingFor is zero when growth alone gets there', () => {
  assert.equal(Engine.savingFor({ cur: 1000, ret: 5, goal: 1000, months: 120 }), 0);
});

test('savingFor works with no return', () => {
  assert.equal(Engine.savingFor({ cur: 0, ret: 0, goal: 1200, months: 12 }), 100);
});

test('the freedom number is 25 times yearly costs', () => {
  assert.equal(Engine.freedomNumber(70000), 21000000);
  assert.equal(Engine.freedomNumber(-5), 0);
});

test('runway counts whole months', () => {
  assert.equal(Engine.runway(13400, 835), 16);
  assert.equal(Engine.runway(100, 0), Infinity);
});

test('a full year at 10% inflation raises prices by 10%', () => {
  near(Engine.priceFactor({ 2024: 10 }, '2024-01', '2025-01'), 1.1);
});

test('inflation compounds across years with different rates', () => {
  near(Engine.priceFactor({ 2023: 30, 2024: 10 }, '2023-01', '2025-01'), 1.3 * 1.1);
});

test('years with no data use the latest known rate', () => {
  near(Engine.priceFactor({ 2025: 10 }, '2026-01', '2027-01'), 1.1);
});

test('no adjustment for this month, the future, or missing data', () => {
  assert.equal(Engine.priceFactor({ 2024: 10 }, '2026-11', '2026-11'), 1);
  assert.equal(Engine.priceFactor({ 2024: 10 }, '2027-01', '2026-11'), 1);
  assert.equal(Engine.priceFactor({}, '2020-01', '2026-11'), 1);
});
