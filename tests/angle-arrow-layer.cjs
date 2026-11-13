// The full ANGLE rainbow remains identical, but passes behind the hero instead of covering him.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const old = { arrow: G.grandAngleArrow, confetti: G.grandAngleConfetti, line: G.line, polygon: G.polygon, character: G.character,
  grandFront: G.grandFront, heroLayers: S.heroLayers, stopLayers: S.stopLayers, heroHit: S.drawHeroHit, smooth: G.smooth };
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b, label, eps = 1e-7) => assert(Math.abs(a - b) < eps, `${label}: ${a} != ${b}`);
const scene = (t, extra = {}) => ({ type: 'ANGLE', t, end: 2.43, climax: C.grandClimax.ANGLE, grand: true,
  heroWX: 1200, heroY: 50, source: { x: 1230 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...extra });
function ctx() {
  const stack = [], o = { globalAlpha: 1, save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop()); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v, k, val) => (v[k] = val, true) });
}
try {
  // Exact original positions, colors and alpha, including fade at the end of the sweep.
  const calls = []; G.line = (c, points, color, width) => calls.push({ kind: 'line', points, color, width, alpha: c.globalAlpha });
  G.polygon = (c, points, color) => calls.push({ kind: 'poly', points, color, alpha: c.globalAlpha });
  const hero = { x: 500, y: 360 }, colors = ['#ff4d6d', '#ffb340', '#ffe066', '#5fd35f', '#4dc3ff', '#a46bff'];
  for (const b of [0, 0.1, 0.35, 0.59]) {
    const c = ctx(); calls.length = 0; assert.equal(G.grandAngleArrow(c, hero, b, 0.7), true); assert.equal(c.globalAlpha, 1);
    assert.equal(calls.length, 7); const ax = hero.x - 420 + 840 * G.ease(Math.max(0, Math.min(1, b / 0.45)));
    const opacity = 0.7 * (1 - Math.max(0, Math.min(1, (b - 0.35) / 0.25)));
    colors.forEach((color, i) => { const d = calls[i]; assert.equal(d.kind, 'line'); assert.equal(d.color, color); assert.equal(d.width, 8);
      near(d.points[0][0], ax - 300, 'line x0'); near(d.points[1][0], ax, 'line x1'); near(d.points[0][1], hero.y - 25 + i * 9, 'line y'); near(d.alpha, opacity, 'line opacity'); });
    const tip = calls[6]; assert.equal(tip.color, '#ffffff'); near(tip.points[1][0], ax + 60, 'tip x'); near(tip.points[1][1], hero.y + 2, 'tip y'); near(tip.alpha, opacity, 'tip opacity');
  }
  for (const b of [-0.001, 0.6, 0.601]) { calls.length = 0; assert.equal(G.grandAngleArrow(ctx(), hero, b, 1), false); assert.equal(calls.length, 0); }
  calls.length = 0; G.grandAngleArrow(ctx(), hero, 0.6 - 1e-8, 1); assert(calls[0].alpha < 1e-6, 'no disappearance pop at the end');
  G.line = old.line; G.polygon = old.polygon;

  // The original 72-piece deterministic confetti keeps its trajectory, palette and opacity.
  const colors7 = [...colors, '#ffffff'];
  function confettiCtx() {
    const out = [], stack = [], c = { globalAlpha: 1, fillStyle: '', xy: null, angle: 0, out,
      save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, xy: this.xy, angle: this.angle }); },
      restore() { Object.assign(this, stack.pop()); }, translate(x, y) { this.xy = [x, y]; }, rotate(a) { this.angle = a; },
      fillRect(...box) { out.push({ xy: this.xy, angle: this.angle, box, color: this.fillStyle, alpha: this.globalAlpha }); }
    }; return c;
  }
  for (const b of [0, 0.1, 0.9, 1.2, 1.4]) {
    const c = confettiCtx(); assert(G.grandAngleConfetti(c, hero, b, 0.7)); assert.equal(c.out.length, 72); assert.equal(c.globalAlpha, 1);
    for (const i of [0, 17, 71]) { const q = c.out[i], an = -Math.PI * G.grandRand(i, 9), v = 300 + 420 * G.grandRand(i, 10), u = Math.min(b, 1.4);
      near(q.xy[0], hero.x + Math.cos(an) * v * u + Math.sin(b * 8 + i) * 8, 'confetti x');
      near(q.xy[1], hero.y + Math.sin(an) * v * u + 520 * u * u, 'confetti y'); near(q.angle, b * 9 + i, 'confetti angle');
      assert.equal(q.color, colors7[i % 7]); near(q.alpha, 0.7 * (1 - Math.max(0, Math.min(1, (b - 0.9) / 0.5))), 'confetti alpha'); assert.deepEqual(q.box, [-5, -3, 10, 6]); }
  }
  const noConfetti = confettiCtx(); assert.equal(G.grandAngleConfetti(noConfetti, hero, -0.001, 1), false); assert.equal(noConfetti.out.length, 0);

  // Normal ANGLE draws the same arrow only in back; reduced/short, skipped and afterglow
  // retain their original front-layer behavior. Other characters never draw this arrow.
  let layer = '', arrowLayers = [];
  G.grandAngleArrow = function (...args) { const drawn = old.arrow.apply(this, args); if (drawn) arrowLayers.push(layer); return drawn; };
  G.grandAngleConfetti = function (...args) { const drawn = old.confetti.apply(this, args); if (drawn) arrowLayers.push(layer + '-confetti'); return drawn; };
  const runLayers = state => { const before = JSON.stringify(state), c = ctx(); arrowLayers = [];
    layer = 'back'; G.grandBack(c, state, sx, sy, ground); layer = 'front'; G.grandFront(c, state, sx, sy, ground);
    assert.equal(JSON.stringify(state), before, 'scene unchanged by draw'); return arrowLayers.slice(); };
  assert.deepEqual(runLayers(scene(1.38)), ['back-confetti', 'back']);
  for (const opts of [{ short: true }, { skipped: true }, { after: 0 }]) assert.deepEqual(runLayers(scene(1.38, opts)), ['front-confetti', 'front']);
  for (const type of ['DASH', 'STOPPER', 'BRAKE', 'GUARD']) assert.deepEqual(runLayers({ ...scene(1.38), type, climax: C.grandClimax[type] }), []);

  // Check actual full renderer order, including its hero fallback between back and front.
  const order = [], game = launch(); game.grandSpecialEnabled = true;
  game.combo = { type: 'ANGLE', solo: true, elapsed: G.comboSceneStart(false) + 1.38, short: false, heroX: 1200, heroY: 50, source: { x: 1230 }, skipped: false };
  G.smooth = false; G.grandAngleArrow = function (...args) { const result = old.arrow.apply(this, args); if (result) order.push('arrow'); return result; };
  G.grandAngleConfetti = function (...args) { const result = old.confetti.apply(this, args); if (result) order.push('confetti'); return result; };
  G.character = (c, id) => { if (id === 'HERO') order.push('hero'); }; G.grandFront = function (...args) { order.push('front'); return old.grandFront.apply(this, args); };
  S.heroLayers = () => []; S.stopLayers = () => []; S.drawHeroHit = () => false;
  const before = JSON.stringify(game), ui = new H.UI(game, element('canvas')); ui.ctx = ctx(); ui.draw();
  assert.equal(JSON.stringify(game), before, 'full render leaves game unchanged');
  assert(order.indexOf('confetti') >= 0 && order.indexOf('confetti') < order.indexOf('arrow') && order.indexOf('arrow') < order.indexOf('hero') && order.indexOf('hero') < order.indexOf('front'), 'confetti -> arrow -> hero -> front effect');
  console.log('ANGLE arrow layer PASS: same geometry, confetti trajectories, colors, fade and timing; behind hero in full scene; short/skip/after preserved; game purity.');
} finally {
  G.grandAngleArrow = old.arrow; G.grandAngleConfetti = old.confetti; G.line = old.line; G.polygon = old.polygon; G.character = old.character; G.grandFront = old.grandFront; G.smooth = old.smooth;
  S.heroLayers = old.heroLayers; S.stopLayers = old.stopLayers; S.drawHeroHit = old.heroHit;
}
