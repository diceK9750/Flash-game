// Launch cut-in raster cost (2026-11-05 auto cycle 53, display only). At a phone viewport (4x CPU) about half of the
// launch cut-in frames went over 33 ms: the whole stage was still rasterized under the cut-in's opaque backdrop, and
// the huge SFX labels re-stroked two round-joined outlines of every glyph on every frame. Now:
//  1) while the cut-in covers the stage (visible, not the reduced "still", alpha 1, shake inside the overscan) the stage
//     is drawn with the same calls but into an empty clip (nothing outside the cut-in reaches a pixel), its images are
//     only noted and touched once each with a 1x1 device-pixel draw that the backdrop repaints; the clip is gone before
//     the cut-in draws; fade / still / reduced motion / no Path2D draw the stage normally; game state is untouched;
//  2) near scale 1 a label's two outline strokes come from a cached device-space canvas (one axis-aligned drawImage
//     under the vector fill); pop-in scales, a filter, a non source-over blend, no canvas, or a detached canvas whose
//     font metrics differ keep the vector strokes; the cache canvas copies the resolved lang; one canvas per label.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mul = (m, n) => ({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d, e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f });
const PAINT = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'clearRect', 'putImageData']);
// recording 2D context: tracks the transform, an "empty clip" flag through save/restore, and logs every paint op
function recCtx(canvas, opts = {}) {
  const st = { globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none', font: '10px sans-serif', lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', lang: 'inherit' };
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, empty = false; const stack = [], log = [], tag = { inCut: false };
  const api = {
    canvas, log, tag,
    save() { stack.push([{ ...st }, m, empty]); }, restore() { const s = stack.pop(); if (s) { Object.assign(st, s[0]); m = s[1]; empty = s[2]; } },
    setTransform(a, b, c, d, e, f) { m = typeof a === 'object' ? { ...a } : { a, b, c, d, e, f }; }, getTransform() { return { ...m }; }, resetTransform() { m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    transform(a, b, c, d, e, f) { m = mul(m, { a, b, c, d, e, f }); }, translate(x, y) { m = mul(m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); },
    scale(x, y) { m = mul(m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); }, rotate(r) { const c = Math.cos(r), s = Math.sin(r); m = mul(m, { a: c, b: s, c: -s, d: c, e: 0, f: 0 }); },
    clip(p) { if (p && p.__empty) empty = true; },
    measureText: t => ({ width: (opts.em || 1) * parseFloat(st.font.replace(/^\D*?(\d+(\.\d+)?)px.*$/, '$1')) * String(t).length, actualBoundingBoxLeft: 50, actualBoundingBoxRight: 50, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 40 }),
    getLineDash: () => [], setLineDash() {}, isPointInPath: () => false,
  };
  for (const op of PAINT) api[op] = (...args) => log.push({ op, args, m: { ...m }, empty, inCut: tag.inCut, ...st });
  return new Proxy(api, { get: (o, p) => p in o ? o[p] : p in st ? st[p] : typeof p === 'string' && p.startsWith('create') ? () => ({ addColorStop() {} }) : () => {},
    set: (o, p, v) => { if (p in st) st[p] = v; else o[p] = v; return true; },
    deleteProperty: (o, p) => { delete o[p]; if (PAINT.has(p)) o[p] = (...args) => log.push({ op: p, args, m: { ...m }, empty, inCut: tag.inCut, ...st }); return true; } });
}
function load({ canvas = true, path2d = true, em2 = 1, lang = 'ja' } = {}) {
  const made = [];
  const element = () => ({ setAttribute() {}, textContent: '', hidden: false, style: {}, addEventListener() {}, getContext: () => recCtx({}) });
  const document = { getElementById: element, addEventListener() {}, documentElement: { lang } };
  if (canvas) document.createElement = t => { assert.equal(t, 'canvas'); const cv = { width: 300, height: 150 }; const x = recCtx(cv, { em: em2 }); cv.getContext = () => x; made.push(cv); return cv; };
  const sc = { document, localStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error('offline')), setTimeout, console, Promise, requestAnimationFrame() {} };
  if (path2d) sc.Path2D = class { constructor() { this.__empty = true; } };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  return { H: sc.Hop, made };
}
const G0 = load().H.Graphics;
assert.equal(typeof G0.launchCutinCovers, 'function', 'launch cut-in stage hiding is in place');
// ---- 1) the stage under the cut-in -------------------------------------------------------------------------------
function cutinRun(env, reducedMotion) {
  const { H } = load(env), G = H.Graphics, c = H.CONFIG;
  let s = 7; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const g = new H.Game(rnd); g.act(); g.angle = 40; g.act(); g.power = 0.8; g.act();
  if (!g.launchCutin) g.startLaunchCutin();
  assert(g.launchCutin, 'a launch cut-in is playing');
  const img = { width: 288, height: 288, naturalWidth: 288, complete: true };
  const ol = G.launchCutin, frames = [];
  const visual = { launchAt: 0, contactAt: -Infinity, reducedMotion, readyTargets: [] };
  for (let i = 0; i < 200 && g.launchCutin; i++) {
    const ctx = recCtx({ width: 1280, height: 720 });
    G.launchCutin = function (...a) { ctx.tag.inCut = true; try { return ol.apply(this, a); } finally { ctx.tag.inCut = false; } };
    const before = JSON.stringify(g), st = G.launchCutinStyle(g.launchCutin, reducedMotion);
    // one stage image drawn through the normal path (stands in for the cast / hero sheets)
    G.draw(ctx, g, visual); ctx.drawImage(img, 0, 0); // after draw(): the method must be the real one again
    assert.equal(JSON.stringify(g), before, 'draw() does not touch the game');
    const own = ctx.log.slice(0, -1), last = ctx.log[ctx.log.length - 1];
    assert.equal(last.op, 'drawImage'); assert.equal(last.empty, false, 'no clip left behind');
    frames.push({ st, ops: own, cover: G.launchCutinCovers(ctx, g, visual) });
    G.launchCutin = ol;
    g.update(1 / 60);
  }
  return { frames, c };
}
for (const [env, rm, label] of [[{}, false, 'full'], [{}, true, 'reduced motion'], [{ path2d: false }, false, 'no Path2D']]) {
  const { frames } = cutinRun(env, rm);
  let covered = 0, open = 0;
  for (const f of frames) {
    const shown = f.ops.filter(o => !o.empty), stage = shown.filter(o => !o.inCut), hidden = f.ops.filter(o => o.empty);
    const covers = f.st.visible && f.st.beat !== 'still' && f.st.alpha >= 1 && Math.abs(f.st.shakeX) < 40 && Math.abs(f.st.shakeY) < 40 && env.path2d !== false;
    if (covers) {
      covered++;
      assert(hidden.length > 20, `${label} ${f.st.beat}: the stage is still drawn (same calls) under an empty clip`);
      assert(hidden.every(o => !o.inCut), 'the cut-in itself is never clipped away');
      for (const o of stage) { // only the 1x1 decode touches reach the canvas outside the cut-in
        assert.equal(o.op, 'drawImage', `${label} ${f.st.beat}: stage ${o.op} reached the canvas`);
        assert.deepEqual(o.args.slice(1), [0, 0, 1, 1, 0, 0, 1, 1]); assert.deepEqual(o.m, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }); assert.equal(o.globalAlpha, 1);
      }
      assert(hidden.filter(o => o.op === 'drawImage').length === 0, 'stage images are noted, not drawn, under the clip');
      assert(f.ops.findIndex(o => o.inCut) > f.ops.findLastIndex(o => !o.inCut), 'touches come before the cut-in paints over them');
    } else if (f.st.visible) {
      open++;
      assert.equal(hidden.length, 0, `${label} ${f.st.beat} a=${f.st.alpha}: nothing hidden`);
      assert(stage.length > 20, `${label} ${f.st.beat}: the stage is drawn normally`);
    }
  }
  if (label === 'full') assert(covered > 40 && open > 5, `full cut-in: covered ${covered}, open ${open}`);
  else assert.equal(covered, 0, `${label}: never hidden`);
}
// covers(): non-default canvas state keeps the stage drawn
{ const { H } = load(), G = H.Graphics, cut = { mode: 'full', total: H.CONFIG.launchCutinDuration, elapsed: 0.05, intensity: 0.5 };
  const ctx = recCtx({}); assert.equal(G.launchCutinCovers(ctx, { launchCutin: cut }, {}), true);
  ctx.globalAlpha = 0.5; assert.equal(G.launchCutinCovers(ctx, { launchCutin: cut }, {}), false); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter'; assert.equal(G.launchCutinCovers(ctx, { launchCutin: cut }, {}), false); ctx.globalCompositeOperation = 'source-over';
  assert.equal(G.launchCutinCovers(ctx, { launchCutin: null }, {}), false);
  assert.equal(G.launchCutinCovers(ctx, { launchCutin: cut }, { reducedMotion: true }), false);
  assert.equal(G.launchCutinCovers(ctx, { launchCutin: { ...cut, elapsed: cut.total * 0.95 } }, {}), false, 'fade: stage visible'); }
