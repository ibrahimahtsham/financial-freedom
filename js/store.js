// Saved data and validation. `cur`, `save` and `live` are kept in USD and shown in
// the chosen currency, so switching never drifts. `cur` and `live` are null when
// they should follow your tracked balance and spending. Transactions keep their own currency.
const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
};
const writeStored = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private window or full storage */ }
};

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const defaultState = () => ({ started: false, ccy: 'USD', real: false, cur: null, save: 0, live: null, ret: 5 });

const amount = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

function cleanState(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object') return s;
  if (/^[A-Z]{3}$/.test(raw.ccy)) s.ccy = raw.ccy;
  s.started = raw.started === true;
  s.real = raw.real === true;
  s.cur = amount(raw.cur);
  s.save = amount(raw.save) ?? 0;
  s.live = amount(raw.live);
  s.ret = Math.min(20, amount(raw.ret) ?? 5);
  return s;
}

const RENAMED_CATEGORIES = { Expense: 'Other', Income: 'Other', Transfer: 'Other', 'Refund or reversal': 'Money back', 'Job or family': 'Other', Refund: 'Money back', 'Own accounts': 'My other banks', Entertainment: 'Fun', Software: 'Apps', Investments: 'Investing' };
const plainCategory = type => CATEGORIES[type][CATEGORIES[type].length - 1];

function cleanLedger(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20000).flatMap(x => {
    if (!x || !/^\d{4}-\d\d-\d\d$/.test(x.d) || !(x.a > 0) || !Number.isFinite(x.a) || !/^[A-Z]{3}$/.test(x.c)) return [];
    const t = x.t === 'income' || (x.t === 'transfer' && x.io === 'in') ? 'income' : 'expense';
    const k = String(x.k || '').slice(0, 30);
    return [{
      d: x.d, a: x.a, c: x.c, t,
      k: RENAMED_CATEGORIES[k] ?? (k || plainCategory(t)),
      n: String(x.n || '').slice(0, 120),
      s: String(x.s || '').slice(0, 20),
      ...(x.o ? { o: String(x.o).slice(0, 300) } : {}),   // the words from the bank statement
    }];
  }).map((x, i) => ({ ...x, id: i + 1 }));
}

let state = cleanState(readStored(KEY, null));
let ledger = cleanLedger(readStored(TX_KEY, []));

const saveState = () => writeStored(KEY, state);
const saveLedger = () => {
  if (!tourDemo) writeStored(TX_KEY, ledger.map(({ id, ...x }) => x));   // example data is never saved
};

function planFile() {
  const { started, ...plan } = state;
  return { app: APP_ID, version: FILE_VERSION, saved: new Date().toISOString(), plan, history: ledger.map(({ id, ...x }) => x) };
}
