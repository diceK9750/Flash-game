// Sprite opaque-box crop (2026-11-05 auto cycle 55, display only). The launch cut-in draws the truck / HIT hero stills
// 8-11x over its bands and six times along the flight (afterimages); a transparent texel costs as much to sample as
// an opaque one and the HIT cell is ~2/3 empty. Each cell of the truck / HIT sheets is now cropped (source and
// destination rect alike) to its alpha bounding box + a 4 px transparent margin, read once at load. Checks: the boxes
// of the real sheets hold every non-transparent pixel with a fully transparent margin, the crop keeps the
// source->screen mapping and combines with the band view, nothing changes without boxes / canvas, both sheets get
// boxes at load.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
// minimal PNG reader (8-bit RGBA, non-interlaced) -> { w, h, px }
function png(file) {
  const b = fs.readFileSync(path.join(root, file)); let o = 8, w, h, idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); assert.equal(d[8], 8); assert.equal(d[9], 6); assert.equal(d[12], 0); }
    if (type === 'IDAT') idat.push(d); if (type === 'IEND') break; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = new Uint8ClampedArray(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], r = y * (st + 1) + 1;
    for (let x = 0; x < st; x++) { const a = x >= 4 ? px[y * st + x - 4] : 0, up = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0, v = raw[r + x];
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      px[y * st + x] = (v + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255; } }
  return { w, h, px };
}
const drawLog = () => { const log = []; return { log, ctx: new Proxy({ log }, { get: (o, p) => p in o ? o[p] : p === 'drawImage' ? (...a) => log.push(a) : () => {}, set: () => true }) }; };
function load({ canvas = null, fetchFiles = false } = {}) {
  const document = { getElementById: () => ({ setAttribute() {}, style: {}, addEventListener() {}, getContext: () => null }), addEventListener() {}, documentElement: { lang: 'ja' },
    createElement: () => canvas ? canvas() : { getContext: () => null } };
  class Image { set src(v) { this._src = v; const p = png(v); Object.assign(this, { naturalWidth: p.w, naturalHeight: p.h, complete: true, _png: p }); setTimeout(() => this.onload?.()); } get src() { return this._src; } }
  const fetch = f => fetchFiles && fs.existsSync(path.join(root, f)) ? Promise.resolve({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) }) : Promise.reject(new Error('offline'));
  const sc = { document, Image, localStorage: { getItem: () => null, setItem() {} }, fetch, setTimeout, console, Promise, requestAnimationFrame() {} };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  return sc.Hop;
}
// a canvas whose 2d context copies a decoded PNG image (drawImage at 0,0) and reads it back
const pngCanvas = () => { const cv = { width: 1, height: 1 }; let img = null;
  cv.getContext = () => ({ drawImage(i) { img = i; }, getImageData: (x, y, w, h) => { assert.equal(w, img._png.w); assert.equal(h, img._png.h); return { data: img._png.px }; } }); return cv; };
