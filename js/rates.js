// Exchange rates: two free no-key sources, then the last saved rate.
let rates = readStored(RATE_KEY, null) || BUILT_IN_RATES;
let rateState = 'loading';

const knownCurrency = c => rates.r[c] > 0;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
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
  onDone();
  for (const source of RATE_SOURCES) {
    try {
      const { r, at } = await source();
      if (!Object.keys(BUILT_IN_RATES.r).every(c => r[c] > 0) || !at) continue;
      rates = { r, at, src: 'live' };
      writeStored(RATE_KEY, rates);
      rateState = 'live';
      onDone();
      return;
    } catch (e) { /* try the next source */ }
  }
  rateState = 'failed';
  onDone();
}
