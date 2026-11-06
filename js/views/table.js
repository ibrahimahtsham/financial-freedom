// The money list on the Money page.
const TX_PAGE = 25;
const defaultTxFilter = () => ({ q: '', type: '', cat: '', acct: '', day: '' });
let txFilter = defaultTxFilter();
let txSort = { key: 'date', dir: -1 };
let txPage = 0;

const NEW_CATEGORY = '__new';
const TX_COLUMNS = [
  { key: 'date', label: 'Date', fixed: true },
  { key: 'note', label: 'Note', cls: 'wide' },
  { key: 'bank', label: 'Bank says', cls: 'wide bank-says' },
  { key: 'cat', label: 'What for' },
  { key: 'acct', label: 'Bank' },
  { key: 'amount', label: 'Amount', cls: 'num-col', fixed: true },
  { key: 'view', label: '', cls: 'num-col' },
];

const signedUsd = x => (x.t === 'income' ? viewUsd(x) : -viewUsd(x));

function sortValue(x, key) {
  if (key === 'date') return x.d;
  if (key === 'note') return x.n.toLowerCase();
  if (key === 'bank') return (x.o || '').toLowerCase();
  if (key === 'cat') return x.k.toLowerCase();
  if (key === 'acct') return x.s.toLowerCase();
  return signedUsd(x);
}

function filteredTx() {
  const set = new Set(selectedMonths());
  const f = txFilter;
  const q = f.q.trim().toLowerCase();
  return ledger.filter(x => set.has(x.d.slice(0, 7))
    && (!f.type || x.t === f.type)
    && (!f.cat || `${x.t}|${x.k}` === f.cat)
    && (!f.acct || x.s === f.acct)
    && (!f.day || x.d === f.day)
    && (!q || `${x.n} ${x.k} ${x.s} ${x.o || ''}`.toLowerCase().includes(q)));
}

function sortedTx() {
  const { key, dir } = txSort;
  return filteredTx().sort((a, b) => {
    const p = sortValue(a, key), q = sortValue(b, key);
    return (p < q ? -1 : p > q ? 1 : 0) * dir || b.id - a.id;
  });
}

function categoryOptions(x, lists) {
  const group = (t, label) => `<optgroup label="${label}">${lists[t].map(k => `<option value="${t}|${esc(k)}"${x.t === t && x.k === k ? ' selected' : ''}>${esc(k)}</option>`).join('')}<option value="${t}|${NEW_CATEGORY}">+ Make my own</option></optgroup>`;
  return group('expense', 'Money out') + group('income', 'Money in');
}

// Columns that can be shown right now, before the person's own choices are applied.
function availableColumns() {
  const convert = ledger.some(x => x.c !== state.ccy) || state.real;
  return TX_COLUMNS.filter(c => (c.key !== 'bank' || ledger.some(x => x.o)) && (c.key !== 'view' || convert));
}

const columnName = c => (c.key === 'view' ? `In ${state.ccy}` : c.label);

function renderColumnMenu() {
  $('colBox').innerHTML = availableColumns().filter(c => !c.fixed).map(c => `<label class="col-pick"><input type="checkbox" data-col="${c.key}"${state.hiddenCols.includes(c.key) ? '' : ' checked'}>${esc(columnName(c))}</label>`).join('');
}

function fillFilterSelects() {
  const set = new Set(selectedMonths());
  const inRange = ledger.filter(x => set.has(x.d.slice(0, 7)));
  const cats = [...new Set(inRange.map(x => `${x.t}|${x.k}`))].sort();
  if (txFilter.cat && !cats.includes(txFilter.cat)) cats.unshift(txFilter.cat);
  const label = c => {
    const [t, ...k] = c.split('|');
    return `${k.join('|')} (${t === 'income' ? 'in' : 'out'})`;
  };
  $('txCatFilter').innerHTML = `<option value="">Everything</option>${cats.map(c => `<option value="${esc(c)}">${esc(label(c))}</option>`).join('')}`;
  $('txCatFilter').value = txFilter.cat;
  const accts = [...new Set(ledger.map(x => x.s).filter(Boolean))].sort();
  $('txAcct').innerHTML = `<option value="">All banks</option>${accts.map(a => `<option>${esc(a)}</option>`).join('')}`;
  $('txAcct').value = txFilter.acct;
  $('txAcct').hidden = accts.length < 2;
  $('acctList').innerHTML = accts.map(a => `<option value="${esc(a)}">`).join('');
}

// Swaps something for a box to type a name in. It finishes on Enter or on clicking
// away, and Esc finishes with nothing typed.
function nameBox(el, value, done) {
  const box = document.createElement('input');
  box.className = 'textin';
  box.maxLength = 30;
  box.value = value;
  box.placeholder = 'Name it';
  box.setAttribute('aria-label', 'Name');
  let over = false;
  const finish = text => {
    if (over) return;
    over = true;
    done(text);
  };
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(box.value); }
    if (e.key === 'Escape') { e.stopPropagation(); finish(''); }
  });
  box.addEventListener('blur', () => finish(box.value));
  el.replaceWith(box);
  box.focus();
  box.select();
}

