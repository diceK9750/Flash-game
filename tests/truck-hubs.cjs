// Road-truck hub motion is presentation only and never changes launch or physics.
const assert = require('node:assert/strict');
const { scope, element, launch } = require('./phase2.cjs');
const H = scope.Hop, s = H.Sprites, G = H.Graphics;
const oldTruck = s.truckIdle, oldDrawTruck = s.drawTruck, oldHubs = s.drawTruckHubs;
const oldMotion = G.truckMotion, oldSmooth = G.smooth, oldAnimEnabled = H.Anim.enabled;
function recorder(throwFirst = false) {
  const calls = []; let depth = 0, attempts = 0;
  const ctx = { calls, save() { depth++; calls.push(['save']); }, restore() { depth--; calls.push(['restore']); },
    translate(...a) { calls.push(['translate', ...a]); }, scale(...a) { calls.push(['scale', ...a]); }, rotate(...a) { calls.push(['rotate', ...a]); },
    beginPath() { calls.push(['begin']); }, arc(...a) { calls.push(['arc', ...a]); }, clip() { calls.push(['clip']); },
    drawImage(...a) { attempts++; calls.push(['image', ...a]); if (throwFirst && attempts === 1) throw Error('hub failure'); },
    moveTo() {}, lineTo() {}, stroke() { calls.push(['stroke']); }, fill() { calls.push(['fill']); },
    get depth() { return depth; } };
  return ctx;
}
try {
  const data = s.normalizeCell({ id: 'TRUCK', animation: 'IDLE', cellW: 576, cellH: 288, frames: 1, fps: 1, loop: false, pivot: { x: 352, y: 264 }, smoothing: true });
  const image = { complete: true, naturalWidth: 576, naturalHeight: 288 };
  s.truckIdle = { ready: true, image, data };
  const c = recorder(); s.drawTruckHubs(c, 200, 594, 0.25);
  assert.deepEqual(c.calls.filter(x => x[0] === 'arc').map(x => x.slice(1, 4)), [[130, 228, 21], [351, 228, 21]]);
  assert.deepEqual(c.calls.filter(x => x[0] === 'rotate').map(x => x[1]), [3.5, 3.5]);
  assert.deepEqual(c.calls.filter(x => x[0] === 'image').map(x => x.slice(1)), [[image, -130, -228], [image, -351, -228]]);
  assert.deepEqual(c.calls.filter(x => x[0] === 'translate').slice(0, 2), [['translate', 200, 594], ['translate', -352, -264]]);
  assert.deepEqual(c.calls.find(x => x[0] === 'scale'), ['scale', 1.25 / 3, 1.25 / 3]); assert.equal(c.depth, 0);
  const paused = recorder(); s.drawTruckHubs(paused, 200, 594, 0.25);
  assert.deepEqual(paused.calls, c.calls, 'same phaseTime gives identical wheels when paused');
  const later = recorder(); s.drawTruckHubs(later, 200, 594, 0.35);
  assert(Math.abs(later.calls.find(x => x[0] === 'rotate')[1] - 4.9) < 1e-12, 'continuous angle follows game phase');
  const failing = recorder(true); assert.doesNotThrow(() => s.drawTruckHubs(failing, 200, 594, 0.25));
  assert.equal(failing.depth, 0); assert.equal(failing.calls.filter(x => x[0] === 'image').length, 2, 'one failed wheel does not abort the other');
  s.truckIdle = { ready: false }; const missing = recorder(); s.drawTruckHubs(missing, 200, 594, 0.25); assert.equal(missing.calls.length, 0);

  // The old wheel lines remain available for the Canvas fallback, and exhaust is present in both paths.
  const fallback = recorder(); G.truckMotion(fallback, 200, 594, 0.1, 1, true);
  assert.equal(fallback.calls.filter(x => x[0] === 'stroke').length, 2); assert.equal(fallback.calls.filter(x => x[0] === 'fill').length, 3);
  const sprite = recorder(); G.truckMotion(sprite, 200, 594, 0.1, 1, false);
  assert.equal(sprite.calls.filter(x => x[0] === 'stroke').length, 0); assert.equal(sprite.calls.filter(x => x[0] === 'fill').length, 3);

  // Actual road rendering picks the right path; launch cut-in never activates road hubs.
  const game = launch(), ui = new H.UI(game, element('canvas')); game.launchCutin = null; game.phaseTime = 0.1; ui.visual.launchAt = 0;
  G.smooth = true; H.Anim.enabled = true; ui.visual.reducedMotion = false;
  const events = []; let imageOk = true;
  s.drawTruck = () => { events.push('image'); return imageOk; };
  s.drawTruckHubs = (_ctx, _x, _y, time) => events.push(['hubs', time]);
  G.truckMotion = (_ctx, _x, _y, _age, _time, lines) => events.push(['motion', lines]);
  const render = () => { events.length = 0; const before = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), before); return events.slice(); };
  assert.deepEqual(render(), ['image', ['hubs', 0.1], ['motion', false]]);
  game.update(0); assert.deepEqual(render(), ['image', ['hubs', 0.1], ['motion', false]], 'pause freezes hub angle');
  imageOk = false; assert.deepEqual(render(), ['image', ['motion', true]], 'fallback retains old lines');
  imageOk = true; ui.visual.reducedMotion = true; assert.deepEqual(render(), ['image'], 'reduced motion has no wheel animation');
  ui.visual.reducedMotion = false; G.smooth = false;
  assert.deepEqual(render(), ['image'], 'smooth=false preserves the prior static truck'); G.smooth = true;
  // Exercise the real sprite draw catch when the loaded image fails on the road canvas.
  s.truckIdle = { ready: true, image, data }; s.drawTruck = oldDrawTruck;
  ui.ctx.drawImage = source => { if (source === image) { events.push('image failure'); throw Error('truck decode failure'); } };
  ui.ctx.fillRect = (x, y, w, h) => { if (x === -110 && y === -91 && w === 91 && h === 70) events.push('canvas body'); };
  assert.deepEqual(render(), ['image failure', 'canvas body', ['motion', true]], 'failed loaded sprite draws the Canvas body and legacy wheel lines');
  const cutGame = new H.Game(); cutGame.launchCutinEnabled = true;
  const cutUI = new H.UI(cutGame, element('canvas')); cutGame.act(); cutGame.act(); cutGame.act();
  assert(cutGame.launchCutin); events.length = 0; cutUI.update(); cutUI.draw();
  assert(!events.some(e => Array.isArray(e) && (e[0] === 'hubs' || e[0] === 'motion')), 'no road hubs during cut-in');
  console.log('Truck hubs PASS: clipped source centers, continuous paused phase, failures, fallback lines/exhaust, cut-in, reduced motion and draw purity.');
} finally {
  s.truckIdle = oldTruck; s.drawTruck = oldDrawTruck; s.drawTruckHubs = oldHubs; G.truckMotion = oldMotion; G.smooth = oldSmooth; H.Anim.enabled = oldAnimEnabled;
}
