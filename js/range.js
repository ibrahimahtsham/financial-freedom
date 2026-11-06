// The timeline at the top of Money: a mini chart with two draggable ends.
let rangeMonths = [];   // every month from the first transaction to now
let rangeFrom = 0;      // indexes into rangeMonths
let rangeTo = 0;
let renderQueued = false;
let zoomedFrom = null;  // the range to go back to after zooming into a month

const selectedMonths = () => rangeMonths.slice(rangeFrom, rangeTo + 1);

function queueMoneyRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderMoney();
  });
}

function setRange(from, to) {
  zoomedFrom = null;
  const last = rangeMonths.length - 1;
  rangeFrom = Math.max(0, Math.min(from, last));
  rangeTo = Math.max(rangeFrom, Math.min(to, last));
  writeStored(RANGE_KEY, { from: rangeMonths[rangeFrom], to: rangeMonths[rangeTo] });
  syncRange();
  queueMoneyRender();
}

function setRangeMonths(from, to) {
  const i = rangeMonths.indexOf(from);
  const j = rangeMonths.indexOf(to);
  setRange(i < 0 ? 0 : i, j < 0 ? rangeMonths.length - 1 : j);
}

function zoomInto(month) {
  const back = [rangeFrom, rangeTo];
  setRangeMonths(month, month);
  zoomedFrom = back;
  writeStored(RANGE_KEY, { from: rangeMonths[back[0]], to: rangeMonths[back[1]] });   // a reload shouldn't strand you zoomed in
  syncRange();
}

function zoomOut() {
  if (zoomedFrom) setRange(...zoomedFrom);
}

// Stretches the range so a month is visible, such as one you just added to.
function showInRange(month) {
  const from = rangeMonths[rangeFrom], to = rangeMonths[rangeTo];
  setRangeMonths(month < from ? month : from, month > to ? month : to);
}

// Last n full months, so a half-finished month doesn't skew the numbers.
function lastFullMonths(n) {
  const end = Math.max(0, rangeMonths.length - 2);
  setRange(Math.max(0, end - n + 1), end);
}

function rangePresets() {
  const years = [...new Set(rangeMonths.map(m => m.slice(0, 4)))].sort().reverse();
  return [
    { id: 'now', label: 'This month', from: rangeMonths[rangeMonths.length - 1], to: rangeMonths[rangeMonths.length - 1] },
    { id: '6', label: '6 months', last: 6 },
    { id: '12', label: '12 months', last: 12 },
    ...years.map(y => ({ id: y, label: y, from: rangeMonths.find(m => m.startsWith(y)), to: [...rangeMonths].reverse().find(m => m.startsWith(y)) })),
    { id: 'all', label: 'All time', from: rangeMonths[0], to: rangeMonths[rangeMonths.length - 1] },
  ];
}

function presetMatches(p) {
  const end = Math.max(0, rangeMonths.length - 2);
  if (p.last) return rangeTo === end && rangeFrom === Math.max(0, end - p.last + 1);
  return rangeMonths[rangeFrom] === p.from && rangeMonths[rangeTo] === p.to;
}

const rangeText = (from, to) => (from === to ? monthName(from) : `${monthName(from)} to ${monthName(to)}`);

function syncRange() {
  const n = Math.max(1, rangeMonths.length);
  const left = (rangeFrom / n) * 100;
  const right = ((rangeTo + 1) / n) * 100;
  $('rangeSel').style.left = `${left}%`;
  $('rangeSel').style.width = `${right - left}%`;
  $('rangeA').style.left = `${left}%`;
  $('rangeB').style.left = `${right}%`;
  const from = rangeMonths[rangeFrom], to = rangeMonths[rangeTo];
  for (const [id, m] of [['rangeA', from], ['rangeB', to]]) {
    $(id).setAttribute('aria-valuemax', n - 1);
    $(id).setAttribute('aria-valuetext', monthName(m));
  }
  $('rangeA').setAttribute('aria-valuenow', rangeFrom);
  $('rangeB').setAttribute('aria-valuenow', rangeTo);
  const count = rangeTo - rangeFrom + 1;
  $('rangeLabel').textContent = rangeText(from, to);
  $('rangeCount').textContent = count === 1 ? '1 month' : `${count} months`;
  document.querySelectorAll('#rangeBars rect').forEach((r, i) => r.classList.toggle('on', i >= rangeFrom && i <= rangeTo));
  $('zoomOut').hidden = !zoomedFrom;
  if (zoomedFrom) $('zoomOut').textContent = `Back to ${rangeText(rangeMonths[zoomedFrom[0]], rangeMonths[zoomedFrom[1]])}`;
  const presets = rangePresets();
  document.querySelectorAll('#rangeChips button').forEach((b, i) => b.classList.toggle('on', presetMatches(presets[i])));
}

