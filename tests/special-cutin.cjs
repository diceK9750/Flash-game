// Display-only SPECIAL success cut-in (fighting-game band). Physics / SPECIAL rules unchanged.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, c = H.CONFIG, G = H.Graphics;
let cases = 0;
const near = (a, b, label, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);

// Config keys present; no magic durations required in game.js beyond CONFIG reads.
assert.deepEqual(
  [c.specialCutinDuration, c.specialCutinSlideIn, c.specialCutinHold, c.specialCutinReducedDuration, c.specialCutinBandHeight, c.specialCutinPortraitScale],
  [1.0, 0.18, 0.55, 0.45, 230, 3.6]
);
assert(c.specialCutinSlideIn + c.specialCutinHold < c.specialCutinDuration, 'fade window exists');
cases++;

function flying() {
  const g = launch(); g.objects = []; g.nextObjectX = g.nextBoundaryX = Infinity; return g;
}
function armSpecial(g, type, extra = {}) {
  g.special = {
    type, merchantType: extra.merchantType || null, partner: extra.partner || null,
    remaining: c.specialWindow, entry: { type, label: type }, guardAtContact: 0,
    velocity: { vx: g.body.vx, vy: g.body.vy }
  };
}

// Success starts a cut-in with type / name / cast; MISS does not.
{
  const g = flying(); Object.assign(g.body, { x: 100, y: 200, vx: 500, vy: 100 });
  armSpecial(g, 'BOOST'); assert.equal(g.resolveSpecial(true), true);
  assert(g.specialCutin, 'cutin on success');
  assert.equal(g.specialCutin.type, 'BOOST');
  assert.equal(g.specialCutin.name, c.specials.BOOST.name);
  assert.equal(g.specialCutin.castId, 'BOOST');
  assert.equal(g.specialCutin.castName, H.CAST.BOOST.name);
  near(g.specialCutin.remaining, c.specialCutinDuration, 'full duration');
  near(g.specialCutin.total, c.specialCutinDuration, 'total');
  assert.equal(g.specialCutin.strong, false);
  const m = flying(); armSpecial(m, 'BOOST'); assert.equal(m.resolveSpecial(false), true);
  assert.equal(m.specialCutin, null, 'MISS has no cutin');
  cases++;
}

// Merchant success also starts a cut-in (Type label + merchant name).
{
  const g = flying(); armSpecial(g, 'DASH', { merchantType: 'B' });
  assert.equal(g.resolveSpecial(true), true);
  assert.equal(g.specialCutin.type, 'MERCHANT');
  assert.equal(g.specialCutin.castId, 'SPECIAL_ONLY');
  assert.equal(g.specialCutin.merchantType, 'B');
  assert.equal(g.specialCutin.name, c.merchantNames.B);
  cases++;
}

// STOPPER success marks strong (gold band path).
{
  const g = flying(); armSpecial(g, 'STOPPER');
  // STOPPER success launches — body must not be stopped
  Object.assign(g.body, { stopped: false, grounded: false, y: 100 });
  assert.equal(g.resolveSpecial(true), true);
  assert.equal(g.specialCutin.strong, true);
  assert.equal(g.specialCutin.type, 'STOPPER');
  cases++;
}

// Timer expires after specialCutinDuration; continuous success restarts from full.
{
  const g = flying(); armSpecial(g, 'ANGLE'); g.resolveSpecial(true);
  const steps = Math.round(c.specialCutinDuration / c.physicsStep);
  for (let i = 0; i < steps - 2; i++) g.update(c.physicsStep);
  assert(g.specialCutin && g.specialCutin.remaining > 0, 'still running');
  for (let i = 0; i < 10; i++) g.update(c.physicsStep);
  assert.equal(g.specialCutin, null, 'expired');
  armSpecial(g, 'BRAKE'); g.resolveSpecial(true);
  const first = g.specialCutin.remaining;
  for (let i = 0; i < 20; i++) g.update(c.physicsStep);
  const mid = g.specialCutin.remaining;
  armSpecial(g, 'GUARD'); g.normalGuard = 1; g.resolveSpecial(true);
  near(g.specialCutin.remaining, c.specialCutinDuration, 'restarted');
  assert.equal(g.specialCutin.type, 'GUARD');
  assert(mid < first, 'was ticking before restart');
  cases++;
}

