// Turns the saved plan into the numbers every view shows.
const laterMonthly = (home, cutNow = 0) => {
  const s = state;
  const last = s.stages[s.stages.length - 1];
  const now = Math.max(0, last.spend - cutNow) * planRate();
  if (!s.move) return now;
  return home === 'buy' ? (s.own || now) : ((s.mRent + s.mOther) || now);
};

// Goal in the plan currency.
function goalFor(home, { cutNow = 0, cutLater = 0, wr = state.wr } = {}) {
  const s = state;
  const need = Engine.potFor(laterMonthly(home, cutNow) - cutLater - s.side * planRate(), wr);
  return need + (s.move && home === 'buy' ? s.price : 0);
}

const planInput = (extra = {}) => ({ cur: state.cur, ret: state.ret, stages: state.stages, start: thisMonth(), ...extra });
const monthsToReach = (goalUsd, extra = {}) => Engine.simulate(planInput({ goal: goalUsd, ...extra })).hit;

function buildModel() {
  const s = state;
  const rate = planRate();
  const goal = goalFor(s.home);
  const goalUsd = goal / rate;
  const mid = Engine.simulate(planInput({ goal: goalUsd }));
  const lo = Math.max(0, s.ret - RETURN_SPREAD);
  const hi = s.ret + RETURN_SPREAD;
  const hitLo = monthsToReach(goalUsd, { ret: lo });
  const hitHi = monthsToReach(goalUsd, { ret: hi });
  const now = Engine.stageAt(s.stages, thisMonth());

  const span = Math.min(40, Math.max(5, Math.ceil(((mid.hit ?? hitLo ?? 240) / 12) + 1)));
  const months = span * 12;
  const run = ret => Engine.simulate(planInput({ ret, months, keepGoing: true })).series;
  const [midS, loS, hiS] = [run(s.ret), run(lo), run(hi)];
  const points = [];
  for (let y = 0; y <= span; y++) {
    const i = y * 12;
    points.push({ y, mid: midS[i].pot, lo: loS[i].pot, hi: hiS[i].pot, own: midS[i].own });
  }

  return {
    goal, goalUsd, rate, unit: unit(), lo, hi, hit: mid.hit, hitLo, hitHi, ranOut: mid.ranOut, points, span, now,
    runway: Engine.runway(s.cur, now.spend),
    later: laterMonthly(s.home),
  };
}
