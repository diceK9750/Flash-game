// Display-only flashy SPECIAL success cut-in. Physics / SPECIAL rules unchanged.
const assert = require('node:assert/strict');
const { scope, launch } = require('./phase2.cjs');
const H = scope.Hop, c = H.CONFIG, G = H.Graphics;
let cases = 0;
const near = (a, b, label, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);

assert.deepEqual(
  [c.specialCutinDuration, c.specialCutinImpact, c.specialCutinWipe, c.specialCutinHold, c.specialCutinReducedDuration],
  [1.2, 0.12, 0.22, 0.55, 0.45]
);
assert.deepEqual(
  [c.specialCutinBandHeight, c.specialCutinPortraitScale, c.specialCutinShakePx, c.specialCutinFlashPeak, c.specialCutinPortraitPop, c.specialCutinTitlePop],
  [248, 3.6, 10, 0.85, 1.35, 1.7]
);
assert(c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold < c.specialCutinDuration, 'fade window');
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

// Success starts cut-in; MISS does not.
{
  const g = flying(); Object.assign(g.body, { x: 100, y: 200, vx: 500, vy: 100 });
  armSpecial(g, 'BOOST'); assert.equal(g.resolveSpecial(true), true);
  assert(g.specialCutin); assert.equal(g.specialCutin.name, c.specials.BOOST.name);
  near(g.specialCutin.remaining, c.specialCutinDuration, 'duration');
  const m = flying(); armSpecial(m, 'BOOST'); m.resolveSpecial(false);
  assert.equal(m.specialCutin, null);
  cases++;
}

// Merchant + STOPPER strong.
{
  const g = flying(); armSpecial(g, 'DASH', { merchantType: 'B' }); g.resolveSpecial(true);
  assert.equal(g.specialCutin.type, 'MERCHANT'); assert.equal(g.specialCutin.castId, 'SPECIAL_ONLY');
  const s = flying(); Object.assign(s.body, { stopped: false, grounded: false, y: 100 });
  armSpecial(s, 'STOPPER'); s.resolveSpecial(true); assert.equal(s.specialCutin.strong, true);
  cases++;
}

// Timer + restart.
{
  const g = flying(); armSpecial(g, 'ANGLE'); g.resolveSpecial(true);
  for (let i = 0; i < Math.round(c.specialCutinDuration / c.physicsStep) + 5; i++) g.update(c.physicsStep);
  assert.equal(g.specialCutin, null);
  armSpecial(g, 'BRAKE'); g.resolveSpecial(true);
  for (let i = 0; i < 20; i++) g.update(c.physicsStep);
  armSpecial(g, 'GUARD'); g.normalGuard = 1; g.resolveSpecial(true);
  near(g.specialCutin.remaining, c.specialCutinDuration, 'restart');
  g.reset(); assert.equal(g.specialCutin, null);
  cases++;
}

// Style timeline: impact flash/shake → wipe/pop → hold → fade; reducedMotion still.
{
  const impact = G.specialCutinStyle(0.04, false, false);
  assert(impact.visible && impact.flash > 0.4 && Math.abs(impact.shakeX) + Math.abs(impact.shakeY) > 0, 'impact');
  assert(impact.portraitPop > 1.1 && impact.titlePop > 1.2, 'pops at impact');
  const wipe = G.specialCutinStyle(c.specialCutinImpact + c.specialCutinWipe * 0.5, false, false);
  assert(wipe.wipe > 0.4 && wipe.wipe < 1 && wipe.slide > 0, 'wipe mid');
  const hold = G.specialCutinStyle(c.specialCutinImpact + c.specialCutinWipe + 0.1, false, false);
  assert(hold.wipe === 1 && hold.slide === 0 && hold.portraitPop === 1 && hold.alpha === 1, 'hold');
  const fade = G.specialCutinStyle(c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold + 0.1, false, false);
  assert(fade.alpha < 1 && fade.alpha > 0, 'fade');
  const strongImpact = G.specialCutinStyle(0.04, false, true);
  assert(strongImpact.flash > impact.flash, 'STOPPER flash stronger');
  const red = G.specialCutinStyle(0.05, true, true);
  assert(red.visible && red.flash === 0 && red.shakeX === 0 && red.wipe === 1 && red.portraitPop === 1, 'reduced still');
  assert(!G.specialCutinStyle(c.specialCutinReducedDuration + 0.01, true).visible, 'reduced ends');
  cases++;
}

// Draw purity (normal + reduced).
{
  const g = flying(); Object.assign(g.body, { x: 400, y: 180, vx: 600, vy: -100 });
  armSpecial(g, 'BOUNCE'); g.resolveSpecial(true);
  const snap = JSON.stringify({ body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses, flash: g.flash, best: g.best });
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => o[k] || ((...a) => { calls.push(k); return o; }), set: (o, k, v) => (o[k] = v, true) });
  // Clip path needs beginPath/moveTo/lineTo/closePath/clip — proxy returns functions.
  const visual = { reducedMotion: false, launchAt: -Infinity, contactAt: -Infinity, readyTargets: [] };
  G.draw(ctx, g, visual);
  assert(calls.length > 0);
  assert.equal(JSON.stringify({ body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses, flash: g.flash, best: g.best }), snap);
  visual.reducedMotion = true; G.draw(ctx, g, visual);
  assert.equal(JSON.stringify({ body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses, flash: g.flash, best: g.best }), snap);
  cases++;
}

// Cut-in alone does not pause DOWN recharge.
{
  const g = flying(); g.downCharge = 0;
  g.specialCutin = { type: 'BOOST', castId: 'BOOST', name: 'x', castName: 'y', merchantType: null, strong: false, remaining: 5, total: 5 };
  g.specialMessage = null; g.merchantVisual = null; g.special = null;
  const before = g.downCharge;
  for (let i = 0; i < 30; i++) g.update(c.physicsStep);
  assert(g.downCharge > before);
  cases++;
}

console.log(JSON.stringify({ specialCutin: 'PASS', cases }));
