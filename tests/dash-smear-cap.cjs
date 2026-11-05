// DASH SPECIAL actor smear afterimages capped at k=1 (2026-11-05 auto cycle 62, display only).
// Before: grandBack drew up to 3 smear comboCasts (k=3..1) for every grand SPECIAL while the actor moved.
// Now: DASH (c62) and ANGLE (c65) keep only the closest smear (k=1); STOPPER / BRAKE / GUARD still use k=1..3.
// Physics, hitboxes, SPECIAL balance/triggers/ranks/JUST/merchant, input, and state are untouched.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const STATE = ['globalAlpha', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'filter', 'globalCompositeOperation', 'strokeStyle', 'fillStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'imageSmoothingEnabled'];
function recCtx(canvas) {
  const st = Object.fromEntries(STATE.map(k => [k, k === 'globalAlpha' ? 1 : k === 'filter' ? 'none' : k === 'globalCompositeOperation' ? 'source-over' : k.includes('Style') ? '#000' : k === 'lineWidth' ? 1 : k === 'lineCap' ? 'butt' : k === 'lineJoin' ? 'miter' : k === 'miterLimit' ? 10 : k === 'imageSmoothingEnabled' ? true : 0]));
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; const stack = [];
  const api = {
    canvas, save() { stack.push([{ ...st }, { ...m }]); }, restore() { const s = stack.pop(); if (s) { Object.assign(st, s[0]); m = s[1]; } },
    setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? { ...a } : { a, b, c, d, e, f }; }, getTransform() { return { ...m }; },
    translate(x, y) { m = { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e + m.a * x + m.c * y, f: m.f + m.b * x + m.d * y }; },
    scale(x, y) { m = { a: m.a * x, b: m.b * x, c: m.c * y, d: m.d * y, e: m.e, f: m.f }; },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); m = { a: m.a * c + m.c * s, b: m.b * c + m.d * s, c: m.a * -s + m.c * c, d: m.b * -s + m.d * c, e: m.e, f: m.f }; },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {}, fill() {}, stroke() {}, fillRect() {}, clearRect() {},
    drawImage() {}, clip() {}, setLineDash() {}, getLineDash: () => [], measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(api, { get: (o, p) => p in o ? o[p] : p in st ? st[p] : typeof p === 'string' && p.startsWith('create') ? () => ({ addColorStop() {} }) : () => {},
    set: (o, p, v) => { if (p in st) st[p] = v; else o[p] = v; return true; } });
}
(async () => {
  class Image { set src(v) { try { const b = fs.readFileSync(path.join(root, v)); this.naturalWidth = b.readUInt32BE(16); this.naturalHeight = b.readUInt32BE(20); } catch { this.naturalWidth = 64; this.naturalHeight = 64; } this.complete = true; setTimeout(() => this.onload && this.onload(), 0); } }
  const fetch = async url => { const f = path.join(root, url); if (!fs.existsSync(f)) return { ok: false, json: async () => ({}) }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }; };
  const document = { getElementById: () => ({}), addEventListener() {}, createElement: () => { const cv = { width: 64, height: 64 }; cv.getContext = () => recCtx(cv); return cv; } };
  const sc = { document, localStorage: { getItem: () => null, setItem() {} }, fetch, Image, setTimeout, console, Promise };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  const H = sc.Hop, S = H.Sprites, G = H.Graphics, c = H.CONFIG;
  await S.castReady;
  const sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY, start = G.comboSceneStart(false);
  const mk = (T, t) => ({ type: T, short: false, t, end: c.grandDurations[T] - start, after: null, afterTotal: 0, heroWX: 420, heroY: 240, device: { x: 140 }, skipped: false, grand: true, climax: c.grandClimax[T] });
  const src = fs.readFileSync(path.join(root, 'js', 'graphics.js'), 'utf8');
  assert.match(src, /kMax = \(st\.type === "DASH" \|\| st\.type === "ANGLE"\) \? 1 : 3/, 'DASH+ANGLE kMax=1');
  assert.match(src, /Cycle 62 \(display only\): DASH keeps the closest smear/, 'cycle 62 marker');
  assert.match(src, /Cycle 65 \(display only\): ANGLE also keeps k=1/, 'cycle 65 marker');
  // The smear loop looks up grandActor at st.t - 0.03*k for k=1..kMax. Count those exact offsets.
  function smearKs(type, baseT) {
    const ks = new Set();
    const ga = G.grandActor.bind(G);
    G.grandActor = function (st2, ...rest) {
      if (st2 && st2.type === type && st2.after === null) {
        const d = +(baseT - st2.t).toFixed(5);
        for (let k = 1; k <= 3; k++) if (Math.abs(d - 0.03 * k) < 1e-9) ks.add(k);
      }
      return ga(st2, ...rest);
    };
    try { G.grandBack(recCtx({ width: 390, height: 844 }), mk(type, baseT), sx, sy, ground); }
    finally { G.grandActor = ga; }
    return [...ks].sort((a, b) => a - b);
  }
  let dashSaw = false, dashMaxK = 0;
  for (let i = 0; i < 50; i++) {
    const t = 0.2 + i * 0.03;
    if (t >= c.grandDurations.DASH - start) break;
    const ks = smearKs('DASH', t);
    if (ks.length) { dashSaw = true; dashMaxK = Math.max(dashMaxK, ...ks); assert.deepEqual(ks, [1], 'DASH only k=1, got ' + ks + ' at t=' + t); }
  }
  assert.ok(dashSaw, 'expected DASH smear lookups');
  assert.equal(dashMaxK, 1, 'DASH max k');
  let stopMaxK = 0, stopSaw = false;
  for (let i = 0; i < 50; i++) {
    const t = 0.2 + i * 0.03;
    if (t >= c.grandDurations.STOPPER - start) break;
    const ks = smearKs('STOPPER', t);
    if (ks.length) { stopSaw = true; stopMaxK = Math.max(stopMaxK, ...ks); assert.ok(ks.every(k => k <= 3)); }
  }
  assert.ok(stopSaw, 'expected STOPPER smear lookups');
  assert.ok(stopMaxK >= 2, 'STOPPER still walks past k=1 (got max k=' + stopMaxK + ')');
  // ANGLE ribbon / trail also probe grandActor at 0.02 / 0.014 steps, so k-offset counting collides with smear.
  // Force historical placements far away so the smear hypot check always passes, then count smear-band comboCast alphas.
  function smearAlphasForced(type, baseT) {
    const a = [];
    const ga = G.grandActor.bind(G), cc = G.comboCast.bind(G);
    G.grandActor = function (st2, ...rest) {
      const A = ga(st2, ...rest);
      if (st2 && st2.type === type && st2.after === null && Math.abs(st2.t - baseT) > 1e-9) return { ...A, x: A.x + 80, dy: (A.dy || 0) + 80 };
      return A;
    };
    G.comboCast = function (ctx, id, p, sx, gnd, alpha) {
      if (id === type && alpha > 0.05 && alpha < 0.4) a.push(+alpha.toFixed(2));
      return cc(ctx, id, p, sx, gnd, alpha);
    };
    try { G.grandBack(recCtx({ width: 390, height: 844 }), mk(type, baseT), sx, sy, ground); }
    finally { G.grandActor = ga; G.comboCast = cc; }
    return a;
  }
  let angleSaw = false;
  for (let i = 0; i < 40; i++) {
    const t = 0.4 + i * 0.04;
    if (t >= c.grandDurations.ANGLE - start) break;
    const al = smearAlphasForced('ANGLE', t).filter(x => x === 0.34 || x === 0.2 || x === 0.1);
    if (al.length) {
      angleSaw = true;
      assert.deepEqual([...new Set(al)].sort((x, y) => y - x), [0.34], 'ANGLE smear alphas k=1 only, got ' + al + ' at t=' + t);
    }
  }
  assert.ok(angleSaw, 'expected ANGLE smear comboCasts under forced distance');
  let brakeFar = false, brakeSaw = false;
  for (let i = 0; i < 40; i++) {
    const t = 0.25 + i * 0.04;
    if (t >= c.grandDurations.BRAKE - start) break;
    const al = smearAlphasForced('BRAKE', t).filter(x => x === 0.34 || x === 0.2 || x === 0.1);
    if (al.length) { brakeSaw = true; if (al.includes(0.2) || al.includes(0.1)) brakeFar = true; }
  }
  assert.ok(brakeSaw, 'expected BRAKE smear comboCasts');
  assert.ok(brakeFar, 'BRAKE still draws far smears (k=2/3)');
  console.log(`dash-smear-cap OK: DASH+ANGLE smear k=1; STOPPER max k=${stopMaxK}; BRAKE keeps far smears`);
})().catch(e => { console.error(e); process.exit(1); });
