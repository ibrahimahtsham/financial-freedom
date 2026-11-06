// Freedom tab: your number, your date, your runway, and how each is worked out.
const TAKE_YEARS = [5, 10, 15, 20, 30];
const YEARS_AHEAD = Engine.MAX_MONTHS / 12;
const LAST_AGE = 100;   // with a birth year, the timeline ends here
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

function buildFreedom() {
  const t = tracked();
  const cur = state.cur ?? t.balance;
  const live = state.live ?? t.spend;
  const save = state.save;
  const goalUsd = Engine.freedomNumber(live);
  const input = { cur, save, goal: goalUsd };
  const hit = Engine.project({ ...input, ret: state.ret }).hit;
  const lo = Math.max(0, state.ret - RETURN_SPREAD);
  const hi = state.ret + RETURN_SPREAD;
  const hitLo = Engine.project({ ...input, ret: lo }).hit;
  const hitHi = Engine.project({ ...input, ret: hi }).hit;
  const now = new Date();
  const yearNow = now.getFullYear() + now.getMonth() / 12;
  const history = savingsHistory();
  const past = history.map(r => ({ y: -Engine.monthsBetween(r.k, thisMonth()) / 12, mid: r.usd, k: r.k }));
  const from = state.born ? state.born - yearNow : past[0]?.y ?? 0;
  const to = state.born ? Math.max(5, state.born + LAST_AGE - yearNow) : YEARS_AHEAD;
  const span = Math.ceil(to);
  const run = ret => Engine.project({ cur, save, ret, months: span * 12 }).series;
  const [mid, low, high] = [run(state.ret), run(lo), run(hi)];
  const real = goalUsd > 0 && save > 0 && hit !== 0 ? realSaving(history) : null;
  const realRun = real ? Engine.project({ cur, save: real.save, ret: state.ret, months: span * 12 }).series : [];
  const points = Array.from({ length: span + 1 }, (_, y) => ({ y, mid: mid[y * 12], lo: low[y * 12], hi: high[y * 12], real: realRun[y * 12] }));
  const realHit = real ? Engine.project({ ...input, save: real.save, ret: state.ret }).hit : null;
  const spendNow = t.has ? t.spend : live;
  return { t, cur, live, save, goalUsd, hit, lo, hi, hitLo, hitHi, points, past, from, to, yearNow, real, realHit, spendNow, runway: Engine.runway(cur, spendNow) };
}

const orTooLong = m => (m === null ? `over ${YEARS_AHEAD} years` : duration(m));

