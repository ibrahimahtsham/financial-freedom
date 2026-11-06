// Money tab: what came in, what went out, categories, rules and transactions.
let txShown = 50;

function fullMonths(n) {
  const start = thisMonth();
  return Array.from({ length: n }, (_, i) => Engine.addMonths(start, i - n));
}

function periodMonths() {
  const p = $('period').value;
  if (/^\d+$/.test(p) && p.length < 4) return fullMonths(+p);
  const used = ledger.map(x => x.d.slice(0, 7)).sort();
  if (!used.length) return [];
  const first = p === 'all' ? used[0] : `${p}-01`;
  const end = p === 'all' ? used[used.length - 1] : `${p}-12`;
  const stop = end > thisMonth() ? thisMonth() : end;
  const count = Engine.monthsBetween(first, stop) + 1;
  return Array.from({ length: Math.max(1, count) }, (_, i) => Engine.addMonths(first, i));
}

function periodOptions() {
  const years = [...new Set(ledger.map(x => x.d.slice(0, 4)))].sort().reverse();
  const value = $('period').value || '6';
  $('period').innerHTML = `<option value="6">Last 6 months</option><option value="12">Last 12 months</option><option value="all">All time</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}`;
  $('period').value = value;
}

function breakdownRows(entries, months) {
  const total = entries.reduce((a, [, v]) => a + v, 0);
  const top = entries.length ? entries[0][1] : 1;
  if (!entries.length) return '<li class="hint">Nothing in this period.</li>';
  return entries.map(([name, v]) => `<li>
    <span class="cat-name">${esc(name)}</span>
    <span class="cat-track"><i style="width:${Math.max(1, (v / top) * 100)}%"></i></span>
    <span class="cat-val">${mine(v / months)}<small>${Math.round((v / total) * 100)}%</small></span>
  </li>`).join('');
}

function renderBreakdown() {
  const keys = new Set(periodMonths());
  const months = Math.max(1, keys.size);
  const sum = { expense: {}, income: {} };
  let moved = { in: 0, out: 0 };
  for (const x of ledger) {
    if (!keys.has(x.d.slice(0, 7))) continue;
    const v = usdOf(x);
    if (x.t === 'transfer') moved[x.io] += v;
    else sum[x.t][x.k] = (sum[x.t][x.k] || 0) + v;
  }
  const sorted = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const total = o => Object.values(o).reduce((a, b) => a + b, 0);
  $('lgSpend').textContent = mine(total(sum.expense) / months);
  $('lgIncome').textContent = mine(total(sum.income) / months);
  $('catOut').innerHTML = breakdownRows(sorted(sum.expense), months);
  $('catIn').innerHTML = breakdownRows(sorted(sum.income), months);
  $('moved').textContent = moved.in + moved.out > 0
    ? `Not counted above: ${mine(moved.in)} came in and ${mine(moved.out)} went out as transfers, such as family, your own accounts and refunds.`
    : '';
}

