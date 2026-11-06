// Short walkthrough. Each step opens its tab and highlights one area.
const TOUR_STEPS = [
  { tab: 'freedom', el: 'hero', t: 'This is your number', p: 'It is how much you need invested so the returns pay your costs without a salary.' },
  { tab: 'freedom', el: 'inputs', t: 'Try your own numbers', p: 'Change these to see your date move. Open "How this is worked out" under any result to see the formula.' },
  { tab: 'money', el: 'addOpen', t: 'Track your money', p: 'Add income and expenses here. Your averages then feed into your freedom date.' },
  { tab: 'money', el: 'topbar', t: 'See it your way', p: 'Pick the currency to view everything in, and save your plan from the menu, because your numbers stay in this browser.' },
];
let tourAt = -1;

function placeTour() {
  if (tourAt < 0) return;
  const r = $(TOUR_STEPS[tourAt].el).getBoundingClientRect();
  const pad = 8, vw = innerWidth, vh = innerHeight, spot = $('tourSpot'), card = $('tourCard');
  const top = Math.max(8, r.top - pad);
  const bottom = Math.min(vh - 8, r.bottom + pad);
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${top}px`, width: `${r.width + pad * 2}px`, height: `${Math.max(0, bottom - top)}px` });
  const ch = card.offsetHeight, cw = card.offsetWidth;
  const cy = bottom + 12 <= vh - ch - 8 ? bottom + 12 : top - ch - 12 >= 8 ? top - ch - 12 : vh - ch - 16;
  card.style.left = `${Math.min(Math.max(16, r.left), vw - cw - 16)}px`;
  card.style.top = `${cy}px`;
}

function showStep(i) {
  tourAt = i;
  const s = TOUR_STEPS[i];
  showTab(s.tab);
  $('tourCount').textContent = `Step ${i + 1} of ${TOUR_STEPS.length}`;
  $('tourTitle').textContent = s.t;
  $('tourText').textContent = s.p;
  $('tourBack').hidden = i === 0;
  $('tourNext').textContent = i === TOUR_STEPS.length - 1 ? 'Done' : 'Next';
  $(s.el).scrollIntoView({ block: 'center' });
  placeTour();
  $('tourNext').focus();
}

const tourParts = ['tourShade', 'tourSpot', 'tourCard'];

function openTour() {
  $('menu').open = false;
  tourParts.forEach(id => { $(id).hidden = false; });
  showStep(0);
}

function closeTour() {
  tourAt = -1;
  tourParts.forEach(id => { $(id).hidden = true; });
  writeStored(TOUR_KEY, true);
  showTab('freedom');
  $('tab-freedom').focus({ preventScroll: true });
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
    if (e.key === 'Escape') closeTour();
    if (e.key === 'Tab') {
      const buttons = [...$('tourCard').querySelectorAll('button')].filter(b => !b.hidden);
      const i = buttons.indexOf(document.activeElement);
      e.preventDefault();
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
}
