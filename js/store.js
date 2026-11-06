// Saved data: the plan, the transaction history, and validation for both.
// Money in a stage, `cur` and `side` is kept in USD and shown in the chosen currency,
// so switching currency never drifts. mRent, mOther, price and own are kept in the
// currency of the place you move to. Transactions stay in their own currency.
const LEGACY_COSTS = ['cHome', 'cFood', 'cMove', 'cBills', 'cGive', 'cMisc'];

const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
};
const writeStored = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private window or full storage */ }
};

const uid = () => Math.random().toString(36).slice(2, 10);
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function defaultState() {
  return {
    started: false, ccy: 'USD', dest: 'USD', move: false, home: 'rent', place: '', fxAuto: true, fx: 1,
    goalY: 10, ret: 5, wr: 4, infl: 6, cur: 0, side: 0, mRent: 0, mOther: 0, price: 0, own: 0,
    stages: [], cats: { expense: [], income: [], transfer: [] }, rules: [],
  };
}

const money = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function cleanStages(raw) {
  let list = Array.isArray(raw.stages) ? raw.stages : [];
  if (!list.length && (raw.save !== undefined || LEGACY_COSTS.some(k => raw[k] !== undefined))) {
    const spend = LEGACY_COSTS.reduce((sum, k) => sum + money(raw[k]), 0);
    list = [{ name: 'Now', from: '', income: spend + money(raw.save), spend }];
  }
  const stages = list.slice(0, 30).filter(s => s && typeof s === 'object').map((s, i) => ({
    id: uid(),
    name: String(s.name || '').slice(0, 40),
    from: i > 0 && /^\d{4}-\d\d$/.test(s.from) ? s.from : '',
    income: money(s.income),
    spend: money(s.spend),
  }));
  const [first, ...rest] = stages;
  return first ? [first, ...rest.sort((a, b) => (a.from || '9').localeCompare(b.from || '9'))] : [];
}

function cleanCats(raw) {
  const cats = { expense: [], income: [], transfer: [] };
  for (const t in cats) {
    const list = raw && Array.isArray(raw[t]) ? raw[t] : [];
    cats[t] = [...new Set(list.map(c => String(c).trim().slice(0, 30)).filter(Boolean))].slice(0, 50);
  }
  return cats;
}

function cleanRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).flatMap(r => {
    if (!r || typeof r.q !== 'string' || !r.q.trim() || !DEFAULT_CATS[r.t]) return [];
    return [{ q: r.q.trim().slice(0, 60), t: r.t, k: String(r.k || '').slice(0, 30) }];
  });
}

// Accepts stored or imported data and keeps only valid values.
function cleanState(raw) {
  const base = defaultState();
  const s = { ...base };
  if (!raw || typeof raw !== 'object') return s;
  for (const k in base) {
    const v = raw[k];
    if (typeof base[k] === 'number' && typeof v === 'number' && Number.isFinite(v) && v >= 0) s[k] = v;
    if (typeof base[k] === 'boolean' && typeof v === 'boolean') s[k] = v;
  }
  if (/^[A-Z]{3}$/.test(raw.ccy)) s.ccy = raw.ccy;
  if (/^[A-Z]{3}$/.test(raw.dest)) s.dest = raw.dest;
  if (raw.home === 'buy') s.home = 'buy';
  if (typeof raw.place === 'string') s.place = raw.place.slice(0, 60);
  s.wr = Math.min(PERCENT_FIELDS.wr.max, Math.max(PERCENT_FIELDS.wr.min, s.wr));
  s.ret = Math.min(20, s.ret);
  s.infl = Math.min(PERCENT_FIELDS.infl.max, s.infl);
  s.goalY = Math.min(40, Math.max(1, Math.round(s.goalY)));
  s.stages = cleanStages(raw);
  s.cats = cleanCats(raw.cats);
  s.rules = cleanRules(raw.rules);
  return s;
}

function cleanLedger(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20000).flatMap(x => {
    if (!x || !/^\d{4}-\d\d-\d\d$/.test(x.d) || !(x.a > 0) || !Number.isFinite(x.a) || !/^[A-Z]{3}$/.test(x.c)) return [];
    const t = ['income', 'expense', 'transfer'].includes(x.t) ? x.t : 'expense';
    return [{
      d: x.d, a: x.a, c: x.c, t,
      k: String(x.k || '').slice(0, 30) || plainCategory(t),
      io: x.io === 'in' || x.io === 'out' ? x.io : (t === 'income' ? 'in' : 'out'),
      n: String(x.n || '').slice(0, 120),
      s: String(x.s || '').slice(0, 20),
    }];
  }).map((x, i) => ({ ...x, id: i + 1 }));
}

const plainCategory = type => DEFAULT_CATS[type][DEFAULT_CATS[type].length - 1];
const categories = type => [...DEFAULT_CATS[type].slice(0, -1), ...state.cats[type], plainCategory(type)];

let state = cleanState(readStored(KEY, null));
let ledger = cleanLedger(readStored(TX_KEY, []));

const saveState = () => writeStored(KEY, state);
const saveLedger = () => writeStored(TX_KEY, ledger.map(({ id, ...x }) => x));

function planFile() {
  const { started, stages, ...plan } = state;
  return {
    app: APP_ID, version: FILE_VERSION, saved: new Date().toISOString(),
    plan: { ...plan, stages: stages.map(({ id, ...s }) => s) },
    history: ledger.map(({ id, ...x }) => x),
  };
}
