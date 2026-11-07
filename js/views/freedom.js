// Freedom tab: your number, your date, your runway, and how each is worked out.
const TAKE_YEARS = [5, 10, 15, 20, 30];
const YEARS_WITHOUT_AGE = 70;   // what we plan for when we don't know your age
const TRACK_MONTHS = 6;   // how far back we look to see how much you really save

// What you had at the end of each month, from your first item up to today.
function savingsHistory() {
  const flows = {};
  for (const x of ledger) {
    const k = x.d.slice(0, 7);
    flows[k] = (flows[k] || 0) + (x.t === 'income' ? usdOf(x) : -usdOf(x));
  }
  const first = Object.keys(flows).sort()[0];
  if (!first) return [];
  const rows = [];
  let run = 0;
  for (let k = first; k <= thisMonth(); k = Engine.addMonths(k, 1)) {
    run += flows[k] || 0;
    rows.push({ k, usd: Math.max(0, run), net: flows[k] || 0 });
  }
  return rows;
}

// How much you really saved a month lately, counting only finished months.
function realSaving(history) {
  const keys = new Set(fullMonths(TRACK_MONTHS));
  const rows = history.filter(r => keys.has(r.k));
  return rows.length >= 2 ? { months: rows.length, save: rows.reduce((sum, r) => sum + r.net, 0) / rows.length } : null;
}
let freedomView = null;

// The plan needs at least five years to work with.
const soonestLastAge = () => new Date().getFullYear() - state.born + 6;
const fitsLastAge = n => validLastAge(n) !== null && n >= soonestLastAge();

function buildFreedom() {
  const t = tracked();
  const cur = state.cur ?? t.balance;
  const live = state.live ?? t.spend;
  const save = state.save;
  const now = new Date();
  const yearNow = now.getFullYear() + now.getMonth() / 12;
  const months = state.born ? Math.max(60, Math.round((state.born + state.lastAge - yearNow) * 12)) : YEARS_WITHOUT_AGE * 12;

  const rate = state.growOn ? state.grow : 0;

  const hit = Engine.stopMonth({ cur, save, spend: live, months, rate });
  const goalUsd = Engine.needed({ spend: live, months: months - (hit ?? 0), rate });
  const peak = hit === null ? cur : Engine.balanceAt({ cur, save, spend: live, stop: hit, rate }, hit);

  const history = savingsHistory();
  const past = history.map(r => ({ y: -Engine.monthsBetween(r.k, thisMonth()) / 12, mid: r.usd, k: r.k }));
  const from = state.born ? state.born - yearNow : past[0]?.y ?? 0;

  const real = live > 0 && save > 0 && hit !== 0 ? realSaving(history) : null;
  const realHit = real ? Engine.stopMonth({ cur, save: real.save, spend: live, months, rate }) : null;
  const stops = [...new Set([...Array(Math.floor(months / 12) + 1).keys()].map(y => y * 12).concat(months, hit ?? 0, realHit ?? 0))].sort((a, b) => a - b);
  const points = stops.map(m => ({
    m, y: m / 12, spending: hit !== null && m > hit,
    mid: Engine.balanceAt({ cur, save, spend: live, stop: hit, rate }, m),
    real: real ? Engine.balanceAt({ cur, save: real.save, spend: live, stop: realHit, rate }, m) : 0,
  }));
  const spendNow = t.has ? t.spend : live;
  return { t, cur, live, save, months, rate, goalUsd, peak, hit, points, past, from, to: months / 12, yearNow, real, realHit, spendNow, runway: Engine.runway(cur, spendNow) };
}

// The years you typed: how much to save, and how much you need to get paid for that.
function renderOwnYears(f) {
  const { cur, live, months, rate } = f;
  const y = state.freeIn;
  const fits = y !== null && y * 12 < months;
  $('takeUse').hidden = !fits || live <= 0;
  if (y === null) { $('takeAnswer').textContent = ''; return; }
  if (!fits) { $('takeAnswer').textContent = state.born ? `That is past age ${state.lastAge}. Try fewer years.` : 'That is too far away. Try fewer years.'; return; }
  const need = Engine.savingToStop({ cur, spend: live, months, stop: y * 12, rate });
  const year = new Date().getFullYear() + y;
  $('takeUse').dataset.save = need;
  $('takeAnswer').innerHTML = `To be free by ${year}${state.born ? `, when you are ${year - state.born}` : ''}, you need to get paid <b>${money(need + live)} a month</b>. That is ${money(need)} to save and ${money(live)} to spend.`;
}

