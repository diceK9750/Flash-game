// SPECIAL cut-in band from a cached layer (2026-11-05 auto cycle 56, display only). The band (plate, duotone wash,
// face close-up, soft wash, rim) used to be drawn live inside a rotated anti-aliased clip on every frame of every
// SPECIAL's first second (~12 ms/frame at 4x CPU on a phone viewport). Once the wipe and the portrait pop are over
// (the full-alpha hold, the reduced still) it is drawn once into a device-space canvas and blitted 1:1 at a whole-pixel offset. Checks (recording
// 2D contexts with a real affine transform, phone-like DPR 3 transform):
//  1) settled frame: no clip and no band fill on the main canvas, one drawImage of the layer at identity transform,
//     whole-pixel destination, at the band alpha; the layer holds the same band ops as the live draw, in device space,
//     shifted by one constant offset of at most half a device pixel;
//  2) later hold frames reuse the layer (built once); wipe / pop and exit-fade frames draw live (the exit's
//     per-element alphas stack - plate + wash + face - which a group alpha would wash out);
//  3) no canvas, a filter or a non source-over blend -> the live draw; 4) dim, flash, name and tags stay live.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mul = (m, n) => ({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d, e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f });
const STATE = ['globalAlpha', 'filter', 'globalCompositeOperation', 'strokeStyle', 'fillStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'font', 'textAlign', 'textBaseline'];
function recCtx(canvas) {
  const st = { globalAlpha: 1, filter: 'none', globalCompositeOperation: 'source-over', strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic' };
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, pathOps = [];
  const stack = [], log = [], pt = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  const rec = (op, extra = {}) => log.push({ op, path: pathOps.slice(), m: { ...m }, ...st, ...extra });
  const api = {
    canvas, log,
    save() { stack.push([{ ...st }, m]); }, restore() { const s = stack.pop(); if (s) { Object.assign(st, s[0]); m = s[1]; } },
    setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? { ...a } : { a, b, c, d, e, f }; }, getTransform() { return { ...m }; }, resetTransform() { m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    transform(a, b, c, d, e, f) { m = mul(m, { a, b, c, d, e, f }); }, translate(x, y) { m = mul(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); },
    scale(x, y) { m = mul(m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); }, rotate(r) { const c = Math.cos(r), s = Math.sin(r); m = mul(m, { a: c, b: s, c: -s, d: c, e: 0, f: 0 }); },
    beginPath() { pathOps = []; }, moveTo(x, y) { pathOps.push(['M', ...pt(x, y)]); }, lineTo(x, y) { pathOps.push(['L', ...pt(x, y)]); },
    rect(x, y, w, h) { pathOps.push(['R', ...pt(x, y), ...pt(x + w, y), ...pt(x + w, y + h), ...pt(x, y + h)]); }, closePath() { pathOps.push(['Z']); },
    fill() { rec('fill'); }, stroke() { rec('stroke'); }, clip() { rec('clip'); },
    fillRect(x, y, w, h) { pathOps = [['R', ...pt(x, y), ...pt(x + w, y), ...pt(x + w, y + h), ...pt(x, y + h)]]; rec('fillRect'); pathOps = []; },
    fillText(t, x, y) { rec('fillText', { text: t, at: pt(x, y) }); }, strokeText(t, x, y) { rec('strokeText', { text: t, at: pt(x, y) }); },
    drawImage(img, ...a) { rec('drawImage', { img, args: a }); },
    clearRect(...a) { log.push({ op: 'clearRect', args: a, m: { ...m } }); },
    getLineDash: () => [], setLineDash() {}, measureText: () => ({ width: 10 }),
    createLinearGradient: (...a) => ({ kind: 'lin', a, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }),
    createRadialGradient: (...a) => ({ kind: 'rad', a, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }),
  };
  return new Proxy(api, { get: (o, p) => p in o ? o[p] : p in st ? st[p] : () => {},
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
const DPR = 3;
// one cut-in frame at `age` s on a main context with a phone-like device transform (non-integer offset on purpose)
function frame(H, age, opts = {}) {
  const c = H.CONFIG, G = H.Graphics, castId = opts.castId || 'GUARD';
  const g = { state: 'FLYING', accumulator: 0, combo: null, specialCutin: { type: castId, castId, name: c.specials[castId].name, castName: H.CAST?.[castId]?.name || castId, merchantType: null, strong: !!opts.strong, total: c.specialCutinDuration, remaining: c.specialCutinDuration - age } };
  const main = recCtx({ width: 390 * DPR, height: 844 * DPR });
  main.setTransform(DPR, 0, 0, DPR, 0.37, 0.61);
  if (opts.filter) main.filter = opts.filter; if (opts.gco) main.globalCompositeOperation = opts.gco;
  G.specialCutin(main, g, { reducedMotion: !!opts.reduced });
  return { main, style: G.specialCutinStyle(age, !!opts.reduced, !!opts.strong) };
}
const c0 = load(false).H.CONFIG, inT = c0.specialCutinImpact + c0.specialCutinWipe, holdEnd = inT + c0.specialCutinHold;
const HOLD = inT + 0.1, EXIT = holdEnd + 0.1, WIPE = c0.specialCutinImpact + 0.05;
const DIM = ['rgba(10,10,18,0.30)', 'rgba(36,28,10,0.28)'], isDim = e => e.op === 'fillRect' && DIM.includes(e.fillStyle);
const bandOps = log => log.filter(e => e.op === 'fill' || e.op === 'stroke' || e.op === 'clip' || (e.op === 'fillRect' && !isDim(e)));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, msg + ' ' + a + ' vs ' + b);
// live reference (no canvas): band ops with a rotated clip on the main canvas
const live = load(false), lh = frame(live.H, HOLD);
const liveBand = bandOps(lh.main.log);
assert.ok(liveBand.some(e => e.op === 'clip'), 'live band clips'); assert.ok(liveBand.filter(e => e.op !== 'clip').length >= 3, 'live band fills');
assert.equal(live.H.Graphics.cutinBandLayer, undefined);
// 1) settled hold frame with a canvas
const neu = load(true), G = neu.H.Graphics, fh = frame(neu.H, HOLD), L = G.cutinBandLayer;
assert.ok(L && L.cv, 'band cut-in layer is in place');
assert.equal(fh.main.log.filter(e => e.op === 'clip').length, 0, 'no clip on the main canvas in a settled frame');
assert.equal(bandOps(fh.main.log).length, 0, 'no band fill / stroke on the main canvas');
const blits = fh.main.log.filter(e => e.op === 'drawImage' && e.img === L.cv);
assert.equal(blits.length, 1, 'one layer blit');
const [b] = blits; assert.deepEqual(b.m, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 'device space'); assert.equal(b.args.length, 2, '1:1 blit');
assert.ok(b.args.every(Number.isInteger), 'whole-pixel destination'); near(b.globalAlpha, fh.style.alpha, 1e-12, 'blit alpha'); assert.equal(b.globalCompositeOperation, 'source-over');
const layerBand = bandOps(L.cx.log);
assert.equal(layerBand.length, liveBand.length, 'same band ops in the layer');
const [dx, dy] = b.args; let off = null;
layerBand.forEach((e, i) => { const o = liveBand[i]; assert.equal(e.op, o.op); if (e.op !== 'clip') near(e.globalAlpha, o.globalAlpha, 1e-12, 'layer alpha (live alpha is 1 in the hold)');
  if (e.op === 'fill' || e.op === 'fillRect') assert.equal(String(e.fillStyle?.kind ? JSON.stringify(e.fillStyle.stops) : e.fillStyle), String(o.fillStyle?.kind ? JSON.stringify(o.fillStyle.stops) : o.fillStyle));
  if (e.op === 'stroke') { assert.equal(e.strokeStyle, o.strokeStyle); near(e.lineWidth, o.lineWidth, 1e-12, 'width'); }
  near(e.m.a, o.m.a, 1e-9, 'm.a'); near(e.m.b, o.m.b, 1e-9, 'm.b'); assert.equal(e.path.length, o.path.length);
  e.path.forEach((p, j) => { for (let q = 1; q < p.length; q += 2) { const ox = p[q] + dx - o.path[j][q], oy = p[q + 1] + dy - o.path[j][q + 1];
    if (!off) off = [ox, oy]; near(ox, off[0], 1e-6, 'constant x offset'); near(oy, off[1], 1e-6, 'constant y offset'); } }); });
assert.ok(off && Math.abs(off[0]) <= 0.5 + 1e-9 && Math.abs(off[1]) <= 0.5 + 1e-9, 'within half a device px ' + off);
// layer contents stay inside the layer
for (const e of layerBand) for (const p of e.path) for (let q = 1; q < p.length; q += 2) assert.ok(p[q] >= 0 && p[q + 1] >= 0 && p[q] <= L.cv.width && p[q + 1] <= L.cv.height, 'inside layer ' + p);
// 2) reuse: later hold frames blit the same layer (no rebuild); the exit fade draws live with stacked alphas
const built = L.cx.log.length;
const fe = frame(neu.H, EXIT); assert.ok(fe.style.alpha < 1 && fe.style.slide > 0);
assert.equal(fe.main.log.filter(e => e.img === L.cv).length, 0, 'exit fade draws live');
const exitBand = bandOps(fe.main.log); assert.ok(exitBand.some(e => e.op === 'clip'), 'exit band clips live');
near(exitBand.find(e => e.op === 'fill').globalAlpha, fe.style.alpha, 1e-12, 'exit plate alpha');
frame(neu.H, HOLD + 0.2); assert.equal(L.cx.log.length, built, 'layer built once');
// wipe / pop frame: live
const fw = frame(neu.H, WIPE); assert.ok(fw.main.log.some(e => e.op === 'clip'), 'wipe frame draws live'); assert.equal(fw.main.log.filter(e => e.img === L.cv).length, 0);
// strong / another cast -> rebuilt for the new key
const fs2 = frame(neu.H, HOLD, { castId: 'STOPPER', strong: true }); assert.equal(fs2.main.log.filter(e => e.img === L.cv).length, 1); assert.ok(L.cx.log.length > built, 'rebuilt for a new cast');
// reduced motion still: settled from the start
const fr = frame(neu.H, 0.01, { reduced: true }); assert.equal(fr.main.log.filter(e => e.op === 'clip').length, 0, 'reduced still blits');
// 3) filter / blend -> live
for (const o of [{ filter: 'brightness(0)' }, { gco: 'lighter' }]) { const f = frame(neu.H, HOLD, o); assert.ok(f.main.log.some(e => e.op === 'clip'), JSON.stringify(o)); assert.equal(f.main.log.filter(e => e.img === L.cv).length, 0); }
// 4) dim + name + tags stay on the main canvas
const texts = fh.main.log.filter(e => e.op === 'fillText').map(e => e.text), ltexts = lh.main.log.filter(e => e.op === 'fillText').map(e => e.text);
assert.deepEqual(texts, ltexts, 'same texts');
assert.equal(fh.main.log.filter(e => e.op === 'fillRect').length, 1); assert.equal(fh.main.log.filter(isDim).length, lh.main.log.filter(isDim).length, 'dim stays live');
assert.equal(neu.created(), 1, 'one layer canvas');
console.log('cutinBandCache PASS: settled SPECIAL cut-in band = one whole-pixel 1:1 blit of a layer holding the same band ops (offset <= 0.5 px); wipe / pop / exit frames, no canvas, filter or blend -> live.');
