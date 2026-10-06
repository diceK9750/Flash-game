// Launch truck HD comic still (display only). The truck has no hit box (no truck in game.js / physics.js);
// Graphics.truck draws the still at the Canvas truck origin when it is loaded and the Canvas truck otherwise.
// Positions per state (READY -55, AIM_ANGLE -44 -> -38, AIM_POWER -32, 0.5 s after launch -20) stay in Graphics.draw.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
// Minimal PNG reader (8-bit RGBA, non-interlaced) for the shipped sheet.
function readPng(file) {
  const buf = fs.readFileSync(path.join(root, file)); let pos = 8, idat = [], w, h;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); assert.equal(body[8], 8); assert.equal(body[9], 6, 'RGBA PNG'); assert.equal(body[12], 0); }
    if (type === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? px[y * stride + i - 4] : 0, b = y ? px[(y - 1) * stride + i] : 0, c = i >= 4 && y ? px[(y - 1) * stride + i - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      px[y * stride + i] = (src[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
  }
  return { w, h, px };
}
const requested = []; let failFetch = false;
class Image { constructor() { this.complete = true; } set src(v) { requested.push(v); try { const p = readPng(v); this.naturalWidth = p.w; this.naturalHeight = p.h; this.onload(); } catch (e) { this.onerror(e); } } }
const fetch = async url => { requested.push(url); if (failFetch) throw new Error('offline'); const file = path.join(root, url); return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) }; };
const scope = { Image, fetch }; scope.window = scope; vm.createContext(scope);
for (const name of ['config', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), scope, { filename: name });
const H = scope.Hop, s = H.Sprites, G = H.Graphics;
// Recording context: drawImage (sprite) and the Canvas primitives (fillRect / arc) the Canvas truck uses.
function recorder(opts = {}) {
  const calls = [], stack = [];
  const ctx = { imageSmoothingEnabled: false, imageSmoothingQuality: 'low', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    save() { stack.push([this.imageSmoothingEnabled, this.imageSmoothingQuality, this.fillStyle]); calls.push(['save']); },
    restore() { [this.imageSmoothingEnabled, this.imageSmoothingQuality, this.fillStyle] = stack.pop(); calls.push(['restore']); },
    translate(x, y) { calls.push(['translate', x, y]); }, scale(a, b) { calls.push(['scale', a, b]); },
    fillRect(...a) { calls.push(['fillRect', this.fillStyle, ...a]); }, beginPath() { calls.push(['beginPath']); },
    arc(...a) { calls.push(['arc', this.fillStyle, ...a]); }, fill() { calls.push(['fill', this.fillStyle]); }, stroke() { calls.push(['stroke']); },
    moveTo() {}, lineTo() {}, closePath() {},
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { if (opts.throws) throw new Error('decode'); calls.push(['drawImage', { img, sx, sy, sw, sh, dx, dy, dw, dh, smooth: this.imageSmoothingEnabled, quality: this.imageSmoothingQuality }]); } };
  return { ctx, calls };
}
const canvasTruck = (x, ground) => { const saved = s.drawTruck; delete s.drawTruck; s.drawTruck = undefined; const r = recorder(); G.truck(r.ctx, x, ground); s.drawTruck = saved; return r.calls; };
(async () => {
  // Manifest: one IDLE still, relative paths below the Pages subpath, flag == files present.
  const T = s.definitions.TRUCK, def = T.IDLE, DIR = 'assets/sprites/truck/truck_comic_v1/';
  assert.deepEqual(Object.keys(T), ['IDLE'], 'one still for every state (no IMPACT)');
  assert.deepEqual([def.id, def.animation, def.frames, def.fps, def.loop, def.scale, def.flip], ['TRUCK', 'IDLE', 1, 1, false, 1.25, undefined]);
  for (const ref of [def.src, def.metadata]) {
    assert(ref.startsWith(DIR) && !/^(?:\/|[a-z]+:)/i.test(ref));
    assert(new URL(ref, 'https://example.test/Flash-game/').pathname.startsWith('/Flash-game/' + DIR));
  }
  const present = fs.existsSync(path.join(root, def.src)) && fs.existsSync(path.join(root, def.metadata));
  assert.equal(def.enabled !== false, present, present ? 'bundle found: set enabled: true' : 'enabled but bundle missing');
  assert(present, 'truck_comic_v1 shipped');
  // Metadata / sheet contract: 576x288 RGBA, pivot (352,264) = Canvas origin, smoothing, displayScale == scale.
  const m = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
  assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot, smoothing: m.smoothing },
    { id: 'TRUCK', animation: 'IDLE', w: 576, h: 288, frames: 1, fps: 1, loop: false, pivot: { x: 352, y: 264 }, smoothing: true });
  assert.equal(m.displayScale, def.scale); assert(s.normalizeCell({ ...m }), 'HD cell contract (cellW = 2 x cellH allowed)');
  const png = readPng(def.src); assert.deepEqual([png.w, png.h], [576, 288]);
  // On-screen footprint of the opaque pixels (alpha > 128) relative to the origin: same as the Canvas truck
  // (x -125.4..+41.4, roof -101.9; tyres stand on the ground instead of dipping 3.4 px below it).
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (png.px[(y * png.w + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
  const k = def.scale * 96 / 288, box = { left: (x0 - 352) * k, right: (x1 - 352) * k, top: (y0 - 264) * k, bottom: (y1 - 264) * k };
  assert(Math.abs(box.left + 125.4) < 3 && Math.abs(box.right - 41.4) < 3, 'length / origin like the Canvas truck ' + JSON.stringify(box));
  assert(Math.abs(box.top + 101.9) < 3 && box.bottom <= 0.5 && box.bottom > -1.5, 'roof height, tyres on the ground ' + JSON.stringify(box));
  for (let x = 0; x < png.w; x++) for (const y of [0, png.h - 1]) assert.equal(png.px[(y * png.w + x) * 4 + 3], 0, 'not clipped');
  // Loader: the real bundle loads; disabled = never requested; bad metadata / offline -> not ready.
  const asset = await s.truckReady; assert.equal(asset.ready, true); assert.equal(s.truckIdle, asset);
  assert(requested.includes(def.metadata) && requested.includes(def.src));
  let n = requested.length; assert.equal((await s.load({ ...def, enabled: false })).ready, false); assert.equal(requested.length, n, 'disabled = never requested');
  assert.equal((await s.load({ ...def, id: 'HERO' })).ready, false, 'id must be TRUCK');
  assert.equal((await s.load({ ...def, frames: 8 })).ready, false, '1-frame still');
  failFetch = true; assert.equal((await s.load(def)).ready, false, 'offline'); failFetch = false;
  // drawTruck: origin (x, ground) on the pivot, drawn scale 1.25*96/288, smoothing on.
  const k3 = 1.25 / 3;
  for (const [x, ground] of [[115, 594], [138, 594], [-20, 400.5]]) {
    const r = recorder(); assert.equal(s.drawTruck(r.ctx, x, ground), true);
    const d = r.calls.filter(c => c[0] === 'drawImage'); assert.equal(d.length, 1); const e = d[0][1];
    assert.deepEqual([e.sx, e.sy, e.sw, e.sh], [0, 0, 576, 288]);
    for (const [a, b] of [[e.dx, x - 352 * k3], [e.dy, ground - 264 * k3], [e.dw, 576 * k3], [e.dh, 288 * k3]]) assert(Math.abs(a - b) < 1e-9, a + ' vs ' + b);
    assert.equal(e.smooth, true); assert.equal(e.quality, 'high'); assert.equal(r.ctx.imageSmoothingEnabled, false, 'state restored');
  }
  // Graphics.truck: sprite only (no Canvas rectangles) when loaded.
  { const r = recorder(); G.truck(r.ctx, 200, 594); assert.equal(r.calls.filter(c => c[0] === 'drawImage').length, 1); assert.equal(r.calls.filter(c => c[0] === 'fillRect' || c[0] === 'arc').length, 0); }
  // Fallbacks -> exactly the previous Canvas truck calls.
  const base = canvasTruck(200, 594);
  assert.deepEqual(base.filter(c => c[0] === 'fillRect').map(c => c[1]), ['#faf3da', '#e79748', '#a3dfed', '#687886', '#fff8ba']);
  assert.deepEqual(base.find(c => c[0] === 'translate'), ['translate', 200, 594]); assert.deepEqual(base.find(c => c[0] === 'scale'), ['scale', 1.12, 1.12]);
  const fallback = label => { const r = recorder(); G.truck(r.ctx, 200, 594); assert.deepEqual(r.calls, base, label); };
  s.truckIdle = { ready: false }; assert.equal(s.drawTruck(recorder().ctx, 200, 594), false); fallback('not loaded');
  s.truckIdle = asset; def.enabled = false; fallback('enabled: false'); def.enabled = true;
  s.truckIdle = { ...asset, image: { complete: false, naturalWidth: 576 } }; fallback('not decoded yet');
  s.truckIdle = asset;
  { const r = recorder({ throws: true }); assert.equal(s.drawTruck(r.ctx, 200, 594), false); G.truck(r.ctx, 200, 594);
    assert.deepEqual(r.calls.filter(c => c[0] !== 'save' && c[0] !== 'restore'), base.filter(c => c[0] !== 'save' && c[0] !== 'restore'), 'drawImage throws -> Canvas'); }
  const saved = s.definitions.TRUCK; delete s.definitions.TRUCK; fallback('no definition'); s.definitions.TRUCK = saved;
  // In the game: same x per state as before, the sprite in every state, gone 0.5 s after launch, game state untouched.
  const { scope: gs, element, random } = require('./phase2.cjs');
  const GH = gs.Hop, c = GH.CONFIG, game = new GH.Game(random(1)), ui = new GH.UI(game, element('canvas'));
  GH.Sprites.truckIdle = { ready: true, image: { complete: true, naturalWidth: 576 }, data: GH.Sprites.normalizeCell({ ...m }) };
  const log = [], origTruck = GH.Graphics.truck, origDraw = GH.Sprites.drawTruck;
  let sprite = 0; GH.Sprites.drawTruck = function (...a) { const ok = origDraw.apply(this, a); sprite += ok ? 1 : 0; return ok; };
  GH.Graphics.truck = function (ctx, x, ground) { log.push([game.state, x - (c.launchX - game.cameraX), ground - (c.groundY + game.cameraY)]); return origTruck.call(this, ctx, x, ground); };
  const frame = () => { log.length = 0; ui.update(); const before = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), before, 'draw purity'); return log.slice(); };
  assert.deepEqual(frame(), [['READY', -55, 0]]);
  game.act(); assert.deepEqual(frame(), [['AIM_ANGLE', -44, 0]]);
  game.phaseTime = 0.25; assert.deepEqual(frame(), [['AIM_ANGLE', -41, 0]]);
  game.phaseTime = 1; assert.deepEqual(frame(), [['AIM_ANGLE', -38, 0]]);
  game.act(); assert.deepEqual(frame(), [['AIM_POWER', -32, 0]]);
  game.act(); assert.equal(game.state, 'FLYING'); const at = game.phaseTime; const after = frame();
  assert.equal(after.length, 1); assert.equal(after[0][0], 'FLYING'); assert(Math.abs(after[0][1] + 20) < 1e-9 && after[0][2] === 0, 'launch: -20');
  game.phaseTime = at + 0.49; assert.equal(frame().length, 1); game.phaseTime = at + 0.5; assert.deepEqual(frame(), [], 'gone 0.5 s after launch');
  assert.equal(sprite, 7, 'the HD still drew in every state');
  GH.Graphics.truck = origTruck; GH.Sprites.drawTruck = origDraw; GH.Sprites.truckIdle = undefined;
  // No truck in the simulation: game.js / physics.js / config.js never mention it.
  for (const f of ['game', 'physics', 'config']) assert(!/truck/i.test(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8')), f + '.js has no truck');
  console.log('Truck sprite PASS: 576x288 HD still, pivot = Canvas origin, 167 x 102 px like the Canvas truck, loader / disabled / errors, drawTruck geometry, Canvas fallback identical, same x per state, gone after 0.5 s, display only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
