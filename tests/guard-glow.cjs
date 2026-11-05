// GUARD 聖護結界 magic-circle glow (2026-11-05 auto cycle 52, display only). The circle's shadowBlur 16 used to blur
// the full-resolution circle area on every one of its 16 strokes; at a phone viewport (4x CPU) that was ~10 ms/frame
// and half of the GUARD scene frames went over 33 ms. Now the same strokes are drawn at 1/3 scale into a cached canvas,
// blurred there (shadowBlur 16/3, landed through a shadow offset), and that glow is upscaled 3x under the crisp strokes,
// which are drawn at full resolution with no shadow. Checks (recording 2D contexts with a real affine transform):
//  1) no canvas -> the old path: every circle stroke on the main canvas carries shadowBlur 16;
//  2) with a canvas: the main-canvas circle strokes are the same geometry / width / colour / alpha in device space as the
//     old path but with no shadow; one glow drawImage before them, identity transform, whole-pixel destination 3x the
//     source, at the ring alpha; the small canvas holds the same strokes at 1/3 scale; the glow canvas gets one
//     shadowed copy (blur 16/3, the circle colour, offset onto the read region);
//  3) a filter or a non source-over blend on the main context -> old path; 4) the two canvases are created once.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mul = (m, n) => ({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d, e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f });
const STATE = ['globalAlpha', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'filter', 'globalCompositeOperation', 'strokeStyle', 'fillStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'imageSmoothingEnabled'];
function recCtx(canvas) {
  const st = { globalAlpha: 1, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0, filter: 'none', globalCompositeOperation: 'source-over', strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, imageSmoothingEnabled: true };
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, pathOps = [];
  const stack = [], log = [], pt = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f], k = () => Math.hypot(m.a, m.b);
  const api = {
    canvas, log,
    save() { stack.push([{ ...st }, m]); }, restore() { const s = stack.pop(); if (s) { Object.assign(st, s[0]); m = s[1]; } },
    setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? { ...a } : { a, b, c, d, e, f }; }, getTransform() { return { ...m }; }, resetTransform() { m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    transform(a, b, c, d, e, f) { m = mul(m, { a, b, c, d, e, f }); }, translate(x, y) { m = mul(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); },
    scale(x, y) { m = mul(m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); }, rotate(r) { const c = Math.cos(r), s = Math.sin(r); m = mul(m, { a: c, b: s, c: -s, d: c, e: 0, f: 0 }); },
    beginPath() { pathOps = []; }, moveTo(x, y) { pathOps.push(['M', ...pt(x, y)]); }, lineTo(x, y) { pathOps.push(['L', ...pt(x, y)]); },
    arc(x, y, r, a0, a1, ccw) { pathOps.push(['A', ...pt(x, y), r * k(), a0 + Math.atan2(m.b, m.a), a1 + Math.atan2(m.b, m.a), !!ccw]); },
    stroke() { log.push({ op: 'stroke', path: pathOps.slice(), width: st.lineWidth * k(), ...st }); },
    drawImage(img, ...a) { log.push({ op: 'drawImage', img, args: a, m: { ...m }, ...st }); },
    clearRect(...a) { log.push({ op: 'clearRect', args: a, m: { ...m } }); },
    getLineDash: () => [], setLineDash() {}, measureText: () => ({ width: 10 }),
  };
  return new Proxy(api, { get: (o, p) => p in o ? o[p] : p in st ? st[p] : typeof p === 'string' && p.startsWith('create') ? () => ({ addColorStop() {} }) : () => {},
    set: (o, p, v) => { if (p in st) st[p] = v; else o[p] = v; return true; } });
}
function load(withCanvas) {
  let created = 0;
  const document = { getElementById: () => ({}), addEventListener() {} };
  if (withCanvas) document.createElement = tag => { assert.equal(tag, 'canvas'); created++; const cv = { width: 300, height: 150 }; const ctx = recCtx(cv); cv.getContext = () => ctx; return cv; };
  const sc = { document, localStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error('offline')), setTimeout, console, Promise };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  return { H: sc.Hop, created: () => created };
}
const COLOR = '#5fe0ff';
// one GUARD scene frame on a main context with a phone-like device transform (backing 1280 / camera zoom); returns the
// circle strokes (colour COLOR, width >= 2 device px at lineWidth 2+) and the drawImage calls of that frame
function frame(H, t, opts = {}) {
  const G = H.Graphics, c = H.CONFIG, sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY;
  const end = c.grandDurations.GUARD - G.comboSceneStart(false);
  const st = { type: 'GUARD', short: false, t, end, after: null, afterTotal: 0, heroWX: 420, heroY: 240, source: { x: 140 }, skipped: false, grand: true, climax: c.grandClimax.GUARD };
  const main = recCtx({ width: 1280, height: 720 });
  main.setTransform(1.37, 0, 0, 1.37, -151.3, -88.7); // camera zoom + pan (non-integer on purpose)
  if (opts.filter) main.filter = opts.filter; if (opts.gco) main.globalCompositeOperation = opts.gco;
  G.grandBack(main, st, sx, sy, ground);
  const circle = main.log.filter(e => e.op === 'stroke' && e.strokeStyle === COLOR && e.path.length && e.path[0][0] !== 'E');
  return { main, circle, images: main.log.filter(e => e.op === 'drawImage') };
}
const T_CHANT = 1.2; // magic circle fully drawn (draw = 1 from t ~0.92), before the climax fade
// 1) fallback: old per-stroke shadow
const old = load(false), fo = frame(old.H, T_CHANT);
assert.ok(fo.circle.length >= 16, 'circle strokes ' + fo.circle.length);
const ringStrokes = fo.circle.filter(e => e.shadowBlur === 16);
assert.equal(ringStrokes.length, 16, 'old path: 2 rings + 2 triangles + 12 runes, each with shadowBlur 16');
assert.equal(old.H.Graphics.guardGlowLayer, undefined);
// 2) glow path
const neu = load(true), G = neu.H.Graphics, fn = frame(neu.H, T_CHANT);
const crisp = fn.circle.filter(e => e.width >= 2 * 1.37 - 1e-9 && e.globalAlpha === ringStrokes[0].globalAlpha);
assert.equal(fn.circle.filter(e => e.shadowBlur > 0).length, 0, 'no shadowed stroke on the main canvas');
assert.equal(crisp.length, 16, 'same 16 strokes');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + ' ' + a + ' vs ' + b);
crisp.forEach((e, i) => { const o = ringStrokes[i]; near(e.width, o.width, 'width'); assert.equal(e.strokeStyle, o.strokeStyle); near(e.globalAlpha, o.globalAlpha, 'alpha');
  assert.equal(e.path.length, o.path.length); e.path.forEach((p, j) => p.forEach((v, q) => typeof v === 'number' ? near(v, o.path[j][q], 'path') : assert.equal(v, o.path[j][q]))); });
