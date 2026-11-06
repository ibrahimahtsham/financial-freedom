// Settings tab: currency, assumptions, exchange rate and your data.
function renderRateNote() {
  const updated = new Date(rates.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  $('retry').hidden = rateState !== 'failed' || !state.fxAuto;
  $('rateNote').textContent = !state.fxAuto ? 'You are using your own exchange rate.'
    : rateState === 'loading' ? "Getting today's exchange rate."
      : rateState === 'live' ? `Live exchange rate from ${updated}.`
        : `No connection, so this is the exchange rate from ${updated}.`;
}

function renderSettings(m) {
  $('wrH').textContent = `4% is the usual rule, tested on 30-year retirements. Stopping young, 3.5% is safer and needs ${bigMoney(goalFor(state.home, { wr: 3.5 }))}.`;
  $('rateBox').hidden = !crossBorder();
  renderRateNote();
}

function exportPlan() {
  const blob = new Blob([JSON.stringify(planFile(), null, 1)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `financial-freedom-plan-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  $('toolNote').textContent = 'Plan saved to your downloads.';
}

function sayFileProblem(message) {
  if (state.started) $('toolNote').textContent = message;
  else {
    $('wErr').textContent = message;
    $('wErr').hidden = false;
  }
}

async function importPlan(file) {
  try {
    if (file.size > 2e7) throw new Error('too big');
    const j = JSON.parse(await file.text());
    if (j.app !== APP_ID || !j.plan || typeof j.plan !== 'object') throw new Error('wrong file');
    const next = { ...cleanState(j.plan), started: true };
    if (!next.stages.length) throw new Error('no stages');
    state = next;
    ledger = cleanLedger(j.history);
    saveLedger();
    txShown = 50;
    writeStored(TOUR_KEY, true);
    showApp();
    $('toolNote').textContent = `Loaded ${file.name}.`;
  } catch (e) {
    sayFileProblem('That file is not a Financial Freedom plan.');
  }
}

function initSettings() {
  $('pctFields').innerHTML = Object.entries(PERCENT_FIELDS).map(([k, f]) => `<div class="field"><label for="${k}">${f.label}</label><div class="row"><input type="range" id="${k}R" aria-label="${f.label}" min="${f.min}" max="${f.max}" step="${f.step}"><span class="num"><span class="unit">%</span><input type="text" id="${k}" inputmode="decimal"></span></div><p class="hint" id="${k}H">${f.hint}</p></div>`).join('');
  $('fxField').innerHTML = `<div class="line"><label for="fx" id="fxLabel"></label>${numberBox('fx', 'uPlan')}</div>`;

  for (const k in PERCENT_FIELDS) {
    const f = PERCENT_FIELDS[k];
    const set = v => {
      const n = parseNumber(v);
      if (!Number.isFinite(n)) return;
      state[k] = Math.max(f.min, n);
      refresh();
      if (k === 'infl') $('lgByCcy').textContent = spendingByCurrency();
    };
    $(k).addEventListener('input', () => { $(`${k}R`).value = $(k).value; set($(k).value); });
    $(`${k}R`).addEventListener('input', () => { $(k).value = $(`${k}R`).value; set($(`${k}R`).value); });
    $(k).addEventListener('blur', paint);
  }

  $('fx').addEventListener('input', () => {
    const n = parseNumber($('fx').value);
    if (!(n > 0)) return;
    state.fxAuto = false;
    state.fx = n;
    $('fxAuto').checked = false;
    refresh();
  });
  $('fx').addEventListener('blur', paint);
  $('fxAuto').addEventListener('change', () => {
    const current = planRate() / unit();
    state.fxAuto = $('fxAuto').checked;
    if (!state.fxAuto) state.fx = current;
    paint();
    refresh();
  });
  $('ccy').addEventListener('change', () => {
    state.ccy = $('ccy').value;
    $('txCcy').value = state.ccy;
    paint();
    renderStages();
    refresh();
    renderMoney();
  });
  $('retry').addEventListener('click', loadRates);
  $('exportBtn').addEventListener('click', exportPlan);
  $('importBtn').addEventListener('click', () => $('planFile').click());
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
    resetWelcome();
    showApp();
    scrollTo(0, 0);
  });
}
