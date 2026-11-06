// Money tab: what came in, what went out, and every transaction.
let txShown = 40;
let catFilter = null;   // { t, k } when a category has been clicked

// Average of the last 6 full months, always in plain amounts. Feeds the Freedom tab.
function tracked() {
  const keys = new Set(fullMonths(6));
  let income = 0, spend = 0;
  for (const x of ledger) {
    if (!keys.has(x.d.slice(0, 7))) continue;
    if (x.t === 'income') income += usdOf(x);
    if (x.t === 'expense') spend += usdOf(x);
  }
  return { has: income + spend > 0, income: income / 6, spend: spend / 6 };
}

function periodMonths() {
  const p = $('period').value;
  if (p === 'now') return [thisMonth()];
  if (p === '6' || p === '12') return fullMonths(+p);
  const used = ledger.map(x => x.d.slice(0, 7)).sort();
  if (!used.length) return [thisMonth()];
  const first = p === 'all' ? used[0] : `${p}-01`;
  const last = p === 'all' ? used[used.length - 1] : `${p}-12`;
  const end = last > thisMonth() ? thisMonth() : last;
  return Array.from({ length: Engine.monthsBetween(first, end) + 1 }, (_, i) => Engine.addMonths(first, i));
}

function periodOptions() {
  const years = [...new Set(ledger.map(x => x.d.slice(0, 4)))].sort().reverse();
  const value = $('period').value || '12';
  $('period').innerHTML = `<option value="now">This month</option><option value="6">Last 6 months</option><option value="12">Last 12 months</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}<option value="all">All time</option>`;
  $('period').value = value;
}

function renderSummary(rows) {
  const u = unit();
  const inUsd = rows.reduce((a, r) => a + r.in, 0) / u;
  const outUsd = rows.reduce((a, r) => a + r.out, 0) / u;
  const n = Math.max(1, rows.length);
  const left = inUsd - outUsd;
  $('mIn').textContent = money(inUsd);
  $('mOut').textContent = money(outUsd);
  $('mLeft').textContent = `${left < 0 ? '-' : ''}${money(Math.abs(left))}`;
  $('mInD').textContent = `${money(inUsd / n)} a month`;
  $('mOutD').textContent = `${money(outUsd / n)} a month`;
  $('mLeftD').textContent = left < 0 ? 'You spent more than came in.' : 'What you kept.';
  $('mKept').textContent = inUsd > 0 ? `${Math.round((left / inUsd) * 100)}%` : 'No income';
  $('mKeptD').textContent = 'Of what came in.';
}

function renderCategories(keys) {
  const sums = { expense: {}, income: {} };
  for (const x of ledger) {
    if (keys.has(x.d.slice(0, 7))) sums[x.t][x.k] = (sums[x.t][x.k] || 0) + viewUsd(x);
  }
  const list = (t, id) => {
    const rows = Object.entries(sums[t]).sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((a, [, v]) => a + v, 0);
    const top = rows.length ? rows[0][1] : 1;
    $(id).innerHTML = rows.length ? rows.map(([k, v]) => `<li><button type="button" class="cat${catFilter && catFilter.k === k && catFilter.t === t ? ' on' : ''}" data-t="${t}" data-k="${esc(k)}">
      <span class="cat-name">${esc(k)}</span>
      <span class="cat-track"><i style="width:${Math.max(1, (v / top) * 100)}%"></i></span>
      <span class="cat-val">${money(v)}<small>${Math.round((v / total) * 100)}%</small></span>
    </button></li>`).join('') : '<li class="hint">Nothing in this period.</li>';
  };
  list('expense', 'catOut');
  list('income', 'catIn');
}

function renderTop(keys) {
  const top = ledger.filter(x => x.t === 'expense' && keys.has(x.d.slice(0, 7))).sort((a, b) => viewUsd(b) - viewUsd(a)).slice(0, 5);
  $('topList').innerHTML = top.length ? top.map(x => `<li><span class="what">${esc(x.n) || esc(x.k)}<small>${dayName(x.d)}, ${esc(x.k)}</small></span><span class="when">${money(viewUsd(x))}</span></li>`).join('') : '<li class="hint">Nothing in this period.</li>';
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
  const end = keys[keys.length - 1];
  if (!first) return rows;
  const wanted = new Set(keys);
  for (let k = first; k <= end; k = Engine.addMonths(k, 1)) {
    for (const c in flows[k] || {}) held[c] = (held[c] || 0) + flows[k][c];
    if (!wanted.has(k)) continue;
    let usd = 0;
    for (const c in held) if (knownCurrency(c)) usd += (held[c] / rates.r[c]) * (state.real ? priceFactor(c, k) : 1);
    rows.push({ k, v: usd * unit() });
  }
  return rows;
}

function lastDay(ym) {
  const d = new Date(+ym.slice(0, 4), +ym.slice(5), 0);
  return `${ym}-${String(d.getDate()).padStart(2, '0')}`;
}

