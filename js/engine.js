// Pure maths: no DOM and no app state, so it can be tested on its own.
// Months are "YYYY-MM" strings.
const Engine = (() => {
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

  // `rate` is how much savings grow in a year, in percent. Leave it out for no growth.
  const monthlyRate = rate => Math.pow(1 + (rate || 0) / 100, 1 / 12) - 1;

  // What adding 1 a month for n months comes to.
  const addsUpTo = (n, g) => (g ? (Math.pow(1 + g, n) - 1) / g : n);

  // What you need today to take out 1 a month for n months.
  const paysFor = (n, g) => (g ? (1 - Math.pow(1 + g, -n)) / g : n);

  const saved = (cur, save, n, g) => cur * Math.pow(1 + g, n) + save * addsUpTo(n, g);

  // What you need on the day you stop, to spend this much for this many months.
  const needed = ({ spend, months, rate }) => spend * paysFor(months, monthlyRate(rate));

  // The first month you could stop: what you have by then pays for every month left.
  // Null when you would never get there.
  function stopMonth({ cur, save, spend, months, rate }) {
    const g = monthlyRate(rate);
    const enough = m => saved(cur, save, m, g) >= spend * paysFor(months - m, g) - 1e-6;   // rounding mustn't cost a month
    if (enough(0)) return 0;
    if (save < 0 || (save === 0 && (!g || cur <= 0)) || !enough(months)) return null;
    let lo = 0, hi = months;
    while (hi - lo > 1) {
      const m = Math.floor((lo + hi) / 2);
      if (enough(m)) hi = m; else lo = m;
    }
    return hi;
  }

  // What you have in month m: you add your saving until you stop, then spend it.
  function balanceAt({ cur, save, spend, stop, rate }, m) {
    const g = monthlyRate(rate);
    if (stop === null || m <= stop) return Math.max(0, saved(cur, save, m, g));
    return Math.max(0, saved(saved(cur, save, stop, g), -spend, m - stop, g));
  }

  // Monthly saving needed to be able to stop after a set number of months.
  function savingToStop({ cur, spend, months, stop, rate }) {
    const g = monthlyRate(rate);
    return Math.max(0, (spend * paysFor(months - stop, g) - saved(cur, 0, stop, g)) / addsUpTo(stop, g));
  }

  // Whole months savings last at this spending.
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

  return { addMonths, monthsBetween, needed, stopMonth, balanceAt, savingToStop, runway, priceFactor };
})();

if (typeof module !== 'undefined') module.exports = Engine;
