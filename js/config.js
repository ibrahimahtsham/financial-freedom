// Constants shared across the app.
const APP_ID = 'financial-freedom';
const FILE_VERSION = 4;
const KEY = 'financial-freedom-v2';
const RATE_KEY = `${KEY}-rates`;
const TX_KEY = `${KEY}-history`;
const TOUR_KEY = `${KEY}-tour`;
const TAB_KEY = `${KEY}-tab`;
const RETURN_SPREAD = 2;

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'PKR', 'INR', 'QAR', 'KWD', 'OMR', 'BHD', 'CAD', 'AUD'];
const LAKH_CURRENCIES = ['PKR', 'INR', 'BDT', 'NPR', 'LKR'];

// Only used if no rate has ever been fetched. Units per 1 USD on 6 Nov 2026.
const BUILT_IN_RATES = {
  r: { USD: 1, SAR: 3.75, PKR: 276.7, AED: 3.6725, QAR: 3.64, KWD: 0.3103, OMR: 0.3845, BHD: 0.376, GBP: 0.743, EUR: 0.891 },
  at: Date.UTC(2026, 10, 6),
  src: 'built-in',
};

// The last entry of each list is the plain fallback for anything uncertain.
const DEFAULT_CATS = {
  expense: ['Food', 'Rent', 'Transport', 'Bills', 'Phone', 'Shopping', 'Health', 'Learning', 'Entertainment', 'Software', 'Family', 'Cash', 'Bank fees', 'Expense'],
  income: ['Job', 'Job or family', 'Family', 'Investments', 'Bank profit', 'Income'],
  transfer: ['Family', 'Own accounts', 'Refund or reversal', 'Transfer'],
};

const PERCENT_FIELDS = {
  ret: { label: 'Yearly return after inflation', min: 0, max: 10, step: 0.5, hint: '5% is a reasonable middle guess.' },
  wr: { label: 'Yearly withdrawal from the pot', min: 2.5, max: 6, step: 0.25, hint: '' },
  infl: { label: 'Yearly price rise for old spending', min: 0, max: 20, step: 0.5, hint: "Brings old spending up to today's prices. This is a guess, so set your own." },
};