// Follows the period. Long periods get one strip per calendar year.
function renderCalendar(keys) {
  const today = new Date().toISOString().slice(0, 10);
  const first = `${keys[0]}-01`;
  const end = lastDay(keys[keys.length - 1]);
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

function categoryOptions(x) {
  const group = (t, label) => {
    const list = CATEGORIES[t].includes(x.k) || x.t !== t ? CATEGORIES[t] : [x.k, ...CATEGORIES[t]];
    return `<optgroup label="${label}">${list.map(k => `<option value="${t}|${esc(k)}"${x.t === t && x.k === k ? ' selected' : ''}>${esc(k)}</option>`).join('')}</optgroup>`;
  };
  return group('expense', 'Money out') + group('income', 'Money in');
}

function renderTransactions() {
  const keys = new Set(periodMonths());
  const q = $('txSearch').value.trim().toLowerCase();
  const rows = ledger
    .filter(x => keys.has(x.d.slice(0, 7))
      && (!catFilter || (x.t === catFilter.t && x.k === catFilter.k))
      && (!q || `${x.n} ${x.k} ${x.s}`.toLowerCase().includes(q)))
    .sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id);
  $('txCount').textContent = `${fmt(rows.length)} ${rows.length === 1 ? 'transaction' : 'transactions'}`;
  $('txClear').hidden = !catFilter;
  $('txClear').textContent = catFilter ? `Showing ${catFilter.k}. Clear` : '';
  $('txList').innerHTML = rows.slice(0, txShown).map(x => {
    const sign = x.t === 'income' ? '+' : '-';
    const original = `${esc(x.c)} ${x.a.toLocaleString('en-US')}`;
    const converted = x.c !== state.ccy || state.real ? `<small>${money(viewUsd(x))}</small>` : '';
    return `<li class="tx" data-id="${x.id}">
      <span class="tx-what">${esc(x.n) || esc(x.k)}<small>${dayName(x.d)}${x.s ? `, ${esc(x.s)}` : ''}</small></span>
      <select aria-label="Category" data-f="cat">${categoryOptions(x)}</select>
      <span class="tx-amt ${x.t === 'income' ? 'pos' : ''}">${sign}${original}${converted}</span>
      <button type="button" class="x" aria-label="Delete this transaction">Delete</button>
    </li>`;
  }).join('') || '<li class="hint">No transactions match.</li>';
  $('txMore').hidden = rows.length <= txShown;
}

function fillAddCategories() {
  const t = document.querySelector('input[name=txKind]:checked').value;
  $('txCat').innerHTML = CATEGORIES[t].map(c => `<option>${esc(c)}</option>`).join('');
  $('txCat').value = plainCategory(t);
}

function renderMoney() {
  const has = ledger.length > 0;
  $('moneyEmpty').hidden = has;
  $('moneyFull').hidden = !has;
  if (!has) return;
  periodOptions();
  const list = periodMonths();
  const keys = new Set(list);
  const months = {};
  for (const x of ledger) {
    const k = x.d.slice(0, 7);
    if (!keys.has(k)) continue;
    months[k] = months[k] || { in: 0, out: 0 };
    months[k][x.t === 'income' ? 'in' : 'out'] += viewUsd(x) * unit();
  }
  const rows = list.map(k => ({ k, in: months[k]?.in || 0, out: months[k]?.out || 0 }));
  renderSummary(rows);
  renderCategories(keys);
  renderTop(keys);
  renderNotice();
  drawInOut(rows);
  drawBalance(balanceRows(list));
  renderCalendar(list);
  renderTransactions();
}

function initMoney() {
  $('period').addEventListener('change', () => { txShown = 40; renderMoney(); });
  const dialog = $('addDialog');
  $('addOpen').addEventListener('click', () => {
    $('txMsg').textContent = '';
    dialog.showModal();
    $('txAmount').focus();
  });
  $('addCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.querySelectorAll('input[name=txKind]').forEach(i => i.addEventListener('change', fillAddCategories));

  $('addBox').addEventListener('submit', e => {
    e.preventDefault();
    const a = parseNumber($('txAmount').value);
    const d = $('txDate').value;
    if (!(a > 0) || !d) { $('txMsg').textContent = 'Enter a date and an amount.'; return; }
    const t = document.querySelector('input[name=txKind]:checked').value;
    ledger.push({ id: ledger.reduce((m, i) => Math.max(m, i.id), 0) + 1, d, a, c: $('txCcy').value, t, k: $('txCat').value, n: $('txNote').value.trim().slice(0, 120), s: '' });
    saveLedger();
    refreshAll();
    $('txAmount').value = '';
    $('txNote').value = '';
    dialog.close();
  });

  $('txSearch').addEventListener('input', () => { txShown = 40; renderTransactions(); });
  $('txMore').addEventListener('click', () => { txShown += 100; renderTransactions(); });
  $('txClear').addEventListener('click', () => { catFilter = null; renderMoney(); });

  const pickCategory = e => {
    const b = e.target.closest('.cat');
    if (!b) return;
    const same = catFilter && catFilter.t === b.dataset.t && catFilter.k === b.dataset.k;
    catFilter = same ? null : { t: b.dataset.t, k: b.dataset.k };
    txShown = 40;
    renderMoney();
    if (catFilter) $('txSec').scrollIntoView({ block: 'start' });
  };
  $('catOut').addEventListener('click', pickCategory);
  $('catIn').addEventListener('click', pickCategory);

  $('txList').addEventListener('change', e => {
    if (e.target.dataset.f !== 'cat') return;
    const x = ledger.find(i => i.id === +e.target.closest('.tx').dataset.id);
    if (!x) return;
    const [t, ...k] = e.target.value.split('|');
    x.t = t;
    x.k = k.join('|');
    saveLedger();
    refreshAll();
  });
  $('txList').addEventListener('click', e => {
    if (!e.target.classList.contains('x')) return;
    const id = +e.target.closest('.tx').dataset.id;
    ledger = ledger.filter(i => i.id !== id);
    saveLedger();
    refreshAll();
  });
}
