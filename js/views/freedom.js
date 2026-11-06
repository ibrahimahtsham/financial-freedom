// Freedom tab: your number, your date, your runway, and how each is worked out.
const liveOn = t => state.live ?? t.spend;
const savingNow = t => state.save ?? Math.max(0, t.income - t.spend);

function buildFreedom() {
  const t = tracked();
  const live = liveOn(t);
  const save = savingNow(t);
  const goalUsd = Engine.freedomNumber(live);
  const input = { cur: state.cur, save, goal: goalUsd };
  const hit = Engine.project({ ...input, ret: state.ret }).hit;
  const lo = Math.max(0, state.ret - RETURN_SPREAD);
  const hi = state.ret + RETURN_SPREAD;
  const hitLo = Engine.project({ ...input, ret: lo }).hit;
  const hitHi = Engine.project({ ...input, ret: hi }).hit;
  const span = Math.min(40, Math.max(5, Math.ceil(((hit ?? hitLo ?? 240) / 12) + 1)));
  const run = ret => Engine.project({ cur: state.cur, save, ret, months: span * 12 }).series;
  const [mid, low, high] = [run(state.ret), run(lo), run(hi)];
  const points = Array.from({ length: span + 1 }, (_, y) => ({ y, mid: mid[y * 12], lo: low[y * 12], hi: high[y * 12] }));
  const spendNow = t.has ? t.spend : live;
  return { t, live, save, goalUsd, hit, lo, hi, hitLo, hitHi, points, spendNow, runway: Engine.runway(state.cur, spendNow) };
}

const moreThanSixty = m => (m === null ? 'over 60 years' : duration(m));

