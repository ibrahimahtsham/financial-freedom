// SVG charts: the growth line on Overview and the monthly bars on Money.
function gridStep(top, lines) {
  const raw = top / lines;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= raw);
}

let growthView = null;

function drawGrowth(m) {
  const box = $('chart');
  const holder = $('chartbox');
  if (!m || !holder.clientWidth) return;
  const { points, goalUsd, unit: u } = m;
  const W = Math.max(280, holder.clientWidth - 16);
  const H = W < 480 ? 240 : 300;
  const L = 52, R = 24, T = 18, B = 26;
  const maxX = points[points.length - 1].y;
  const goal = goalUsd * u;
  const top = Math.max(goal * 1.15, points[points.length - 1].mid * u * 1.05, points[0].mid * u * 1.15, 1);
  const x = t => L + (t / maxX) * (W - L - R);
  const y = v => T + (1 - Math.min(v * u, top) / top) * (H - T - B);
  const step = gridStep(top, 4);
  let o = '';
  for (let v = 0; v <= top; v += step) {
    const py = y(v / u);
    o += `<line x1="${L}" x2="${W - R}" y1="${py}" y2="${py}" stroke="var(--line)"/><text x="${L - 8}" y="${py + 4}" text-anchor="end">${shortNumber(v)}</text>`;
  }
  const year = new Date().getFullYear();
  const every = Math.ceil(maxX / (W < 480 ? 4 : 8));
  for (let t = 0; t <= maxX; t += every) o += `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${year + t}</text>`;

  let lastLabel = -Infinity;
  for (const stage of state.stages.slice(1)) {
    if (!stage.from) continue;
    const at = Engine.monthsBetween(thisMonth(), stage.from) / 12;
    if (at <= 0 || at >= maxX) continue;
    const px = x(at);
    o += `<line x1="${px}" x2="${px}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="2 4"/>`;
    if (px - lastLabel > 110 && px < W - 120) {
      const label = stage.name.length > 20 ? `${stage.name.slice(0, 19)}…` : stage.name;
      o += `<text x="${px + 5}" y="${T + 2}">${esc(label)}</text>`;
      lastLabel = px;
    }
  }

  const band = points.map(p => `${x(p.y)},${y(p.hi)}`).concat(points.slice().reverse().map(p => `${x(p.y)},${y(p.lo)}`)).join(' ');
  o += `<polygon points="${band}" fill="var(--accent-soft)"/>`;
  o += `<line x1="${L}" x2="${W - R}" y1="${y(goalUsd)}" y2="${y(goalUsd)}" stroke="var(--goal)" stroke-width="2" stroke-dasharray="5 4"/><text class="goalt" x="${L + 6}" y="${y(goalUsd) + 16}">Goal: ${mine(goalUsd)}</text>`;
  o += `<polyline points="${points.map(p => `${x(p.y)},${y(p.mid)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  o += `<line id="cross" y1="${T}" y2="${H - B}" stroke="var(--muted)" visibility="hidden"/><circle id="dot" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>`;
  box.setAttribute('viewBox', `0 0 ${W} ${H}`);
  box.setAttribute('height', H);
  box.innerHTML = o;
  growthView = { points, x, y, W, rate: m.rate };
}

function growthHover(e) {
  if (!growthView) return;
  const { points, x, y, W, rate } = growthView;
  const holder = $('chartbox');
  const rect = $('chart').getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  let p = points[0];
  for (const q of points) if (Math.abs(x(q.y) - px) < Math.abs(x(p.y) - px)) p = q;
  const cross = $('cross'), dot = $('dot'), tip = $('tip');
  cross.setAttribute('x1', x(p.y));
  cross.setAttribute('x2', x(p.y));
  cross.setAttribute('visibility', 'visible');
  dot.setAttribute('cx', x(p.y));
  dot.setAttribute('cy', y(p.mid));
  dot.setAttribute('visibility', 'visible');
  tip.innerHTML = `<b>${new Date().getFullYear() + p.y}</b><div><span>Pot</span><span>${mine(p.mid)}</span></div><div><span>Your money</span><span>${mine(p.own)}</span></div><div><span>Growth</span><span>${mine(Math.max(0, p.mid - p.own))}</span></div><div><span>Pays per month</span><span>${planMoney(p.mid * rate * (state.wr / 100) / 12)}</span></div>`;
  tip.style.display = 'block';
  const left = (x(p.y) / W) * holder.clientWidth;
  const width = tip.offsetWidth;
  tip.style.left = `${left + width + 18 > holder.clientWidth ? left - width - 10 : left + 10}px`;
}

function growthLeave() {
  if ($('cross')) {
    $('cross').setAttribute('visibility', 'hidden');
    $('dot').setAttribute('visibility', 'hidden');
  }
  $('tip').style.display = 'none';
}

function drawBars(keys, values) {
  const box = $('bars');
  const width = box.parentElement.clientWidth;
  if (!width) return;
  const W = Math.max(280, width - 16);
  const H = 170, L = 52, R = 8, T = 10, B = 24;
  const top = Math.max(...values, 1) * 1.1;
  const step = gridStep(top, 3);
  const y = v => T + (1 - v / top) * (H - T - B);
  const slot = (W - L - R) / keys.length;
  const barWidth = Math.max(3, slot - 3);
  const labelEvery = Math.ceil(keys.length / (W < 480 ? 3 : 6));
  let o = '';
  for (let v = 0; v <= top; v += step) o += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${shortNumber(v)}</text>`;
  keys.forEach((k, i) => {
    const px = L + i * slot + 1.5;
    const h = H - B - y(values[i]);
    if (h > 0) o += `<rect class="bar" x="${px}" y="${y(values[i])}" width="${barWidth}" height="${h}" rx="2"><title>${monthName(k)}: ${state.ccy} ${fmt(values[i])}</title></rect>`;
    if (i % labelEvery === 0) o += `<text x="${px}" y="${H - 6}">${monthName(k)}</text>`;
  });
  box.setAttribute('viewBox', `0 0 ${W} ${H}`);
  box.setAttribute('height', H);
  box.innerHTML = o;
}
