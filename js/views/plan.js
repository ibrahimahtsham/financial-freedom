// Plan tab: savings, life stages, where you'll live, and what-if comparisons.
const LOCAL_FIELDS = { mRent: 'Monthly rent', mOther: 'Everything else each month', price: 'Home price', own: 'Monthly costs once you own' };

const numberBox = (id, unitClass) => `<span class="num"><span class="unit ${unitClass}"></span><input type="text" id="${id}" inputmode="decimal"></span>`;
const fieldLine = (id, label, unitClass) => `<div class="line"><label for="${id}">${label}</label>${numberBox(id, unitClass)}</div>`;

function renderStages() {
  const u = unit();
  $('stages').innerHTML = state.stages.map((s, i) => `
    <li class="stage" data-id="${s.id}">
      <div class="stage-head">
        <input class="textin" data-f="name" type="text" maxlength="40" aria-label="Stage name" placeholder="Name this stage" value="${esc(s.name)}">
        ${i === 0 ? '<span class="hint">Starts now</span>' : `<input class="textin month" data-f="from" type="month" aria-label="Start month" value="${esc(s.from)}"><button type="button" class="x" data-act="remove">Remove</button>`}
      </div>
      <div class="stage-nums">
        <div class="pick"><label>Income a month</label><span class="num"><span class="unit uMine">${state.ccy}</span><input type="text" inputmode="decimal" data-f="income" aria-label="Income a month" value="${fmt(s.income * u)}"></span></div>
        <div class="pick"><label>Spending a month</label><span class="num"><span class="unit uMine">${state.ccy}</span><input type="text" inputmode="decimal" data-f="spend" aria-label="Spending a month" value="${fmt(s.spend * u)}"></span></div>
      </div>
      <p class="hint" data-net></p>
    </li>`).join('');
  stageNets();
}

function stageNets() {
  document.querySelectorAll('#stages .stage').forEach(row => {
    const s = state.stages.find(x => x.id === row.dataset.id);
    if (!s) return;
    const flow = s.income - s.spend;
    row.querySelector('[data-net]').textContent = flow > 0 ? `Saves ${mine(flow)} a month.` : flow < 0 ? `Uses ${mine(-flow)} a month from your savings.` : 'Breaks even.';
  });
}

function sortStages() {
  const [first, ...rest] = state.stages;
  state.stages = [first, ...rest.sort((a, b) => (a.from || '9').localeCompare(b.from || '9'))];
}

function renderPlan(m) {
  const s = state;
  $('moveFields').hidden = !s.move;
  $('rentFields').hidden = s.home !== 'rent';
  $('buyFields').hidden = s.home !== 'buy';
  stageNets();

  const stepLater = tidy(m.later * 0.1) || tidy(100 * m.rate);
  $('sideH').textContent = `Every ${planMoney(stepLater)} a month you earn takes ${bigMoney(Engine.potFor(stepLater, s.wr))} off your number.`;

  const months = s.goalY * 12;
  const extra = Engine.extraToFinish(planInput({ goal: m.goalUsd, months }));
  $('goalH').textContent = `To finish in ${s.goalY} ${s.goalY === 1 ? 'year' : 'years'}`;
  $('needV').textContent = extra > 0 ? `${mine(extra)} more a month` : 'You are on track';
  $('needD').textContent = extra > 0 ? 'On top of what your stages already save.' : 'Your stages get you there in time.';

  renderLevers(m);
  renderIncomeTest(m);
  renderCompare(m);
  renderYears(m);
}

