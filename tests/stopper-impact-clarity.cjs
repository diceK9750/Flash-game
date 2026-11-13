// The priest's cross stays intact behind the hero, and filled impact stars fade promptly.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const old = { cross: G.grandStopperCross, line: G.line, spark: G.spark, character: G.character, front: G.grandFront,
  heroLayers: S.heroLayers, stopLayers: S.stopLayers, heroHit: S.drawHeroHit, smooth: G.smooth };
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const scene = (t, extra = {}) => ({ type: 'STOPPER', t, end: 2.4, climax: C.grandClimax.STOPPER,
  grand: true, heroWX: 1200, heroY: 50, source: { x: 1230 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...extra });
function ctx() { const stack = [], o = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v, k, x) => (v[k] = x, true) }); }
try {
  const calls = [], hero = { x: 500, y: 360 }; G.line = (c, p, color, width) => calls.push({ p, color, width, alpha: c.globalAlpha });
  for (const [t, b] of [[0.61, -0.54], [1.05, -0.1], [1.15, 0], [1.3, 0.15], [1.749, 0.599]]) {
    const c = ctx(); calls.length = 0; assert(G.grandStopperCross(c, hero, t, b, 0.7)); assert.equal(calls.length, 2); near(c.globalAlpha, 1);
    const k = b < 0 ? Math.max(0, Math.min(1, (t - 0.6) / 0.4)) : 1 - b / 0.6;
    assert.deepEqual(calls.map(x => x.color), ['#ffffff', '#ffffff']); assert(calls.every(x => x.width === 6));
    near(calls[0].p[0][1], hero.y - 70 * k - 30); near(calls[0].p[1][1], hero.y + 70 * k + 30);
    near(calls[1].p[0][0], hero.x - 45 * k - 20); near(calls[1].p[1][0], hero.x + 45 * k + 20); near(calls[1].p[0][1], hero.y - 10);
    near(calls[0].alpha, 0.7 * k); near(calls[1].alpha, 0.7 * k);
  }
  for (const [t, b] of [[0.6, -0.55], [2, 0.6]]) assert.equal(G.grandStopperCross(ctx(), hero, t, b, 1), false);
  calls.length = 0; G.grandStopperCross(ctx(), hero, 1.75 - 1e-8, 0.6 - 1e-8, 1); assert(calls[0].alpha < 1e-6);
  G.line = old.line;
  let layer = '', layers = []; G.grandStopperCross = function (...args) { const yes = old.cross.apply(this, args); if (yes) layers.push(layer); return yes; };
  function drawLayers(st) { const before = JSON.stringify(st), c = ctx(); layers = []; layer = 'back'; G.grandBack(c, st, sx, sy, ground); layer = 'front'; G.grandFront(c, st, sx, sy, ground); assert.equal(JSON.stringify(st), before); return layers.slice(); }
  assert.deepEqual(drawLayers(scene(1.05)), ['back']); assert.deepEqual(drawLayers(scene(1.3)), ['back']);
  for (const opts of [{ short: true }, { skipped: true }, { after: 0 }]) assert.deepEqual(drawLayers(scene(1.05, opts)), ['front']);
  for (const type of ['DASH', 'BRAKE', 'ANGLE', 'GUARD']) assert.deepEqual(drawLayers(scene(1.05, { type, climax: C.grandClimax[type] })), []);
  const order = [], game = launch(); game.grandSpecialEnabled = true;
  game.combo = { type: 'STOPPER', solo: true, elapsed: G.comboSceneStart(false) + 1.05, short: false, heroX: 1200, heroY: 50, source: { x: 1230 }, skipped: false };
  G.smooth = false; G.grandStopperCross = function (...args) { const yes = old.cross.apply(this, args); if (yes) order.push('cross'); return yes; };
  G.character = (c, id) => { if (id === 'HERO') order.push('hero'); }; G.grandFront = function (...args) { order.push('front'); return old.front.apply(this, args); };
  S.heroLayers = () => []; S.stopLayers = () => []; S.drawHeroHit = () => false;
  const before = JSON.stringify(game), ui = new H.UI(game, element('canvas')); ui.ctx = ctx(); ui.draw(); assert.equal(JSON.stringify(game), before);
  assert(order.indexOf('cross') >= 0 && order.indexOf('cross') < order.indexOf('hero') && order.indexOf('hero') < order.indexOf('front'));
  G.grandFront = old.front; G.grandStopperCross = old.cross;
  const sparks = (type, b, opts = {}) => { const list = [], st = scene(C.grandClimax[type] + G.GRAND_HITSTOP + b, { type, climax: C.grandClimax[type], ...opts }), before = JSON.stringify(st);
    G.spark = (c, x, y, radius, color) => list.push({ color, alpha: c.globalAlpha }); G.grandFront(ctx(), st, sx, sy, ground); assert.equal(JSON.stringify(st), before); return list; };
  for (const [color, maximum, end] of [[G.GRAND.STOPPER.glow, 0.5, 0.18], ['#ffffff', 0.55, 0.16]]) {
    const val = b => sparks('STOPPER', b).find(v => v.color === color)?.alpha ?? 0; near(val(0), maximum); let prev = maximum;
    for (let i = 1; i <= 100; i++) { const v = val(i * end / 100); assert(v >= 0 && v <= prev + 1e-8); prev = v; }
    assert(val(end - 1e-5) < 1e-7 && val(end) === 0);
  }
  for (const opts of [{ skipped: true }, { after: 0, afterTotal: 0.6 }]) { const s = sparks('STOPPER', 0.12, opts); near(s[0].alpha, 1 - 0.12 / 0.35); near(s[1].alpha, 1 - 0.12 / 0.35); }
  for (const type of ['BRAKE', 'ANGLE', 'GUARD']) { const s = sparks(type, 0); near(s[0].alpha, 0.5); near(s[1].alpha, 0.55); }
  const dash = sparks('DASH', 0.12); near(dash[0].alpha, 1 - 0.12 / 0.35); near(dash[1].alpha, 1 - 0.12 / 0.35);
  assert.deepEqual(sparks('STOPPER', 0.07), sparks('STOPPER', 0.07));
  console.log('STOPPER clarity PASS: cross geometry and layer, bounded continuous stars, other specials, short/skip/after and state purity.');
} finally { G.grandStopperCross = old.cross; G.line = old.line; G.spark = old.spark; G.character = old.character; G.grandFront = old.front; G.smooth = old.smooth; S.heroLayers = old.heroLayers; S.stopLayers = old.stopLayers; S.drawHeroHit = old.heroHit; }