function renderFreedom() {
  const f = buildFreedom();
  const { t, live, save, goalUsd, hit } = f;
  const u = unit();
  const monthlyPct = (Engine.monthlyRate(state.ret) * 100).toFixed(2);

  $('headline').textContent = goalUsd > 0 ? `Your number is ${bigMoney(goalUsd)}.` : 'What do you want to live on?';
  let path = '';
  if (goalUsd > 0) {
    if (hit === 0) path = 'You already have enough.';
    else if (hit !== null) path = `Saving ${money(save)} a month gets you there around ${dateIn(hit)}.`;
    else if (save <= 0) path = 'Enter what you expect to save to see your date.';
    else path = 'At this pace it takes over 60 years.';
  }
  $('lede').textContent = goalUsd > 0
    ? `That is what you need invested for it to pay your costs for good. You have ${money(state.cur)} today. ${path}`
    : 'Enter it below and your number will show here.';

  const frac = goalUsd > 0 ? Math.min(1, state.cur / goalUsd) : 0;
  const crest = $('crest');
  const length = crest.getTotalLength();
  if (length) {
    const pt = crest.getPointAtLength(frac * length);
    $('you').setAttribute('cx', pt.x);
    $('you').setAttribute('cy', pt.y);
  }
  $('progress').textContent = frac >= 1 ? 'You have reached the top.' : `You are ${frac < 0.1 ? (frac * 100).toFixed(1) : Math.round(frac * 100)}% of the way up.`;

  // Results
  $('numV').textContent = bigMoney(goalUsd);
  $('dateV').textContent = hit === null ? 'No date yet' : hit === 0 ? 'Now' : dateIn(hit);
  $('dateV').className = `v${hit === null ? ' bad' : ''}`;
  $('dateD').textContent = hit === null ? (save <= 0 ? 'Enter what you expect to save.' : 'Over 60 years away.') : hit === 0 ? 'You have reached your number.' : `${duration(hit)} from now.`;
  $('runV').textContent = f.runway === Infinity ? 'No limit' : f.runway >= 120 ? '10+ years' : f.runway === 0 ? 'Under a month' : duration(f.runway);
  $('runD').textContent = 'If your income stopped today.';
  $('numD').textContent = `To live on ${money(live)} a month.`;
  $('tiles').classList.toggle('runway-first', save <= 0 && hit !== 0);

  // How each result is worked out
  const yearly = live * 12;
  $('numHow').innerHTML = `<code>${money(live)} × 12 × ${Engine.FREEDOM_MULTIPLE} = ${money(goalUsd)}</code>
    <p>That is your monthly costs, times 12 for a year, times 25. The 25 comes from the 4% rule: if you take out about 4% of your money each year, it has historically lasted at least 30 years. So 4% of your number, ${money(yearly)}, covers one year.</p>
    <p>If you plan to stop young, a safer 3.5% means multiplying by about 28.6, which makes it ${bigMoney(yearly / 0.035)}.</p>`;
  const own = hit ? state.cur + save * hit : state.cur;
  const growth = Math.max(0, goalUsd - own);
  $('dateHow').innerHTML = `<code>Next month's pot = pot × (1 + ${monthlyPct}%) + ${money(save)}</code>
    <p>Each month your pot earns its return, which is ${state.ret}% a year or ${monthlyPct}% a month, and then your saving is added. This repeats until it reaches your number.</p>
    ${hit > 0 ? `<p>You put in ${money(Math.min(own, goalUsd))}, and growth adds about ${money(growth)}. Returns are never certain: at ${f.hi}% it takes ${moreThanSixty(f.hitHi)}, and at ${f.lo}% it takes ${moreThanSixty(f.hitLo)}.</p>` : ''}`;
  $('runHow').innerHTML = `<code>${money(state.cur)} ÷ ${money(f.spendNow)} = ${f.spendNow > 0 ? (state.cur / f.spendNow).toFixed(1) : 'no limit'} months</code>
    <p>That is your savings divided by your monthly spending${t.has ? ', which comes from your last 6 full months' : ''}. It leaves out any growth, to be on the safe side.</p>`;

  // Input hints
  const tracking = t.has;
  $('liveHint').textContent = state.live === null ? (tracking ? 'From your last 6 full months.' : '') : 'What you plan to live on once you stop working.';
  $('saveHint').textContent = state.save === null ? (tracking ? 'From your last 6 full months.' : '') : '';
  $('liveAuto').hidden = !tracking || state.live === null;
  $('saveAuto').hidden = !tracking || state.save === null;
  $('liveAuto').textContent = `Use my average (${money(t.spend)})`;
  $('saveAuto').textContent = `Use my average (${money(Math.max(0, t.income - t.spend))})`;

  const focused = document.activeElement;
  const set = (id, v) => { if (focused !== $(id)) $(id).value = v; };
  set('fCur', fmt(state.cur * u));
  set('fSave', fmt(save * u));
  set('fLive', fmt(live * u));
  set('fRet', String(state.ret));
  $('fRetR').value = state.ret;
  document.querySelectorAll('.uMine').forEach(e => { e.textContent = state.ccy; });

  $('lgMid').textContent = `Pot at ${state.ret}%`;
  $('lgBand').textContent = `${f.lo}% to ${f.hi}%`;
  freedomView = f;
  drawGrowth(f);
}

let freedomView = null;

function initFreedom() {
  const edit = (id, apply) => {
    $(id).addEventListener('input', () => {
      const n = parseNumber($(id).value);
      if (Number.isFinite(n)) { apply(Math.max(0, n)); saveState(); renderFreedom(); }
    });
    $(id).addEventListener('blur', renderFreedom);
  };
  edit('fCur', n => { state.cur = n / unit(); });
  edit('fSave', n => { state.save = n / unit(); });
  edit('fLive', n => { state.live = n / unit(); });
  edit('fRet', n => { state.ret = Math.min(20, n); });
  $('fRetR').addEventListener('input', () => {
    state.ret = +$('fRetR').value;
    saveState();
    renderFreedom();
  });
  $('liveAuto').addEventListener('click', () => { state.live = null; saveState(); renderFreedom(); });
  $('saveAuto').addEventListener('click', () => { state.save = null; saveState(); renderFreedom(); });
}
