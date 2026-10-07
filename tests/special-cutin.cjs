// Display-only early-Tales band SPECIAL cut-in. Physics / SPECIAL rules unchanged.
const assert = require('node:assert/strict');
const { scope, launch } = require('./phase2.cjs');
const H = scope.Hop, c = H.CONFIG, G = H.Graphics;
let cases = 0;
const near = (a, b, label, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);

assert.deepEqual(
  [c.specialCutinDuration, c.specialCutinImpact, c.specialCutinWipe, c.specialCutinHold, c.specialCutinReducedDuration],
  [1.0, 0.07, 0.24, 0.46, 0.40]
);
assert.deepEqual(
  [c.specialCutinBandHeight, c.specialCutinBandTiltDeg, c.specialCutinFaceScale, c.specialCutinPortraitScale, c.specialCutinNameSize],
  [300, 7, 1.35, 3.2, 62]
);
assert(c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold < c.specialCutinDuration, 'fade window');
assert.equal(c.specialCutinSlam, undefined, 'slam key removed');
assert.equal(c.specialCutinRayCount, undefined, 'ray key removed');
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

{ const g = flying(); armSpecial(g, 'BOOST'); g.resolveSpecial(true);
  assert(g.specialCutin); near(g.specialCutin.remaining, c.specialCutinDuration, 'dur');
  const m = flying(); armSpecial(m, 'BOOST'); m.resolveSpecial(false); assert.equal(m.specialCutin, null); cases++; }
{ const g = flying(); armSpecial(g, 'DASH', { merchantType: 'B' }); g.resolveSpecial(true);
  assert.equal(g.specialCutin.castId, 'SPECIAL_ONLY');
  const s = flying(); Object.assign(s.body, { y: 100, stopped: false }); armSpecial(s, 'STOPPER'); s.resolveSpecial(true);
  assert.equal(s.specialCutin.strong, true); cases++; }
{ const g = flying(); armSpecial(g, 'ANGLE'); g.resolveSpecial(true);
  for (let i = 0; i < Math.round(c.specialCutinDuration / c.physicsStep) + 4; i++) g.update(c.physicsStep);
  assert.equal(g.specialCutin, null);
  armSpecial(g, 'GUARD'); g.normalGuard = 1; g.resolveSpecial(true);
  near(g.specialCutin.remaining, c.specialCutinDuration, 'restart'); g.reset(); assert.equal(g.specialCutin, null); cases++; }

// Timeline: impact → wipe → hold → fade; reducedMotion still.
{
  const impact = G.specialCutinStyle(0.03, false, false);
  assert(impact.visible && impact.flash > 0.4 && impact.wipe < 0.35 && impact.portraitPop > 1.05, 'impact');
  const wipe = G.specialCutinStyle(c.specialCutinImpact + c.specialCutinWipe * 0.55, false, false);
  assert(wipe.wipe > 0.5 && wipe.wipe < 1, 'wipe mid');
  const hold = G.specialCutinStyle(c.specialCutinImpact + c.specialCutinWipe + 0.1, false, false);
  assert(hold.wipe === 1 && hold.portraitPop === 1 && hold.alpha === 1, 'hold');
  const fade = G.specialCutinStyle(c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold + 0.1, false, false);
  assert(fade.alpha < 1 && fade.alpha > 0, 'fade');
  const strong = G.specialCutinStyle(0.03, false, true);
  assert(strong.flash > impact.flash, 'STOPPER stronger flash');
  const red = G.specialCutinStyle(0.05, true, true);
  assert(red.visible && red.flash === 0 && red.wipe === 1 && red.shakeX === 0, 'reduced');
  assert(!G.specialCutinStyle(c.specialCutinReducedDuration + 0.01, true).visible); cases++;
}

{
  const g = flying(); Object.assign(g.body, { x: 400, y: 180, vx: 600, vy: -100 });
  armSpecial(g, 'BOUNCE'); g.resolveSpecial(true);
  const snap = JSON.stringify({ body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses, flash: g.flash, best: g.best });
  const ctx2 = {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    clip() {}, fillRect() {}, stroke() {}, fillText() {}, strokeText() {}, arc() {}, fill() {}, rect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    set fillStyle(v) {}, set strokeStyle(v) {}, set globalAlpha(v) {}, set lineWidth(v) {}, set font(v) {},
    set textAlign(v) {}, set textBaseline(v) {}, set lineJoin(v) {}, set globalCompositeOperation(v) {}
  };
  const visual = { reducedMotion: false, launchAt: -Infinity, contactAt: -Infinity, readyTargets: [] };
  G.draw(ctx2, g, visual);
  assert.equal(JSON.stringify({ body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses, flash: g.flash, best: g.best }), snap);
  visual.reducedMotion = true; G.draw(ctx2, g, visual);
  assert.equal(JSON.stringify({ body: g.body, cut: g.specialCutin, specialSuccesses: g.specialSuccesses, flash: g.flash, best: g.best }), snap);
  cases++;
}

{ const g = flying(); g.downCharge = 0;
  g.specialCutin = { type: 'BOOST', castId: 'BOOST', name: 'x', castName: 'y', merchantType: null, strong: false, remaining: 5, total: 5 };
  g.specialMessage = null; g.merchantVisual = null; g.special = null;
  const before = g.downCharge; for (let i = 0; i < 30; i++) g.update(c.physicsStep);
  assert(g.downCharge > before); cases++; }

// Dedicated face plates for every SPECIAL cast
{
  const ids = ['BOOST','BOUNCE','BRAKE','DASH','STOPPER','ANGLE','GUARD','SPECIAL_ONLY'];
  for (const id of ids) {
    const def = H.Sprites.definitions.CAST[id].CUTIN_FACE;
    assert(def && def.enabled !== false && def.animation === 'CUTIN_FACE');
    assert(require('node:fs').existsSync(require('node:path').join(__dirname, '..', def.src)));
  }
  cases++;
}

console.log(JSON.stringify({ specialCutin: 'PASS', cases }));
