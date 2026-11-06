// The guided tour. Each step opens its tab and highlights one or more areas.
// Steps with `tryIt` leave the page usable, so people can use the real control.
const TOUR_STEPS = [
  { section: 'Welcome', t: 'Welcome to Financial Freedom', p: 'This app does two things. Money shows where your money goes. Freedom shows how much you need invested so you no longer depend on a salary, and when you could get there. This takes about two minutes.' },

  { section: 'Money', tab: 'money', els: ['rangeBox'], t: 'Pick your time range', p: 'This timeline controls everything on the Money page. The small bars show your spending each month.', tryIt: 'Try it: drag either end, drag the middle to slide the window, or press a button like 2026.' },
  { section: 'Money', tab: 'money', els: ['realWrap', 'ccy'], t: 'See it your way', p: 'Every transaction keeps its original amount. Here you choose how to view them: in any currency, and either as paid or raised to today\'s prices, so old spending is fair to compare.', tryIt: "Try it: switch to Today's prices and watch the numbers change." },
  { section: 'Money', tab: 'money', els: ['tileIn', 'tileKept'], t: 'Your summary', p: 'What came in, what went out, what was left, and how much you kept. It also compares this period with the one before it.' },
  { section: 'Money', tab: 'money', els: ['inOut'], t: 'Month by month', p: 'Money in and money out, side by side. Hover over a month for the exact amounts, or click one to zoom in on it.' },
  { section: 'Money', tab: 'money', els: ['catOut', 'catIn', 'insights'], t: 'Where your money goes', p: 'Your categories, biggest first. Click one to see just those transactions. What stands out picks out useful patterns for you.' },
  { section: 'Money', tab: 'money', els: ['calendar'], t: 'Spending by day', p: 'Each square is a day, and darker means more spent. It shows your habits at a glance. Click a day to see what you spent.' },
  { section: 'Money', tab: 'money', els: ['txSec'], t: 'Every transaction', p: 'Search, filter, or click a column heading to sort. You can change a category right in the row, edit or delete anything, and export the list to a spreadsheet.' },
  { section: 'Money', tab: 'money', els: ['addOpen'], t: 'Add income or spending', p: 'Use this button whenever you want to record something. If an amount is in another currency, just pick that currency.' },

  { section: 'Freedom', tab: 'freedom', els: ['hero'], t: 'Your number', p: 'This is how much you need invested to live on your chosen amount for good. It is 25 times your yearly costs, which comes from the 4% rule.', tryIt: 'Try it: open "How this is worked out" to see the sum with your own numbers.' },
  { section: 'Freedom', tab: 'freedom', els: ['tileDate', 'tileRun', 'tilePot'], t: 'Where you stand', p: 'When you could reach your number, how long your savings would last with no income, and what they could already pay you. Each one shows its formula too.' },
  { section: 'Freedom', tab: 'freedom', els: ['inputs'], t: 'Change the plan', p: 'Your savings and spending can come from your transactions, and you can type over them. If you plan to spend less later, lower what you want to live on.', tryIt: 'Try it: press a return button, like Bank account 0%, and see what changes.' },
  { section: 'Freedom', tab: 'freedom', els: ['chart'], t: 'Your timeline', p: 'How your pot could grow toward your number. The shaded band shows what happens if returns turn out lower or higher, because nobody knows them for sure.' },
  { section: 'Freedom', tab: 'freedom', els: ['takeTable'], t: 'What it would take', p: 'Pick how soon you want to get there and see what to save, and the income you would need. It is useful even with no income right now, as a target for your next job.' },

  { section: 'Keep it safe', tab: 'freedom', els: ['menu'], openMenu: true, t: 'Save your plan', p: 'Your numbers stay in this browser and nothing is uploaded. So save your plan to a file now and then, because clearing your browser would erase it. You can replay this tutorial here any time.' },
];

let tourAt = -1;
let tourDemo = false;
let tourReturnTab = 'money';
let tourSavedLedger = null;

// A believable year of money for people who have nothing tracked yet.
function exampleLedger() {
  const u = unit();
  const pick = [['Rent', 900, 'Rent'], ['Food', 320, 'Groceries'], ['Transport', 90, 'Fuel'], ['Bills', 110, 'Electricity'], ['Phone', 35, 'Phone plan']];
  const rows = [];
  fullMonths(12).forEach((ym, i) => {
    const wobble = 1 + ((i * 7) % 5 - 2) / 20;
    rows.push({ d: `${ym}-01`, a: Math.round(2600 * u), c: state.ccy, t: 'income', k: 'Job', n: 'Salary', s: 'Example' });
    pick.forEach(([k, base, n], j) => rows.push({ d: `${ym}-${String(3 + j * 5).padStart(2, '0')}`, a: Math.round(base * wobble * u), c: state.ccy, t: 'expense', k, n, s: 'Example' }));
    for (let w = 0; w < 6; w++) rows.push({ d: `${ym}-${String(2 + w * 4 + (i % 3)).padStart(2, '0')}`, a: Math.round((12 + ((i + w) % 4) * 9) * u), c: state.ccy, t: 'expense', k: w % 2 ? 'Food' : 'Shopping', n: w % 2 ? 'Cafe' : 'Shop', s: 'Example' });
  });
  return cleanLedger(rows);
}

function tourTargets(s) {
  return (s.els || []).map(id => $(id).closest('.panel') || $(id)).filter(e => e.getClientRects().length);
}

