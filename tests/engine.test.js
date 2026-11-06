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
