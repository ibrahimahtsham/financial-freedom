// Overview tab: your number, your date, your runway and the stops along the way.
function renderOverview(m) {
  const s = state;
  const inPlace = s.move && s.place ? ` in ${s.place}` : '';
  const also = planCurrency() !== s.ccy ? ` That is ${mine(m.goalUsd)}.` : '';
  $('headline').textContent = m.goal > 0 ? `Your number is ${bigMoney(m.goal)}.` : 'Your work income already covers your costs.';
  let path;
  if (m.goal <= 0) path = '';
  else if (m.hit === 0) path = 'You already have enough.';
  else if (m.hit === null) path = 'Your plan does not get there yet, so add a stage with income on the Plan tab.';
  else path = `On your plan, you get there around ${dateIn(m.hit)}.`;
  $('lede').textContent = m.goal <= 0
    ? 'You would not need a pot at all, as long as that income keeps coming in.'
    : `That is what you need invested to cover your costs${inPlace} for good.${also} You have ${mine(s.cur)} today. ${path}`;

  const frac = m.goalUsd > 0 ? Math.min(1, s.cur / m.goalUsd) : 1;
  const crest = $('crest');
  const length = crest.getTotalLength();
  if (length) {
    const pt = crest.getPointAtLength(frac * length);
    $('you').setAttribute('cx', pt.x);
    $('you').setAttribute('cy', pt.y);
  }
  $('progress').textContent = frac >= 1 ? 'You have reached the top.' : `You are ${frac < 0.1 ? (frac * 100).toFixed(1) : Math.round(frac * 100)}% of the way up.`;

  // With no income right now, what matters most is how long the savings last.
  const earning = m.now.income > 0;
  const flow = m.now.income - m.now.spend;
  $('tiles').classList.toggle('runway-first', !earning);
  $('dateV').textContent = m.hit === null ? 'No date yet' : m.hit === 0 ? 'Now' : dateIn(m.hit);
  $('dateV').className = `v${m.hit === null ? ' bad' : ''}`;
  $('dateD').textContent = m.hit === null ? 'Add income on the Plan tab.' : m.hit === 0 ? 'You have reached your number.' : `${duration(m.hit)} from now.`;
  $('runH').textContent = earning ? 'If your income stopped' : 'Your savings last';
  $('runV').textContent = m.runway === Infinity ? 'No limit' : m.runway >= 120 ? '10+ years' : m.runway === 0 ? 'Under a month' : duration(m.runway);
  $('runD').textContent = `At ${mine(m.now.spend)} a month, without counting growth.`;
  $('nowV').textContent = `${mine(Math.abs(flow))} a month`;
  $('nowH').textContent = flow >= 0 ? 'You are saving' : 'You are using up';
  $('nowD').textContent = m.now.name ? `Stage: ${m.now.name}` : 'Your current stage';

  const notes = [];
  if (m.ranOut !== null) notes.push(`Your savings run out around ${dateIn(m.ranOut)} on this plan.`);
  if (m.hit > 0) notes.push(`Returns are never certain. At ${m.hi}% it takes ${m.hitHi === null ? 'more than 60 years' : duration(m.hitHi)}. At ${m.lo}% it takes ${m.hitLo === null ? 'more than 60 years' : duration(m.hitLo)}.`);
  $('range').textContent = notes.join(' ');

  $('lgMid').textContent = `Pot at ${s.ret}%`;
  $('lgBand').textContent = `${m.lo}% to ${m.hi}%`;
  drawGrowth(m);
  renderStops(m);
}

function renderStops(m) {
  const s = state;
  const stops = [
    { t: m.goalUsd / 2, l: 'Halfway', d: `${mine(m.goalUsd / 2)} in the pot.` },
    { t: m.now.spend * 3, l: 'Safety cushion ready', d: `${mine(m.now.spend * 3)}, which is 3 months of spending. Keep this in cash before you invest, and clear any high-interest debt first.` },
  ];
  const housing = s.move && s.home === 'rent' ? s.mRent : 0;
  if (housing > 0) stops.push({ t: Engine.potFor(housing, s.wr) / m.rate, l: 'Your pot pays your housing', d: `It could pay ${planMoney(housing)} a month from here on.` });
  if (s.move && s.home === 'buy' && s.price > 0) stops.push({ t: s.price / m.rate, l: 'You can afford the home', d: `${bigMoney(s.price)} in the pot. Buying now would pause the rest of the plan.` });
  const route = stops.filter(p => p.t > 0 && p.t < m.goalUsd).sort((a, b) => a.t - b.t);
  route.push({ t: m.goalUsd, l: 'Financial freedom', d: 'The pot covers your monthly costs for good.' });
  $('steps').innerHTML = route.map(p => {
    const months = monthsToReach(p.t);
    const label = months === 0 ? 'Done' : months === null ? 'Not yet' : dateIn(months);
    return `<li class="${months === 0 ? 'done' : ''}"><span class="when">${label}</span><span class="what">${p.l}<small>${p.d}</small></span></li>`;
  }).join('');
}