function renderTake(f) {
  const { cur, live, months, rate } = f;
  $('takeNote').textContent = f.save > 0
    ? 'Pick when you want to get there. You need to get paid enough to cover your saving and your spending.'
    : "You aren't saving right now, so here is what each choice would need. You need to get paid enough to cover your saving and your spending.";
  const rows = TAKE_YEARS.filter(y => y * 12 < months).map(y => {
    const need = Engine.savingToStop({ cur, spend: live, months, stop: y * 12, rate });
    const year = new Date().getFullYear() + y;
    const mine = Math.abs(need - f.save) < 0.5;
    return `<tr class="${mine ? 'me' : ''}"><td>${y} years, by ${year}${state.born ? ` (age ${year - state.born})` : ''}</td><td class="num-col">${money(need)}</td><td class="num-col">${money(live)}</td><td class="num-col amt">${money(need + live)}</td><td class="acts">${mine ? 'Your plan' : `<button type="button" data-save="${need}">Use this</button>`}</td></tr>`;
  }).join('');
  $('takeTable').innerHTML = `<thead><tr><th>To get there in</th><th class="num-col">Save a month</th><th class="num-col">Spend a month</th><th class="num-col">Get paid a month</th><th></th></tr></thead><tbody>${rows}</tbody>`;
}

function renderTrack(f) {
  const { real, realHit, save } = f;
  $('track').hidden = !real;
  $('lgReal').hidden = !real;
  $('lgPast').hidden = !f.past.length;
  if (!real) return;
  const on = real.save >= save;
  const saved = real.save > 0
    ? `You saved ${money(real.save)} a month over the last ${real.months} months`
    : `Over the last ${real.months} months you spent more than you got`;
  const goes = realHit === null ? 'At your real speed you would not reach your goal.' : `At your real speed you get there around ${dateIn(realHit)}${atAge(realHit)}.`;
  $('track').className = `track ${on ? 'on' : 'off'}`;
  $('track').innerHTML = `<b>${on ? '✓ On track.' : '! Off track.'}</b> ${saved}, and your plan says ${money(save)}. ${goes}`;
}

