// GUARD 聖護結界 barrier dome (2026-11-05 auto cycle 60, display only). After its 0.3 s growth the dome's radial fill,
// circle clip and ~60 hex-lattice strokes were re-rasterized every frame (~5 ms/frame at 4x CPU). Now, once R >= 100,
// they come from one cached device-pixel layer blitted row by row; the white rim stays a live stroke. Checks:
//  1) no canvas -> old path (lattice stroke on the main context); 2) with a canvas, after growth: no lattice stroke on
//     the main context, the layer holds one lattice stroke, the main context gets identity-transform drawImage rows at the
//     dome alpha whose union covers the dome disc's bounding box, plus the white rim stroke; 3) layer built once while the
//     zoom is steady, rebuilt when the zoom changes > 4%; 4) during growth (R < 100) -> old path; 5) filter -> old path.
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
const LAT = 'rgba(220,250,255,0.85)';
function frame(H, b, opts = {}) {
  const G = H.Graphics, c = H.CONFIG, sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY;
  const end = c.grandDurations.GUARD - G.comboSceneStart(false), climax = c.grandClimax.GUARD;
  const st = { type: 'GUARD', short: false, t: climax + b, end, after: null, afterTotal: 0, heroWX: 420, heroY: 240, source: { x: 140 }, skipped: false, grand: true, climax };
  const main = recCtx({ width: 1280, height: 720 }), z = opts.z || 1.37;
  main.setTransform(z, 0, 0, z, -151.3, -88.7); if (opts.filter) main.filter = opts.filter;
  G.grandFront(main, st, sx, sy, ground);
  return { main, lat: main.log.filter(e => e.op === 'stroke' && e.strokeStyle === LAT), rows: main.log.filter(e => e.op === 'drawImage' && e.img === G.guardDomeLayer?.a), rim: main.log.filter(e => e.op === 'stroke' && e.strokeStyle === '#ffffff' && e.width >= 4) };
}
{ const { H } = load(false); const f = frame(H, 0.6); assert.equal(f.lat.length, 1, 'no canvas: live lattice'); assert.equal(f.lat[0].path.filter(p => p[0] === 'M').length > 30, true); }
{ const { H, created } = load(true); const G = H.Graphics;
  const f = frame(H, 0.6); assert.equal(f.lat.length, 0, 'cached: no live lattice stroke'); assert.ok(f.rows.length > 5, 'row blits');
  for (const r of f.rows) { assert.deepEqual(r.m, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }); assert.ok(r.globalAlpha > 0.3 && r.globalAlpha < 0.85); }
  assert.equal(f.rim.length >= 1, true, 'live rim');
  const L = G.guardDomeLayer, ll = L.ca.log.filter(e => e.op === 'stroke' && e.strokeStyle === LAT); assert.equal(ll.length, 1, 'layer lattice'); assert.equal(L.builds, 1); assert.equal(created(), 1);
  const ys = f.rows.map(r => [r.args[5], r.args[5] + r.args[7]]); for (let i = 1; i < ys.length; i++) assert.ok(Math.abs(ys[i][0] - ys[i - 1][1]) < 1e-6, 'rows contiguous');
  frame(H, 0.7); frame(H, 0.8); assert.equal(L.builds, 1, 'steady zoom: reused');
  frame(H, 0.9, { z: 1.5 }); assert.equal(L.builds, 2, 'zoom change: rebuilt');
  const g = frame(H, 0.15); assert.equal(g.lat.length, 1, 'growing dome: live'); assert.equal(g.rows.length, 0);
  const h = frame(H, 0.6, { filter: 'blur(2px)' }); assert.equal(h.lat.length, 1, 'filter: live'); }
console.log('guard-dome: PASS');
