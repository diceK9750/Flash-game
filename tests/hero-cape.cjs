// Canvas-only cape motion: no source image, game state or physics is modified.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { scope, launch, element } = require('./phase2.cjs');
const s = scope.Hop.Sprites, root = path.resolve(__dirname, '..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, s.definitions.HERO.FLIGHT_LOOP.metadata), 'utf8'));
const d = s.normalizeCell({ ...metadata });
const source = { ready: true, image: { complete: true, naturalWidth: 384 * 8, naturalHeight: 288 }, data: d };
const oldCreate = scope.document.createElement, oldCache = s.flightCapeCache, oldFlight = s.heroFlight;
const oldAerial = s.heroAerialUp, oldDrawFlight = s.drawFlightCape;
try {
  const operations = [], scratch = {
    save() { operations.push(['save']); }, restore() { operations.push(['restore']); },
    beginPath() { operations.push(['begin']); }, rect(...args) { operations.push(['rect', ...args]); },
    clip() { operations.push(['clip']); }, clearRect(...args) { operations.push(['clear', ...args]); },
    drawImage(...args) { operations.push(['draw', ...args]); }
  };
  const canvas = { width: 0, height: 0, getContext() { return scratch; } };
  scope.document.createElement = () => canvas;
  const cache = s.buildFlightCapeCache(source);
  assert(cache?.ready && cache.sourceAsset === source); assert.equal(canvas.width, 384 * 8); assert.equal(canvas.height, 288);
  assert.equal(operations.filter(o => o[0] === 'draw').length, 8 * 129, 'one original plus 128 strips per frame, once');
  assert.equal(operations.filter(o => o[0] === 'clip').length, 8);
  assert.deepEqual(operations.filter(o => o[0] === 'rect').map(o => o.slice(1)), Array.from({ length: 8 }, (_, f) => [f * 384, 145, 128, 82]));
  assert.deepEqual(operations.filter(o => o[0] === 'clear').map(o => o.slice(1)), Array.from({ length: 8 }, (_, f) => [f * 384, 145, 128, 82]));
  const strips = operations.filter(o => o[0] === 'draw' && o[4] === 1 && o[5] === 82);
  assert.equal(strips.length, 8 * 128);
  for (let f = 0; f < 8; f++) for (let x = 0; x < 128; x++) {
    const op = strips[f * 128 + x], shift = op[7] - 145;
    assert.equal(op[2], f * 384 + x, 'sample matching source frame and column');
    assert.equal(op[6], f * 384 + x, 'no horizontal shift');
    assert(Math.abs(shift) <= 3, 'shift bounded to ±3px');
    if (f === 0 || x === 127) assert.equal(shift, 0, 'first frame and protected seam are unchanged');
  }
  assert.equal(strips[2 * 128][7] - 145, 3); assert.equal(strips[6 * 128][7] - 145, -3);
  assert.equal(s.buildFlightCapeCache({ ...source, ready: false }), null);
  scope.document.createElement = () => ({ getContext() { throw Error('canvas denied'); } });
  assert.equal(s.buildFlightCapeCache(source), null, 'cache errors stay optional');
  scope.document.createElement = () => canvas;

  const drawCalls = [], target = { filter: 'none', save() {}, restore() {}, drawImage(...args) { drawCalls.push(args); } };
  s.flightCapeCache = cache;
  for (let f = 0; f < 8; f++) {
    drawCalls.length = 0; assert(s.drawFlightCape(target, source, (f + 0.1) / 8, 0, 18, 1.25));
    assert.equal(drawCalls.length, 1, 'one cached draw per selected sprite');
    assert.equal(drawCalls[0][0], canvas); assert.equal(drawCalls[0][1], f * 384);
  }
  let attempts = 0;
  const broken = { filter: 'none', save() {}, restore() {}, drawImage(img) { attempts++; if (img === canvas) throw Error('cache lost'); } };
  assert(s.drawFlightCape(broken, source, 0.4, 0, 18, 1.25)); assert.equal(attempts, 2, 'failed cache falls back to original');
  s.flightCapeCache = { ...cache, sourceAsset: {} }; drawCalls.length = 0;
  assert(s.drawFlightCape(target, source, 0.4, 0, 18, 1.25)); assert.equal(drawCalls.length, 1); assert.equal(drawCalls[0][0], source.image);

  // Integrate through Graphics.draw: priority, pause and reduced-motion choose the actual flight layer.
  s.heroFlight = source; s.flightCapeCache = cache;
  const game = launch(), ui = new scope.Hop.UI(game, element('canvas'));
  game.objects = []; game.trail = []; game.launchCutin = null; game.body.grounded = false;
  ui.visual.oneShot = null; ui.visual.stopAt = null; ui.visual.launchAt = 0; ui.visual.reducedMotion = false;
  let shown = 0, lastTime = null;
  s.drawFlightCape = function (ctx, a, time, ...rest) { shown++; lastTime = time; return oldDrawFlight.call(this, ctx, a, time, ...rest); };
  game.phaseTime = 1; const snapshot = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), snapshot); assert.equal(shown, 1);
  game.update(0); ui.draw(); assert.equal(lastTime, 1, 'zero-delta pause keeps frame time');
  shown = 0; ui.visual.reducedMotion = true; ui.draw(); assert.equal(shown, 0, 'reduced motion keeps original');
  ui.visual.reducedMotion = false; game.body.grounded = true; ui.draw(); assert.equal(shown, 0, 'grounded flight keeps original');
  game.body.grounded = false; game.state = 'RESULT'; game.finalDistance = 0; ui.draw(); assert.equal(shown, 0, 'RESULT keeps original');
  game.state = 'FLYING';
  s.heroAerialUp = { ready: true, image: { complete: true, naturalWidth: 384 * 8 }, data: { ...d, animation: 'AERIAL_UP', fps: 12, loop: false } };
  ui.visual.oneShot = { animation: 'AERIAL_UP', at: game.phaseTime }; ui.draw();
  assert.equal(shown, 0, 'active one-shot takes priority');
  console.log('Hero cape PASS: bounded clipped cache, eight phases, one draw/frame, fallback, pause, reduced motion, RESULT, one-shot priority, game purity.');
} finally {
  if (oldCreate === undefined) delete scope.document.createElement; else scope.document.createElement = oldCreate;
  s.flightCapeCache = oldCache; s.heroFlight = oldFlight; s.heroAerialUp = oldAerial; s.drawFlightCape = oldDrawFlight;
}
