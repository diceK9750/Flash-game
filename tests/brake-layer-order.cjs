// BRAKE smoke and final X move behind the actors without changing their geometry or timing.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG, S = H.Sprites;
const old = { line: G.line, circle: G.circle, cross: G.grandBrakeCross, smoke: G.grandBrakeSmoke,
  character: G.character, actorDraw: G.grandActorDraw, grandFront: G.grandFront, heroLayers: S.heroLayers, stopLayers: S.stopLayers, heroHit: S.drawHeroHit, smooth: G.smooth };
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b, label, eps = 1e-7) => assert(Math.abs(a - b) < eps, `${label}: ${a} != ${b}`);
const scene = (t, extra = {}) => ({ type: 'BRAKE', t, end: 2.43, climax: C.grandClimax.BRAKE, grand: true,
  heroWX: 1200, heroY: 50, source: { x: 1230 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...extra });
function ctx() {
  const stack = [], o = { globalAlpha: 1, save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
    restore() { Object.assign(this, stack.pop()); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v, k, val) => (v[k] = val, true) });
}
try {
  // Exact original X/smoke geometry, colors, alpha and boundaries, including a non-unit fade.
  let lines = [], circles = [];
  G.line = (c, points, color, width) => lines.push({ points, color, width, alpha: c.globalAlpha });
  G.circle = (c, x, y, r, color) => circles.push({ x, y, r, color, alpha: c.globalAlpha });
  const hero = { x: 520, y: 340 }, fade = 0.7, cl = x => Math.max(0, Math.min(1, x));
  for (const b of [-0.001, 0, 0.03, 0.12, 0.3, 0.699999, 0.7, 0.8]) {
    lines = []; const c = ctx(), initial = c.globalAlpha, drawn = G.grandBrakeCross(c, hero, b, fade);
    assert.equal(c.globalAlpha, initial, 'cross restores alpha');
    if (b < 0 || b >= 0.7) { assert.equal(drawn, false); assert.equal(lines.length, 0); continue; }
    assert.equal(drawn, true); assert.equal(lines.length, 2);
    const u = G.ease(cl(b / 0.12)), alpha = fade * (1 - cl((b - 0.3) / 0.4));
    assert.equal(lines[0].color, '#ffffff'); assert.equal(lines[1].color, G.GRAND.BRAKE.color);
    for (const line of lines) { assert.equal(line.width, 10); near(line.alpha, alpha, 'cross alpha'); }
    near(lines[0].points[0][0], hero.x - 130 * u, 'white x0'); near(lines[0].points[1][1], hero.y + 110 * u, 'white y1');
    near(lines[1].points[0][0], hero.x + 130 * u, 'violet x0'); near(lines[1].points[1][1], hero.y + 110 * u, 'violet y1');
  }
  for (const side of [-1, 1]) for (const t of [1.1, 1.100001, 1.18, 1.4, 1.699999, 1.7]) {
    circles = []; const c = ctx(), drawn = G.grandBrakeSmoke(c, hero, t, fade, side);
    assert.equal(c.globalAlpha, 1, 'smoke restores alpha');
    if (t <= 1.1 || t >= 1.7) { assert.equal(drawn, false); assert.equal(circles.length, 0); continue; }
    assert.equal(drawn, true); assert.equal(circles.length, 7);
    const u = cl((t - 1.1) / 0.6);
    for (let i = 0; i < 7; i++) { const p = circles[i]; assert.equal(p.color, '#5a4a70');
      near(p.x, hero.x - side * 140 + Math.cos(i) * 50 * (0.5 + u), 'smoke x');
      near(p.y, hero.y + 30 + Math.sin(i * 1.7) * 30 * (0.5 + u), 'smoke y');
      near(p.r, 18 + 16 * u, 'smoke radius'); near(p.alpha, fade * (1 - u) * 0.8, 'smoke alpha'); }
  }
  // No layer duplicates: both effects remain behind during live, reduced, skip and afterglow.
  let layer = '', events = [];
  G.grandBrakeCross = function(...args) { const result = old.cross.apply(this, args); if (result) events.push(layer + '-cross'); return result; };
  G.grandBrakeSmoke = function(...args) { const result = old.smoke.apply(this, args); if (result) events.push(layer + '-smoke'); return result; };
  const layers = (st, rm = false) => { events = []; const before = JSON.stringify(st), c = ctx();
    layer = 'back'; G.grandBack(c, st, sx, sy, ground, rm); layer = 'front'; G.grandFront(c, st, sx, sy, ground, rm);
    assert.equal(JSON.stringify(st), before, 'scene unchanged'); return events.slice(); };
  assert.deepEqual(layers(scene(1.4)), ['back-cross', 'back-smoke']);
  for (const opts of [{ short: true }, { skipped: true }, { after: 0 }]) assert.deepEqual(layers(scene(1.4, opts)), ['back-cross', 'back-smoke']);
  assert.deepEqual(layers(scene(1.4), true), ['back-cross', 'back-smoke'], 'live reduced ON');
  assert.deepEqual(layers(scene(1.4), false), ['back-cross', 'back-smoke'], 'live reduced OFF');
  // Real scene transitions: the short afterglow still contains X/smoke, so test both
  // skipped and naturally ended short scenes, as well as a live reduced-motion toggle.
  const liveGame = launch(); liveGame.grandSpecialEnabled = true; liveGame.comboShort = false;
  const startBrake = () => liveGame.startCombo({ type: 'BRAKE', source: { x: liveGame.body.x - 250 } }, true);
  startBrake(); liveGame.combo.elapsed = G.comboSceneStart(false) + 1.4;
  const live = G.grandState(liveGame), liveBefore = JSON.stringify(liveGame);
  for (const reduced of [false, true, false]) assert.deepEqual(layers(live, reduced), ['back-cross', 'back-smoke']);
  assert.equal(JSON.stringify(liveGame), liveBefore, 'live reduced toggle keeps game unchanged');
  liveGame.endCombo(true);
  for (const reduced of [false, true]) assert.deepEqual(layers(G.grandState(liveGame), reduced), [], 'full-scene skip is beyond effects');
  for (const skipped of [false, true]) {
    liveGame.comboAfter = null; liveGame.comboShort = true; startBrake(); liveGame.endCombo(skipped);
    const shortAfter = G.grandState(liveGame), before = JSON.stringify(liveGame);
    assert(shortAfter.short && shortAfter.after !== null, 'short afterglow is real game state');
    for (const reduced of [false, true, false]) assert.deepEqual(layers(shortAfter, reduced), ['back-cross', 'back-smoke']);
    assert.equal(JSON.stringify(liveGame), before, 'short afterglow keeps game unchanged');
  }
  for (const type of ['DASH', 'STOPPER', 'ANGLE', 'GUARD']) assert.deepEqual(layers(scene(1.4, { type, climax: C.grandClimax[type] })), [], type + ' unchanged');
  for (const heroWX of [-85, 35, 1200, 2600]) assert.deepEqual(layers(scene(1.4, { heroWX })), ['back-cross', 'back-smoke'], 'stage edge');
  for (const fps of [30, 60, 120, 144]) for (let i = 0; i <= Math.ceil(2.3 * fps); i++) {
    const st = scene(i / fps), result = layers(st), t = G.grandT(st), b = t - st.climax;
    assert.equal(result.filter(x => x.endsWith('-cross')).length, b >= 0 && b < 0.7 ? 1 : 0, `${fps}Hz cross ${i}`);
    assert.equal(result.filter(x => x.endsWith('-smoke')).length, t > 1.1 && t < 1.7 ? 1 : 0, `${fps}Hz smoke ${i}`);
    assert(result.every(x => x.startsWith('back-')), `${fps}Hz correct layer ${i}`);
  }
  // Rapid clone slashes draw once behind the actors with their original paths, widths and opacity.
  lines = []; G.line = (c, points, color, width) => lines.push({ points, color, width, alpha: c.globalAlpha });
  const st = scene(0.6), t = G.grandT(st), h = G.grandHero(st, sx, sy); G.grandBack(ctx(), st, sx, sy, ground); G.grandFront(ctx(), st, sx, sy, ground);
  for (let k = 0; k < 6; k++) { const u = (t - (0.18 + k * 0.15 + 0.1)) / 0.4; if (u < 0 || u > 1) continue;
    const dir = k % 2 ? -1 : 1, yy = h.y + [-30, 20, -5, 35, -20, 10][k], expectedWidth = 7 * (1 - u) + 2;
    const found = lines.filter(x => x.color === (k % 2 ? '#ffffff' : G.GRAND.BRAKE.color) && Math.abs(x.width - expectedWidth) < 1e-8 &&
      Math.abs(x.points[0][0] - (h.x - 150 * dir)) < 1e-8 && Math.abs(x.points[0][1] - (yy - 40 * dir)) < 1e-8);
    assert.equal(found.length, 1, 'each background rapid slash occurs once'); near(found[0].alpha, 1 - u, 'rapid slash alpha');
  }
  // Full renderer paints the dark tint first, then the unchanged X/smoke, then both actors.
  const order = [], game = launch(); game.grandSpecialEnabled = true;
  game.combo = { type: 'BRAKE', solo: true, elapsed: G.comboSceneStart(false) + 1.4, short: false,
    heroX: 1200, heroY: 50, source: { x: 1230 }, skipped: false };
  G.smooth = false; G.grandBrakeCross = function(...args) { const result = old.cross.apply(this, args); if (result) order.push('cross'); return result; };
  G.grandBrakeSmoke = function(...args) { const result = old.smoke.apply(this, args); if (result) order.push('smoke'); return result; };
  G.grandActorDraw = function(...args) { order.push('actor'); return old.actorDraw.apply(this, args); };
  G.character = (c, id) => { if (id === 'HERO') order.push('hero'); };
  G.grandFront = function(...args) { order.push('front'); return old.grandFront.apply(this, args); };
  S.heroLayers = () => []; S.stopLayers = () => []; S.drawHeroHit = () => false;
  const before = JSON.stringify(game), ui = new H.UI(game, element('canvas')); ui.ctx = ctx();
  ui.ctx.fillRect = function() { if (typeof this.fillStyle === 'string' && this.fillStyle.startsWith('rgba(20,0,40,')) order.push('tint'); };
  ui.draw();
  assert.equal(JSON.stringify(game), before, 'full render leaves game unchanged');
  const expected = ['tint', 'cross', 'smoke', 'actor', 'hero', 'front'];
  for (let i = 0; i < expected.length; i++) assert(order.indexOf(expected[i]) >= 0, `${expected[i]} drawn`);
  for (let i = 1; i < expected.length; i++) assert(order.indexOf(expected[i - 1]) < order.indexOf(expected[i]), `${expected[i - 1]} -> ${expected[i]}`);
  console.log('BRAKE layer order PASS: exact original X/smoke, 30–144Hz, edges, background rapid slashes, short/skip/after, live reduced ON/OFF and game purity.');
} finally {
  G.line = old.line; G.circle = old.circle; G.grandBrakeCross = old.cross; G.grandBrakeSmoke = old.smoke;
  G.character = old.character; G.grandActorDraw = old.actorDraw; G.grandFront = old.grandFront; G.smooth = old.smooth;
  S.heroLayers = old.heroLayers; S.stopLayers = old.stopLayers; S.drawHeroHit = old.heroHit;
}