const H0 = load();
assert.equal(typeof H0.Sprites.opaqueBoxes, 'function', 'sprite opaque-box crop is in place');
const S0 = H0.Sprites;
// ---- real sheets: every pixel with alpha > 0 is inside its cell box; the margin ring is fully transparent ----------
for (const [json, sheet, minGain] of [['assets/sprites/hero/hero_hit_hd_v1/hero_hit.json', 'assets/sprites/hero/hero_hit_hd_v1/hero_hit_sheet_288x288.png', 0.5],
  ['assets/sprites/truck/truck_comic_v1/truck_idle.json', 'assets/sprites/truck/truck_comic_v1/truck_idle_sheet_576x288.png', 0.2]]) {
  const data = JSON.parse(fs.readFileSync(path.join(root, json), 'utf8')); assert(S0.normalizeCell(data));
  const p = png(sheet), H = load({ canvas: pngCanvas }), image = { naturalWidth: p.w, naturalHeight: p.h, complete: true, _png: p };
  const boxes = H.Sprites.opaqueBoxes({ ready: true, data, image });
  assert(Array.isArray(boxes) && boxes.length === data.frames, sheet + ': one box per cell');
  const m = H.Sprites.OPAQUE_MARGIN; assert(m >= 2, 'margin covers the bilinear taps');
  for (let f = 0; f < data.frames; f++) {
    const b = boxes[f]; assert(b, sheet + ' cell ' + f + ' is cropped');
    assert(0 <= b.x0 && b.x0 < b.x1 && b.x1 <= data.frameWidth && 0 <= b.y0 && b.y0 < b.y1 && b.y1 <= data.frameHeight, 'box inside the cell');
    assert((b.x1 - b.x0) * (b.y1 - b.y0) <= (1 - minGain) * data.frameWidth * data.frameHeight, sheet + ': the crop removes empty cell area');
    for (let y = 0; y < p.h; y++) for (let x = 0; x < data.frameWidth; x++) {
      const a = p.px[(y * p.w + f * data.frameWidth + x) * 4 + 3];
      const inside = x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1, core = x >= b.x0 + m && x < b.x1 - m && y >= b.y0 + m && y < b.y1 - m;
      if (a) assert(inside, `${sheet} cell ${f}: pixel (${x},${y}) alpha ${a} outside its box`);
      if (inside && !core) { const edge = (b.x0 === 0 && x < m) || (b.y0 === 0 && y < m) || (b.x1 === data.frameWidth && x >= b.x1 - m) || (b.y1 === data.frameHeight && y >= b.y1 - m);
        if (!edge) assert.equal(a, 0, `${sheet} cell ${f}: margin pixel (${x},${y}) is transparent`); }
    }
  }
}
// ---- synthetic sheets: margin / clamp / empty cell / no-gain cell / no canvas / unreadable -------------------------
{
  const W = 100, Hh = 120, fw = 100, data = { frameWidth: fw, frameHeight: Hh, frames: 1 };
  const mk = paint => { const px = new Uint8ClampedArray(W * Hh * 4); paint((x, y) => { px[(y * W + x) * 4 + 3] = 1; }); return { naturalWidth: W, naturalHeight: Hh, complete: true, _png: { w: W, h: Hh, px } }; };
  const H = load({ canvas: pngCanvas }), S = H.Sprites, m = S.OPAQUE_MARGIN;
  assert.deepEqual({ ...S.opaqueBoxes({ ready: true, data, image: mk(s => { s(30, 40); s(50, 70); }) })[0] }, { x0: 30 - m, y0: 40 - m, x1: 51 + m, y1: 71 + m });
  assert.deepEqual({ ...S.opaqueBoxes({ ready: true, data, image: mk(s => { s(1, 2); s(99, 50); }) })[0] }, { x0: 0, y0: 0, x1: 100, y1: 51 + m }, 'clamped to the cell');
  assert.deepEqual({ ...S.opaqueBoxes({ ready: true, data, image: mk(() => {}) })[0] }, { x0: 0, y0: 0, x1: 0, y1: 0 }, 'empty cell -> empty box');
  assert.equal(S.opaqueBoxes({ ready: true, data, image: mk(s => { s(0, 0); s(99, 119); }) })[0], null, 'no gain -> no crop');
  assert.equal(S0.opaqueBoxes({ ready: true, data, image: mk(() => {}) }), null, 'no canvas -> null');
  const Ht = load({ canvas: () => ({ getContext: () => ({ drawImage() {}, getImageData() { throw new Error('tainted'); } }) }) });
  assert.equal(Ht.Sprites.opaqueBoxes({ ready: true, data, image: mk(() => {}) }), null, 'unreadable image -> null');
  assert.equal(S.opaqueBoxes({ ready: false }), null);
}
// ---- Sprites.draw: crop to the box keeps the mapping, combines with view, empty draws nothing -------------------
{
  const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/hero/hero_hit_hd_v1/hero_hit.json'), 'utf8')); assert(S0.normalizeCell(data));
  const image = { complete: true, naturalWidth: 2304 }, plain = { ready: true, data, image };
  const box = { x0: 59, y0: 104, x1: 245, y1: 268 }, cropped = { ready: true, data, image, opaque: Array(8).fill(box) };
  const one = (asset, view = null, time = 0.3) => { const { ctx, log } = drawLog(); assert.equal(S0.draw(ctx, asset, time, 40, 90, 3.3, view), true); return log; };
  const [full] = one(plain), [, sx, sy, sw, sh, dx, dy, dw, dh] = full, kx = dw / sw, ky = dh / sh;
  assert.equal(sw, data.frameWidth, 'no boxes -> whole cell as before');
  const map = (c, why) => { const [, csx, csy, csw, csh, cdx, cdy, cdw, cdh] = c;
    for (const [s, d, s0, d0, k] of [[csx, cdx, sx, dx, kx], [csy, cdy, sy, dy, ky], [csx + csw, cdx + cdw, sx, dx, kx], [csy + csh, cdy + cdh, sy, dy, ky]]) assert(Math.abs(d0 + (s - s0) * k - d) < 1e-6, why); return c; };
  const [c] = one(cropped), frame = S0.frameAt(data, 0.3);
  map(c, 'box crop keeps the source->screen mapping');
  assert(Math.abs(c[1] - (frame * data.frameWidth + box.x0)) < 1e-9 && Math.abs(c[2] - box.y0) < 1e-9 && Math.abs(c[3] - (box.x1 - box.x0)) < 1e-9 && Math.abs(c[4] - (box.y1 - box.y0)) < 1e-9, 'source = the box of this frame');
  const v = { x0: dx + 100, y0: dy + 10, x1: dx + 200, y1: dy + 600 }, [cv] = one(cropped, v); map(cv, 'box + view crop keeps the mapping');
  assert(Math.abs(cv[5] - v.x0) < 1e-9 && Math.abs(cv[6] - (dy + box.y0 * 3.3 / data.unit)) < 1e-9 && Math.abs(cv[5] + cv[7] - v.x1) < 1e-9 && Math.abs(cv[6] + cv[8] - (dy + box.y1 * 3.3 / data.unit)) < 1e-9, 'box ∩ view');
  assert.equal(one(cropped, { x0: dx, y0: dy, x1: dx + 50, y1: dy + 50 }).length, 0, 'view outside the box: nothing drawn');
  assert.equal(one({ ...cropped, opaque: Array(8).fill({ x0: 0, y0: 0, x1: 0, y1: 0 }) }).length, 0, 'empty cell: nothing drawn');
  const [n] = one({ ...cropped, opaque: Array(8).fill(null) }); assert.deepEqual(n, full, 'null box -> whole cell');
}
// ---- load: the truck and HIT sheets get their boxes --------------------------------------------------------------
(async () => {
  const H = load({ canvas: pngCanvas, fetchFiles: true }), S = H.Sprites;
  const [hit, truck] = await Promise.all([S.hitReady, S.truckReady]);
  assert(hit.ready && truck.ready, 'sheets load in the stub');
  assert(Array.isArray(hit.opaque) && hit.opaque.length === 8 && hit.opaque.every(Boolean), 'HIT sheet boxes at load');
  assert(Array.isArray(truck.opaque) && truck.opaque.length === 1 && truck.opaque[0], 'truck sheet box at load');
  assert.equal(S.heroHit, hit); assert.equal(S.truckIdle, truck);
  console.log('sprites-opaque-crop ok');
})().catch(e => { console.error(e); process.exit(1); });
