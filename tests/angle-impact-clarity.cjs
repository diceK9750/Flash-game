// ANGLE's common impact fades before it can obscure the airborne hero.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG, oldSpark = G.spark;
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y;
const scene = (type, b, opts = {}) => ({ type, t: C.grandClimax[type] + G.GRAND_HITSTOP + b,
  end: 2.4, climax: C.grandClimax[type], grand: true, heroWX: 1200, heroY: 50,
  source: { x: 1230 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...opts });
function context() {
  const stack = [], obj = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); } };
  return new Proxy(obj, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
}
function render(st) {
  const sparks = [], ctx = context(), before = JSON.stringify(st);
  G.spark = (c, x, y, radius, color) => sparks.push({ x, y, radius, color, alpha: c.globalAlpha });
  G.grandFront(ctx, st, sx, sy, C.groundY);
  assert.equal(JSON.stringify(st), before, 'scene is not mutated');
  near(ctx.globalAlpha, 1);
  return sparks;
}
try {
  const star = (b, color) => render(scene('ANGLE', b)).find(s => s.color === color)?.alpha ?? 0;
  const pink = G.GRAND.ANGLE.glow, white = '#ffffff';
  for (const [color, maximum, end] of [[pink, 0.5, 0.18], [white, 0.55, 0.16]]) {
    near(star(0, color), maximum);
    let previous = maximum;
    for (let i = 1; i <= 200; i++) {
      const value = star(end * i / 200, color);
      assert(value >= 0 && value <= previous + 1e-8 && value <= maximum, 'bounded monotone fade');
      previous = value;
    }
    assert(star(end - 0.00001, color) < 1e-7 && star(end, color) === 0, 'continuous endpoint');
  }
  assert(star(0.1, pink) < 0.21 && star(0.1, white) < 0.18, 'QA impact keeps the hero readable');
  for (const type of ['DASH']) {
    const sparks = render(scene(type, 0.12));
    near(sparks[0].alpha, 1 - 0.12 / 0.35); near(sparks[1].alpha, 1 - 0.12 / 0.35);
  }
  for (const opts of [{ skipped: true }, { after: 0, afterTotal: 0.6 }]) {
    const sparks = render(scene('ANGLE', 0.12, opts));
    near(sparks.find(s => s.color === pink).alpha, 1 - 0.12 / 0.35);
    near(sparks.find(s => s.color === white).alpha, 1 - 0.12 / 0.35);
  }
  assert(!render(scene('ANGLE', 0, { short: true })).some(s => s.color === white), 'short scene unchanged');
  assert.deepEqual(render(scene('ANGLE', 0.1)), render(scene('ANGLE', 0.1)), 'paused render deterministic');
  console.log('ANGLE impact clarity PASS: bounded continuous fade, other specials, short/skip/after, deterministic render and state purity.');
} finally { G.spark = oldSpark; }
