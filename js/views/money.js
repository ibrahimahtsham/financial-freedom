// Money tab: the dashboard. The transactions table lives in table.js.

let expandedCats = { expense: false, income: false };

// What the Freedom tab reads from your tracking: your balance, and your average
// monthly living costs over the last 12 full months, in today's prices.
function tracked() {
  const keys = new Set(fullMonths(12));
  let spend = 0, balance = 0;
  for (const x of ledger) {
    balance += x.t === 'income' ? usdOf(x) : -usdOf(x);
    if (x.t === 'expense' && keys.has(x.d.slice(0, 7)) && !NOT_LIVING_COSTS.includes(x.k)) {
      spend += usdOf(x) * priceFactor(x.c, x.d.slice(0, 7));
    }
  }
  return { has: ledger.length > 0, spend: spend / 12, balance: Math.max(0, balance) };
}

function sumMonths(keys) {
  const set = new Set(keys);
  let income = 0, spend = 0;
  for (const x of ledger) {
    if (!set.has(x.d.slice(0, 7))) continue;
    if (x.t === 'income') income += viewUsd(x);
    else spend += viewUsd(x);
  }
  return { income, spend };
}

function changeText(now, before, label) {
  if (!(before > 0)) return '';
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `Same as the ${label} before`;
  return `${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than the ${label} before`;
}

function renderSummary(keys) {
  const { income, spend } = sumMonths(keys);
  const n = Math.max(1, keys.length);
  const left = income - spend;
  const prev = Array.from({ length: n }, (_, i) => Engine.addMonths(keys[0], i - n));
  const before = sumMonths(prev);
  const label = n === 1 ? 'month' : `${n} months`;
  $('mIn').textContent = money(income);
  $('mOut').textContent = money(spend);
  $('mLeft').textContent = `${left < 0 ? '-' : ''}${money(Math.abs(left))}`;
  $('mKept').textContent = income > 0 ? `${Math.round((left / income) * 100)}%` : 'No income';
  $('mInD').textContent = `${money(income / n)} a month`;
  $('mOutD').textContent = `${money(spend / n)} a month`;
  $('mLeftD').textContent = left < 0 ? 'You spent more than came in.' : 'Added to your balance.';
  $('mKeptD').textContent = 'Of what came in.';
  $('mInC').textContent = changeText(income, before.income, label);
  $('mOutC').textContent = changeText(spend, before.spend, label);
}

function renderCategories(keys) {
  const set = new Set(keys);
  const sums = { expense: {}, income: {} };
  for (const x of ledger) if (set.has(x.d.slice(0, 7))) sums[x.t][x.k] = (sums[x.t][x.k] || 0) + viewUsd(x);
  const list = (t, id) => {
    const all = Object.entries(sums[t]).sort((a, b) => b[1] - a[1]);
    const total = all.reduce((a, [, v]) => a + v, 0);
    const top = all.length ? all[0][1] : 1;
    const open = expandedCats[t];
    const shown = open ? all : all.slice(0, 7);
    const more = all.length - 7;
    const row = (k, v) => `<li><button type="button" class="cat${txFilter.cat === `${t}|${k}` ? ' on' : ''}" data-cat="${t}|${esc(k)}">
      <span class="cat-name">${esc(k)}</span>
      <span class="cat-track"><i style="width:${Math.max(1, (v / top) * 100)}%"></i></span>
      <span class="cat-val">${money(v)}<small>${Math.round((v / total) * 100)}%</small></span>
    </button></li>`;
    $(id).innerHTML = all.length
      ? shown.map(([k, v]) => row(k, v)).join('') + (more > 0 ? `<li><button type="button" class="link more" data-more="${t}">${open ? 'Show less' : `Show ${more} more`}</button></li>` : '')
      : '<li class="hint">Nothing in this period.</li>';
  };
  list('expense', 'catOut');
  list('income', 'catIn');
}

function renderTop(keys) {
  const set = new Set(keys);
  const top = ledger.filter(x => x.t === 'expense' && set.has(x.d.slice(0, 7))).sort((a, b) => viewUsd(b) - viewUsd(a)).slice(0, 5);
  $('topList').innerHTML = top.length ? top.map(x => `<li><span class="what">${esc(x.n) || esc(x.k)}<small>${dayName(x.d)}, ${esc(x.k)}</small></span><span class="when">${money(viewUsd(x))}</span></li>`).join('') : '<li class="hint">Nothing in this period.</li>';
}

// Short plain-language findings, built from whatever is in the chosen period.
function renderInsights(keys, rows) {
  const set = new Set(keys);
  const out = [];
  const items = ledger.filter(x => x.t === 'expense' && set.has(x.d.slice(0, 7)));
  const total = items.reduce((a, x) => a + viewUsd(x), 0);
  if (!items.length) {
    $('insights').innerHTML = '<li class="hint">Nothing in this period.</li>';
    return;
  }
  const byCat = {};
  for (const x of items) if (x.k !== plainCategory('expense')) byCat[x.k] = (byCat[x.k] || 0) + viewUsd(x);
  const [topCat] = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (topCat) out.push(`<b>${esc(topCat[0])}</b> was your biggest known cost, at ${Math.round((topCat[1] / total) * 100)}% of spending.`);
  if (rows.length > 1) {
    const peak = rows.reduce((a, r) => (r.out > a.out ? r : a), rows[0]);
    out.push(`You spent the most in <b>${monthName(peak.k)}</b>: ${state.ccy} ${fmt(peak.out)}.`);
  }
  const perDay = {};
  for (const x of items) perDay[x.d] = (perDay[x.d] || 0) + viewUsd(x);
  const spent = Object.values(perDay).sort((a, b) => a - b);
  out.push(`On a day you spend, it's usually about <b>${money(spent[Math.floor(spent.length / 2)])}</b>.`);
  const today = new Date().toISOString().slice(0, 10);
  const lastDayOf = lastDate(keys[keys.length - 1]);
  const end = lastDayOf > today ? today : lastDayOf;
  const days = Math.round((Date.parse(end) - Date.parse(`${keys[0]}-01`)) / 864e5) + 1;
  const free = Math.max(0, days - spent.length);
  out.push(`<b>${fmt(free)} of ${fmt(days)} days</b> had no spending.`);
  $('insights').innerHTML = out.map(s => `<li>${s}</li>`).join('');
}

