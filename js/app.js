// Starts the app and ties the tabs together.
const TABS = ['overview', 'plan', 'money', 'settings'];
let activeTab = 'overview';
let model = null;

function currencyOptions() {
  const names = new Intl.DisplayNames(['en'], { type: 'currency' });
  const label = c => {
    try { return names.of(c); } catch (e) { return c; }
  };
  const option = c => `<option value="${c}">${esc(label(c))} (${c})</option>`;
  const top = POPULAR_CURRENCIES.filter(knownCurrency);
  const rest = Object.keys(rates.r).sort().filter(c => !POPULAR_CURRENCIES.includes(c));
  const html = `<optgroup label="Common">${top.map(option).join('')}</optgroup>${rest.length ? `<optgroup label="All">${rest.map(option).join('')}</optgroup>` : ''}`;
  ['ccy', 'dest', 'wCcy', 'txCcy'].forEach(id => {
    const select = $(id);
    const value = select.value;
    select.innerHTML = html;
    if (value) select.value = value;
  });
}

// Pushes saved values into every control.
function paint() {
  if (!state.started) return;
  const u = unit();
  const focused = document.activeElement;
  const set = (id, v) => { if (focused !== $(id)) $(id).value = v; };
  set('cur', fmt(state.cur * u));
  for (const k of Object.keys(LOCAL_FIELDS)) set(k, fmt(state[k]));
  set('side', fmt(state.side * planRate()));
  for (const k in PERCENT_FIELDS) {
    $(`${k}R`).value = state[k];
    set(k, String(state[k]));
  }
  const pair = planRate() / u;
  set('fx', pair.toFixed(pair < 1 ? 4 : 2));
  set('place', state.place);
  document.querySelectorAll('.uMine').forEach(e => { e.textContent = state.ccy; });
  document.querySelectorAll('.uPlan').forEach(e => { e.textContent = planCurrency(); });
  document.querySelector(`input[name=move][value=${state.move ? 'move' : 'stay'}]`).checked = true;
  document.querySelector(`input[name=home][value=${state.home}]`).checked = true;
  $('ccy').value = state.ccy;
  $('dest').value = state.dest;
  $('fxAuto').checked = state.fxAuto;
  $('goalYR').value = state.goalY;
  $('fxLabel').textContent = `${planCurrency()} per 1 ${state.ccy}`;
}

// Saves, recalculates and redraws whatever depends on the plan.
function refresh() {
  saveState();
  if (!state.started) return;
  model = buildModel();
  renderOverview(model);
  renderPlan(model);
  renderSettings(model);
  $('dockA').textContent = bigMoney(model.goal);
  $('dockB').textContent = model.hit === null ? 'No date yet' : model.hit === 0 ? 'Done' : dateIn(model.hit);
}

function showTab(name) {
  activeTab = TABS.includes(name) ? name : 'overview';
  for (const t of TABS) {
    const on = t === activeTab;
    $(`view-${t}`).hidden = !on;
    const tab = $(`tab-${t}`);
    tab.setAttribute('aria-selected', on);
    tab.tabIndex = on ? 0 : -1;
  }
  writeStored(TAB_KEY, activeTab);
  if (location.hash !== `#${activeTab}`) history.replaceState(null, '', `#${activeTab}`);
  if (activeTab === 'overview') drawGrowth(model);
  if (activeTab === 'money' && ledger.length) renderBars();
}

function showApp() {
  $('welcome').hidden = state.started;
  $('app').hidden = !state.started;
  $('dock').hidden = !state.started;
  if (!state.started) return;
  paint();
  renderStages();
  refresh();
  renderMoney();
  showTab(activeTab);
}

function loadRates() {
  refreshRates(() => {
    currencyOptions();
    renderRateNote();
    if (state.started && rateState === 'live') {
      paint();
      renderStages();
      refresh();
      renderMoney();
    }
  });
}

function resetWelcome() {
  $('wForm').reset();
  $('wCcy').value = 'USD';
  $('wErr').hidden = true;
}

function initWelcome() {
  $('wImport').addEventListener('click', () => $('planFile').click());
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
    state.dest = state.ccy;
    const u = unit();
    state.cur = Math.max(0, parseNumber($('wCur').value) || 0) / u;
    state.stages = [{ id: uid(), name: 'Now', from: '', income: Math.max(0, parseNumber($('wIncome').value) || 0) / u, spend: spend / u }];
    state.started = true;
    activeTab = 'overview';
    showApp();
    scrollTo(0, 0);
    if (!readStored(TOUR_KEY, false)) openTour();
  });
}

function initTabs() {
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
}

function boot() {
  initPlan();
  initSettings();
  initMoney();
  initTutorial();
  initWelcome();
  initTabs();
  currencyOptions();
  const start = knownCurrency(state.ccy) ? state.ccy : 'USD';
  $('wCcy').value = start;
  $('txCcy').value = start;
  $('txDate').value = new Date().toISOString().slice(0, 10);
  if (state.started && !state.stages.length) state.started = false;
  activeTab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : readStored(TAB_KEY, 'overview');
  $('chartbox').addEventListener('pointermove', growthHover);
  $('chartbox').addEventListener('pointerleave', growthLeave);
  new ResizeObserver(() => {
    if (activeTab === 'overview') drawGrowth(model);
    if (activeTab === 'money' && ledger.length) renderBars();
  }).observe($('app'));
  showApp();
  loadRates();
}

boot();
