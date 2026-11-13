// BRAKE's brief white impact must not hide the hero and violet cross-slash for the whole scene.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG, originalSpark = G.spark, originalLine = G.line;
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b, label, eps = 1e-8) => assert(Math.abs(a - b) < eps, `${label}: ${a} != ${b}`);
const scene = (type, b, opts = {}) => ({ type, t: C.grandClimax[type] + G.GRAND_HITSTOP + b, end: 2.4, climax: C.grandClimax[type],
  grand: true, heroWX: 1200, heroY: 50, source: { x: 1230 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...opts });
function ctx() {
  const stack = [], o = { globalAlpha: 1, save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop()); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v, k, val) => (v[k] = val, true) });
}
function render(st, back = false) {
  const sparks = [], lines = [], c = ctx(), snapshot = JSON.stringify(st);
  G.spark = (context, x, y, radius, color) => sparks.push({ x, y, radius, color, alpha: context.globalAlpha });
  G.line = (context, points, color, width) => lines.push({ points, color, width, alpha: context.globalAlpha });
  if (back) G.grandBack(c, st, sx, sy, ground); else G.grandFront(c, st, sx, sy, ground);
  assert.equal(JSON.stringify(st), snapshot, 'render does not mutate the scene');
  return { sparks, lines };
}
try {
  const white = b => render(scene('BRAKE', b)).sparks.find(s => s.color === '#ffffff');
  const alpha = b => white(b)?.alpha ?? 0;
  near(alpha(0), 0.55, 'clear but visible initial impact');
  let previous = Infinity;
  for (const b of [0, 0.04, 0.08, 0.12, 0.15999, 0.16, 0.2, 0.35]) {
    const a = alpha(b); assert(a <= previous + 1e-8 && a >= 0 && a <= 0.55, 'white star tapers and stays bounded'); previous = a;
  }
  assert(alpha(0.15999) < 1e-7 && alpha(0.16) === 0, 'fade approaches zero continuously at end');
  assert(alpha(0.12) > 0.08 && alpha(0.12) < 0.1, 'QA t=1.40 keeps the hero visible');
  const shot = render(scene('BRAKE', 0.12));
  assert(shot.sparks.some(s => s.color === G.GRAND.BRAKE.glow && s.alpha > 0.12 && s.alpha < 0.14), 'violet star fades sooner as well');
  assert(render(scene('BRAKE', 0.12), true).lines.some(l => l.color === G.GRAND.BRAKE.color && l.width === 10), 'violet final slash remains behind the hero');
  const origin = render(scene('BRAKE', 0)).sparks.filter(s => s.color === G.GRAND.BRAKE.glow)[0];
  near(origin.alpha, 0.5, 'violet hit stays visible at impact');
  const violet = b => render(scene('BRAKE', b)).sparks.find(s => s.color === G.GRAND.BRAKE.glow)?.alpha ?? 0;
  let violetPrevious = Infinity;
  for (const b of [0, 0.04, 0.09, 0.12, 0.17999, 0.18, 0.2]) {
    const value = violet(b); assert(value <= violetPrevious + 1e-8 && value >= 0 && value <= 0.5, 'violet star tapers and stays bounded'); violetPrevious = value;
  }
  assert(violet(0.17999) < 1e-7 && violet(0.18) === 0, 'violet fade is continuous at end');
  // Unmodified SPECIALs retain the common 0.35-second white and colored burst.
  for (const type of ['DASH']) {
    const data = render(scene(type, 0.12)), common = data.sparks.slice(0, 2);
    assert.equal(common[0].color, G.GRAND[type].glow); assert.equal(common[1].color, '#ffffff');
    near(common[0].alpha, 1 - 0.12 / 0.35, type + ' colored star'); near(common[1].alpha, 1 - 0.12 / 0.35, type + ' white star');
  }
  // Existing shortened, skipped and afterglow states are unchanged.
  for (const opts of [{ skipped: true }, { after: 0, afterTotal: 0.6 }]) {
    const sparks = render(scene('BRAKE', 0.12, opts)).sparks;
    near(sparks.find(s => s.color === '#ffffff').alpha, 1 - 0.12 / 0.35, 'skip/after retains old white star');
    near(sparks.find(s => s.color === G.GRAND.BRAKE.glow).alpha, 1 - 0.12 / 0.35, 'skip/after retains old violet star');
  }
  assert(!render(scene('BRAKE', 0, { short: true })).sparks.some(s => s.color === '#ffffff'), 'short/reduced keeps its existing later still');
  assert.deepEqual(render(scene('BRAKE', 0.12)), render(scene('BRAKE', 0.12)), 'paused scene rendering is deterministic');
  console.log('BRAKE impact clarity PASS: bounded brief stars, end continuity, preserved violet slash, other specials, skip/short/after and render purity.');
} finally { G.spark = originalSpark; G.line = originalLine; }
