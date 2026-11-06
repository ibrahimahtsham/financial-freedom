// Display helpers and currency conversion.
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const parseNumber = t => parseFloat(String(t).replace(/,/g, ''));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const unit = () => (knownCurrency(state.ccy) ? rates.r[state.ccy] : 1);   // my currency per 1 USD
const planCurrency = () => (state.move ? state.dest : state.ccy);         // currency of the life being planned
const planRate = () => {                                                  // plan currency per 1 USD
  const c = planCurrency();
  if (c === state.ccy) return unit();
  if (!state.fxAuto) return state.fx * unit();
  return knownCurrency(c) ? rates.r[c] : 1;
};
const crossBorder = () => state.move && state.dest !== state.ccy;
const usdOf = x => (knownCurrency(x.c) ? x.a / rates.r[x.c] : 0);

const mine = usd => `${state.ccy} ${fmt(usd * unit())}`;
const planMoney = x => `${planCurrency()} ${fmt(x)}`;
function bigMoney(x) {
  const p = Math.abs(x);
  const c = planCurrency();
  if (!LAKH_CURRENCIES.includes(c) || p < 1e5) return planMoney(p);
  return p >= 1e7
    ? `${c} ${(p / 1e7).toFixed(2).replace(/\.?0+$/, '')} crore`
    : `${c} ${(p / 1e5).toFixed(1).replace(/\.0$/, '')} lakh`;
}

function tidy(v) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}
function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}
const shortNumber = v => (v >= 1e6
  ? `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(v)));

const monthName = ym => new Date(+ym.slice(0, 4), +ym.slice(5) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const dateIn = months => monthName(Engine.addMonths(thisMonth(), months));
function duration(m) {
  if (m === 0) return 'Now';
  const y = Math.floor(m / 12);
  const mo = m % 12;
  return [y ? `${y} ${y === 1 ? 'year' : 'years'}` : '', mo ? `${mo} mo` : ''].filter(Boolean).join(' ');
}