function renderFreedom() {
  const f = buildFreedom();
  const { t, cur, live, save, rate, goalUsd, hit } = f;
  const u = unit();

  $('headline').textContent = goalUsd > 0 ? `You need ${bigMoney(goalUsd)}.` : 'How much do you want to spend each month?';
  const lastsUntil = state.born ? `until you are ${state.lastAge},` : `for ${YEARS_WITHOUT_AGE} years from today,`;
  let path = '';
  if (goalUsd > 0) {
    if (hit === 0) path = 'You already have enough.';
    else if (hit !== null) path = `If you save ${money(save)} a month, you get there around ${dateIn(hit)}${atAge(hit)}.`;
    else path = "You aren't saving right now, so we can't give a date yet.";
  }
  $('lede').textContent = goalUsd > 0
    ? `That is enough to spend ${money(live)} a month ${lastsUntil} without a job${rate ? `, if your savings grow ${rate}% a year` : ''}. You have ${money(cur)} today. ${path}`
    : 'Type it below and your goal will show here.';

  const frac = goalUsd > 0 ? Math.min(1, cur / goalUsd) : 0;
  const crest = $('crest');
  const length = crest.getTotalLength();
  if (length) {
    const pt = crest.getPointAtLength(frac * length);
    $('you').setAttribute('cx', pt.x);
    $('you').setAttribute('cy', pt.y);
  }
  $('progress').textContent = frac >= 1 ? 'You have reached the top.' : `You are ${frac < 0.1 ? (frac * 100).toFixed(1) : Math.round(frac * 100)}% of the way up.`;

  // Results
  $('dateV').textContent = hit === null ? 'No date yet' : hit === 0 ? 'Now' : dateIn(hit);
  $('dateV').className = `v${hit === null ? ' bad' : ''}`;
  $('dateD').textContent = hit === null ? 'See what it would take below.' : hit === 0 ? 'You have reached your goal.' : `${duration(hit)} from now${atAge(hit)}.`;
  $('runV').textContent = f.runway === Infinity ? 'No limit' : f.runway >= 120 ? '10+ years' : f.runway === 0 ? 'Under a month' : duration(f.runway);
  $('runD').textContent = 'If no money comes in.';
  $('tileRun').classList.toggle('first', save <= 0 && hit !== 0);
  const left = f.months - (hit ?? 0);
  $('potV').textContent = state.born ? `Until age ${state.lastAge}` : duration(left);
  $('potD').textContent = hit === null ? 'Once you get there, you spend your savings.' : `You spend ${money(live)} a month for ${duration(left)}.`;

  // How each result is worked out
  const until = state.born ? `until you are ${state.lastAge}` : `until ${YEARS_WITHOUT_AGE} years from today`;
  const growing = `growing ${rate}% a year`;
  $('numHow').innerHTML = rate
    ? `<code>${money(live)} a month for ${fmt(left)} months, ${growing} = ${money(goalUsd)}</code>
    <p>Your savings keep growing while you spend them, so you need less than ${money(live * left)}, which is what those months cost. That is your goal.</p>
    <p>The ${rate}% is a guess. If your money grows less, your goal is too small. Press Sit still to see the plan with no guess.</p>`
    : `<code>${money(live)} × ${fmt(left)} months = ${money(goalUsd)}</code>
    <p>Take what you spend in a month. Times the months from the day you stop ${until}. That is your goal.</p>
    <p>We don't count any growth, so nothing here depends on a guess about the future. The later you stop, the fewer months you need to pay for, so the goal gets smaller.</p>`;
  $('dateHow').innerHTML = hit > 0
    ? `<code>${money(cur)} + ${money(save)} a month for ${fmt(hit)} months${rate ? `, ${growing}` : ''} = ${money(f.peak)}</code>
    <p>Each month we add what you save${rate ? ' and what your savings grew' : ''}. The date is the first month your savings can pay for all the months left.</p>`
    : '<p>Each month we add what you save. The date is the first month your savings can pay for all the months left.</p>';
  $('runHow').innerHTML = `<code>${money(cur)} ÷ ${money(f.spendNow)} = ${f.spendNow > 0 ? (cur / f.spendNow).toFixed(1) : 'no limit'} months</code>
    <p>That is your savings divided by what you spend each month.</p>`;
  $('potHow').innerHTML = rate
    ? `<code>${money(goalUsd)}, ${growing}, pays ${money(live)} a month for ${fmt(left)} months</code>
    <p>Once you stop, you take out what you spend each month, and what is left keeps growing until the money is gone.</p>`
    : `<code>${money(goalUsd)} ÷ ${money(live)} = ${fmt(left)} months</code>
    <p>Once you stop, you take out what you spend each month until the money is gone.</p>`;
  $('planNote').textContent = rate
    ? `We count your savings growing ${rate}% a year on top of rising prices. That is a guess: real years can be better or worse, and some years you lose money. All these numbers are in today's prices. This is to help you plan, not advice from a money expert.`
    : "We don't count any growth, and all these numbers are in today's prices, so your savings need to keep up with rising prices. This is to help you plan, not advice from a money expert.";

  // Input hints
  $('curHint').textContent = state.cur === null && t.has ? 'Worked out from your money list.' : '';
  $('liveHint').textContent = state.live === null && t.has ? "What you spent in a normal month over the last year, at today's prices. Money moved between your banks and money you got back don't count, because you didn't really spend them." : '';
  $('saveHint').textContent = save <= 0 ? 'Type what you plan to save, or pick a choice further down.' : '';
  $('curAuto').hidden = !t.has || state.cur === null;
  $('liveAuto').hidden = !t.has || state.live === null;
  $('curAuto').textContent = `Use what I have (${money(t.balance)})`;
  $('liveAuto').textContent = `Use my normal month (${money(t.spend)})`;

  const focused = document.activeElement;
  const set = (id, v) => { if (focused !== $(id)) $(id).value = v; };
  set('fCur', fmt(cur * u));
  set('fSave', fmt(save * u));
  set('fLive', fmt(live * u));
  set('fPay', fmt((save + live) * u));
  set('fYears', hit === null ? '' : +(hit / 12).toFixed(1));
  const typedPay = focused === $('fPay') ? parseNumber($('fPay').value) / u : NaN;
  const typedYears = focused === $('fYears') ? parseNumber($('fYears').value) : NaN;
  $('payHint').textContent = typedPay < live ? 'That is less than you want to spend, so nothing is left to save.' : 'What you spend plus what you save.';
  $('yearsHint').textContent = typedYears * 12 >= f.months ? (state.born ? `That is past age ${state.lastAge}. Try fewer years.` : 'That is too far away. Try fewer years.') : hit === null ? 'Type a number and we work out what to save.' : '';
  set('fBorn', state.born ?? '');
  set('fAge', state.lastAge);
  $('ageRow').hidden = !state.born;
  const typedAge = focused === $('fAge') ? Number($('fAge').value) : NaN;
  $('ageHint').textContent = typedAge && !fitsLastAge(typedAge) ? `Pick an age from ${soonestLastAge()} to ${MAX_LAST_AGE}.` : 'Your money runs out at this age, so pick one you are sure to pass.';
  set('takeYears', state.freeIn ?? '');
  set('fGrow', state.grow);
  document.querySelector(`input[name="growMode"][value="${state.growOn ? 'grow' : 'still'}"]`).checked = true;
  $('growRow').hidden = !state.growOn;
  document.querySelectorAll('.uMine').forEach(e => { e.textContent = state.ccy; });

  renderTake(f);
  renderOwnYears(f);
  renderTrack(f);
  freedomView = f;
  drawGrowth(f);
}