function renderLevers(m) {
  const s = state;
  $('moves').hidden = m.hit === 0 || m.goal <= 0;
  const times = Math.round(1000 / s.wr) / 10;
  const stepCut = tidy(m.later * 0.05) || tidy(50 * m.rate);
  $('movesNote').textContent = `Your number is ${times} times your yearly costs${s.move && s.home === 'buy' && s.price ? ', plus the home' : ''}. So every ${planMoney(stepCut)} a month you cut takes ${bigMoney(Engine.potFor(stepCut, s.wr))} off it.`;
  const u = m.unit;
  const gain = months => {
    if (months === null) return 'Still too long';
    if (m.hit === null) return `Done around ${dateIn(months)}`;
    return m.hit - months > 0 ? `${duration(m.hit - months)} sooner` : 'No change';
  };
  const biggest = Math.max(...s.stages.map(x => x.income));
  const more = (tidy(biggest * 0.1 * u) || tidy(100 * u)) / u;
  const less = (tidy(m.now.spend * 0.1 * u) || tidy(50 * u)) / u;
  const rows = [];
  if (biggest > 0) rows.push({ l: `Earn ${mine(more)} more and save it`, d: 'Keep your spending the same when your pay goes up.', m: monthsToReach(m.goalUsd, { incomeAdd: more }) });
  if (!s.move) {
    const low = goalFor(s.home, { cutNow: less }) / m.rate;
    rows.push({ l: `Spend ${mine(less)} less a month`, d: `You save more, and your number drops by ${bigMoney(m.goal - low * m.rate)}.`, m: monthsToReach(low, { spendCut: less }) });
  } else {
    rows.push({ l: `Spend ${mine(less)} less a month now`, d: 'Saves it every month until you move.', m: monthsToReach(m.goalUsd, { spendCut: less }) });
    const low = goalFor(s.home, { cutLater: stepCut });
    rows.push({ l: `Need ${planMoney(stepCut)} less a month later`, d: `Takes ${bigMoney(m.goal - low)} off your number.`, m: monthsToReach(low / m.rate) });
  }
  $('levers').innerHTML = rows.map(r => `<li><span class="what">${r.l}<small>${r.d}</small></span><span class="when">${gain(r.m)}</span></li>`).join('');
}

// What-if: this income from next month onward. Later stages keep their spending.
function withIncome(incomeUsd) {
  const from = Engine.addMonths(thisMonth(), 1);
  const stages = state.stages.filter((s, i) => i === 0 || s.from !== from);
  const earlier = stages.filter((s, i) => i === 0 || (s.from && s.from < from));
  const later = stages.filter(s => !earlier.includes(s)).map(s => ({ ...s, income: incomeUsd }));
  const spend = Engine.stageAt(state.stages, from).spend;
  return [...earlier, { id: uid(), name: 'New income', from, income: incomeUsd, spend }, ...later];
}

function renderIncomeTest(m) {
  const u = m.unit;
  const spend = state.stages[state.stages.length - 1].spend;
  const base = Math.max(spend, 100);
  const custom = parseNumber($('testIncome').value);
  const list = [2, 4, 6, 8, 12, 16].map(k => tidy(base * k * u) / u);
  if (custom > 0) list.push(custom / u);
  const rows = [...new Set(list)].sort((a, b) => a - b);
  $('salaries').innerHTML = `<thead><tr><th>Monthly income</th><th>You save</th><th>Time</th><th>Done around</th><th></th></tr></thead><tbody>${rows.map(income => {
    const sv = income - spend;
    const months = Engine.simulate(planInput({ stages: withIncome(income), goal: m.goalUsd })).hit;
    const mark = custom > 0 && Math.abs(income - custom / u) < 0.01;
    return `<tr class="${mark ? 'me' : ''}"><td>${mine(income)}</td><td>${sv > 0 ? mine(sv) : 'Nothing'}</td><td>${months === null ? 'Too long' : duration(months)}</td><td>${months === null ? '' : dateIn(months)}</td><td><button type="button" data-income="${income}">Use this</button></td></tr>`;
  }).join('')}</tbody>`;
}

function renderCompare(m) {
  const s = state;
  const show = s.move && s.price > 0;
  $('cmpFold').hidden = !show;
  if (!show) return;
  const rent = goalFor('rent'), buy = goalFor('buy');
  const away = months => (months === null ? 'No date yet.' : `Done around ${dateIn(months)}.`);
  $('cmpRentV').textContent = bigMoney(rent);
  $('cmpBuyV').textContent = bigMoney(buy);
  $('cmpRentD').textContent = away(monthsToReach(rent / m.rate));
  $('cmpBuyD').textContent = `Includes the home. ${away(monthsToReach(buy / m.rate))}`;
  $('cmpRent').classList.toggle('on', s.home === 'rent');
  $('cmpBuy').classList.toggle('on', s.home === 'buy');
  const diff = rent - buy;
  const lead = Math.abs(diff) < rent * 0.01 ? 'Both plans need about the same.' : diff > 0 ? `Buying needs ${bigMoney(diff)} less overall.` : `Renting needs ${bigMoney(diff)} less overall.`;
  $('cmpNote').textContent = `${lead} A home is harder to sell than a fund is, so try the area first if you can.`;
}