function tourRect(s) {
  const rects = tourTargets(s).map(e => e.getBoundingClientRect());
  if (!rects.length) return null;
  const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right)), bottom = Math.max(...rects.map(r => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

const stickyHeight = () => (getComputedStyle($('stickyBar')).position === 'sticky' ? $('stickyBar').offsetHeight : 0);

function placeTour() {
  if (tourAt < 0) return;
  const s = TOUR_STEPS[tourAt];
  const r = tourRect(s);
  const spot = $('tourSpot'), card = $('tourCard');
  const vw = innerWidth, vh = innerHeight, pad = 8;
  const cw = card.offsetWidth, ch = card.offsetHeight;
  if (!r) {
    Object.assign(spot.style, { left: `${vw / 2}px`, top: `${vh / 2}px`, width: '0px', height: '0px' });
    card.style.left = `${(vw - cw) / 2}px`;
    card.style.top = `${Math.max(16, (vh - ch) / 2)}px`;
    return;
  }
  const inBar = s.els.some(id => $('stickyBar').contains($(id)));
  const floor = inBar ? 4 : stickyHeight() + 4;
  const top = Math.max(floor, r.top - pad);
  const bottom = Math.min(vh - 8, r.bottom + pad);
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${top}px`, width: `${r.width + pad * 2}px`, height: `${Math.max(0, bottom - top)}px` });

  // Prefer below, then above, then beside, then over the bottom corner.
  let x = Math.min(Math.max(16, r.left), vw - cw - 16);
  let y;
  if (bottom + 12 + ch <= vh - 8) y = bottom + 12;
  else if (top - 12 - ch >= floor) y = top - 12 - ch;
  else {
    y = Math.max(floor + 8, Math.min(top, vh - ch - 16));
    if (r.right + 24 + cw <= vw) x = r.right + 20;
    else if (r.left - 24 - cw >= 0) x = r.left - cw - 20;
    else { x = vw - cw - 16; y = vh - ch - 16; }
  }
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

function scrollToStep(s) {
  const r = tourRect(s);
  if (!r) return;
  if (s.els.some(id => $('stickyBar').contains($(id)))) { scrollTo(0, 0); return; }
  const head = stickyHeight();
  const room = innerHeight - head;
  const target = r.height + $('tourCard').offsetHeight + 40 <= room
    ? r.top + scrollY - head - 16
    : r.top + scrollY - head - 12 - Math.max(0, (room - r.height) / 2);
  scrollTo(0, Math.max(0, target));
}

function showStep(i) {
  tourAt = i;
  const s = TOUR_STEPS[i];
  if (s.tab) showTab(s.tab);
  $('menu').open = Boolean(s.openMenu);
  $('tourSection').textContent = s.section;
  $('tourCount').textContent = `${i + 1} of ${TOUR_STEPS.length}`;
  $('tourBar').style.width = `${((i + 1) / TOUR_STEPS.length) * 100}%`;
  $('tourTitle').textContent = s.t;
  $('tourText').textContent = s.p;
  $('tourTry').textContent = s.tryIt || '';
  $('tourTry').hidden = !s.tryIt;
  $('tourDemo').hidden = !tourDemo || s.tab !== 'money';
  $('tourBack').hidden = i === 0;
  $('tourNext').textContent = i === 0 ? 'Start' : i === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
  $('tourShade').hidden = Boolean(s.tryIt);
  $('tourSpot').classList.toggle('live', Boolean(s.tryIt));
  scrollToStep(s);
  placeTour();
  $('tourNext').focus({ preventScroll: true });
}

const tourParts = ['tourShade', 'tourSpot', 'tourCard'];

function openTour() {
  $('menu').open = false;
  tourReturnTab = activeTab;
  tourDemo = !ledger.length;
  if (tourDemo) {
    tourSavedLedger = ledger;
    ledger = exampleLedger();   // in memory only, never saved
    renderRange();
    refreshAll();
  }
  tourParts.forEach(id => { $(id).hidden = false; });
  showStep(0);
}

function closeTour() {
  tourAt = -1;
  tourParts.forEach(id => { $(id).hidden = true; });
  $('menu').open = false;
  writeStored(TOUR_KEY, true);
  if (tourDemo) {
    ledger = tourSavedLedger;
    tourDemo = false;
    writeStored(RANGE_KEY, null);
    renderRange();
    refreshAll();
  }
  showTab(tourReturnTab);
  $(`tab-${activeTab}`).focus({ preventScroll: true });
  scrollTo(0, 0);
}

function initTutorial() {
  $('tourBtn').addEventListener('click', openTour);
  $('tourSkip').addEventListener('click', closeTour);
  $('tourBack').addEventListener('click', () => showStep(tourAt - 1));
  $('tourNext').addEventListener('click', () => (tourAt === TOUR_STEPS.length - 1 ? closeTour() : showStep(tourAt + 1)));
  addEventListener('resize', placeTour);
  addEventListener('scroll', placeTour, { passive: true });
  addEventListener('keydown', e => {
    if (tourAt < 0) return;
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === 'Escape') closeTour();
    else if (e.key === 'ArrowRight' && !typing && document.activeElement.getAttribute('role') !== 'slider') $('tourNext').click();
    else if (e.key === 'ArrowLeft' && !typing && tourAt > 0 && document.activeElement.getAttribute('role') !== 'slider') showStep(tourAt - 1);
    else if (e.key === 'Tab' && !TOUR_STEPS[tourAt].tryIt) {
      const buttons = [...$('tourCard').querySelectorAll('button')].filter(b => !b.hidden);
      const i = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
}