// reset clears cut-in.
{
  const g = flying(); armSpecial(g, 'BOOST'); g.resolveSpecial(true);
  assert(g.specialCutin); g.reset(); assert.equal(g.specialCutin, null);
  cases++;
}

// Style helper: slide → hold → fade; reducedMotion is a short still.
{
  const slide = G.specialCutinStyle(0.05, false);
  assert(slide.visible && slide.slide > 0.5 && slide.alpha === 1, 'slide-in');
  const hold = G.specialCutinStyle(c.specialCutinSlideIn + 0.1, false);
  assert(hold.visible && hold.slide === 0 && hold.alpha === 1, 'hold');
  const fade = G.specialCutinStyle(c.specialCutinSlideIn + c.specialCutinHold + 0.1, false);
  assert(fade.visible && fade.alpha < 1 && fade.alpha > 0, 'fade');
  const gone = G.specialCutinStyle(c.specialCutinDuration, false);
  assert(!gone.visible, 'done');
  const red = G.specialCutinStyle(0.1, true);
  assert(red.visible && red.slide === 0 && red.alpha === 1, 'reduced still');
  const redGone = G.specialCutinStyle(c.specialCutinReducedDuration + 0.01, true);
  assert(!redGone.visible, 'reduced ends early');
  cases++;
}

// Drawing does not mutate game state (body / specialCutin / scores).
{
  const g = flying(); Object.assign(g.body, { x: 400, y: 180, vx: 600, vy: -100 });
  armSpecial(g, 'BOUNCE', { partner: { used: false } });
  // partner used on success for adjacent — BOUNCE needs partner in rule; launchVector runs
  g.resolveSpecial(true);
  const snap = JSON.stringify({
    body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses,
    flash: g.flash, trail: g.specialTrail, best: g.best
  });
  const calls = [];
  const ctx = new Proxy({}, {
    get: (o, k) => o[k] || ((...a) => { calls.push([k, ...a]); return o; }),
    set: (o, k, v) => (o[k] = v, true)
  });
  const visual = { reducedMotion: false, launchAt: -Infinity, contactAt: -Infinity, readyTargets: [] };
  G.draw(ctx, g, visual);
  assert(calls.length > 0, 'drew something');
  assert.equal(JSON.stringify({
    body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses,
    flash: g.flash, trail: g.specialTrail, best: g.best
  }), snap, 'draw purity');
  // reducedMotion path also pure
  visual.reducedMotion = true;
  G.draw(ctx, g, visual);
  assert.equal(JSON.stringify({
    body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses,
    flash: g.flash, trail: g.specialTrail, best: g.best
  }), snap, 'reduced draw purity');
  cases++;
}

// Cut-in does not pause DOWN recharge (unlike specialMessage — charge pause is pre-existing for message).
// specialCutin alone must not be in playTimersPaused: after message expires, charge resumes while cutin may still show.
{
  const g = flying(); Object.assign(g.body, { y: 300, vx: 500, vy: 200 });
  g.downCharge = 0;
  armSpecial(g, 'ANGLE'); g.resolveSpecial(true);
  assert(g.specialMessage && g.specialCutin);
  // Advance past specialMessage (1.3s) but within cutin if we extend — cutin is 1.0s so both end around then.
  // Verify playTimersPaused formula does not include specialCutin by inspecting charge after message clears
  // while manually keeping a cutin alive.
  for (let i = 0; i < Math.round(c.specialMessageDuration / c.physicsStep) + 2; i++) g.update(c.physicsStep);
  // message gone; cutin may be gone too (1.0 < 1.3). Re-set cutin only and confirm charge ticks.
  g.specialCutin = { type: 'BOOST', castId: 'BOOST', name: 'x', castName: 'y', merchantType: null, strong: false, remaining: 5, total: 5 };
  g.specialMessage = null; g.merchantVisual = null; g.special = null;
  const before = g.downCharge;
  for (let i = 0; i < 30; i++) g.update(c.physicsStep);
  assert(g.downCharge > before, 'cutin alone does not pause recharge');
  cases++;
}

console.log(JSON.stringify({ specialCutin: 'PASS', cases }));
