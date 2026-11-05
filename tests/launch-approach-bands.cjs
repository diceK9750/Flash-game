// Launch cut-in approach bands (2026-11-05 auto cycle 54, display only). The approach beat drew both tilted bands'
// content (speed lines, the 9-11x truck still + headlight glow over the whole band, focus wedges, the 10-11x hero
// still) through a rotated anti-aliased clip, so every pixel paid for the clip mask (~p50 31 ms at 4x CPU). Now each
// layer crops itself to the band rect (stills: source + destination rect, wedges: polygon cut, speed lines: x cut,
// glow: its own box) and is drawn with the clip lifted; only the "!?" label stays clipped. Checks: nothing unclipped
// leaves its band, the crop keeps the still's source->screen mapping, the glow box covers the whole glow, the
// Canvas fallbacks (no sheets) stay clipped, the reduced "still" band and other beats are unchanged in kind.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mul = (m, n) => ({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d, e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f });
const ap = (m, x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
const PAINT = ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'clearRect'];
function recCtx(canvas) {
  const st = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', font: '10px sans-serif', lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', lang: 'ja', imageSmoothingEnabled: true, imageSmoothingQuality: 'low' };
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, clips = 0, pts = []; const stack = [], log = [], tag = {};
  const api = {
    canvas, log, tag,
    save() { stack.push([{ ...st }, m, clips]); }, restore() { const s = stack.pop(); if (s) { Object.assign(st, s[0]); m = s[1]; clips = s[2]; } },
    setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? { ...a } : { a, b, c, d, e, f }; }, getTransform() { return { ...m }; },
    translate(x, y) { m = mul(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); }, scale(x, y) { m = mul(m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); m = mul(m, { a: c, b: s, c: -s, d: c, e: 0, f: 0 }); },
    beginPath() { pts = []; }, moveTo(x, y) { pts.push(ap(m, x, y)); }, lineTo(x, y) { pts.push(ap(m, x, y)); }, closePath() {},
    rect(x, y, w, h) { pts.push(ap(m, x, y), ap(m, x + w, y), ap(m, x + w, y + h), ap(m, x, y + h)); },
    arc(x, y, r) { pts.push(ap(m, x - r, y - r), ap(m, x + r, y + r)); }, ellipse(x, y, rx, ry) { pts.push(ap(m, x - rx, y - ry), ap(m, x + rx, y + ry)); },
    clip() { clips++; },
    createRadialGradient: (...a) => ({ radial: a, addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
    measureText: t => ({ width: 10 * String(t).length, actualBoundingBoxLeft: 50, actualBoundingBoxRight: 50, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 40 }),
    getLineDash: () => [], setLineDash() {},
  };
  for (const op of PAINT) api[op] = (...args) => log.push({ op, args, m: { ...m }, clips, pts: pts.slice(), band: tag.band, text: tag.text, who: tag.who, ...st });
  return new Proxy(api, { get: (o, p) => p in o ? o[p] : p in st ? st[p] : () => {}, set: (o, p, v) => { if (p in st) st[p] = v; else o[p] = v; return true; } });
}
function load({ sheets = true } = {}) {
  const element = () => ({ setAttribute() {}, textContent: '', hidden: false, style: {}, addEventListener() {}, getContext: () => recCtx({}) });
  const document = { getElementById: element, addEventListener() {}, documentElement: { lang: 'ja' }, createElement: () => { const cv = { width: 1, height: 1 }; const x = recCtx(cv); cv.getContext = () => x; return cv; } };
  const sc = { document, localStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error('offline')), setTimeout, console, Promise, requestAnimationFrame() {} };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  const H = sc.Hop, S = H.Sprites;
  if (sheets) {
    const sheet = (file, w) => { const data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); assert(S.normalizeCell(data)); return { ready: true, data, image: { complete: true, naturalWidth: w, name: file } }; };
    S.truckIdle = sheet('assets/sprites/truck/truck_comic_v1/truck_idle.json', 576);
    S.heroHit = sheet('assets/sprites/hero/hero_hit_hd_v1/hero_hit.json', 2304);
  }
  return H;
}
const H0 = load();
assert.equal(typeof H0.Graphics.lcClipPoly, 'function', 'approach band crop is in place');
// ---- Sprites.draw view crop keeps the mapping --------------------------------------------------------------------
{
  const S = H0.Sprites, a = S.truckIdle;
  const one = view => { const c = recCtx({}); assert.equal(S.draw(c, a, 0, 40, 90, 3.7, view), true); return c.log.filter(o => o.op === 'drawImage'); };
  const [full] = one(null), [sx, sy, sw, sh, dx, dy, dw, dh] = full.args.slice(1), kx = dw / sw, ky = dh / sh;
  for (const v of [{ x0: -50, y0: -20, x1: 120, y1: 60 }, { x0: dx + 5, y0: dy + 7, x1: dx + dw - 3, y1: dy + dh - 11 }, { x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 }]) {
    const [c] = one(v), [csx, csy, csw, csh, cdx, cdy, cdw, cdh] = c.args.slice(1);
    assert(cdx >= v.x0 - 1e-9 && cdy >= v.y0 - 1e-9 && cdx + cdw <= v.x1 + 1e-9 && cdy + cdh <= v.y1 + 1e-9, 'crop inside the view');
    assert(cdx >= dx - 1e-9 && cdy >= dy - 1e-9 && cdx + cdw <= dx + dw + 1e-9 && cdy + cdh <= dy + dh + 1e-9, 'crop inside the cell');
    for (const [s, d, s0, d0, k] of [[csx, cdx, sx, dx, kx], [csy, cdy, sy, dy, ky], [csx + csw, cdx + cdw, sx, dx, kx], [csy + csh, cdy + cdh, sy, dy, ky]]) {
      assert(Math.abs(d0 + (s - s0) * k - d) < 1e-6, 'same source->screen mapping as the uncropped draw');
    }
    assert.equal(c.args[0], full.args[0]);
  }
  assert.equal(one({ x0: 1e4, y0: 0, x1: 2e4, y1: 10 }).length, 0, 'empty view draws nothing (and reports drawn)');
}
// ---- convex polygon cut -------------------------------------------------------------------------------------------
{
  const G = H0.Graphics, r = { x0: 0, y0: 0, x1: 10, y1: 10 };
  assert.equal(JSON.stringify(G.lcClipPoly([[1, 1], [5, 1], [3, 4]], r)), '[[1,1],[5,1],[3,4]]', 'inside: unchanged');
  assert.equal(G.lcClipPoly([[20, 20], [30, 20], [25, 30]], r).length, 0, 'outside: empty');
  const p = G.lcClipPoly([[-10, 5], [20, 4], [20, 6]], r);
  assert(p.length >= 3 && p.every(([x, y]) => x >= -1e-9 && x <= 10 + 1e-9 && y >= -1e-9 && y <= 10 + 1e-9), 'cut to the rect');
}
// ---- the approach beat ----------------------------------------------------------------------------------------------
function frames(H, beatWanted) {
  const G = H.Graphics, c = H.CONFIG, out = [];
  const T = G.launchCutinTimes({ mode: 'full', total: c.launchCutinDuration });
  for (const name of ['lcBand', 'lcText', 'lcTruck', 'lcHero']) {
    const f = G[name];
    G[name] = function (ctx, ...a) {
      const tag = ctx.tag || {}, prev = { band: tag.band, text: tag.text, who: tag.who };
      if (name === 'lcBand') tag.band = { cy: a[0], h: a[1], tilt: a[2], m: ctx.getTransform() }; else if (name === 'lcText') tag.text = a[0]; else tag.who = name;
      try { return f.call(this, ctx, ...a); } finally { Object.assign(tag, prev); }
    };
  }
  for (let t = 0; t < T.total; t += 1 / 60) {
    const cut = { mode: 'full', total: T.total, elapsed: t, intensity: 1, tier: 'MAX', power: 1, just: true };
    const st = G.launchCutinStyle(cut, false); if (st.beat !== beatWanted) continue;
    const ctx = recCtx({ width: 1170, height: 2532 }); ctx.setTransform(3, 0, 0, 3, 0, 0);
    G.launchCutin(ctx, { launchCutin: cut }, { reducedMotion: false });
    out.push({ t, st, T, log: ctx.log });
  }
  return { out, W: c.width };
}
const local = (b, W, [x, y]) => { // device point -> band-local
  const m = mul(b.m, mul({ a: 1, b: 0, c: 0, d: 1, e: W / 2, f: b.cy }, { a: Math.cos(b.tilt), b: Math.sin(b.tilt), c: -Math.sin(b.tilt), d: Math.cos(b.tilt), e: 0, f: 0 }));
  const det = m.a * m.d - m.b * m.c, X = x - m.e, Y = y - m.f; return [(m.d * X - m.c * Y) / det, (-m.b * X + m.a * Y) / det];
};
{
  const { out, W } = frames(load(), 'approach'), bw = W * 1.3; let images = 0, wedges = 0, lines = 0, glows = 0;
  assert(out.length > 20);
  for (const f of out) {
    for (const o of f.log.filter(o => o.band && o.op !== 'strokeRect')) {
      const inBand = (p, ty = 0) => { const [x, y] = local(o.band, W, p); return x >= -bw / 2 - 1e-6 && x <= bw / 2 + 1e-6 && Math.abs(y) <= o.band.h / 2 + ty + 1e-6; };
      if (o.text) { assert(o.clips > 0, `"${o.text}" stays clipped to its band`); continue; }
      assert.equal(o.clips, 0, `${o.op} ${o.who || ''} in the band is drawn with the clip lifted`);
      if (o.op === 'drawImage') {
        const [, , , , , dx, dy, dw, dh] = o.args; images++;
        for (const p of [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]) assert(inBand(ap(o.m, ...p)), 'still cropped to the band');
      } else if (o.op === 'fillRect') {
        const [x, y, w, h] = o.args;
        for (const p of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) assert(inBand(ap(o.m, ...p)), 'fill inside the band');
        if (o.fillStyle?.radial) {
          glows++; const [hx, hy, , , , R] = o.fillStyle.radial;
          assert(x <= Math.max(-bw / 2, hx - R) + 1e-9 && y <= Math.max(-o.band.h / 2, hy - R) + 1e-9 && x + w >= Math.min(bw / 2, hx + R) - 1e-9 && y + h >= Math.min(o.band.h / 2, hy + R) - 1e-9, 'glow box covers the glow');
        }
      } else if (o.op === 'fill') { wedges++; assert(o.pts.length >= 3 && o.pts.every(p => inBand(p)), 'wedge cut to the band'); }
      else if (o.op === 'stroke') { lines++; assert(o.pts.every(p => inBand(p, 0)), 'speed line cut to the band'); assert(o.lineWidth / 2 <= 4, 'overhang stays under the 8 px rim'); }
    }
  }
  assert(images >= out.length * 2, 'truck + hero stills each frame'); assert(glows === out.length, 'one glow per frame');
  assert(wedges > 0 && lines > 0);
}
// Canvas fallbacks (no sheets): the vector truck / hero are clipped to the band
{
  const { out } = frames(load({ sheets: false }), 'approach'); let n = 0;
  for (const f of out) for (const o of f.log) if (o.band && (o.who === 'lcTruck' || o.who === 'lcHero')) { n++; assert(o.clips > 0, 'Canvas fallback clipped to the band'); }
  assert(n > 0);
}
// other beats keep drawing (no band there), and the reduced still band keeps its clip
{
  const H = load();
  for (const beat of ['impact', 'launch', 'fade']) { const { out } = frames(H, beat); assert(out.length > 0 && out.every(f => f.log.length > 20 && f.log.every(o => !o.band))); }
  const G = H.Graphics, ctx = recCtx({}); ctx.setTransform(3, 0, 0, 3, 0, 0);
  G.launchCutin(ctx, { launchCutin: { mode: 'reduced', total: 1.5, elapsed: 0.5, intensity: 1, tier: 'MAX' } }, { reducedMotion: true });
  const inBand = ctx.log.filter(o => o.band && o.op !== 'strokeRect');
  assert(inBand.length > 0 && inBand.every(o => o.clips > 0), 'still band content stays clipped');
}
console.log('launch-approach-bands ok');
