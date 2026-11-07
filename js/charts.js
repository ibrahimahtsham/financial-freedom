// SVG charts. Anything with a data-tip attribute gets the shared hover box.
function gridStep(top, lines) {
  const raw = top / lines;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= raw);
}

function yGrid(y, top, lines, left, right) {
  const step = gridStep(top, lines);
  let o = '';
  for (let v = 0; v <= top; v += step) {
    o += `<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${left - 8}" y="${y(v) + 4}" text-anchor="end">${shortNumber(v)}</text>`;
  }
  return o;
}

function setChart(box, W, H, markup) {
  box.setAttribute('viewBox', `0 0 ${W} ${H}`);
  box.setAttribute('height', H);
  box.innerHTML = markup;
}

const chartWidth = box => Math.max(280, box.parentElement.clientWidth);

// Income and spending side by side, for each month or each day of one month.
function drawInOut(rows) {
  const box = $('inOut');
  if (!box.parentElement.clientWidth || !rows.length) return;
  const W = chartWidth(box), H = 260, L = 52, R = 8, T = 10, B = 24;
  const top = Math.max(...rows.flatMap(r => [r.in, r.out]), 1) * 1.1;
  const y = v => T + (1 - v / top) * (H - T - B);
  const slot = (W - L - R) / rows.length;
  const bar = Math.max(2, Math.min(24, (slot - 4) / 2));
  const every = Math.ceil(rows.length / (W < 480 ? 3 : 8));
  let o = yGrid(y, top, 4, L, W - R);
  rows.forEach((r, i) => {
    const x = L + i * slot + (slot - bar * 2 - 2) / 2;
    const isDay = r.k.length > 7;
    const tip = `${isDay ? dayName(r.k) : monthName(r.k)}\nIn: ${state.ccy} ${fmt(r.in)}\nOut: ${state.ccy} ${fmt(r.out)}`;
    if (r.in > 0) o += `<rect fill="var(--in)" x="${x}" y="${y(r.in)}" width="${bar}" height="${H - B - y(r.in)}" rx="2"/>`;
    if (r.out > 0) o += `<rect fill="var(--out)" x="${x + bar + 2}" y="${y(r.out)}" width="${bar}" height="${H - B - y(r.out)}" rx="2"/>`;
    o += `<rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${H - T - B}" data-tip="${esc(tip)}" data-${isDay ? 'day' : 'month'}="${r.k}"/>`;
    if (i % every === 0) o += `<text x="${L + i * slot + 2}" y="${H - 6}">${isDay ? +r.k.slice(8) : monthName(r.k)}</text>`;
  });
  setChart(box, W, H, o);
}

