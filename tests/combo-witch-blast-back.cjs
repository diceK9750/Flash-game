// BOOST burst accents are presentation-only, bounded and stay behind the actors.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG, blast = C.comboWitchTimes.blast;
const original = { fx: G.comboWitchBlastBack, blend: G.comboCastBlend, cast: G.comboCast };
const sx = x => C.launchX + x - 900, sy = y => C.groundY - C.playerRadius - y;
const makeScene = (age, opts = {}) => ({ type: 'BOOST', t: blast + age, end: C.comboWitchDuration - G.comboSceneStart(false),
  short: false, skipped: false, after: null, afterTotal: 0.6, heroWX: 1200, heroY: 50,
  source: { x: 1080 }, partner: { x: 1700 }, room: 400, ...opts });
function recorder() {
  const out = [], stack = [], c = { globalAlpha: 0.8, out,
    save() { stack.push({ globalAlpha: this.globalAlpha, strokeStyle: this.strokeStyle, fillStyle: this.fillStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop()); }, beginPath() {}, closePath() {},
    arc(x, y, r) { this.arcArgs = [x, y, r]; },
    stroke() { out.push({ kind: 'stroke', arc: this.arcArgs, color: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha }); },
    moveTo(x, y) { this.points = [[x, y]]; }, lineTo(x, y) { this.points.push([x, y]); },
    fill() { out.push({ kind: 'fill', points: this.points.slice(), color: this.fillStyle, alpha: this.globalAlpha }); }
  }; return c;
}
function draw(st, reduced = false) {
  const before = JSON.stringify(st), c = recorder();
  const visible = G.comboWitchBlastBack(c, st, sx, sy, reduced);
  assert.equal(JSON.stringify(st), before, 'scene is not changed');
  assert.equal(c.globalAlpha, 0.8, 'Canvas alpha is restored');
  return { visible, out: c.out };
}
try {
  const end = makeScene(0).end - blast;
  for (const age of [-0.01, 0, end, end + 0.01, NaN]) assert.deepEqual(draw(makeScene(age)), { visible: false, out: [] });
  for (const flag of [{ short: true }, { skipped: true }, { after: 0 }, { type: 'BOUNCE' }])
    assert.deepEqual(draw(makeScene(end / 2, flag)), { visible: false, out: [] });
  assert.deepEqual(draw(makeScene(end / 2), true), { visible: false, out: [] });
  for (const age of [1e-6, end - 1e-6]) {
    const result = draw(makeScene(age)); assert(result.visible && result.out[0].alpha < 1e-8, 'continuous fade at boundary');
  }
  const st = makeScene(end / 2), center = G.comboActors(st).hero, result = draw(st);
  const rings = result.out.filter(item => item.kind === 'stroke'), flames = result.out.filter(item => item.kind === 'fill');
  assert.equal(rings.length, 2); assert.equal(flames.length, 12);
  assert.deepEqual(rings.map(item => item.color), ['#ffc148', '#fff1ba']);
  const x = sx(st.heroWX) + center.dx, y = sy(st.heroY) + center.dy;
  for (const ring of rings) {
    assert(Math.abs(ring.arc[0] - x) < 1e-8 && Math.abs(ring.arc[1] - y) < 1e-8, 'same center as existing blast');
    assert(ring.arc[2] > 40 && ring.arc[2] < 300); assert(ring.alpha <= 0.8 * 0.68 + 1e-8);
  }
  for (const flame of flames) {
    assert.equal(flame.points.length, 3); assert(flame.points.every(([px, py]) => Math.hypot(px - x, py - y) > rings[0].arc[2]), 'flames do not cover the center');
    assert(['#ffb14a', '#ffe477'].includes(flame.color));
  }
  assert.deepEqual(draw(st), result, 'paused redraw is deterministic');
  // Equal elapsed times have equal appearance regardless of how frame times were produced.
  const frames = [30, 60, 120, 144].map(fps => {
    const samples = []; for (let i = 0; i / fps < end; i++) samples.push(draw(makeScene(i / fps)));
    assert(samples.some(item => item.visible), `${fps} fps shows the burst`);
    return draw(makeScene(Math.round(fps / 6) / fps));
  });
  for (const frame of frames.slice(1)) assert.deepEqual(frame, frames[0], 'same elapsed time at 30–144 fps');

  // In the real back layer the new effect precedes both actors; other types do not get the accent.
  const order = [], ctx = new Proxy({ globalAlpha: 1 }, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) });
  G.comboWitchBlastBack = function (...args) { order.push('fx'); return original.fx.apply(this, args); };
  G.comboCastBlend = () => order.push('actor'); G.comboCast = () => order.push('actor');
  G.comboBack(ctx, st, sx, sy, C.groundY, false);
  assert.equal(order[0], 'fx'); assert(order.indexOf('actor') > 0, 'FX is behind cast');
  const game = launch(), ui = new H.UI(game, element('canvas')), before = JSON.stringify(game);
  ui.update(); ui.draw(); assert.equal(JSON.stringify(game), before, 'normal rendering does not mutate game');
  console.log('Combo witch blast back PASS: continuous bounded burst, center, layer, reduced/short/skip/after, 30–144Hz and scene purity.');
} finally { G.comboWitchBlastBack = original.fx; G.comboCastBlend = original.blend; G.comboCast = original.cast; }
