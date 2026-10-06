// HD sprite cells (display only): sheets may declare cellW / cellH and a pivot; the drawn scale is
// definition scale * 96 / cellH so an HD sheet keeps the 96 version's on-screen size and feet point.
// Uses the synthetic fixtures in tests/fixtures/hd (96x96, 288x288 = same figure x3, 360x288 wide).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), FIX = 'tests/fixtures/hd/';
// Minimal PNG reader (8-bit RGBA, non-interlaced) for the fixtures.
function readPng(file) {
  const buf = fs.readFileSync(path.join(root, file)); let pos = 8, idat = [], w, h;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); assert.equal(body[8], 8); assert.equal(body[9], 6); assert.equal(body[12], 0); }
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
function alphaBox(png) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (png.px[(y * png.w + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  return { x0, y0, x1, y1 };
}
// File-backed fetch / Image mocks (paths are relative to the repo root, like the static site).
class Image { constructor() { this.complete = true; } set src(v) { try { const p = readPng(v); this.naturalWidth = p.w; this.naturalHeight = p.h; this.onload(); } catch (e) { this.onerror(e); } } }
let failFetch = false;
const fetch = async url => { if (failFetch) throw new Error('offline'); const file = path.join(root, url); return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) }; };
const scope = { Hop: {}, Image, fetch }; vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8'), scope);
const s = scope.Hop.Sprites;
let cases = 0; const test = async (name, fn) => { try { await fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } };
const def = (name, extra) => ({ id: 'BOOST', animation: 'IDLE', frames: 1, fps: 1, loop: false, scale: 1.25, enabled: true, src: FIX + name + '.png', metadata: FIX + name + '.json', ...extra });
function recorder() {
  const stack = [], calls = [];
  const ctx = { imageSmoothingEnabled: true, imageSmoothingQuality: 'low', m: [1, 0, 0, 1, 0, 0],
    save() { stack.push([this.imageSmoothingEnabled, this.imageSmoothingQuality, this.m.slice()]); },
    restore() { [this.imageSmoothingEnabled, this.imageSmoothingQuality, this.m] = stack.pop(); },
    translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
    scale(a, b) { const m = this.m; m[0] *= a; m[1] *= a; m[2] *= b; m[3] *= b; },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { calls.push({ img, sx, sy, sw, sh, dx, dy, dw, dh, smooth: this.imageSmoothingEnabled, quality: this.imageSmoothingQuality, m: this.m.slice() }); } };
  return { ctx, calls };
}
// Screen-space box of the opaque fixture pixels for one recorded drawImage call.
function screenBox(call, png) {
  const b = alphaBox(png), kx = call.dw / call.sw, ky = call.dh / call.sh, m = call.m;
  const xs = [call.dx + (b.x0 - call.sx) * kx, call.dx + (b.x1 - call.sx) * kx].map(x => m[0] * x + m[4]).sort((p, q) => p - q);
  const ys = [call.dy + (b.y0 - call.sy) * ky, call.dy + (b.y1 - call.sy) * ky].map(y => m[3] * y + m[5]);
  return { x0: xs[0], x1: xs[1], y0: ys[0], y1: ys[1] };
}
const close = (a, b, label) => { for (const k of ['x0', 'x1', 'y0', 'y1']) assert(Math.abs(a[k] - b[k]) < 1e-9, label + ' ' + k + ' ' + a[k] + ' vs ' + b[k]); };
(async () => {
  await s.castReady; // real shipped assets still load through the generalized loader
  await test('cell contract: legacy strict, HD cellW/cellH + pivot + bounds', () => {
    const n = d => s.normalizeCell(JSON.parse(JSON.stringify(d)));
    const legacy = n({ frameWidth: 96, frameHeight: 96, pivot: { x: 48, y: 88 } });
    assert.equal(legacy.unit, 1); assert.equal(legacy.smooth, false);
    for (const bad of [{ frameWidth: 64, frameHeight: 96, pivot: { x: 48, y: 88 } }, { frameWidth: 96, frameHeight: 96, pivot: { x: 48, y: 90 } }, { frameWidth: 96, frameHeight: 96 }]) assert.equal(n(bad), false, JSON.stringify(bad));
    const hd = n({ cellW: 288, cellH: 288 });
    assert.equal(JSON.stringify([hd.frameWidth, hd.frameHeight, hd.pivot.x, hd.pivot.y, hd.unit, hd.smooth]), JSON.stringify([288, 288, 144, 264, 3, true]));
    assert.equal(n({ frameWidth: 288, frameHeight: 288 }).unit, 3, 'frameHeight > 96 is HD too');
    assert.equal(n({ cellW: 360, cellH: 288, pivot: { x: 180, y: 264 } }).frameWidth, 360, 'wide pose cell');
    assert.equal(n({ cellW: 288, cellH: 288, smoothing: false }).smooth, false);
    for (const bad of [{ cellW: 600, cellH: 288 }, { cellW: 120, cellH: 288 }, { cellW: 2048, cellH: 2048 }, { cellW: 288, cellH: 80 }, { cellW: 288.5, cellH: 288 },
      { cellW: 288, cellH: 288, frameWidth: 96 }, { cellW: 288, cellH: 288, pivot: { x: 300, y: 264 } }, { cellW: 288, cellH: 288, pivot: { x: 144 } }, { cellW: 288, cellH: 288, smoothing: 'yes' }]) assert.equal(n(bad), false, JSON.stringify(bad));
  });
  const a96 = await s.load(def('hd_fixture_96')), a288 = await s.load(def('hd_fixture_288')), aWide = await s.load(def('hd_fixture_wide_360x288'));
  const png = { 96: readPng(FIX + 'hd_fixture_96.png'), 288: readPng(FIX + 'hd_fixture_288.png'), wide: readPng(FIX + 'hd_fixture_wide_360x288.png') };
  await test('fixtures load (96 legacy, 288 HD, 360x288 wide)', () => {
    assert(a96.ready && a288.ready && aWide.ready);
    assert.equal(a288.data.unit, 3); assert.equal(a288.data.pivot.y, 264); assert.equal(aWide.data.frameWidth, 360);
  });
  await test('HD sheet size mismatch / bad metadata rejected, recovery', async () => {
    assert.equal((await s.load(def('hd_fixture_288', { src: FIX + 'hd_fixture_96.png' }))).ready, false, '96 image for a 288 cell');
    assert.equal((await s.load(def('hd_fixture_288', { frames: 8 }))).ready, false);
    failFetch = true; assert.equal((await s.load(def('hd_fixture_288'))).ready, false); failFetch = false;
    assert.equal((await s.load(def('hd_fixture_288'))).ready, true);
  });
  await test('same on-screen bbox and feet as the 96 version (plain, merchant scale, mirrored, any position)', () => {
    for (const scale of [1.25, 1.25 * 1.25 / 1.365]) for (const [x, feet] of [[0, 18], [517.3, 594], [1200, 400]]) {
      const r = recorder();
      assert(s.draw(r.ctx, a96, 0, x, feet, scale)); assert(s.draw(r.ctx, a288, 0, x, feet, scale)); assert(s.draw(r.ctx, aWide, 0, x, feet, scale));
      const [c96, c288, cWide] = r.calls, ref = screenBox(c96, png[96]);
      close(screenBox(c288, png[288]), ref, '288'); close(screenBox(cWide, png.wide), ref, 'wide');
      // Feet: the pivot lands on (x, feet) for every cell size.
      for (const c of r.calls) { const k = c.dw / c.sw, piv = c === c96 ? a96.data.pivot : c === c288 ? a288.data.pivot : aWide.data.pivot; assert(Math.abs(c.dx + piv.x * k - x) < 1e-9 && Math.abs(c.dy + piv.y * k - feet) < 1e-9); }
      assert(Math.abs(c288.dw - 96 * scale * 3 / 3) < 1e-9, '288 cell drawn at 96*scale canvas px');
    }
    // Mirrored CAST still through drawCast (flip: true), as DASH / GUARD use it.
    s.definitions.CAST.TEST = { IDLE: { scale: 1.25, flip: true } };
    const boxes = [a96, a288, aWide].map((asset, i) => { s.castAssets.TEST = { IDLE: asset }; const r = recorder(); assert(s.drawCast(r.ctx, 'TEST', 640, 594)); return screenBox(r.calls[0], [png[96], png[288], png.wide][i]); });
    close(boxes[1], boxes[0], 'flip 288'); close(boxes[2], boxes[0], 'flip wide');
    close(boxes[0], { x0: 640 - (65 - 48) * 1.25, x1: 640 + (48 - 38) * 1.25, y0: 594 - (88 - 12) * 1.25, y1: 594 }, 'mirrored: staff on the viewer\'s left');
    delete s.definitions.CAST.TEST; delete s.castAssets.TEST;
  });
  await test('smoothing: off for legacy pixel sprites, high-quality on for HD, restored after', () => {
    const r = recorder();
    s.draw(r.ctx, a96, 0, 0, 0, 1.25); s.draw(r.ctx, a288, 0, 0, 0, 1.25);
    assert.equal(r.calls[0].smooth, false); assert.equal(r.calls[1].smooth, true); assert.equal(r.calls[1].quality, 'high');
    assert.equal(r.ctx.imageSmoothingEnabled, true); assert.equal(r.ctx.imageSmoothingQuality, 'low');
  });
  await test('8-frame HD hero sheet: frame columns step by cellW', () => {
    const asset = { ready: true, image: { complete: true, naturalWidth: 288 * 8 }, data: s.normalizeCell({ id: 'HERO', animation: 'FLIGHT_LOOP', cellW: 288, cellH: 288, frames: 8, fps: 8, loop: true }) };
    const r = recorder(); s.draw(r.ctx, asset, 3.5 / 8, 0, 18, 1.25);
    assert.equal(r.calls[0].sx, 3 * 288); assert.equal(r.calls[0].sw, 288); assert(Math.abs(r.calls[0].dw - 120) < 1e-9);
  });
  await test('shipped definitions: same scales, legacy 96 cast stills except the HD comic ones', () => {
    for (const d of Object.values(s.definitions.HERO)) assert.equal(d.scale, 1.25);
    assert(Math.abs(s.definitions.CAST.SPECIAL_ONLY.IDLE.scale - 1.25 * 1.25 / 1.365) < 1e-12);
    // Cast: legacy 96 stills except the shipped HD comic ones (288 cell, unit 3, smoothing on).
    const HD_CAST = ['BOOST.IDLE', 'BOOST.USED', 'BOUNCE.IDLE', 'BOUNCE.KICK', 'BRAKE.IDLE', 'BRAKE.USED', 'ANGLE.IDLE', 'ANGLE.USED', 'DASH.IDLE'];
    for (const [id, slots] of Object.entries(s.castAssets)) for (const [name, a] of Object.entries(slots)) if (a.ready) {
      const hd = HD_CAST.includes(id + '.' + name); assert.equal(a.data.unit, hd ? 3 : 1, id + '.' + name); assert.equal(a.data.smooth, hd, id + '.' + name);
    }
  });
  console.log(JSON.stringify({ spritesHd: 'PASS', cases }));
})().catch(e => { console.error(e); process.exitCode = 1; });
