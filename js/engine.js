// Pure maths: no DOM and no app state, so it can be tested on its own.
// Months are "YYYY-MM" strings.
const Engine = (() => {
  const MAX_MONTHS = 720;
  const FREEDOM_MULTIPLE = 25;   // 4% rule: 1 / 0.04

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

  // Each month: pot = pot x (1 + monthly return) + saving.
  function project({ cur, ret, save, goal = Infinity, months = MAX_MONTHS }) {
    const r = monthlyRate(ret);
    let pot = cur;
    let hit = cur >= goal ? 0 : null;
    const series = [pot];
    for (let m = 1; m <= months; m++) {
      pot = pot * (1 + r) + save;
      series.push(pot);
      if (hit === null && pot >= goal) hit = m;
    }
    return { hit, series };
  }

  const freedomNumber = monthly => Math.max(0, monthly) * 12 * FREEDOM_MULTIPLE;

  // Whole months savings last at this spending, ignoring growth.
  const runway = (savings, spend) => (spend > 0 ? Math.floor(savings / spend) : Infinity);

  // How much prices rose from month `from` to month `to`, given yearly inflation
  // percentages by year. Years with no data use the nearest earlier year.
  function priceFactor(table, from, to) {
    const years = Object.keys(table).map(Number).sort((a, b) => a - b);
    if (!years.length || from >= to) return 1;
    const rateIn = y => {
      const known = years.filter(k => k <= y);
      return table[known.length ? known[known.length - 1] : years[0]];
    };
    let factor = 1;
    for (let ym = from; ym < to; ym = addMonths(ym, 1)) {
      factor *= Math.pow(1 + rateIn(+ym.slice(0, 4)) / 100, 1 / 12);
    }
    return factor;
  }

  return { MAX_MONTHS, FREEDOM_MULTIPLE, monthlyRate, addMonths, monthsBetween, project, freedomNumber, runway, priceFactor };
})();

if (typeof module !== 'undefined') module.exports = Engine;