function renderYears(m) {
  const year = new Date().getFullYear();
  const shown = m.points.filter(p => m.hit === null || p.y <= Math.ceil(m.hit / 12));
  $('yearly').innerHTML = `<thead><tr><th>Year</th><th>Pot</th><th>Your money</th><th>Growth</th><th>Pays per month</th></tr></thead><tbody>${shown.map(p => `<tr><td>${year + p.y}</td><td>${mine(p.mid)}</td><td>${mine(p.own)}</td><td>${mine(Math.max(0, p.mid - p.own))}</td><td>${planMoney(p.mid * m.rate * (state.wr / 100) / 12)}</td></tr>`).join('')}</tbody>`;
}

function initPlan() {
  $('rentFields').innerHTML = fieldLine('mRent', LOCAL_FIELDS.mRent, 'uPlan') + fieldLine('mOther', LOCAL_FIELDS.mOther, 'uPlan');
  $('buyFields').innerHTML = fieldLine('price', LOCAL_FIELDS.price, 'uPlan') + fieldLine('own', LOCAL_FIELDS.own, 'uPlan');
  $('sideField').innerHTML = fieldLine('side', 'Income from light work', 'uPlan');
  $('curField').innerHTML = fieldLine('cur', 'Savings right now', 'uMine');

  for (const id of Object.keys(LOCAL_FIELDS)) {
    $(id).addEventListener('input', () => {
      const n = parseNumber($(id).value);
      if (Number.isFinite(n)) { state[id] = Math.max(0, n); refresh(); }
    });
    $(id).addEventListener('blur', paint);
  }
  $('cur').addEventListener('input', () => {
    const n = parseNumber($('cur').value);
    if (Number.isFinite(n)) { state.cur = Math.max(0, n) / unit(); refresh(); }
  });
  $('side').addEventListener('input', () => {
    const n = parseNumber($('side').value);
    if (Number.isFinite(n)) { state.side = Math.max(0, n) / planRate(); refresh(); }
  });
  ['cur', 'side'].forEach(id => $(id).addEventListener('blur', paint));

  $('place').addEventListener('input', () => { state.place = $('place').value; refresh(); });
  document.querySelectorAll('input[name=move]').forEach(i => i.addEventListener('change', () => { state.move = i.value === 'move'; paint(); refresh(); }));
  document.querySelectorAll('input[name=home]').forEach(i => i.addEventListener('change', () => { state.home = i.value; paint(); refresh(); }));
  $('dest').addEventListener('change', () => { state.dest = $('dest').value; state.fxAuto = true; paint(); refresh(); });
  $('goalYR').addEventListener('input', () => { state.goalY = +$('goalYR').value; refresh(); });
  $('testIncome').addEventListener('input', refresh);

  const list = $('stages');
  list.addEventListener('input', e => {
    const f = e.target.dataset.f;
    const s = state.stages.find(x => x.id === e.target.closest('.stage')?.dataset.id);
    if (!f || !s) return;
    if (f === 'name') s.name = e.target.value;
    else if (f === 'from') s.from = e.target.value;
    else {
      const n = parseNumber(e.target.value);
      if (!Number.isFinite(n)) return;
      s[f] = Math.max(0, n) / unit();
    }
    refresh();
  });
  list.addEventListener('change', e => {
    if (e.target.dataset.f === 'from') { sortStages(); renderStages(); refresh(); }
  });
  list.addEventListener('click', e => {
    if (e.target.dataset.act !== 'remove') return;
    const id = e.target.closest('.stage').dataset.id;
    state.stages = state.stages.filter(x => x.id !== id);
    renderStages();
    refresh();
  });
  $('addStage').addEventListener('click', () => {
    const last = state.stages[state.stages.length - 1];
    const from = Engine.addMonths(last.from || thisMonth(), 12);
    state.stages.push({ id: uid(), name: '', from, income: last.income, spend: last.spend });
    renderStages();
    refresh();
    list.querySelector('.stage:last-child input')?.focus();
  });
  $('salaries').addEventListener('click', e => {
    const income = +e.target.dataset.income;
    if (!income) return;
    state.stages = withIncome(income);
    renderStages();
    refresh();
  });
}
