// The guided tour. Each step opens its tab and highlights one or more areas.
// The highlighted area stays usable, and everything outside it is blocked.
// `locked` steps block everything, and `holdRange` steps undo any zooming on the way out.
const TOUR_STEPS = [
  { section: 'Welcome', locked: true, t: 'Welcome to Financial Freedom', p: 'This app does two things. The Money page shows where your money goes. The Freedom page shows how much you need so you don\'t have to work, and when you could get there. This takes about two minutes.' },

  { section: 'Money', tab: 'money', els: ['rangeBox'], t: 'Pick your months', p: 'This bar decides which months the whole Money page shows. The little bars show how much you spent each month.', tryIt: 'Try it: drag either end, drag the middle to slide it, or press a button like 2026.' },
  { section: 'Money', tab: 'money', els: ['realWrap', 'ccy'], t: 'See it your way', p: 'You can see everything in any type of money. Prices go up over time, so you can also see what old spending would cost today.', tryIt: "Try it: press Today's prices and watch the numbers change." },
  { section: 'Money', tab: 'money', els: ['tileIn', 'tileKept'], t: 'The quick view', p: 'How much came in, how much went out, what was left over, and how much you kept. It also shows if you did better or worse than before.' },
  { section: 'Money', tab: 'money', els: ['inOut'], holdRange: true, t: 'Month by month', p: 'Money in and money out, side by side, so you can see your good and bad months.', tryIt: 'Try it: put your mouse on a month to see the amounts, or click it to see its days. Press the Back button on the chart to go back.' },
  { section: 'Money', tab: 'money', els: ['catOut', 'catIn', 'insights'], t: 'Where your money goes', p: 'What you spent on, biggest first. Things we noticed points out anything useful.', tryIt: 'Try it: click one, like Food. Your money list will show only that. You will see the list in two steps.' },
  { section: 'Money', tab: 'money', els: ['calendar'], t: 'Spending by day', p: 'Each square is a day. Darker means you spent more that day.', tryIt: 'Try it: put your mouse on a square to see that day, or click it to show that day in your money list.' },
  { section: 'Money', tab: 'money', els: ['txSec'], t: 'Your money list', p: 'Every bit of money in or out. You can change what something was for, or make your own type. You can also edit, delete, hide columns, or download the list.', tryIt: 'Try it: click a heading like Amount to sort the list, or search for something.' },

  { section: 'Add', tab: 'add', els: ['addBox', 'quickPanel'], locked: true, t: 'Add money in or out', p: 'This page is where you write down money you get or spend. It remembers your bank and stays open, so you can add a few in a row. Quick picks fill in the form for things you buy a lot, and you can change anything before adding.' },
  { section: 'Add', tab: 'add', els: ['checkPanel'], locked: true, t: 'Does it match your bank?', p: 'Now and then, type what your bank really shows. If it doesn\'t match your money list, you forgot to add something, and this tells you how much.' },

  { section: 'Freedom', tab: 'freedom', els: ['hero'], t: 'Your goal', p: 'This is how much money you need to stop working and pay for your life until you are 100. We only count on your money growing if you ask us to.', tryIt: 'Try it: open "See how we worked this out" to see the sum with your own numbers.' },
  { section: 'Freedom', tab: 'freedom', els: ['tileDate', 'tileRun', 'tilePot'], t: 'Where you are now', p: 'When you could reach your goal, how long your savings would last if no money came in, and how long you would spend your money for. Each one shows its sum too.' },
  { section: 'Freedom', tab: 'freedom', els: ['inputs'], t: 'Change your plan', p: 'We fill these in from your money list, but you can type over them. Change one and the others follow, so you can type how much you get paid, or how many years you want, and see the rest. If you plan to spend less later, lower what you want to spend. Savings sit still unless you press Grow, and growth is only a guess.', tryIt: 'Try it: change how much you save and see your date move.' },
  { section: 'Freedom', tab: 'freedom', els: ['chart'], t: 'Your timeline', p: 'What you really had so far, then your plan: your savings go up until you reach your goal, then go down as you spend them. Under it, we tell you if you are on track.' },
  { section: 'Freedom', tab: 'freedom', els: ['takeTable'], t: 'What it would take', p: 'Pick how soon you want to get there, or type your own number of years, and see how much to save and how much you need to get paid. If you have no job right now, this gives you a target for your next one.' },

  { section: 'Keep it safe', tab: 'freedom', els: ['menu', 'menuBox'], openMenu: true, locked: true, t: 'Save your plan', p: 'Your numbers stay in this web browser and are never sent anywhere. If the browser gets cleared, they are gone, so save your plan to a file now and then. You can watch this tutorial again from here.' },
];

let tourAt = -1;
let tourDemo = false;
let tourReturnTab = 'money';
let tourSavedLedger = null;
let tourHeldRange = null;

function releaseRange() {
  if (tourHeldRange) setRange(...tourHeldRange);
  tourHeldRange = null;
}

function clearTourFilters() {
  txFilter = defaultTxFilter();
  txPage = 0;
  if (ledger.length) renderMoney();
}

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
  releaseRange();
  closeExplanations();
  tourAt = i;
  const s = TOUR_STEPS[i];
  if (s.tab === 'freedom') clearTourFilters();
  if (s.tab) showTab(s.tab);
  if (s.holdRange) tourHeldRange = [rangeFrom, rangeTo];
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
  $('tourShade').hidden = !s.locked;
  $('tourSpot').classList.toggle('live', !s.locked);
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
  followTarget();
}

// Keeps the highlight on its area when the area changes size, such as opening a section.
let tourLastBox = '';
function followTarget() {
  if (tourAt < 0) return;
  const r = tourRect(TOUR_STEPS[tourAt]);
  const box = r ? `${r.left},${r.top},${r.width},${r.height},${$('tourCard').offsetHeight}` : '';
  if (box !== tourLastBox) {
    tourLastBox = box;
    placeTour();
  }
  requestAnimationFrame(followTarget);
}

const closeExplanations = () => document.querySelectorAll('.how[open]').forEach(d => { d.open = false; });

function closeTour() {
  releaseRange();
  clearTourFilters();
  closeExplanations();
  expandedCats = { expense: false, income: false };
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
  // Blocks clicks outside the highlighted area, but never inside the tour card.
  const guard = e => {
    if (tourAt < 0 || e.detail === 0 || e.target.closest?.('#tourCard')) return;
    const r = tourRect(TOUR_STEPS[tourAt]);
    const pad = 8;
    const inside = r && e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    if (!inside) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  addEventListener('pointerdown', guard, true);
  addEventListener('click', guard, true);
  addEventListener('resize', placeTour);
  addEventListener('scroll', placeTour, { passive: true });
  addEventListener('keydown', e => {
    if (tourAt < 0) return;
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === 'Escape') closeTour();
    else if (e.key === 'ArrowRight' && !typing && document.activeElement.getAttribute('role') !== 'slider') $('tourNext').click();
    else if (e.key === 'ArrowLeft' && !typing && tourAt > 0 && document.activeElement.getAttribute('role') !== 'slider') showStep(tourAt - 1);
    else if (e.key === 'Tab' && TOUR_STEPS[tourAt].locked) {
      const buttons = [...$('tourCard').querySelectorAll('button')].filter(b => !b.hidden);
      const i = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
}