function renderTable() {
  fillFilterSelects();
  const rows = sortedTx();
  const pages = Math.max(1, Math.ceil(rows.length / TX_PAGE));
  txPage = Math.min(txPage, pages - 1);
  const start = txPage * TX_PAGE;
  const page = rows.slice(start, start + TX_PAGE);
  const columns = availableColumns().filter(c => !state.hiddenCols.includes(c.key));
  const lists = { expense: categoryList('expense'), income: categoryList('income') };
  const arrow = key => (txSort.key === key ? (txSort.dir > 0 ? ' ↑' : ' ↓') : '');
  const aria = key => (txSort.key === key ? ` aria-sort="${txSort.dir > 0 ? 'ascending' : 'descending'}"` : '');

  $('txHead').innerHTML = `<tr>${columns.map(c => `<th class="${c.cls || ''}"${aria(c.key)}><button type="button" data-sort="${c.key}">${esc(columnName(c))}${arrow(c.key)}</button></th>`).join('')}<th></th></tr>`;
  $('txBody').innerHTML = page.length ? page.map(x => {
    const sign = x.t === 'income' ? '+' : '-';
    const cells = {
      date: `<td class="date">${dayName(x.d)}</td>`,
      note: `<td class="wide">${esc(x.n) || `<span class="hint">No note</span>`}</td>`,
      bank: `<td class="wide bank-says">${esc(x.o || '')}</td>`,
      cat: `<td><select aria-label="What for" data-f="cat">${categoryOptions(x, lists)}</select></td>`,
      acct: `<td>${esc(x.s)}</td>`,
      amount: `<td class="num-col amt${x.t === 'income' ? ' pos' : ''}">${sign}${esc(x.c)} ${x.a.toLocaleString('en-US')}</td>`,
      view: `<td class="num-col muted">${sign}${fmt(viewUsd(x) * unit())}</td>`,
    };
    return `<tr data-id="${x.id}">
      ${columns.map(c => cells[c.key]).join('')}
      <td class="acts"><button type="button" class="x" data-act="edit">Edit</button><button type="button" class="x" data-act="delete">Delete</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="${columns.length + 1}" class="hint empty">Nothing found.</td></tr>';

  const net = rows.reduce((a, x) => a + signedUsd(x), 0);
  $('txCount').textContent = `${fmt(rows.length)} ${rows.length === 1 ? 'item' : 'items'}, ${net < 0 ? '-' : '+'}${money(Math.abs(net))} in total`;
  $('txPageLabel').textContent = rows.length ? `${fmt(start + 1)} to ${fmt(start + page.length)} of ${fmt(rows.length)}` : '';
  $('txPrev').disabled = txPage === 0;
  $('txNext').disabled = txPage >= pages - 1;
  $('txDay').hidden = !txFilter.day;
  $('txDay').textContent = txFilter.day ? `Only ${dayName(txFilter.day)}. Show all` : '';
  $('txSearch').value = txFilter.q;
  $('txType').value = txFilter.type;
}

function exportCsv() {
  const cell = v => {
    const s = String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = sortedTx().map(x => [x.d, x.t === 'income' ? 'Money in' : 'Money out', x.k, x.n, x.o || '', x.s, x.a, x.c].map(cell).join(','));
  downloadFile(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, ['Date,Type,What for,Note,Bank says,Bank,Amount,Type of money', ...rows].join('\n'), 'text/csv');
}

function ledgerChanged() {
  saveLedger();
  renderRange();
  refreshAll();
}

function initTable() {
  $('colMenu').addEventListener('toggle', renderColumnMenu);
  $('colBox').addEventListener('change', e => {
    const key = e.target.dataset.col;
    state.hiddenCols = state.hiddenCols.filter(c => c !== key);
    if (!e.target.checked) state.hiddenCols.push(key);
    saveState();
    renderTable();
  });
  document.addEventListener('click', e => { if (!$('colMenu').contains(e.target)) $('colMenu').open = false; });

  $('txSearch').addEventListener('input', () => { txFilter.q = $('txSearch').value; txPage = 0; renderTable(); });
  $('txType').addEventListener('change', () => { txFilter.type = $('txType').value; txPage = 0; renderTable(); });
  $('txCatFilter').addEventListener('change', () => { txFilter.cat = $('txCatFilter').value; txPage = 0; renderMoney(); });
  $('txAcct').addEventListener('change', () => { txFilter.acct = $('txAcct').value; txPage = 0; renderTable(); });
  $('txDay').addEventListener('click', () => { txFilter.day = ''; renderTable(); });
  $('txPrev').addEventListener('click', () => { txPage -= 1; renderTable(); });
  $('txNext').addEventListener('click', () => { txPage += 1; renderTable(); });
  $('txCsv').addEventListener('click', exportCsv);

  $('txHead').addEventListener('click', e => {
    const key = e.target.dataset.sort;
    if (!key) return;
    txSort = txSort.key === key ? { key, dir: -txSort.dir } : { key, dir: key === 'date' || key === 'amount' || key === 'view' ? -1 : 1 };
    renderTable();
  });

  $('txBody').addEventListener('change', e => {
    if (e.target.dataset.f !== 'cat') return;
    const x = ledger.find(i => i.id === +e.target.closest('tr').dataset.id);
    if (!x) return;
    const [t, ...k] = e.target.value.split('|');
    if (k.join('|') === NEW_CATEGORY) {
      nameBox(e.target, '', text => {
        const name = categoryName(t, text);
        if (!name) { renderTable(); return; }
        x.t = t;
        x.k = name;
        saveLedger();
        refreshAll();
      });
      return;
    }
    x.t = t;
    x.k = k.join('|');
    saveLedger();
    refreshAll();
  });
  $('txBody').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (!act) return;
    const x = ledger.find(i => i.id === +e.target.closest('tr').dataset.id);
    if (!x) return;
    if (act === 'edit') { startEdit(x); return; }
    ledger = ledger.filter(i => i !== x);
    ledgerChanged();
    showToast('Deleted.', () => {
      ledger.push(x);
      ledgerChanged();
    });
  });
}
