// Isolated async loader checks are awaited in a child so release.cjs stays synchronous.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const dir = 'assets/sprites/hero/flight_loop/';
const metadata = JSON.parse(fs.readFileSync(path.join(root, dir, 'hero_flight_loop.json')));
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok';
    class Image {
      constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 96; }
      set src(value) {
        if (mode === 'image-error') this.onerror(new Error('missing image'));
        else { if (mode === 'size') this.naturalWidth = 1; this.onload(); }
      }
    }
    const scope = { Hop: {}, Image, fetch: async () => {
      if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => {
        if (mode === 'json') throw new SyntaxError('invalid JSON');
        return mode === 'metadata' ? { ...metadata, fps: 0 } : metadata;
      } };
    } };
    vm.createContext(scope); vm.runInContext(code, scope);
    const sprites = scope.Hop.Sprites;
    assert.equal((await sprites.ready).ready, true);
    for (mode of ['image-error', 'size', 'network', '404', 'json', 'metadata']) {
      assert.equal((await sprites.load(sprites.definitions.HERO.FLIGHT_LOOP)).ready, false, mode);
    }
    mode = 'ok'; assert.equal((await sprites.load(sprites.definitions.HERO.FLIGHT_LOOP)).ready, true);
    console.log('Sprite loader PASS: success, missing image, bad dimensions, network/404, invalid JSON/metadata, recovery.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, launch, element } = require('./phase2.cjs');
  const s = scope.Hop.Sprites, definition = s.definitions.HERO.FLIGHT_LOOP;
  for (const ref of [definition.src, definition.metadata]) {
    assert(!/^(?:\/|[a-z]+:)/i.test(ref));
    assert(new URL(ref, 'https://example.test/Flash-game/').pathname.startsWith('/Flash-game/assets/'));
    assert(fs.existsSync(path.join(root, ref)));
  }
  const png = fs.readFileSync(path.join(root, definition.src));
  // Shipped FLIGHT_LOOP is the HD comic sheet (8 x 288 cells); the draw checks below keep using the
  // legacy 96 sheet metadata (still in flight_loop/) to cover the 96 code path.
  assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288);
  const shipped = JSON.parse(fs.readFileSync(path.join(root, definition.metadata)));
  assert.equal(shipped.cellW, 288); assert.equal(shipped.frames, 8); assert.equal(shipped.pivot.x, 144); assert.equal(shipped.pivot.y, 264); assert.equal(shipped.loop, true);
  assert.equal(png[25], 6, 'RGBA PNG');
  const asset = { ready: true, image: { complete: true, naturalWidth: 768 }, data: metadata };
  const calls = [], stack = [];
  const ctx = { imageSmoothingEnabled: true,
    save() { stack.push(this.imageSmoothingEnabled); },
    restore() { this.imageSmoothingEnabled = stack.pop(); },
    drawImage(...args) { assert.equal(this.imageSmoothingEnabled, false); calls.push(args); }
  };
  for (const fps of [30, 60, 120, 144]) {
    for (let i = 0; i <= fps * 2; i++) {
      assert(s.draw(ctx, asset, i / fps, 100, 200, definition.scale));
      const args = calls.at(-1);
      assert.equal(args[1], Math.floor(i / fps * 8) % 8 * 96);
      assert.deepEqual(args.slice(5), [40, 90, 120, 120]);
      assert.equal(ctx.imageSmoothingEnabled, true);
    }
  }
  assert.equal(s.draw(ctx, null, 0, 0, 0, 1), false);
  assert.equal(s.draw(ctx, { ...asset, data: null }, 0, 0, 0, 1), false);
  assert.equal(s.draw(ctx, { ...asset, ready: false }, 0, 0, 0, 1), false);
  ctx.drawImage = () => { throw new Error('decode lost'); };
  assert.equal(s.draw(ctx, asset, 0, 0, 0, 1), false); assert.equal(ctx.imageSmoothingEnabled, true);
  const game = launch(), ui = new scope.Hop.UI(game, element('canvas'));
  const graphics = scope.Hop.Graphics, original = graphics.character, originalAsset = s.heroFlight;
  const rendered = []; graphics.character = function(ctx, id, ...rest) { rendered.push(id); return original.call(this, ctx, id, ...rest); };
  s.heroFlight = asset;
  // With no IDLE asset, READY/AIM fall back to Canvas HERO (legacy).
  s.heroIdle = { ready: false };
  for (const state of ['READY', 'AIM_ANGLE', 'AIM_POWER', 'FLYING', 'RESULT']) {
    game.state = state; rendered.length = 0;
    const before = JSON.stringify(game); ui.draw();
    assert.equal(JSON.stringify(game), before, 'Drawing must not mutate any game state');
    assert.equal(rendered.includes('HERO'), state !== 'FLYING' && state !== 'RESULT'); // RESULT: frozen FLIGHT_LOOP (Phase B)
  }
  // HD IDLE still: READY/AIM draw the sprite (no Canvas); FLYING/RESULT unchanged.
  const idle = { ready: true, image: { complete: true, naturalWidth: 288, naturalHeight: 288 },
    data: s.normalizeCell({ id: 'HERO', animation: 'IDLE', cellW: 288, cellH: 288, frames: 1, fps: 1, loop: false }) };
  s.heroIdle = idle; const idleDraws = [];
  const prevDraw = s.draw; s.draw = function (ctx, a, ...rest) { if (a === idle) idleDraws.push(true); return prevDraw.call(this, ctx, a, ...rest); };
  for (const state of ['READY', 'AIM_ANGLE', 'AIM_POWER']) {
    game.state = state; rendered.length = 0; idleDraws.length = 0; ui.draw();
    assert.equal(rendered.includes('HERO'), false, state + ' uses IDLE not Canvas');
    assert.equal(idleDraws.length, 1, state + ' draws IDLE once');
  }
  game.state = 'FLYING'; rendered.length = 0; idleDraws.length = 0; ui.draw();
  assert.equal(idleDraws.length, 0, 'FLYING does not draw IDLE'); assert.equal(rendered.includes('HERO'), false);
  s.draw = prevDraw;
  game.state = 'FLYING'; s.heroFlight = { ready: false }; s.heroIdle = idle; rendered.length = 0; ui.draw();
  assert(rendered.includes('HERO'), 'FLYING with no flight asset still falls back to Canvas (IDLE is prelaunch only)');
  const originalDraw = s.draw, times = [];
  s.draw = (ctx, asset, time) => { times.push(time); return true; };
  ui.visual.launchAt = 2; game.phaseTime = 2.375; ui.draw(); ui.draw();
  assert.deepEqual(times, [.375, .375], 'Paused game time keeps the same frame');
  ui.visual.reducedMotion = true; ui.draw(); assert.equal(times.at(-1), 0);
  s.draw = originalDraw;
  graphics.character = original; s.heroFlight = originalAsset;
  console.log('Sprites PASS: RGBA/relative assets, 8fps/8 frames at 30/60/120/144Hz, fixed pivot, smoothing isolation, READY/AIM HD IDLE, FLYING only for flight sheets, fallback, draw purity.');
}
