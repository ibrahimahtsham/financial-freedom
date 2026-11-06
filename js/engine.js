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

  // The first month you could stop: what you have by then pays for every month left.
  // Null when you aren't saving and don't have enough today.
  function stopMonth({ cur, save, spend, months }) {
    if (cur >= spend * months) return 0;
    if (save <= 0) return null;
    return Math.ceil((spend * months - cur) / (save + spend) - 1e-9);   // rounding mustn't cost a month
  }

  // What you have in month m: you add your saving until you stop, then spend it.
  function balanceAt({ cur, save, spend, stop }, m) {
    if (stop === null) return Math.max(0, cur + save * m);
    if (m <= stop) return cur + save * m;
    return Math.max(0, cur + save * stop - spend * (m - stop));
  }

  // Monthly saving needed to be able to stop after a set number of months.
  const savingToStop = ({ cur, spend, months, stop }) => Math.max(0, (spend * (months - stop) - cur) / stop);

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

  return { addMonths, monthsBetween, stopMonth, balanceAt, savingToStop, runway, priceFactor };
})();

if (typeof module !== 'undefined') module.exports = Engine;
