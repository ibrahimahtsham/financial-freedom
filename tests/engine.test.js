const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../js/engine.js');

const near = (a, b, within = 1e-6) => assert.ok(Math.abs(a - b) < within, `${a} is not near ${b}`);

test('addMonths crosses year boundaries', () => {
  assert.equal(Engine.addMonths('2026-11', 2), '2027-01');
  assert.equal(Engine.addMonths('2026-01', -1), '2025-12');
  assert.equal(Engine.monthsBetween('2026-11', '2027-01'), 2);
});

test('you can stop once savings pay for every month left', () => {
  // 100 saved a month, 100 spent a month, 120 months: month 60 has 6000, and 60 months left cost 6000.
  assert.equal(Engine.stopMonth({ cur: 0, save: 100, spend: 100, months: 120 }), 60);
});

test('you can stop today with enough money', () => {
  assert.equal(Engine.stopMonth({ cur: 12000, save: 0, spend: 100, months: 120 }), 0);
});

test('there is no date without saving or enough money', () => {
  assert.equal(Engine.stopMonth({ cur: 100, save: 0, spend: 100, months: 120 }), null);
});

test('money goes up to the stop month, then runs out at the end', () => {
  const plan = { cur: 0, save: 100, spend: 100, stop: 60 };
  assert.equal(Engine.balanceAt(plan, 30), 3000);
  assert.equal(Engine.balanceAt(plan, 60), 6000);
  assert.equal(Engine.balanceAt(plan, 90), 3000);
  assert.equal(Engine.balanceAt(plan, 120), 0);
});

test('the balance never goes below zero', () => {
  assert.equal(Engine.balanceAt({ cur: 100, save: -50, spend: 10, stop: null }, 12), 0);
});

test('savingToStop gets you there on time', () => {
  const save = Engine.savingToStop({ cur: 1000, spend: 100, months: 120, stop: 60 });
  assert.equal(Engine.stopMonth({ cur: 1000, save, spend: 100, months: 120 }), 60);
});

test('savingToStop is zero when you already have enough', () => {
  assert.equal(Engine.savingToStop({ cur: 99999, spend: 100, months: 120, stop: 60 }), 0);
});

test('with no rate, the goal is spending times months', () => {
  assert.equal(Engine.needed({ spend: 100, months: 120 }), 12000);
});

test('growth means you need less to stop', () => {
  const need = Engine.needed({ spend: 100, months: 120, rate: 3 });
  assert.ok(need < 12000 && need > 10000);
});

test('growth gets you there sooner', () => {
  const plan = { cur: 1000, save: 100, spend: 100, months: 600 };
  assert.ok(Engine.stopMonth({ ...plan, rate: 3 }) < Engine.stopMonth(plan));
});

test('with growth, the money runs out right at the end', () => {
  const plan = { cur: 0, save: 100, spend: 100, months: 600, rate: 3 };
  const stop = Engine.stopMonth(plan);
  const peak = Engine.balanceAt({ ...plan, stop }, stop);
  assert.ok(peak >= Engine.needed({ spend: 100, months: 600 - stop, rate: 3 }));
  assert.ok(peak < Engine.needed({ spend: 100, months: 600 - stop + 2, rate: 3 }));
  near(Engine.balanceAt({ cur: Engine.needed({ spend: 100, months: 120, rate: 3 }), save: 0, spend: 100, stop: 0, rate: 3 }, 120), 0, 1e-6);
});

test('savings can reach the goal by growth alone', () => {
  assert.ok(Engine.stopMonth({ cur: 5000, save: 0, spend: 100, months: 600, rate: 3 }) > 0);
  assert.equal(Engine.stopMonth({ cur: 0, save: 0, spend: 100, months: 600, rate: 3 }), null);
});

test('savingToStop gets you there on time with growth', () => {
  const plan = { cur: 1000, spend: 100, months: 600, rate: 3 };
  const save = Engine.savingToStop({ ...plan, stop: 240 });
  assert.equal(Engine.stopMonth({ ...plan, save }), 240);
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