// ---- 2) label outlines -------------------------------------------------------------------------------------------
function label(env, scale, set = {}) {
  const { H, made } = load(env), G = H.Graphics, ctx = recCtx({ width: 1280, height: 720 });
  ctx.setTransform(1.37, 0, 0, 1.37, -11.3, 8.7); Object.assign(ctx, set);
  const runs = [0, 1, 2].map(() => { ctx.log.length = 0; G.lcText(ctx, 'ドカァァァン！！', 640, 150, 120, -0.08, '#ff5a1f', '#1a0f08', scale); return ctx.log.slice(); });
  return { runs, made };
}
{ const { runs, made } = label({}, 1.02);
  assert.equal(made.length, 1, 'one cache canvas for the label');
  const x2 = made[0].getContext('2d'), strokes = x2.log.filter(o => o.op === 'strokeText');
  assert.deepEqual(strokes.map(o => [o.lineWidth, o.strokeStyle]), [[120 * 0.26, '#1a0f08'], [120 * 0.1, '#ffffff']], 'cached: dark rim then white rim');
  assert.equal(x2.lang, 'ja', 'cache canvas uses the page lang');
  const r = Math.hypot(strokes[0].m.a, strokes[0].m.b); assert(Math.abs(r - 1.37) < 1e-9 && Math.abs(Math.atan2(strokes[0].m.b, strokes[0].m.a) + 0.08) < 1e-9, 'cached at device scale + rotation');
  for (const ops of runs) {
    assert.deepEqual(ops.map(o => o.op), ['drawImage', 'fillText'], 'outline blit, then the vector fill');
    const [d, f] = ops; assert.deepEqual(d.m, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, 'axis-aligned blit');
    assert.equal(d.args[0], made[0]); assert(Math.abs(d.args[3] - made[0].width * 1.02) < 1e-9 && Math.abs(d.args[4] - made[0].height * 1.02) < 1e-9);
    assert.equal(f.fillStyle, '#ff5a1f'); assert(Math.abs(f.m.a - 1.37 * 1.02 * Math.cos(-0.08)) < 1e-9);
    // the label origin lands where the vector path would put it
    const ox = (f.m.e - d.args[1]) / 1.02, oy = (f.m.f - d.args[2]) / 1.02;
    assert(Math.abs(ox - Math.round(ox)) < 1e-9 && Math.abs(oy - Math.round(oy)) < 1e-9 && ox > 0 && oy > 0, 'origin inside the cache');
  } }
const vector = (runs, why) => { for (const ops of runs) assert.deepEqual(ops.map(o => o.op), ['strokeText', 'strokeText', 'fillText'], why); };
vector(label({}, 1.6).runs, 'pop-in scale: vector strokes');
vector(label({}, 1, { filter: 'blur(2px)' }).runs, 'filter: vector strokes');
vector(label({}, 1, { globalCompositeOperation: 'lighter' }).runs, 'blend: vector strokes');
vector(label({ canvas: false }, 1).runs, 'no canvas: vector strokes');
{ const { runs, made } = label({ em2: 1.1 }, 1); vector(runs, 'different font metrics on the cache canvas: vector strokes'); assert.equal(made.length, 1, 'checked once'); }
console.log('launch-cutin-perf ok');