const L = G.guardGlowLayer, glow = fn.images.filter(e => e.img === L.b), D = G.GUARD_GLOW_DOWN;
assert.equal(D, 3);
assert.ok(glow.length >= 3, 'ring-band glow drawImages (got ' + glow.length + ')');
glow.forEach(g => {
  assert.deepEqual(g.m, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 'device space');
  near(g.globalAlpha, ringStrokes[0].globalAlpha, 'glow alpha');
  assert.equal(g.shadowBlur, 0); assert.equal(g.globalCompositeOperation, 'source-over');
  assert.equal(g.imageSmoothingEnabled, true, 'bilinear upscale (no nearest banding)');
  const [sx0, sy0, sw1, sh1, dx1, dy1, dw, dh] = g.args;
  assert.ok(Number.isInteger(dx1) && Number.isInteger(dy1), 'whole-pixel destination');
  near(dw / sw1, D, 'scale x'); near(dh / sh1, D, 'scale y');
});
const nsClear = L.ca.log.find(e => e.op === 'clearRect');
assert.ok(nsClear); const sw = nsClear.args[2], sh = sw; // glow read region is ns x ns
const dx = Math.min(...glow.map(g => g.args[4])), dy = Math.min(...glow.map(g => g.args[5]));
const area = glow.reduce((s, g) => s + g.args[6] * g.args[7], 0);
assert.ok(area < sw * D * sh * D * 0.85, 'band covers less than the full square');
assert.ok(fn.main.log.indexOf(glow[0]) < fn.main.log.indexOf(crisp[0]), 'glow under the strokes');
// small canvas: same strokes at 1/3 scale, offset to the glow destination
const small = L.ca.log.filter(e => e.op === 'stroke');
assert.equal(small.length, 16); assert.ok(small.every(e => e.shadowBlur === 0 && e.globalAlpha === 1 && e.strokeStyle === COLOR));
small.forEach((e, i) => { near(e.width * D, crisp[i].width, 'small width'); e.path.forEach((p, j) => { const o = crisp[i].path[j];
  if (p[0] === 'A') { near(p[1] * D + dx, o[1], 'arc x'); near(p[2] * D + dy, o[2], 'arc y'); near(p[3] * D, o[3], 'arc r'); near(p[4], o[4], 'a0'); near(p[5], o[5], 'a1'); }
  else { near(p[1] * D + dx, o[1], 'x'); near(p[2] * D + dy, o[2], 'y'); } }); });
