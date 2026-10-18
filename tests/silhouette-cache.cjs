// Sakuga silhouette cache (2026-10-18 auto cycle 51, display only). Before, the impact flash (sakugaImpact) and the
// grand-scene pose smear (grandCastBlend) drew sprites with ctx.filter = brightness(0) [invert(1)]; under 4x CPU
// throttling at a phone viewport those frames cost 51-126 ms (p50) each. Sprites.draw now draws a cached black /
// white silhouette of the cell with the filter off (20-53 ms). In-browser, 61 such frames were pixel-identical to the
// filtered draw (cycle folder visual_check.txt). Checks: only the two silhouette filters are mapped; the cached cell
// is used (built once per asset / frame / colour, 1:1 cell copy then source-in fill) with the same destination rect
// and the filter off during the draw and restored after; other filters and no-canvas environments use the old
// filtered draw; per pixel the silhouette equals the filter maths (rgb 0 or 255, alpha kept) on a real HD fixture cell.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function readPng(file) { // 8-bit RGBA, non-interlaced
  const buf = fs.readFileSync(path.join(root, file)); let pos = 8, idat = [], w, h;
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); assert.equal(body[9], 6); } if (type === 'IDAT') idat.push(body); pos += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), stride = w * 4;
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) { const a = i >= 4 ? px[y * stride + i - 4] : 0, b = y ? px[(y - 1) * stride + i] : 0, c = i >= 4 && y ? px[(y - 1) * stride + i - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); px[y * stride + i] = (src[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255; } }
  return { w, h, px };
}
// Pixel canvas good enough for the silhouette build: 1:1 drawImage copy and a source-in solid fill.
let created = 0;
const pixelCanvas = () => { created++; const cv = { width: 0, height: 0 }; let px = null;
  const ctx = { globalCompositeOperation: 'source-over', fillStyle: '#000',
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { assert.equal(sw, dw); assert.equal(sh, dh); px = Buffer.alloc(cv.width * cv.height * 4);
      for (let y = 0; y < sh; y++) img.px.copy(px, ((dy + y) * cv.width + dx) * 4, ((sy + y) * img.w + sx) * 4, ((sy + y) * img.w + sx + sw) * 4); },
    fillRect() { assert.equal(this.globalCompositeOperation, 'source-in'); const v = parseInt(this.fillStyle.slice(1), 16), rgb = [v >> 16, (v >> 8) & 255, v & 255];
      for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]; px[i] = a ? rgb[0] : 0; px[i + 1] = a ? rgb[1] : 0; px[i + 2] = a ? rgb[2] : 0; } } };
  cv.getContext = () => ctx; cv.pixels = () => px; return cv; };
function load(withCanvas) {
  const scope = { console, fetch: () => Promise.reject(new Error('offline')), Promise };
  if (withCanvas) scope.document = { createElement: t => (assert.equal(t, 'canvas'), pixelCanvas()) };
  scope.window = scope; vm.createContext(scope); scope.Hop = {};
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'sprites.js'), 'utf8'), scope, { filename: 'sprites.js' });
  return scope.Hop.Sprites;
}
// recording main context with save / restore of filter (like a real 2D context)
const mainCtx = () => { const stack = [], calls = []; return { calls, filter: 'none', imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
  save() { stack.push(this.filter); }, restore() { this.filter = stack.pop(); }, drawImage(...a) { calls.push({ args: a, filter: this.filter }); } }; };
const sheet = readPng('tests/fixtures/hd/hd_fixture_288.png');
const img = { complete: true, naturalWidth: sheet.w, naturalHeight: sheet.h, w: sheet.w, h: sheet.h, px: sheet.px };
const asset = () => ({ ready: true, image: img, data: { frameWidth: sheet.w, frameHeight: sheet.h, pivot: { x: sheet.w / 2, y: sheet.h * 88 / 96 }, unit: sheet.h / 96, smooth: true, fps: 1, frames: 1, loop: false } });
const S = load(true);
assert.deepEqual(Object.keys(S.SILHOUETTE_FILTERS), ['brightness(0)', 'brightness(0) invert(1)']);
for (const f of ['none', 'blur(2px)', 'brightness(0.5)', 'invert(1)', '', undefined]) assert.equal(S.silhouetteTint({ filter: f }), null, String(f));
// plain draw (reference rect)
const A = asset(), plain = mainCtx(); assert.equal(S.draw(plain, A, 0, 100, 400, 1.25), true);
const ref = plain.calls[0].args; assert.equal(ref[0], img);
for (const [filter, tint, rgb] of [['brightness(0)', '#000000', 0], ['brightness(0) invert(1)', '#ffffff', 255]]) {
  const before = created;
  for (let k = 0; k < 3; k++) { const ctx = mainCtx(); ctx.filter = filter; assert.equal(S.draw(ctx, A, 0, 100, 400, 1.25), true);
    const call = ctx.calls[0]; assert.notEqual(call.args[0], img, 'cached cell, not the sheet'); assert.equal(call.filter, 'none', 'filter off during the draw');
    assert.deepEqual(call.args.slice(1), [0, 0, sheet.w, sheet.h, ...ref.slice(5)], 'same cell size and destination rect');
    assert.equal(ctx.filter, filter, 'filter restored'); }
  assert.equal(created - before, 1, 'built once per asset / frame / colour');
  const px = A.silhouettes.get(0 + tint).pixels(); let opaque = 0;
  for (let i = 0; i < px.length; i += 4) { const a = sheet.px[i + 3]; assert.equal(px[i + 3], a); if (a) { opaque++; assert.equal(px[i], rgb); assert.equal(px[i + 1], rgb); assert.equal(px[i + 2], rgb); } }
  assert(opaque > 1000, 'fixture has a figure');
}
// another filter -> old filtered draw of the sheet
{ const ctx = mainCtx(); ctx.filter = 'blur(2px)'; S.draw(ctx, asset(), 0, 100, 400, 1.25); assert.equal(ctx.calls[0].args[0], img); assert.equal(ctx.calls[0].filter, 'blur(2px)'); }
// no canvas (headless tests, old browsers) -> filtered draw as before
{ const N = load(false), ctx = mainCtx(); ctx.filter = 'brightness(0)'; assert.equal(N.draw(ctx, asset(), 0, 100, 400, 1.25), true);
  assert.equal(ctx.calls[0].args[0], img); assert.equal(ctx.calls[0].filter, 'brightness(0)'); assert.deepEqual(ctx.calls[0].args.slice(5), ref.slice(5)); }
console.log(JSON.stringify({ silhouetteCache: 'PASS' }));
