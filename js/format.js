// Display helpers and currency conversion.
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const parseNumber = t => parseFloat(String(t).replace(/,/g, ''));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const unit = () => (knownCurrency(state.ccy) ? rates.r[state.ccy] : 1);   // chosen currency per 1 USD
const usdOf = x => (knownCurrency(x.c) ? x.a / rates.r[x.c] : 0);

// A transaction's value in USD, in today's prices if that view is on.
const viewUsd = x => usdOf(x) * (state.real ? priceFactor(x.c, x.d.slice(0, 7)) : 1);

const money = usd => `${state.ccy} ${fmt(usd * unit())}`;
function bigMoney(usd) {
  const p = Math.abs(usd * unit());
  if (!LAKH_CURRENCIES.includes(state.ccy) || p < 1e5) return `${state.ccy} ${fmt(p)}`;
  return p >= 1e7
    ? `${state.ccy} ${(p / 1e7).toFixed(2).replace(/\.?0+$/, '')} crore`
    : `${state.ccy} ${(p / 1e5).toFixed(1).replace(/\.0$/, '')} lakh`;
}

const shortNumber = v => (v >= 1e6
  ? `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(v)));

const monthName = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const dayName = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
const dateIn = months => monthName(Engine.addMonths(thisMonth(), months));
function duration(m) {
  if (m === 0) return 'Now';
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return [y ? `${y} ${y === 1 ? 'year' : 'years'}` : '', mo ? `${mo} ${mo === 1 ? 'month' : 'months'}` : ''].filter(Boolean).join(' ');
}

function fullMonths(n) {
  const start = thisMonth();
  return Array.from({ length: n }, (_, i) => Engine.addMonths(start, i - n));
}