function balanceRows(keys) {
  const flows = {};
  for (const x of ledger) {
    const k = x.d.slice(0, 7);
    flows[k] = flows[k] || {};
    flows[k][x.c] = (flows[k][x.c] || 0) + (x.t === 'income' ? x.a : -x.a);
  }
  const held = {};
  const rows = [];
  const first = Object.keys(flows).sort()[0];
  if (!first) return rows;
  const wanted = new Set(keys);
  const end = keys[keys.length - 1];
  for (let k = first < keys[0] ? first : keys[0]; k <= end; k = Engine.addMonths(k, 1)) {
    for (const c in flows[k] || {}) held[c] = (held[c] || 0) + flows[k][c];
    if (!wanted.has(k)) continue;
    let usd = 0;
    for (const c in held) if (knownCurrency(c)) usd += (held[c] / rates.r[c]) * (state.real ? priceFactor(c, k) : 1);
    rows.push({ k, v: usd * unit() });
  }
  return rows;
}

function lastDate(ym) {
  const d = new Date(+ym.slice(0, 4), +ym.slice(5), 0);
  return `${ym}-${String(d.getDate()).padStart(2, '0')}`;
}

// Follows the period. Long periods get one strip per calendar year.
function renderCalendar(keys) {
  const today = new Date().toISOString().slice(0, 10);
  const first = `${keys[0]}-01`;
  const end = lastDate(keys[keys.length - 1]);
  const last = end > today ? today : end;
  const days = {};
  for (const x of ledger) if (x.t === 'expense' && x.d >= first && x.d <= last) days[x.d] = (days[x.d] || 0) + viewUsd(x);
  const strips = [];
  if (keys.length <= 13) strips.push({ from: first, to: last });
  else {
    for (let y = +last.slice(0, 4); y >= +first.slice(0, 4); y--) {
      strips.push({ label: String(y), from: `${y}-01-01` < first ? first : `${y}-01-01`, to: `${y}-12-31` > last ? last : `${y}-12-31` });
    }
  }
  drawCalendar(days, strips);
}

function renderNotice() {
  const used = [...new Set(ledger.map(x => x.c))];
  const missing = used.filter(c => !inflationCovers(c));
  const parts = [];
  if (state.real) {
    parts.push(`Old amounts are raised to today's prices using each currency's own yearly inflation, up to ${latestInflationYear()}, then converted.`);
    if (missing.length) parts.push(`No inflation data for ${missing.join(', ')}, so those stay as they were.`);
  }
  if (used.some(c => c !== state.ccy)) parts.push("Other currencies are converted at today's exchange rate.");
  $('viewNote').textContent = parts.join(' ');
}

function renderMoney() {
  const has = ledger.length > 0;
  $('moneyEmpty').hidden = has;
  $('moneyFull').hidden = !has;
  if (!has) return;
  const keys = selectedMonths();
  if (!keys.length) return;
  const set = new Set(keys);
  const months = {};
  for (const x of ledger) {
    const k = x.d.slice(0, 7);
    if (!set.has(k)) continue;
    months[k] = months[k] || { in: 0, out: 0 };
    months[k][x.t === 'income' ? 'in' : 'out'] += viewUsd(x) * unit();
  }
  const rows = keys.map(k => ({ k, in: months[k]?.in || 0, out: months[k]?.out || 0 }));
  renderSummary(keys);
  renderCategories(keys);
  renderTop(keys);
  renderInsights(keys, rows);
  renderNotice();
  drawInOut(rows);
  drawBalance(balanceRows(keys));
  renderCalendar(keys);
  renderTable();
}

function initMoney() {
  const pickCategory = e => {
    const toggle = e.target.dataset.more;
    if (toggle) {
      expandedCats[toggle] = !expandedCats[toggle];
      renderMoney();
      return;
    }
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    txFilter.cat = txFilter.cat === b.dataset.cat ? '' : b.dataset.cat;
    txFilter.day = '';
    txPage = 0;
    renderMoney();
    if (txFilter.cat && tourAt < 0) $('txSec').scrollIntoView({ block: 'start' });
  };
  $('catOut').addEventListener('click', pickCategory);
  $('catIn').addEventListener('click', pickCategory);

  $('inOut').addEventListener('click', e => {
    const m = e.target.dataset.month;
    if (m) setRangeMonths(m, m);
  });
  $('calendar').addEventListener('click', e => {
    const d = e.target.dataset.day;
    if (!d) return;
    txFilter.day = d;
    txFilter.cat = '';
    txPage = 0;
    renderMoney();
    if (tourAt < 0) $('txSec').scrollIntoView({ block: 'start' });
    else showToast(`The table now shows ${dayName(d)}.`);
  });
}
