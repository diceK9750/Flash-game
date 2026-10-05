// HERO HD IDLE still (READY / AIM only). Display-only; 288 cell, same on-screen size as 96 FLIGHT_LOOP.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { scope, element, launch } = require('./phase2.cjs');
const root = path.resolve(__dirname, '..');
const s = scope.Hop.Sprites, G = scope.Hop.Graphics;
let cases = 0; const test = (n, fn) => { try { fn(); cases++; } catch (e) { e.message = n + ': ' + e.message; throw e; } };
(async () => {
  // Load the real idle files through a file-backed fetch/Image (phase2 has none).
  class Image { constructor() { this.complete = true; } set src(v) {
    const buf = fs.readFileSync(path.join(root, v)); this.naturalWidth = buf.readUInt32BE(16); this.naturalHeight = buf.readUInt32BE(20); this.onload(); } }
  const fetch = async url => { const f = path.join(root, url); return { ok: fs.existsSync(f), json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }; };
  const def = s.definitions.HERO.IDLE;
  assert.equal(def.frames, 1); assert.equal(def.scale, 1.25); assert.equal(def.enabled, true);
  const prevImg = scope.Image, prevFetch = scope.fetch; scope.Image = Image; scope.fetch = fetch;
  // load via a fresh Sprites-like call using the shared loader
  const asset = await s.load(def);
  scope.Image = prevImg; scope.fetch = prevFetch;
  assert(asset.ready, 'HD idle sheet loads'); assert.equal(asset.data.frameWidth, 288); assert.equal(asset.data.unit, 3);
  assert.equal(asset.data.pivot.x, 144); assert.equal(asset.data.pivot.y, 264); assert.equal(asset.data.smooth, true);
  test('idleLayers empty when missing, one layer when ready', () => {
    s.heroIdle = { ready: false }; assert.equal(s.idleLayers().length, 0);
    s.heroIdle = asset; const layers = s.idleLayers();
    assert.equal(layers.length, 1); assert.equal(layers[0].name, 'IDLE'); assert.equal(layers[0].scale, 1.25);
  });
  test('draw: smoothing on, on-screen cell 120x120, feet at pivot', () => {
    const stack = [], calls = [];
    const ctx = { imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
      save() { stack.push([this.imageSmoothingEnabled, this.imageSmoothingQuality]); },
      restore() { [this.imageSmoothingEnabled, this.imageSmoothingQuality] = stack.pop(); },
      drawImage(...a) { calls.push({ args: a, smooth: this.imageSmoothingEnabled, q: this.imageSmoothingQuality }); } };
    assert(s.draw(ctx, asset, 0, 100, 18, 1.25));
    assert.equal(calls[0].smooth, true); assert.equal(calls[0].q, 'high');
    const [, , , , , dx, dy, dw, dh] = calls[0].args;
    assert(Math.abs(dw - 120) < 1e-9 && Math.abs(dh - 120) < 1e-9);
    assert(Math.abs(dx - (100 - 60)) < 1e-9 && Math.abs(dy - (18 - 110)) < 1e-9); // pivot 144/288*120=60, 264/288*120=110
    assert.equal(ctx.imageSmoothingEnabled, false);
  });
  test('READY/AIM draw IDLE; FLYING does not; missing IDLE -> Canvas', () => {
    s.heroIdle = asset; s.heroFlight = { ready: false };
    let canvas = 0, idle = 0;
    const origC = G.character, origD = s.draw;
    G.character = function (ctx, id, ...r) { if (id === 'HERO') canvas++; return origC.apply(this, arguments); };
    s.draw = function (ctx, a, ...r) { if (a === asset) idle++; return origD.apply(this, arguments); };
    const game = launch(3), ui = new scope.Hop.UI(game, element('canvas'));
    for (const st of ['READY', 'AIM_ANGLE', 'AIM_POWER']) {
      game.state = st; canvas = 0; idle = 0; const before = JSON.stringify(game); ui.draw();
      assert.equal(JSON.stringify(game), before); assert.equal(idle, 1); assert.equal(canvas, 0);
    }
    game.state = 'FLYING'; canvas = 0; idle = 0; ui.draw(); assert.equal(idle, 0); assert.equal(canvas, 1);
    s.heroIdle = { ready: false }; game.state = 'READY'; canvas = 0; idle = 0; ui.draw(); assert.equal(idle, 0); assert.equal(canvas, 1);
    G.character = origC; s.draw = origD;
  });
  test('shipped files present and JSON matches sheet', () => {
    const dir = path.join(root, 'assets/sprites/hero/idle');
    assert(fs.existsSync(path.join(dir, 'hero_idle_sheet_288x288.png')));
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'hero_idle.json'), 'utf8'));
    assert.equal(m.cellW, 288); assert.equal(m.cellH, 288); assert.equal(m.frames, 1);
  });
  console.log(JSON.stringify({ spritesIdle: 'PASS', cases }));
})().catch(e => { console.error(e); process.exitCode = 1; });