// all small strokes inside the read region with room for the blur (3 sigma = 3 * (16/3) / 2 = 8 px)
for (const e of small) for (const p of e.path) { const r = p[0] === 'A' ? p[3] + e.width : e.width; assert.ok(p[1] - r >= 8 && p[2] - r >= 8 && p[1] + r <= sw - 8 && p[2] + r <= sh - 8, 'blur room'); }
const copies = L.cb.log.filter(e => e.op === 'drawImage');
assert.equal(copies.length, 1); const [cp] = copies;
assert.equal(cp.img, L.a); near(cp.shadowBlur, 16 / D, 'small blur'); assert.equal(cp.shadowColor, COLOR); assert.equal(cp.shadowOffsetY, 0);
assert.equal(cp.args[4] + cp.shadowOffsetX, 0, 'shadow lands on the read region'); assert.ok(cp.args[4] >= sw, 'source copy outside the read region');
assert.ok(L.b.width >= cp.args[4] + sw, 'source copy on-canvas');
// 2b) cycle 59: the blurred layer is rebuilt every GUARD_GLOW_EVERY (3) frames; in between it is reused (no new blur)
// but still blitted as the ring band at the same 3x scale under the crisp strokes
assert.equal(G.GUARD_GLOW_EVERY, 3);
const nCopies = () => L.cb.log.filter(e => e.op === 'drawImage').length;
for (let j = 1; j <= 2; j++) { const fr = frame(neu.H, T_CHANT + j / 60), gl = fr.images.filter(e => e.img === L.b);
  assert.equal(nCopies(), 1, 'reused frame ' + j); assert.ok(gl.length >= 3, 'reused glow still blitted');
  gl.forEach(g => { near(g.args[6] / g.args[2], D, 'reuse scale x'); near(g.args[7] / g.args[3], D, 'reuse scale y'); });
  assert.equal(fr.circle.filter(e => e.shadowBlur > 0).length, 0); }
frame(neu.H, T_CHANT + 3 / 60); assert.equal(nCopies(), 2, 'rebuilt on the 3rd frame');
// 3) filter / blend -> old path
for (const o of [{ filter: 'brightness(0)' }, { gco: 'lighter' }]) { const f = frame(neu.H, T_CHANT, o);
  assert.equal(f.circle.filter(e => e.shadowBlur === 16).length, 16, JSON.stringify(o)); assert.equal(f.images.filter(e => e.img === L.b).length, 0); }
// whole scene draws (back layer) with the glow and stays in cached canvases
for (let i = 0; i <= 90; i++) frame(neu.H, i / 30);
assert.equal(neu.created(), 2, 'two canvases, created once');
console.log('guardGlow PASS: 16 crisp strokes unchanged in device space without shadow, 1/3-scale glow (blur 16/3) upscaled as a ring band under them; fallback = old shadowed strokes.');