function drawBalance(rows) {
  const box = $('balance');
  if (!box.parentElement.clientWidth || !rows.length) return;
  const W = chartWidth(box), H = 260, L = 52, R = 12, T = 10, B = 24;
  const top = Math.max(...rows.map(r => r.v), 1) * 1.1;
  const y = v => T + (1 - Math.max(0, v) / top) * (H - T - B);
  const x = i => L + (rows.length > 1 ? (i / (rows.length - 1)) * (W - L - R) : 0);
  const every = Math.ceil(rows.length / (W < 480 ? 3 : 8));
  let o = yGrid(y, top, 3, L, W - R);
  const line = rows.map((r, i) => `${x(i)},${y(r.v)}`).join(' ');
  o += `<polygon points="${x(0)},${y(0)} ${line} ${x(rows.length - 1)},${y(0)}" fill="var(--accent-soft)"/>`;
  o += `<polyline points="${line}" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round"/>`;
  const slot = (W - L - R) / Math.max(1, rows.length - 1);
  rows.forEach((r, i) => {
    const isDay = r.k.length > 7;
    o += `<rect class="hit" x="${x(i) - slot / 2}" y="${T}" width="${slot}" height="${H - T - B}" data-tip="${esc(`${isDay ? dayName(r.k) : monthName(r.k)}\n${state.ccy} ${fmt(r.v)}`)}"/>`;
    if (i % every === 0) o += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${isDay ? +r.k.slice(8) : monthName(r.k)}</text>`;
  });
  setChart(box, W, H, o);
}

// One square per day, darker for more spending. Levels come from the person's own spread.
function calendarStrip(days, level, startDate, endDate, step) {
  const gap = 3, size = step - gap, top = 16, left = 2;
  const start = new Date(`${startDate}T12:00:00`);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(`${endDate}T12:00:00`);
  let o = '';
  let lastMonth = -1;
  let col = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 && d > start) col += 1;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso < startDate) continue;
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      o += `<text x="${left + col * step}" y="10">${d.toLocaleDateString('en-US', { month: 'short' })}</text>`;
    }
    const v = (days[iso] || 0) * unit();
    o += `<rect class="day l${level(days[iso] || 0)}" x="${left + col * step}" y="${top + d.getDay() * step}" width="${size}" height="${size}" rx="2" data-day="${iso}" data-tip="${esc(`${dayName(iso)}\n${v > 0 ? `${state.ccy} ${fmt(v)}` : 'No spending'}`)}"/>`;
  }
  const W = left + (col + 1) * step + 24;   // room for a month label on the last column
  const H = top + 7 * step;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Spending for each day from ${startDate} to ${endDate}">${o}</svg>`;
}

function drawCalendar(days, strips) {
  const spent = Object.values(days).filter(v => v > 0).sort((a, b) => a - b);
  const cut = q => spent[Math.floor(spent.length * q)] ?? 0;
  const cuts = [cut(0.25), cut(0.5), cut(0.75)];
  const level = v => (v <= 0 ? 0 : 1 + cuts.filter(c => v > c).length);
  const weeks = Math.max(...strips.map(s => Math.ceil((Date.parse(s.to) - Date.parse(s.from)) / 6048e5) + 2));
  const room = $('calendar').parentElement.clientWidth - 28;
  const step = Math.max(14, Math.min(28, Math.floor(room / weeks)));
  $('calendar').innerHTML = strips.map(s => `<div class="cal-year">${s.label ? `<h3>${s.label}</h3>` : ''}${calendarStrip(days, level, s.from, s.to, step)}</div>`).join('');
}

let growthView = null;

function drawGrowth(m) {
  const box = $('chart');
  if (!m || !box.parentElement.clientWidth) return;
  const { points, past, from, to, yearNow, goalUsd, real } = m;
  const u = unit();
  const W = chartWidth(box), H = W < 480 ? 240 : 380, L = 52, R = 24, T = 14, B = 26;
  const top = Math.max(goalUsd, ...points.map(p => Math.max(p.mid, p.real)), ...past.map(p => p.mid), 1 / u) * u * 1.15;
  const x = t => L + ((t - from) / (to - from)) * (W - L - R);
  const y = v => T + (1 - (v * u) / top) * (H - T - B);
  const yv = v => T + (1 - v / top) * (H - T - B);
  const line = (rows, key, attrs) => `<polyline points="${rows.map(p => `${x(p.y)},${y(p[key])}`).join(' ')}" fill="none" stroke-width="2" stroke-linejoin="round" ${attrs}/>`;
  let o = yGrid(yv, top, 4, L, W - R);
  const every = W < 480 ? 20 : 10;
  const base = state.born ?? 0;   // ticks land on round ages or round years
  const firstTick = Math.ceil((yearNow + from - base) / every) * every;
  for (let v = firstTick; v + base <= yearNow + to + 0.01; v += every) o += `<text x="${x(v + base - yearNow)}" y="${H - 6}" text-anchor="middle">${state.born ? `Age ${v}` : v}</text>`;
  if (goalUsd > 0) o += `<line x1="${L}" x2="${W - R}" y1="${y(goalUsd)}" y2="${y(goalUsd)}" stroke="var(--goal)" stroke-width="2" stroke-dasharray="5 4"/><text class="goalt" x="${L + 6}" y="${y(goalUsd) + 16}">Goal: ${money(goalUsd)}</text>`;
  if (from < 0) o += `<line x1="${x(0)}" x2="${x(0)}" y1="${T}" y2="${H - B}" stroke="var(--line)"/><text x="${x(0) + 6}" y="${H - B - 6}">Today</text>`;
  if (real) o += line(points, 'real', 'stroke="var(--muted)" stroke-dasharray="2 4"');
  o += line(points, 'mid', 'stroke="var(--in)"');
  if (past.length) o += line(past, 'mid', 'stroke="var(--fg)"');
  o += `<line id="cross" y1="${T}" y2="${H - B}" stroke="var(--muted)" visibility="hidden"/><circle id="dot" r="5" fill="var(--in)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>`;
  setChart(box, W, H, o);
  const stops = [...past, ...points.filter(p => p.y > 0 || !past.length)];
  growthView = { stops, x, y, W };
}

function growthHover(e) {
  if (!growthView) return;
  const { stops, x, y, W } = growthView;
  const rect = $('chart').getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  let p = stops[0];
  for (const q of stops) if (Math.abs(x(q.y) - px) < Math.abs(x(p.y) - px)) p = q;
  $('cross').setAttribute('x1', x(p.y));
  $('cross').setAttribute('x2', x(p.y));
  $('cross').setAttribute('visibility', 'visible');
  $('dot').setAttribute('cx', x(p.y));
  $('dot').setAttribute('cy', y(p.mid));
  $('dot').setAttribute('visibility', 'visible');
  const months = Math.round(p.y * 12);
  const when = `${state.born ? `Age ${ageIn(months)}, ` : ''}${p.k ? monthName(p.k) : dateIn(months)}`;
  showTip(`${when}\n${p.k ? 'You had' : p.spending ? 'Left to spend' : 'Savings'}: ${money(p.mid)}`, e.clientX, e.clientY);
}

function growthLeave() {
  if ($('cross')) {
    $('cross').setAttribute('visibility', 'hidden');
    $('dot').setAttribute('visibility', 'hidden');
  }
  hideTip();
}

function showTip(text, cx, cy) {
  const tip = $('hoverTip');
  tip.textContent = text;
  tip.hidden = false;
  const width = tip.offsetWidth, height = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, cx + 14))}px`;
  tip.style.top = `${cy - height - 12 < 8 ? cy + 16 : cy - height - 12}px`;
}
const hideTip = () => { $('hoverTip').hidden = true; };

function initCharts() {
  document.addEventListener('pointermove', e => {
    const tip = e.target.closest?.('[data-tip]');
    if (tip) showTip(tip.dataset.tip, e.clientX, e.clientY);
    else if (!e.target.closest?.('#growthBox')) hideTip();
  });
  $('growthBox').addEventListener('pointermove', growthHover);
  $('growthBox').addEventListener('pointerleave', growthLeave);
}