function renderRange() {
  const used = ledger.map(x => x.d.slice(0, 7)).sort();
  const now = thisMonth();
  const end = used.length && used[used.length - 1] > now ? used[used.length - 1] : now;
  const first = used.length && used[0] < now ? used[0] : now;
  rangeMonths = Array.from({ length: Engine.monthsBetween(first, end) + 1 }, (_, i) => Engine.addMonths(first, i));

  const spend = {};
  for (const x of ledger) if (x.t === 'expense') spend[x.d.slice(0, 7)] = (spend[x.d.slice(0, 7)] || 0) + usdOf(x);
  const top = Math.max(...rangeMonths.map(m => spend[m] || 0), 1);
  const n = rangeMonths.length;
  const H = 40;
  $('rangeBars').setAttribute('viewBox', `0 0 ${n} ${H}`);
  $('rangeBars').innerHTML = rangeMonths.map((m, i) => {
    const h = Math.max(1, ((spend[m] || 0) / top) * (H - 2));
    return `<rect x="${i + 0.1}" y="${H - h}" width="0.8" height="${h}"/>`;
  }).join('');
  $('rangeTicks').innerHTML = rangeMonths.map((m, i) => (m.endsWith('-01') || i === 0
    ? `<span style="left:${(i / n) * 100}%">${m.slice(0, 4)}</span>` : '')).join('');
  $('rangeChips').innerHTML = rangePresets().map(p => `<button type="button" data-id="${p.id}">${p.label}</button>`).join('');

  const saved = readStored(RANGE_KEY, null);
  const i = saved ? rangeMonths.indexOf(saved.from) : -1;
  const j = saved ? rangeMonths.indexOf(saved.to) : -1;
  if (i >= 0 && j >= i) {
    rangeFrom = i;
    rangeTo = j;
  } else {
    const last = Math.max(0, n - 2);
    rangeTo = n === 1 ? 0 : last;
    rangeFrom = Math.max(0, last - 11);
  }
  syncRange();
}

function initRange() {
  const track = $('rangeTrack');
  let drag = null;
  const monthAt = x => {
    const r = track.getBoundingClientRect();
    return Math.max(0, Math.min(rangeMonths.length - 1, Math.floor(((x - r.left) / r.width) * rangeMonths.length)));
  };

  track.addEventListener('pointerdown', e => {
    const at = monthAt(e.clientX);
    if (e.target.id === 'rangeA') drag = { end: 'from' };
    else if (e.target.id === 'rangeB') drag = { end: 'to' };
    else if (at >= rangeFrom && at <= rangeTo) drag = { end: 'both', at, from: rangeFrom, to: rangeTo };
    else {
      drag = { end: at < rangeFrom ? 'from' : 'to' };
      if (drag.end === 'from') setRange(at, rangeTo);
      else setRange(rangeFrom, at);
    }
    track.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  track.addEventListener('pointermove', e => {
    if (!drag) return;
    const at = monthAt(e.clientX);
    if (drag.end === 'from') setRange(Math.min(at, rangeTo), rangeTo);
    else if (drag.end === 'to') setRange(rangeFrom, Math.max(at, rangeFrom));
    else {
      const size = drag.to - drag.from;
      const start = Math.max(0, Math.min(drag.from + at - drag.at, rangeMonths.length - 1 - size));
      setRange(start, start + size);
    }
  });
  const stop = () => { drag = null; };
  track.addEventListener('pointerup', stop);
  track.addEventListener('pointercancel', stop);

  const keys = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
  $('rangeA').addEventListener('keydown', e => {
    if (!keys[e.key]) return;
    e.preventDefault();
    setRange(Math.min(rangeFrom + keys[e.key], rangeTo), rangeTo);
  });
  $('rangeB').addEventListener('keydown', e => {
    if (!keys[e.key]) return;
    e.preventDefault();
    setRange(rangeFrom, Math.max(rangeTo + keys[e.key], rangeFrom));
  });

  $('zoomOut').addEventListener('click', zoomOut);
  $('rangeChips').addEventListener('click', e => {
    const p = rangePresets().find(x => x.id === e.target.dataset.id);
    if (!p) return;
    if (p.last) lastFullMonths(p.last);
    else setRangeMonths(p.from, p.to);
  });
}
