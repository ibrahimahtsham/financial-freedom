// Pure planning maths: no DOM, no app state, so it can be tested on its own.
// All amounts here are in one currency. Months are "YYYY-MM" strings.
const Engine = (() => {
  const MAX_MONTHS = 720;

  const monthlyRate = yearly => Math.pow(1 + yearly / 100, 1 / 12) - 1;

  function addMonths(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const i = y * 12 + (m - 1) + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  }

  function monthsBetween(a, b) {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return (by - ay) * 12 + (bm - am);
  }

  // The first stage has no start month. It applies until the next one begins.
  function stageAt(stages, ym) {
    let current = stages[0];
    for (const s of stages.slice(1)) if (s.from && s.from <= ym) current = s;
    return current;
  }

  // Runs the plan month by month. Stops at the goal unless keepGoing is set.
  function simulate({ cur, ret, stages, start, goal = Infinity, months = MAX_MONTHS, incomeAdd = 0, spendCut = 0, keepGoing = false }) {
    const r = monthlyRate(ret);
    let pot = cur, own = cur, hit = cur >= goal ? 0 : null, ranOut = null;
    const series = [{ m: 0, pot, own }];
    for (let m = 1; m <= months; m++) {
      if (hit !== null && !keepGoing) break;
      const s = stageAt(stages, addMonths(start, m - 1));
      const flow = s.income + (s.income > 0 ? incomeAdd : 0) - Math.max(0, s.spend - spendCut);
      pot = pot * (1 + r) + flow;
      own += flow;
      if (pot < 0) {
        pot = 0;
        own = 0;
        if (ranOut === null) ranOut = m;
      }
      series.push({ m, pot, own });
      if (hit === null && pot >= goal) hit = m;
    }
    return { hit, ranOut, series };
  }

  // How much is needed invested for a yearly withdrawal to cover a monthly cost.
  const potFor = (monthly, withdrawalRate) => Math.max(0, monthly) * 12 / (withdrawalRate / 100);

  // Whole months savings last at this spending, ignoring growth.
  const runway = (savings, spend) => (spend > 0 ? Math.floor(savings / spend) : Infinity);

  // Extra needed every month, on top of the plan, to reach the goal by month n.
  function extraToFinish({ cur, ret, stages, start, goal, months }) {
    const planned = simulate({ cur, ret, stages, start, months, keepGoing: true }).series[months].pot;
    const r = monthlyRate(ret);
    const growth = r > 0 ? (Math.pow(1 + r, months) - 1) / r : months;
    return Math.max(0, (goal - planned) / growth);
  }

  return { MAX_MONTHS, monthlyRate, addMonths, monthsBetween, stageAt, simulate, potFor, runway, extraToFinish };
})();

if (typeof module !== 'undefined') module.exports = Engine;
