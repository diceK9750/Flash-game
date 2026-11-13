// Preserve GUARD's dome and motes while making its central impact brief and readable.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG, oldSpark = G.spark, oldCached = G.guardDomeCached;
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y;
const scene = (type, b, opts = {}) => ({ type, t: C.grandClimax[type] + G.GRAND_HITSTOP + b,
  end: 2.4, climax: C.grandClimax[type], grand: true, heroWX: 1200, heroY: 50,
  source: { x: 1230 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...opts });
function context() {
  const stack = [], obj = { globalAlpha: 1, arcs: [], save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); }, arc(x, y, r) { this.arcs.push({ x, y, r }); } };
  return new Proxy(obj, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
}
function render(st) {
  const sparks = [], domes = [], ctx = context(), before = JSON.stringify(st);
  G.spark = (c, x, y, radius, color) => sparks.push({ x, y, radius, color, alpha: c.globalAlpha });
  G.guardDomeCached = (c, x, y, r, alpha) => { domes.push({ x, y, r, alpha }); return true; };
  G.grandFront(ctx, st, sx, sy, C.groundY);
  assert.equal(JSON.stringify(st), before, 'scene not mutated'); near(ctx.globalAlpha, 1);
  return { sparks, domes, arcs: ctx.arcs };
}
try {
  const star = (b, color) => render(scene('GUARD', b)).sparks.find(s => s.color === color)?.alpha ?? 0;
  const cyan = G.GRAND.GUARD.glow, white = '#ffffff';
  for (const [color, maximum, end] of [[cyan, 0.5, 0.18], [white, 0.55, 0.16]]) {
    near(star(0, color), maximum); let previous = maximum;
    for (let i = 1; i <= 200; i++) { const v = star(end * i / 200, color); assert(v >= 0 && v <= previous + 1e-8 && v <= maximum); previous = v; }
    assert(star(end - 0.00001, color) < 1e-7 && star(end, color) === 0, 'continuous endpoint');
  }
  const b = 0.3, shot = render(scene('GUARD', b)), h = G.grandHero(scene('GUARD', b), sx, sy);
  const R = 108 * G.ease(b / 0.3) * (1 + 0.03 * Math.sin(b * 12));
  assert(shot.domes.length === 1, 'barrier dome remains visible');
  near(shot.domes[0].x, h.x); near(shot.domes[0].y, h.y); near(shot.domes[0].r, R); near(shot.domes[0].alpha, 0.85);
  assert(shot.arcs.some(a => Math.abs(a.r - R) < 1e-8), 'dome outline remains');
  assert.equal(shot.sparks.filter(s => s.color === '#e8fdff').length, 14, 'all particles retained');
  for (const type of ['DASH']) { const s = render(scene(type, 0.12)).sparks; near(s[0].alpha, 1 - 0.12 / 0.35); near(s[1].alpha, 1 - 0.12 / 0.35); }
  for (const type of ['BRAKE', 'ANGLE']) { const s = render(scene(type, 0)).sparks; near(s[0].alpha, 0.5); near(s[1].alpha, 0.55); }
  for (const opts of [{ skipped: true }, { after: 0, afterTotal: 0.6 }]) { const s = render(scene('GUARD', 0.12, opts)).sparks; near(s.find(v => v.color === cyan).alpha, 1 - 0.12 / 0.35); near(s.find(v => v.color === white).alpha, 1 - 0.12 / 0.35); }
  assert(!render(scene('GUARD', 0, { short: true })).sparks.some(s => s.color === white));
  assert.deepEqual(render(scene('GUARD', b)), render(scene('GUARD', b)), 'paused render deterministic');
  console.log('GUARD impact clarity PASS: continuous fade, dome geometry/outline, particles, other specials, short/skip/after and state purity.');
} finally { G.spark = oldSpark; G.guardDomeCached = oldCached; }