function spendingByCurrency() {
  const out = [];
  for (const c of [...new Set(ledger.map(x => x.c))]) {
    const m = {};
    for (const x of ledger) {
      if (x.c !== c || x.t !== 'expense') continue;
      const k = x.d.slice(0, 7);
      m[k] = m[k] || { sum: 0, n: 0 };
      m[k].sum += x.a;
      if (x.k !== 'Bank fees') m[k].n += 1;   // a month of fees alone isn't a month of living
    }
    const active = Object.keys(m).filter(k => m[k].n >= 5).sort().slice(-12);
    if (active.length < 3) continue;
    const avg = active.reduce((a, k) => a + m[k].sum, 0) / active.length;
    const mid = active[Math.floor(active.length / 2)];
    const years = Math.max(0, Engine.monthsBetween(mid, thisMonth()) / 12);
    const today = avg * Math.pow(1 + state.infl / 100, years);
    out.push(`In ${c}, you spent about ${fmt(avg)} a month from ${monthName(active[0])} to ${monthName(active[active.length - 1])}${years >= 0.75 ? `, which is about ${fmt(today)} at today's prices.` : '.'}`);
  }
  return out.join(' ');
}

function renderBars() {
  const keys = fullMonths(24);
  const m = {};
  for (const x of ledger) if (x.t === 'expense') m[x.d.slice(0, 7)] = (m[x.d.slice(0, 7)] || 0) + usdOf(x);
  drawBars(keys, keys.map(k => (m[k] || 0) * unit()));
}

function categoryOptions(x) {
  const list = categories(x.t);
  return (list.includes(x.k) ? list : [x.k, ...list]).map(c => `<option${c === x.k ? ' selected' : ''}>${esc(c)}</option>`).join('');
}

function renderTransactions() {
  const q = $('txSearch').value.trim().toLowerCase();
  const f = $('txFilter').value;
  const plain = [plainCategory('income'), plainCategory('expense')];
  const rows = ledger
    .filter(x => (f === 'all' || x.t === f || (f === 'plain' && plain.includes(x.k))) && (!q || `${x.n} ${x.k} ${x.s}`.toLowerCase().includes(q)))
    .sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id);
  $('txCount').textContent = `${fmt(ledger.length)} saved`;
  $('txTable').innerHTML = `<thead><tr><th>Date</th><th class="memo">Details</th><th>Amount</th><th>Type</th><th>Category</th><th></th></tr></thead><tbody>${rows.slice(0, txShown).map(x => `<tr data-id="${x.id}">
    <td>${x.d}</td>
    <td class="memo">${esc(x.n) || 'No note'}${x.s ? `<small>${esc(x.s)}</small>` : ''}</td>
    <td>${esc(x.c)} ${x.a.toLocaleString('en-US')}</td>
    <td><select aria-label="Type" data-f="t">${['expense', 'income', 'transfer'].map(t => `<option value="${t}"${t === x.t ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></td>
    <td><select aria-label="Category" data-f="k">${categoryOptions(x)}</select></td>
    <td><button type="button" class="x">Delete</button></td>
  </tr>`).join('')}</tbody>`;
  $('txMore').hidden = rows.length <= txShown;
}

function renderCategories() {
  const custom = Object.entries(state.cats).flatMap(([t, list]) => list.map(k => ({ t, k })));
  $('catList').innerHTML = custom.length
    ? custom.map(c => `<li><span>${esc(c.k)} <small>${c.t}</small></span><button type="button" class="x" data-t="${c.t}" data-k="${esc(c.k)}">Remove</button></li>`).join('')
    : '<li class="hint">Your own categories will show here.</li>';
  $('ruleList').innerHTML = state.rules.length
    ? state.rules.map((r, i) => `<li><span>"${esc(r.q)}" goes to ${esc(r.k)} <small>${r.t}</small></span><button type="button" class="x" data-i="${i}">Remove</button></li>`).join('')
    : '<li class="hint">Rules you add will show here.</li>';
}

function fillCategorySelect(typeId, catId) {
  $(catId).innerHTML = categories($(typeId).value).map(c => `<option>${esc(c)}</option>`).join('');
}

function renderMoney() {
  const has = ledger.length > 0;
  $('ledgerEmpty').hidden = has;
  $('ledgerStats').hidden = !has;
  $('txFold').hidden = !has;
  fillCategorySelect('txType', 'txCat');
  fillCategorySelect('ruleType', 'ruleCat');
  renderCategories();
  if (!has) return;
  periodOptions();
  renderBreakdown();
  $('lgByCcy').textContent = spendingByCurrency();
  renderBars();
  renderTransactions();
}

function ruleMatches(rule, x) {
  return `${x.n} ${x.s}`.toLowerCase().includes(rule.q.toLowerCase());
}

function applyRule(rule) {
  let changed = 0;
  for (const x of ledger) {
    if (ruleMatches(rule, x) && (x.t !== rule.t || x.k !== rule.k)) {
      x.t = rule.t;
      x.k = rule.k;
      changed += 1;
    }
  }
  return changed;
}

function initMoney() {
  $('period').addEventListener('change', renderBreakdown);
  $('txType').addEventListener('change', () => fillCategorySelect('txType', 'txCat'));
  $('ruleType').addEventListener('change', () => fillCategorySelect('ruleType', 'ruleCat'));

  $('txForm').addEventListener('submit', e => {
    e.preventDefault();
    const a = parseNumber($('txAmount').value);
    const d = $('txDate').value;
    if (!(a > 0) || !d) { $('txMsg').textContent = 'Enter a date and an amount.'; return; }
    const t = $('txType').value;
    const x = { id: ledger.reduce((m, i) => Math.max(m, i.id), 0) + 1, d, a, c: $('txCcy').value, t, k: $('txCat').value, io: t === 'income' ? 'in' : 'out', n: $('txNote').value.trim().slice(0, 120), s: 'Added by hand' };
    ledger.push(x);
    saveLedger();
    renderMoney();
    $('txAmount').value = '';
    $('txNote').value = '';
    $('txMsg').textContent = 'Added.';
    $('txAmount').focus();
  });

  $('txSearch').addEventListener('input', () => { txShown = 50; renderTransactions(); });
  $('txFilter').addEventListener('change', () => { txShown = 50; renderTransactions(); });
  $('txMore').addEventListener('click', () => { txShown += 100; renderTransactions(); });

  $('txTable').addEventListener('change', e => {
    const f = e.target.dataset.f;
    const x = ledger.find(i => i.id === +e.target.closest('tr')?.dataset.id);
    if (!f || !x) return;
    x[f] = e.target.value;
    if (f === 't') x.k = plainCategory(x.t);
    saveLedger();
    renderMoney();
  });
  $('txTable').addEventListener('click', e => {
    if (!e.target.classList.contains('x')) return;
    const id = +e.target.closest('tr').dataset.id;
    ledger = ledger.filter(i => i.id !== id);
    saveLedger();
    renderMoney();
  });

  $('useReal').addEventListener('click', () => {
    const keys = new Set(fullMonths(6));
    const spend = ledger.reduce((a, x) => a + (x.t === 'expense' && keys.has(x.d.slice(0, 7)) ? usdOf(x) : 0), 0) / 6;
    if (!spend) { $('lgNote').textContent = 'There is no spending in the last 6 full months to use.'; return; }
    Engine.stageAt(state.stages, thisMonth()).spend = spend;
    renderStages();
    refresh();
    $('lgNote').textContent = `Your current stage now uses ${mine(spend)} a month.`;
  });

  $('catForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('catName').value.trim().slice(0, 30);
    const t = $('catType').value;
    if (!name) return;
    if (!categories(t).includes(name)) state.cats[t].push(name);
    $('catName').value = '';
    saveState();
    renderMoney();
  });
  $('catList').addEventListener('click', e => {
    const { t, k } = e.target.dataset;
    if (!t) return;
    state.cats[t] = state.cats[t].filter(c => c !== k);
    for (const x of ledger) if (x.t === t && x.k === k) x.k = plainCategory(t);
    saveLedger();
    saveState();
    renderMoney();
  });

  $('ruleForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('ruleQ').value.trim();
    if (!q) { $('ruleMsg').textContent = 'Enter the words to look for.'; return; }
    const rule = { q: q.slice(0, 60), t: $('ruleType').value, k: $('ruleCat').value };
    state.rules.push(rule);
    const changed = applyRule(rule);
    saveLedger();
    saveState();
    $('ruleQ').value = '';
    renderMoney();
    $('ruleMsg').textContent = `Rule added. ${fmt(changed)} ${changed === 1 ? 'transaction' : 'transactions'} changed.`;
  });
  $('ruleList').addEventListener('click', e => {
    if (e.target.dataset.i === undefined) return;
    state.rules.splice(+e.target.dataset.i, 1);
    saveState();
    renderMoney();
  });
}
