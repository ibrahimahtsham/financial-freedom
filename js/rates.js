// Exchange rates and inflation, from free services that need no key.
let rates = readStored(RATE_KEY, null) || BUILT_IN_RATES;
let rateState = 'loading';
let inflation = readStored(INFLATION_KEY, null) || { table: BUILT_IN_INFLATION, at: 0 };

const knownCurrency = c => rates.r[c] > 0;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const RATE_SOURCES = [
  async () => {
    const j = await getJson('https://open.er-api.com/v6/latest/USD');
    return { r: j.rates, at: j.time_last_update_unix * 1000 };
  },
  async () => {
    const j = await getJson('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json');
    const r = {};
    for (const c in j.usd) if (/^[a-z]{3}$/.test(c) && j.usd[c] > 0) r[c.toUpperCase()] = j.usd[c];
    return { r, at: Date.parse(j.date) };
  },
];

async function refreshRates(onDone) {
  rateState = 'loading';
  for (const source of RATE_SOURCES) {
    try {
      const { r, at } = await source();
      if (!Object.keys(BUILT_IN_RATES.r).every(c => r[c] > 0) || !at) continue;
      rates = { r, at };
      writeStored(RATE_KEY, rates);
      rateState = 'live';
      onDone();
      return;
    } catch (e) { /* try the next source */ }
  }
  rateState = 'failed';
  onDone();
}

const inflationTable = currency => inflation.table[CURRENCY_COUNTRY[currency]];
const inflationCovers = currency => Boolean(inflationTable(currency));
const latestInflationYear = () => Math.max(...Object.values(inflation.table).flatMap(t => Object.keys(t).map(Number)));

const factorCache = new Map();
function priceFactor(currency, ym) {
  const key = `${currency}${ym}`;
  if (!factorCache.has(key)) {
    const table = inflationTable(currency);
    factorCache.set(key, table ? Engine.priceFactor(table, ym, thisMonth()) : 1);
  }
  return factorCache.get(key);
}

// Fetches inflation for the currencies in use. Skips the request if it's recent.
async function refreshInflation(currencies, onDone) {
  const codes = [...new Set(currencies.map(c => CURRENCY_COUNTRY[c]).filter(Boolean))];
  const fresh = Date.now() - inflation.at < 30 * 864e5;
  if (!codes.length || (fresh && codes.every(c => inflation.table[c]))) return;
  try {
    const url = `https://api.worldbank.org/v2/country/${codes.join(';')}/indicator/FP.CPI.TOTL.ZG?format=json&date=2000:${new Date().getFullYear()}&per_page=2000`;
    const [, rows] = await getJson(url);
    const table = { ...inflation.table };
    for (const row of rows || []) {
      if (row.value === null) continue;
      const code = row.countryiso3code;
      table[code] = { ...table[code], [row.date]: row.value };
    }
    inflation = { table, at: Date.now() };
    writeStored(INFLATION_KEY, inflation);
    factorCache.clear();
    onDone();
  } catch (e) { /* keep the saved data */ }
}
