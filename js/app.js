// Starts the app, and handles tabs, the top bar and saving files.
const TABS = ['money', 'freedom'];
let activeTab = 'money';

function currencyOptions() {
  const names = new Intl.DisplayNames(['en'], { type: 'currency' });
  const label = c => {
    try { return names.of(c); } catch (e) { return c; }
  };
  const option = c => `<option value="${c}">${esc(label(c))} (${c})</option>`;
  const top = POPULAR_CURRENCIES.filter(knownCurrency);
  const rest = Object.keys(rates.r).sort().filter(c => !POPULAR_CURRENCIES.includes(c));
  const html = `<optgroup label="Common">${top.map(option).join('')}</optgroup>${rest.length ? `<optgroup label="All">${rest.map(option).join('')}</optgroup>` : ''}`;
  ['ccy', 'wCcy', 'txCcy'].forEach(id => {
    const select = $(id);
    const value = select.value;
    select.innerHTML = html;
    if (value) select.value = value;
  });
}

function renderRateNote() {
  const updated = new Date(rates.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  $('retry').hidden = rateState !== 'failed';
  $('rateNote').textContent = rateState === 'live' ? `Live exchange rates from ${updated}.`
    : rateState === 'loading' ? 'Getting exchange rates.'
      : `No connection, so these are the rates from ${updated}.`;
}

function refreshAll() {
  saveState();
  if (!state.started) return;
  $('ccy').value = state.ccy;
  document.querySelector(`input[name=priceView][value=${state.real ? 'today' : 'paid'}]`).checked = true;
  moneyControls();
  renderRateNote();
  renderFreedom();
  renderMoney();
}

function moneyControls() {
  const hide = activeTab !== 'money' || !ledger.length;
  $('realWrap').hidden = hide;
  $('rangeBox').hidden = hide;
  $('addOpen').hidden = activeTab !== 'money';
}

function showTab(name) {
  activeTab = TABS.includes(name) ? name : 'money';
  for (const t of TABS) {
    const on = t === activeTab;
    $(`view-${t}`).hidden = !on;
    const tab = $(`tab-${t}`);
    tab.setAttribute('aria-selected', on);
    tab.tabIndex = on ? 0 : -1;
  }
  writeStored(TAB_KEY, activeTab);
  if (location.hash !== `#${activeTab}`) history.replaceState(null, '', `#${activeTab}`);
  moneyControls();
  if (state.started) (activeTab === 'money' ? renderMoney : renderFreedom)();
}

function showApp() {
  $('welcome').hidden = state.started;
  $('app').hidden = !state.started;
  if (!state.started) return;
  renderRange();
  showTab(activeTab);
  refreshAll();
}

function fetchData() {
  refreshRates(() => {
    currencyOptions();
    if (state.started) refreshAll();
    else renderRateNote();
  });
  refreshInflation(ledger.map(x => x.c), () => { if (state.started) refreshAll(); });
}

function downloadFile(name, text, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportPlan() {
  downloadFile(`financial-freedom-plan-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(planFile(), null, 1), 'application/json');
  $('menuNote').textContent = 'Plan saved to your downloads.';
}

let toastTimer = 0;
function showToast(text, undo) {
  $('toastText').textContent = text;
  $('toastUndo').hidden = !undo;
  $('toastUndo').onclick = () => {
    $('toast').hidden = true;
    undo();
  };
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, undo ? 6000 : 2500);
}

async function importPlan(file) {
  try {
    if (file.size > 2e7) throw new Error('too big');
    const j = JSON.parse(await file.text());
    if (j.app !== APP_ID || !j.plan || typeof j.plan !== 'object') throw new Error('wrong file');
    state = { ...cleanState(j.plan), started: true };
    ledger = cleanLedger(j.history);
    saveLedger();
    txFilter = defaultTxFilter();
    txPage = 0;
    writeStored(TOUR_KEY, true);
    writeStored(RANGE_KEY, null);
    activeTab = ledger.length ? 'money' : 'freedom';
    showApp();
    refreshInflation(ledger.map(x => x.c), refreshAll);
    $('menuNote').textContent = `Loaded ${file.name}.`;
  } catch (e) {
    const message = 'That file is not a Financial Freedom plan.';
    if (state.started) $('menuNote').textContent = message;
    else {
      $('wErr').textContent = message;
      $('wErr').hidden = false;
    }
  }
}

function initWelcome() {
  $('wForm').addEventListener('submit', e => {
    e.preventDefault();
    const spend = parseNumber($('wSpend').value);
    if (!(spend > 0)) {
      $('wErr').textContent = 'Enter what you spend in a month to continue.';
      $('wErr').hidden = false;
      $('wSpend').focus();
      return;
    }
    $('wErr').hidden = true;
    state.ccy = $('wCcy').value;
    $('txCcy').value = state.ccy;
    const u = unit();
    const income = Math.max(0, parseNumber($('wIncome').value) || 0);
    state.cur = Math.max(0, parseNumber($('wCur').value) || 0) / u;
    state.live = spend / u;
    state.save = Math.max(0, income - spend) / u;
    state.started = true;
    activeTab = 'freedom';
    showApp();
    scrollTo(0, 0);
    if (!readStored(TOUR_KEY, false)) openTour();
  });
}

function initTopBar() {
  $('tabs').addEventListener('click', e => {
    const tab = e.target.closest('[role=tab]');
    if (tab) showTab(tab.dataset.tab);
  });
  $('tabs').addEventListener('keydown', e => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const next = TABS[(TABS.indexOf(activeTab) + step + TABS.length) % TABS.length];
    showTab(next);
    $(`tab-${next}`).focus();
  });
  addEventListener('hashchange', () => showTab(location.hash.slice(1)));

  $('ccy').addEventListener('change', () => {
    state.ccy = $('ccy').value;
    $('txCcy').value = state.ccy;
    refreshAll();
  });
  document.querySelectorAll('input[name=priceView]').forEach(i => i.addEventListener('change', () => {
    state.real = i.value === 'today';
    refreshAll();
  }));
  document.addEventListener('click', e => { if (!$('menu').contains(e.target)) $('menu').open = false; });
  $('retry').addEventListener('click', fetchData);
  $('exportBtn').addEventListener('click', exportPlan);
  $('importBtn').addEventListener('click', () => $('planFile').click());
  $('wImport').addEventListener('click', () => $('planFile').click());
  $('planFile').addEventListener('change', () => {
    const file = $('planFile').files[0];
    $('planFile').value = '';
    if (file) importPlan(file);
  });

  let armed = 0;
  $('reset').addEventListener('click', () => {
    const button = $('reset');
    if (!armed) {
      button.textContent = 'Click again to erase everything';
      armed = setTimeout(() => { button.textContent = 'Start over'; armed = 0; }, 4000);
      return;
    }
    clearTimeout(armed);
    armed = 0;
    button.textContent = 'Start over';
    state = defaultState();
    ledger = [];
    saveState();
    saveLedger();
    $('wForm').reset();
    $('wCcy').value = 'USD';
    $('wErr').hidden = true;
    $('menu').open = false;
    showApp();
    scrollTo(0, 0);
  });
}

function boot() {
  initCharts();
  initRange();
  initTable();
  initMoney();
  initFreedom();
  initTutorial();
  initWelcome();
  initTopBar();
  currencyOptions();
  const start = knownCurrency(state.ccy) ? state.ccy : 'USD';
  $('wCcy').value = start;
  $('txCcy').value = start;
  $('txDate').value = new Date().toISOString().slice(0, 10);
  fillAddCategories();
  const hash = location.hash.slice(1);
  activeTab = TABS.includes(hash) ? hash : readStored(TAB_KEY, ledger.length ? 'money' : 'freedom');
  let width = 0;
  new ResizeObserver(entries => {
    const next = entries[0].contentRect.width;
    if (!state.started || next === width) return;
    width = next;
    if (activeTab === 'money' && ledger.length) queueMoneyRender();
    if (activeTab === 'freedom' && freedomView) drawGrowth(freedomView);
  }).observe($('app'));
  showApp();
  fetchData();
}

boot();
