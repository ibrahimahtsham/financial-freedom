// Constants shared across the app.
const APP_ID = 'financial-freedom';
const FILE_VERSION = 6;
const KEY = 'financial-freedom-v3';
const TX_KEY = `${KEY}-history`;
const RATE_KEY = `${KEY}-rates`;
const INFLATION_KEY = `${KEY}-inflation`;
const TOUR_KEY = `${KEY}-tour`;
const TAB_KEY = `${KEY}-tab`;
const RANGE_KEY = `${KEY}-range`;
const RETURN_SPREAD = 2;

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'PKR', 'INR', 'QAR', 'KWD', 'OMR', 'BHD', 'CAD', 'AUD'];
const LAKH_CURRENCIES = ['PKR', 'INR', 'BDT', 'NPR', 'LKR'];

// Only used if no rate has ever been fetched. Units per 1 USD on 6 Nov 2026.
const BUILT_IN_RATES = {
  r: { USD: 1, SAR: 3.75, PKR: 276.7, AED: 3.6725, QAR: 3.64, KWD: 0.3103, OMR: 0.3845, BHD: 0.376, GBP: 0.743, EUR: 0.891 },
  at: Date.UTC(2026, 10, 6),
};

// The World Bank reports inflation by country, so each currency maps to one.
const CURRENCY_COUNTRY = {
  AED: 'ARE', AUD: 'AUS', BDT: 'BGD', BHD: 'BHR', BRL: 'BRA', CAD: 'CAN', CHF: 'CHE', CNY: 'CHN', DKK: 'DNK', EGP: 'EGY',
  EUR: 'EMU', GBP: 'GBR', IDR: 'IDN', INR: 'IND', JOD: 'JOR', JPY: 'JPN', KRW: 'KOR', KWD: 'KWT', LKR: 'LKA', MAD: 'MAR',
  MXN: 'MEX', MYR: 'MYS', NGN: 'NGA', NOK: 'NOR', NPR: 'NPL', NZD: 'NZL', OMR: 'OMN', PHP: 'PHL', PKR: 'PAK', QAR: 'QAT',
  SAR: 'SAU', SEK: 'SWE', SGD: 'SGP', THB: 'THA', TRY: 'TUR', USD: 'USA', VND: 'VNM', ZAR: 'ZAF',
};

// Used until live data arrives. Yearly % from the World Bank.
const BUILT_IN_INFLATION = {
  PAK: { 2022: 19.87, 2023: 30.77, 2024: 12.63, 2025: 3.55 },
  SAU: { 2022: 2.54, 2023: 2.47, 2024: 1.5, 2025: 2.04 },
};

// The last entry of each list is the fallback for anything uncertain.
const CATEGORIES = {
  expense: ['Food', 'Rent', 'Transport', 'Bills', 'Phone', 'Shopping', 'Health', 'Learning', 'Entertainment', 'Software', 'Family', 'Own accounts', 'Refund', 'Cash', 'Bank fees', 'Other'],
  income: ['Job', 'Job or family', 'Family', 'Own accounts', 'Refund', 'Investments', 'Bank profit', 'Other'],
};
