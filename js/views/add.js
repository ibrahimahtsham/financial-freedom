// Add page: the form, quick picks, latest items, the bank check and renaming.
let editingId = null;
let editReturn = null;   // where to go back to after changing an item
let pickToRemove = -1;   // the quick pick waiting for a yes or no
let pickAskedAt = 0;

const todayDate = () => new Date().toISOString().slice(0, 10);
const chosenKind = () => document.querySelector('input[name=txKind]:checked').value;
const setKind = t => { document.querySelector(`input[name=txKind][value=${t}]`).checked = true; };
const exactMoney = (c, v) => `${v < 0 ? '-' : ''}${c} ${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function fillAddCategories(value) {
  const list = categoryList(chosenKind());
  $('txCat').innerHTML = `${list.map(c => `<option>${esc(c)}</option>`).join('')}<option value="${NEW_CATEGORY}">+ Make my own</option>`;
  $('txCat').value = value && list.includes(value) ? value : plainCategory(chosenKind());
  showNewCategoryBox();
}

function showNewCategoryBox() {
  const on = $('txCat').value === NEW_CATEGORY;
  $('txCatNew').hidden = !on;
  if (!on) $('txCatNew').value = '';
}

function setEditing(id) {
  editingId = id;
  $('addTitle').textContent = id === null ? 'Add money in or out' : 'Change this';
  $('addSave').textContent = id === null ? 'Add it' : 'Save';
  $('addCancel').hidden = id === null;
  $('addBoth').hidden = id !== null;
  $('addPickOnly').hidden = id !== null;
  $('txMsg').textContent = '';
}

// Empties the form for the next item, keeping the last bank and type of money.
function clearForm(keepDate) {
  setEditing(null);
  fillAddCategories();
  const c = [state.last.c, state.ccy].find(knownCurrency) || 'USD';
  $('txAmount').value = '';
  $('txCcy').value = c;
  if (!keepDate || !$('txDate').value) $('txDate').value = todayDate();
  $('txNote').value = '';
  $('txSource').value = state.last.s;
}

function focusAmount() {
  if (tourAt < 0 && matchMedia('(hover: hover)').matches) $('txAmount').focus({ preventScroll: true });
}

function startEdit(x) {
  editReturn = { tab: activeTab, y: scrollY };
  setEditing(x.id);
  setKind(x.t);
  fillAddCategories(x.k);
  $('txAmount').value = x.a;
  $('txCcy').value = x.c;
  $('txDate').value = x.d;
  $('txNote').value = x.n;
  $('txSource').value = x.s;
  showTab('add');
  scrollTo(0, 0);
}

function finishEdit() {
  const back = editReturn;
  editReturn = null;
  setKind('expense');
  clearForm();
  showTab(back.tab);
  scrollTo(0, back.y);
}

function addItem(fields, undoPick) {
  const item = { id: ledger.reduce((m, i) => Math.max(m, i.id), 0) + 1, ...fields };
  ledger.push(item);
  state.last = { c: fields.c, s: fields.s };
  ledgerChanged();
  showInRange(fields.d.slice(0, 7));
  showToast(`Added ${fields.n || fields.k}${undoPick ? ' and made a quick pick' : ''}.`, () => {
    ledger = ledger.filter(i => i !== item);
    ledgerChanged();
    undoPick?.();
  });
}

// Saves a quick pick, and returns a way to take it back.
function addPick({ d, ...pick }) {
  const same = q => ['a', 'c', 't', 'k', 'n', 's'].every(f => q[f] === pick[f]);
  if (state.quick.some(same)) return () => {};
  state.quick = [...state.quick, pick].slice(-12);
  saveState();
  renderAdd();
  return () => {
    state.quick = state.quick.filter(q => q !== pick);
    saveState();
    renderQuick();
  };
}

const quickLabel = q => (q.a > 0 ? `${q.n || q.k}, ${exactMoney(q.c, q.a)}` : q.n || q.k);

function renderQuick() {
  $('quickList').innerHTML = state.quick.map((q, i) => (i === pickToRemove
    ? `<span class="quick asking"><span>Remove ${esc(q.n || q.k)}?</span><button type="button" data-yes="${i}">Yes, remove</button><button type="button" data-keep="1">Keep</button></span>`
    : `<span class="quick"><button type="button" data-quick="${i}">${esc(quickLabel(q))}</button><button type="button" class="x" data-drop="${i}" aria-label="Remove ${esc(q.n || q.k)}">×</button></span>`)).join('');
  $('quickHint').textContent = state.quick.length
    ? 'Click one to fill in the form. Change anything you want, then add it.'
    : 'Fill in the form for something you buy a lot, then press Add + quick pick or Only quick pick. After that, one click fills in the form.';
}

// Fills the form but adds nothing, so the amount or anything else can change first.
function usePick(q) {
  setEditing(null);
  setKind(q.t);
  fillAddCategories(q.k);
  $('txAmount').value = q.a > 0 ? q.a : '';
  $('txCcy').value = q.c;
  $('txNote').value = q.n;
  $('txSource').value = q.s;
  scrollTo(0, 0);
  $('txAmount').focus({ preventScroll: true });
  $('txAmount').select();
}

function renderLatest() {
  const latest = [...ledger].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id)).slice(0, 5);
  $('latestList').innerHTML = latest.length ? latest.map(x => `<li><span class="what">${esc(x.n) || esc(x.k)}<small>${dayName(x.d)}, ${esc(x.k)}</small></span><span class="amt${x.t === 'income' ? ' pos' : ''}">${x.t === 'income' ? '+' : '-'}${esc(exactMoney(x.c, x.a))}</span><button type="button" class="x" data-edit="${x.id}">Edit</button></li>`).join('') : '<li class="hint">Nothing yet.</li>';
}

// Renaming Other would sweep up everything unsorted, and renaming the two below
// would quietly start counting them as spending.
const canRename = (t, k) => k !== plainCategory(t) && !NOT_LIVING_COSTS.includes(k);

function renderRenames() {
  const list = (t, id) => {
    const counts = {};
    for (const x of ledger) if (x.t === t) counts[x.k] = (counts[x.k] || 0) + 1;
    const rows = categoryList(t).filter(k => (counts[k] || state.ownCats[t].includes(k)) && canRename(t, k));
    $(id).innerHTML = `${rows.map(k => `<li><span class="ren-name">${esc(k)}</span><small>${fmt(counts[k] || 0)}</small>${counts[k] ? '' : `<button type="button" class="x" data-rm="${t}|${esc(k)}">Remove</button>`}<button type="button" class="x" data-ren="${t}|${esc(k)}">Rename</button></li>`).join('')}<li><button type="button" class="link" data-new="${t}">+ Add new</button></li>`;
  };
  list('expense', 'renOut');
  list('income', 'renIn');
}

function renameCategory(t, from, typed) {
  const clean = typed.trim().replace(/\s+/g, ' ').slice(0, 30);
  const to = clean.toLowerCase() === from.toLowerCase() ? clean : categoryName(t, clean);
  if (!to || to === from) { renderRenames(); return; }
  const items = ledger.filter(x => x.t === t && x.k === from);
  const picks = state.quick.filter(q => q.t === t && q.k === from);
  const move = (a, b) => {
    [...items, ...picks].forEach(x => { x.k = b; });
    state.ownCats[t] = [...new Set(state.ownCats[t].map(k => (k === a ? b : k)))];
    txFilter.cat = '';
    ledgerChanged();
  };
  move(from, to);
  showToast(`Renamed to ${to}.`, () => move(to, from));
}

function addCategory(t, typed) {
  const name = categoryName(t, typed);
  if (!name) { renderRenames(); return; }
  if (categoryList(t).includes(name)) {
    renderRenames();
    showToast(`You already have ${name}.`);
    return;
  }
  state.ownCats[t] = [...state.ownCats[t], name];
  refreshAll();
  showToast(`Added ${name}.`);
}

// Keeps the form's dropdown in step with new and renamed categories.
function refreshFormCategories() {
  if ($('txCat').value !== NEW_CATEGORY) fillAddCategories($('txCat').value);
}

// What the app thinks is in one bank, in that bank's main type of money.
function appHolds(bank) {
  const items = bank ? ledger.filter(x => x.s === bank) : ledger;
  const uses = {};
  for (const x of items) uses[x.c] = (uses[x.c] || 0) + 1;
  const c = bank ? Object.keys(uses).sort((a, b) => uses[b] - uses[a])[0] : state.ccy;
  const rate = knownCurrency(c) ? rates.r[c] : 1;
  const total = items.reduce((sum, x) => sum + (x.t === 'income' ? 1 : -1) * usdOf(x) * rate, 0);
  return { c, total: Math.round(total * 100) / 100 };
}

function renderCheck() {
  const banks = [...new Set(ledger.map(x => x.s).filter(Boolean))].sort();
  const chosen = $('chkBank').value;
  $('chkBank').innerHTML = `${banks.map(b => `<option>${esc(b)}</option>`).join('')}<option value="">All my money</option>`;
  $('chkBank').value = banks.includes(chosen) || (chosen === '' && $('chkBank').dataset.ready) ? chosen : (banks[0] ?? '');
  $('chkBank').dataset.ready = '1';
  const { c, total } = appHolds($('chkBank').value);
  const real = parseNumber($('chkReal').value);
  const diff = Math.round((real - total) * 100) / 100;
  $('chkApp').textContent = `Your money list says ${exactMoney(c, total)}.`;
  $('chkLabel').textContent = `What your bank shows (${c})`;
  const has = Number.isFinite(real);
  const off = has && Math.abs(diff) >= 0.5;
  $('chkResult').hidden = !has;
  $('chkFix').hidden = !off;
  if (!has) return;
  $('chkResult').textContent = !off ? 'It matches.'
    : diff < 0 ? `Your bank has ${exactMoney(c, -diff)} less, so you probably forgot some spending.`
      : `Your bank has ${exactMoney(c, diff)} more, so you probably forgot some money coming in.`;
}

function fillMissing() {
  const bank = $('chkBank').value;
  const { c, total } = appHolds(bank);
  const diff = parseNumber($('chkReal').value) - total;
  clearForm(true);
  setKind(diff > 0 ? 'income' : 'expense');
  fillAddCategories();
  $('txAmount').value = Math.round(Math.abs(diff) * 100) / 100;
  $('txCcy').value = c;
  $('txSource').value = bank;
  $('txNote').value = 'To match my bank';
  scrollTo(0, 0);
  focusAmount();
}

function renderAdd() {
  renderQuick();
  renderLatest();
  renderRenames();
  renderCheck();
  refreshFormCategories();
}

function openAddPage() {
  if (editingId === null && !$('txAmount').value) clearForm(true);
  renderAdd();
  focusAmount();
}

function initAdd() {
  document.querySelectorAll('input[name=txKind]').forEach(i => i.addEventListener('change', () => fillAddCategories()));
  $('txCat').addEventListener('change', () => {
    showNewCategoryBox();
    if (!$('txCatNew').hidden) $('txCatNew').focus();
  });
  $('addCancel').addEventListener('click', finishEdit);

  $('addBox').addEventListener('submit', e => {
    e.preventDefault();
    const a = parseNumber($('txAmount').value);
    const d = $('txDate').value;
    const pickOnly = e.submitter?.id === 'addPickOnly';
    if (!(a > 0) && !pickOnly) { $('txMsg').textContent = 'Type an amount.'; return; }
    if (!d && !pickOnly) { $('txMsg').textContent = 'Pick a date.'; return; }
    const t = chosenKind();
    const k = $('txCat').value === NEW_CATEGORY ? categoryName(t, $('txCatNew').value) : $('txCat').value;
    if (!k) { $('txMsg').textContent = 'Type a name for your new one.'; $('txCatNew').focus(); return; }
    const fields = { d, a: a > 0 ? a : 0, c: $('txCcy').value, t, k, n: $('txNote').value.trim().slice(0, 120), s: $('txSource').value.trim().slice(0, 20) };
    const existing = ledger.find(x => x.id === editingId);
    if (existing) {
      Object.assign(existing, fields);
      ledgerChanged();
      showInRange(d.slice(0, 7));
      finishEdit();
      showToast('Saved.');
      return;
    }
    if (pickOnly) showToast(`Made a quick pick for ${fields.n || fields.k}.`, addPick(fields));
    else addItem(fields, e.submitter?.id === 'addBoth' ? addPick(fields) : null);
    clearForm(true);
    focusAmount();
  });

  $('quickList').addEventListener('click', e => {
    const { quick, drop, yes, keep } = e.target.dataset;
    // Yes can land under the mouse, so the second half of a double click must not count.
    if (yes && Date.now() - pickAskedAt < 600) return;
    if (yes) {
      state.quick = state.quick.filter((_, i) => i !== +yes);
      saveState();
    }
    if (drop || yes || keep) {
      pickToRemove = drop ? +drop : -1;
      pickAskedAt = Date.now();
      renderQuick();
    }
    if (quick) usePick(state.quick[+quick]);
  });

  document.addEventListener('click', e => {
    if (pickToRemove < 0 || e.target.closest('#quickList') || !e.target.isConnected) return;
    pickToRemove = -1;
    renderQuick();
  });

  $('latestList').addEventListener('click', e => {
    const x = ledger.find(i => i.id === +e.target.dataset.edit);
    if (x) startEdit(x);
  });

  const rename = e => {
    const { ren, rm, new: fresh } = e.target.dataset;
    if (fresh) nameBox(e.target, '', text => addCategory(fresh, text));
    if (!ren && !rm) return;
    const [t, ...k] = (ren || rm).split('|');
    const name = k.join('|');
    if (ren) nameBox(e.target.closest('li').querySelector('.ren-name'), name, text => renameCategory(t, name, text));
    else {
      state.ownCats[t] = state.ownCats[t].filter(c => c !== name);
      refreshAll();
    }
  };
  $('renOut').addEventListener('click', rename);
  $('renIn').addEventListener('click', rename);

  $('chkBank').addEventListener('change', renderCheck);
  $('chkReal').addEventListener('input', renderCheck);
  $('chkFix').addEventListener('click', fillMissing);
}
