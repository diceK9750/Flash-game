// Optional CAST wind uses a deferred, bounded cache. Nothing here changes the source image or game.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, S = H.Sprites, G = H.Graphics, C = H.CONFIG;
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', S.definitions.CAST.BOOST.CAST.metadata), 'utf8'));
const data = S.normalizeCell({ ...meta }), source = { ready: true, image: { complete: true, naturalWidth: 288, naturalHeight: 288 }, data };
const before = { create: scope.document.createElement, idle: scope.requestIdleCallback, timeout: scope.setTimeout,
  slots: S.castAssets.BOOST, cache: S.witchWindCache, pending: S.witchWindPending, drawCast: S.drawCastScaled, smooth: G.smooth };
try {
  const operations = [], callbacks = [];
  const c = { save() { operations.push(['save']); }, restore() { operations.push(['restore']); }, beginPath() {},
    rect(...args) { operations.push(['clipRect', ...args]); }, clip() {}, clearRect(...args) { operations.push(['clear', ...args]); },
    drawImage(...args) { operations.push(['draw', ...args]); } };
  const canvases = [];
  scope.document.createElement = () => { const canvas = { width: 0, height: 0, getContext() { return c; } }; canvases.push(canvas); return canvas; };
  scope.requestIdleCallback = fn => { callbacks.push(fn); return callbacks.length; };
  S.castAssets.BOOST = { ...before.slots, CAST: source }; S.witchWindCache = null; S.witchWindPending = null;
  S.scheduleWitchWindCache(source);
  assert.equal(callbacks.length, 1, 'one deferred callback, no synchronous raster work');
  assert.equal(operations.length, 0); assert.equal(S.witchWindCache, null);
  S.scheduleWitchWindCache(source); assert.equal(callbacks.length, 1, 'no duplicate build');
  for (let i = 0; i < 16; i++) {
    const workBefore = operations.filter(op => op[0] === 'draw').length; callbacks.shift()();
    assert.equal(operations.filter(op => op[0] === 'draw').length - workBefore, i === 0 ? 1 : 126, 'original first frame; one image and 125 strips for later frames');
    if (i < 15) { assert.equal(S.witchWindCache, null, 'part-built cache is never visible'); assert.equal(callbacks.length, 1); }
  }
  assert.equal(callbacks.length, 0); const cache = S.witchWindCache;
  assert(cache?.ready && cache.sourceAsset === source); assert.equal(cache.sheets.length, 4);
  for (const sheet of cache.sheets) { assert(sheet.canvasSource); assert.equal(sheet.image.width, 288 * 4); assert.equal(sheet.image.height, 288); }
  assert.equal(cache.sheets.reduce((n, sheet) => n + sheet.image.width * sheet.image.height * 4, 0), 5308416, 'bounded raw RGBA bytes');
  assert.equal(cache.data.frames, 16); assert.equal(cache.data.pivot.x, 144); assert.equal(cache.data.pivot.y, 278);
  assert.equal(cache.data.fps, 16 / 1.3); assert.equal(cache.data.loop, true);
  assert.deepEqual(operations.filter(op => op[0] === 'clipRect').map(op => op.slice(1)),
    Array.from({ length: 15 }, (_, i) => { const f = i + 1; return [[(f % 4) * 288 + 32, 140, 68, 100], [(f % 4) * 288 + 215, 156, 57, 82]]; }).flat());
  assert.equal(source.data.frames, 1, 'source metadata stays untouched');
  assert.equal(S.createWitchWindCache({ ...source, ready: false }), null);
  assert.equal(S.createWitchWindCache({ ...source, data: { ...data, pivot: { x: 145, y: 278 } } }), null);
  scope.document.createElement = () => ({ getContext() { throw Error('denied'); } });
  assert.equal(S.createWitchWindCache(source), null, 'no canvas remains a safe fallback');
  scope.document.createElement = () => ({ width: 0, height: 0, getContext() { return c; } });
  // An idle callback that fails halfway, or an asset that changes, must never publish a partial cache.
  S.witchWindCache = null; S.witchWindPending = null; S.scheduleWitchWindCache(source);
  S.castAssets.BOOST.CAST = { ...source }; callbacks.shift()(); assert.equal(S.witchWindCache, null); assert.equal(S.witchWindPending, null);
  S.castAssets.BOOST.CAST = source; const oldRender = S.renderWitchWindFrame;
  S.renderWitchWindFrame = () => { throw Error('lost canvas'); };
  try { S.scheduleWitchWindCache(source); callbacks.shift()(); assert.equal(S.witchWindCache, null); assert.equal(S.witchWindPending, null); }
  finally { S.renderWitchWindFrame = oldRender; }
  // Browsers without requestIdleCallback get the same bounded work via setTimeout.
  delete scope.requestIdleCallback; scope.setTimeout = fn => { callbacks.push(fn); return callbacks.length; };
  S.scheduleWitchWindCache(source); assert.equal(callbacks.length, 1); assert.equal(S.witchWindCache, null);
  for (let i = 0; i < 16; i++) callbacks.shift()(); assert(S.witchWindCache?.ready); assert.equal(callbacks.length, 0);
  S.witchWindCache = cache;

  // Cache loss or an unprepared cache is never allowed to break the original sprite.
  const drawCalls = [], stack = [];
  const target = { globalAlpha: 1, filter: 'none', save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
    translate() {}, rotate() {}, scale() {}, drawImage(...args) { drawCalls.push({ image: args[0], alpha: this.globalAlpha, args }); } };
  drawCalls.length = 0; assert(S.drawCastScaled(target, 'BOOST', 400, 500, 'CAST', 1, { face: 'right', windTime: 0.4, windAlpha: 1 }));
  assert.equal(drawCalls.length, 1, 'steady motion uses a single blit'); assert.equal(drawCalls[0].image, cache.sheets[1].image);
  for (let frame = 0; frame < 16; frame++) {
    drawCalls.length = 0;
    assert(S.drawCastScaled(target, 'BOOST', 400, 500, 'CAST', 1, { windTime: (frame + 0.25) / cache.data.fps }));
    assert.equal(drawCalls.length, 1); assert.equal(drawCalls[0].image, cache.sheets[Math.floor(frame / 4)].image);
    assert.equal(drawCalls[0].args[1], (frame % 4) * 288, 'correct local cell across all strip boundaries');
  }
  drawCalls.length = 0; assert(S.drawCastScaled(target, 'BOOST', 400, 500, 'CAST', 1, { face: 'left', windTime: 0.4, windAlpha: 0.5 }));
  assert.equal(drawCalls.length, 1, 'entrance uses one cached image without darkening translucent pixels'); assert.equal(drawCalls[0].image, cache.sheets[1].image); assert.equal(drawCalls[0].alpha, 1);
  drawCalls.length = 0; assert(S.drawCastScaled(target, 'BOOST', 400, 500, 'CAST', 1, { windTime: 0.4, windAlpha: 0 }));
  assert.equal(drawCalls.length, 1); assert.equal(drawCalls[0].image, cache.sheets[1].image, 'wind alpha does not introduce a second image');
  let attempts = 0;
  const broken = { ...target, drawImage(image) { attempts++; if (cache.sheets.some(sheet => sheet.image === image)) throw Error('cache lost'); } };
  assert(S.drawCastScaled(broken, 'BOOST', 400, 500, 'CAST', 1, { windTime: 0.5 })); assert.equal(attempts, 2, 'failed cached draw falls back to original');
  S.witchWindCache = { ...cache, sourceAsset: {} }; drawCalls.length = 0;
  assert(S.drawCastScaled(target, 'BOOST', 400, 500, 'CAST', 1, { windTime: 0.5 })); assert.equal(drawCalls[0].image, source.image, 'stale cache is ignored');
  S.witchWindCache = { ready: true, sourceAsset: source }; drawCalls.length = 0;
  assert(S.drawCastScaled(target, 'BOOST', 400, 500, 'CAST', 1, { windTime: 0.5 })); assert.equal(drawCalls[0].image, source.image, 'malformed cache falls back safely');

  // Render-time gate: late cache completion never starts animation part-way through a scene.
  const game = launch(), ui = new H.UI(game, element('canvas'));
  game.objects = []; game.trail = []; game.launchCutin = null; game.specialCutin = null; game.comboAfter = null;
  const start = G.comboSceneStart(false);
  const makeScene = type => ({ type, elapsed: start + (type === 'BOOST' ? 0.3 : C.comboFighterTimes.arrive + 0.3),
    short: false, heroX: 1200, heroY: 30, source: { x: 1080 }, partner: { x: 1500 }, skipped: false, total: 3 });
  const seen = []; S.drawCastScaled = (ctx, id, x, feet, pose, mul, opts) => { if (id === 'BOOST' && pose === 'CAST') seen.push(opts); return { w: 1 }; };
  G.smooth = false; ui.visual.reducedMotion = false; S.witchWindCache = null; game.combo = makeScene('BOOST');
  let snapshot = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), snapshot); assert(!ui.visual.witchWindAllowed);
  S.witchWindCache = cache; ui.draw(); assert(!ui.visual.witchWindAllowed, 'late completion waits for next scene'); assert.equal(seen.at(-1).windTime, undefined);
  game.combo = makeScene('BOOST'); ui.draw(); assert(ui.visual.witchWindAllowed); assert(Number.isFinite(seen.at(-1).windTime));
  ui.visual.reducedMotion = true; ui.draw(); assert(!ui.visual.witchWindAllowed); assert.equal(seen.at(-1).windTime, undefined);
  ui.visual.reducedMotion = false; ui.draw(); assert(!ui.visual.witchWindAllowed); assert.equal(seen.at(-1).windTime, undefined, 'off waits for next scene');
  game.combo = makeScene('BOUNCE'); snapshot = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), snapshot); assert(ui.visual.witchWindAllowed); assert(Number.isFinite(seen.at(-1).windTime));
  game.combo.skipped = true; ui.draw(); assert.equal(seen.at(-1).windTime, undefined, 'skip remains static');
  game.combo = null; ui.draw(); assert.equal(ui.visual.witchWindScene, null);
  console.log('Witch CAST wind PASS: idle chunks, bounded cache, one blit, fade, draw failures, late completion gate, reduced motion, skip and game purity.');
} finally {
  if (before.create === undefined) delete scope.document.createElement; else scope.document.createElement = before.create;
  if (before.idle === undefined) delete scope.requestIdleCallback; else scope.requestIdleCallback = before.idle;
  if (before.timeout === undefined) delete scope.setTimeout; else scope.setTimeout = before.timeout;
  S.castAssets.BOOST = before.slots; S.witchWindCache = before.cache; S.witchWindPending = before.pending; S.drawCastScaled = before.drawCast; G.smooth = before.smooth;
}