function initFreedom() {
  const edit = (id, apply) => {
    $(id).addEventListener('input', () => {
      const n = parseNumber($(id).value);
      if (Number.isFinite(n)) { apply(Math.max(0, n)); saveState(); renderFreedom(); }
    });
    $(id).addEventListener('blur', renderFreedom);
  };
  $('fBorn').addEventListener('input', () => {
    state.born = validBirthYear(Number($('fBorn').value));
    saveState();
    renderFreedom();
  });
  $('fBorn').addEventListener('blur', renderFreedom);
  $('fAge').addEventListener('input', () => {
    const n = Number($('fAge').value);
    if (fitsLastAge(n)) { state.lastAge = n; saveState(); }
    renderFreedom();
  });
  $('fAge').addEventListener('blur', renderFreedom);
  document.querySelectorAll('input[name="growMode"]').forEach(r => r.addEventListener('change', () => {
    state.growOn = r.value === 'grow';
    saveState();
    renderFreedom();
  }));
  $('fGrow').addEventListener('input', () => {
    const n = validGrowth(parseNumber($('fGrow').value));
    if (n === null) return;
    state.grow = n;
    saveState();
    renderFreedom();
  });
  $('fGrow').addEventListener('blur', renderFreedom);
  $('takeYears').addEventListener('input', () => {
    const y = Math.floor(parseNumber($('takeYears').value));
    state.freeIn = y > 0 ? y : null;
    saveState();
    renderFreedom();
  });
  $('takeUse').addEventListener('click', () => {
    state.save = +$('takeUse').dataset.save;
    saveState();
    renderFreedom();
  });
  edit('fCur', n => { state.cur = n / unit(); });
  edit('fSave', n => { state.save = n / unit(); });
  edit('fLive', n => { state.live = n / unit(); });
  edit('fPay', n => { state.save = Math.max(0, n / unit() - freedomView.live); });
  edit('fYears', y => {
    const { cur, live, months, rate } = freedomView;
    if (y > 0 && y * 12 < months) state.save = Engine.savingToStop({ cur, spend: live, months, stop: Math.max(1, Math.round(y * 12)), rate });
  });
  $('liveAuto').addEventListener('click', () => { state.live = null; saveState(); renderFreedom(); });
  $('curAuto').addEventListener('click', () => { state.cur = null; saveState(); renderFreedom(); });
  $('takeTable').addEventListener('click', e => {
    const need = +e.target.dataset.save;
    if (!e.target.dataset.save) return;
    state.save = need;
    saveState();
    renderFreedom();
  });
}