function renderTake(f) {
  const { cur, goalUsd, spendNow } = f;
  $('takeNote').textContent = f.save > 0
    ? 'Pick when you want to get there. You need to get paid enough to cover your saving and your spending.'
    : "You aren't saving right now, so here is what each choice would need. You need to get paid enough to cover your saving and your spending.";
  const rows = TAKE_YEARS.map(y => {
    const need = Engine.savingFor({ cur, ret: state.ret, goal: goalUsd, months: y * 12 });
    const year = new Date().getFullYear() + y;
    const mine = Math.abs(need - f.save) < 0.5;
    return `<tr class="${mine ? 'me' : ''}"><td>${y} years, by ${year}${state.born ? ` (age ${year - state.born})` : ''}</td><td class="num-col">${money(need)}</td><td class="num-col">${money(spendNow)}</td><td class="num-col amt">${money(need + spendNow)}</td><td class="acts">${mine ? 'Your plan' : `<button type="button" data-save="${need}">Use this</button>`}</td></tr>`;
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
  const { t, cur, live, save, goalUsd, hit } = f;
  const u = unit();
  const monthlyPct = (Engine.monthlyRate(state.ret) * 100).toFixed(2);

  $('headline').textContent = goalUsd > 0 ? `You need ${bigMoney(goalUsd)}.` : 'How much do you want to spend each month?';
  let path = '';
  if (goalUsd > 0) {
    if (hit === 0) path = 'You already have enough.';
    else if (hit !== null) path = `If you save ${money(save)} a month, you get there around ${dateIn(hit)}${atAge(hit)}.`;
    else if (save <= 0) path = "You aren't saving right now, so we can't give a date yet.";
    else path = `At this speed it takes over ${YEARS_AHEAD} years.`;
  }
  $('lede').textContent = goalUsd > 0
    ? `If you put that much somewhere it can grow, it could pay you ${money(live)} a month for 30 years or more, without a job. You have ${money(cur)} today. ${path}`
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
  const pays = cur / Engine.FREEDOM_MULTIPLE / 12;
  $('potV').textContent = `${money(pays)} a month`;
  $('potD').textContent = live > 0 ? `That is ${Math.round(Math.min(1, pays / live) * 100)}% of what you want to spend.` : 'If you stopped adding to it today.';

  // How each result is worked out
  const yearly = live * 12;
  $('numHow').innerHTML = `<code>${money(live)} × 12 × ${Engine.FREEDOM_MULTIPLE} = ${money(goalUsd)}</code>
    <p>Take what you spend in a month. Times 12 gives you a year. Times 25 gives you your goal.</p>
    <p>Why 25? A well-known guide called the 4% rule says that if you only take out about 4% of your money each year, it has usually lasted 30 years or more. So 4% of your goal, ${money(yearly)}, pays for one year.</p>
    <p>If you plan to stop working young, your money has to last longer. Taking out only 3.5% a year is safer, and your goal would be ${bigMoney(yearly / 0.035)}.</p>`;
  const own = hit ? cur + save * hit : cur;
  const growth = Math.max(0, goalUsd - own);
  $('dateHow').innerHTML = `<code>Next month's savings = savings × (1 + ${monthlyPct}%) + ${money(save)}</code>
    <p>Each month your savings grow a little: ${state.ret}% a year is ${monthlyPct}% a month. Then we add what you save. This repeats until you reach your goal.</p>
    ${hit > 0 ? `<p>You put in ${money(Math.min(own, goalUsd))}, and growth adds about ${money(growth)}. Nobody knows the real growth: at ${f.hi}% it takes ${orTooLong(f.hitHi)}, and at ${f.lo}% it takes ${orTooLong(f.hitLo)}.</p>` : ''}`;
  $('runHow').innerHTML = `<code>${money(cur)} ÷ ${money(f.spendNow)} = ${f.spendNow > 0 ? (cur / f.spendNow).toFixed(1) : 'no limit'} months</code>
    <p>That is your savings divided by what you spend each month. We don't count any growth here, to be safe.</p>`;
  $('potHow').innerHTML = `<code>${money(cur)} ÷ ${Engine.FREEDOM_MULTIPLE} ÷ 12 = ${money(pays)}</code>
    <p>This is the 4% rule backwards: 4% of your savings each year, split into 12 months.</p>`;

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
  set('fRet', String(state.ret));
  set('fBorn', state.born ?? '');
  $('fRetR').value = state.ret;
  document.querySelectorAll('#retChips button').forEach(b => b.classList.toggle('on', +b.dataset.ret === state.ret));
  document.querySelectorAll('.uMine').forEach(e => { e.textContent = state.ccy; });

  $('lgMid').textContent = `Growing ${state.ret}% a year`;
  $('lgBand').textContent = `If it grows ${f.lo}% to ${f.hi}%`;
  renderTake(f);
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
  edit('fCur', n => { state.cur = n / unit(); });
  edit('fSave', n => { state.save = n / unit(); });
  edit('fLive', n => { state.live = n / unit(); });
  edit('fRet', n => { state.ret = Math.min(20, n); });
  $('fRetR').addEventListener('input', () => {
    state.ret = +$('fRetR').value;
    saveState();
    renderFreedom();
  });
  $('retChips').addEventListener('click', e => {
    if (!e.target.dataset.ret) return;
    state.ret = +e.target.dataset.ret;
    saveState();
    renderFreedom();
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
