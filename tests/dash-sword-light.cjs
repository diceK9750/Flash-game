// DASH's two lights track the two actual swords while the visual poses crossfade.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const saved = { slots: S.castAssets.DASH, glow: G.grandGlow, spark: G.spark, trail: G.grandTrail, point: S.castPoint };
const records = [], near = (a, b, eps = 1e-6) => assert(Math.abs(a - b) <= eps, `${a} != ${b}`);
function ctx() {
  const stack = [], o = { globalAlpha: 1, save() { stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, globalCompositeOperation: this.globalCompositeOperation }); },
    restore() { Object.assign(this, stack.pop()); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v, k, x) => (v[k] = x, true) });
}
function asset(name) {
  const def = S.definitions.CAST.DASH[name], data = JSON.parse(fs.readFileSync(def.metadata, 'utf8'));
  assert(S.normalizeCell(data));
  return { ready: true, image: { complete: true, naturalWidth: data.frameWidth, naturalHeight: data.frameHeight }, data };
}
const ground = C.groundY, sy = y => ground - C.playerRadius - y;
const mk = (t, extra = {}) => ({ type: 'DASH', t, end: 2.43, climax: C.grandClimax.DASH, grand: true, heroWX: 1200,
  heroY: 50, source: { x: 900 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...extra });
try {
  S.castAssets.DASH = { ...saved.slots, WINDUP: asset('WINDUP'), THRUST: asset('THRUST') };
  G.grandGlow = (c, x, y, r, col, alpha) => records.push({ kind: 'glow', x, y, r, col, alpha });
  G.spark = (c, x, y, r, col, rot) => records.push({ kind: 'spark', x, y, r, col, rot, alpha: c.globalAlpha });
  G.grandTrail = () => 0;
  const run = (st, sx, gate = { allowed: true }, reduced = false) => {
    records.length = 0; const before = JSON.stringify(st), A = G.grandActor(st, sx, sy, ground), c = ctx();
    G.grandPoseFx(c, st, A, sx, sy, ground, 1, false, reduced, gate);
    assert.equal(JSON.stringify(st), before, 'render leaves scene unchanged'); near(c.globalAlpha, 1);
    return { A, calls: records.slice(), gate };
  };
  for (const screenX of [110, 640, 1100]) {
    const sx = x => screenX + x - 1200;
    for (const t of [0.66, 0.67, 0.70, 0.74, 0.7499, 0.7501, 0.76, 0.78, 0.80, 0.84, 0.86]) {
      const st = mk(t), { A, calls } = run(st, sx), actual = S.castPoint('DASH', sx(A.x), ground + A.dy, A.pose, A.scale, { face: A.face, rotate: A.rotate });
      const principal = calls.find(x => x.kind === 'glow' && x.col === (A.pose === 'WINDUP' ? '255,140,50' : '255,170,70'));
      const spark = calls.find(x => x.kind === 'spark' && x.col === (A.pose === 'WINDUP' ? '#fff6d8' : '#ffffff')); assert(principal && spark && actual);
      near(principal.x, actual.x); near(principal.y, actual.y); near(spark.x, actual.x); near(spark.y, actual.y);
      const old = calls.filter(x => A.pose === 'THRUST' && x.kind === 'glow' && x.col === '255,140,50');
      if (t >= 0.7501 && t < 0.85) {
        assert.equal(old.length, 1); const ch = G.grandPoseChange(st, A, sx, sy, ground);
        const oldTip = S.castPoint('DASH', sx(A.x), ground + A.dy, 'WINDUP', A.scale, { face: ch.face, rotate: A.rotate });
        near(old[0].x, oldTip.x); near(old[0].y, oldTip.y); near(old[0].r, 72 + 6 * Math.sin(t * 40)); assert(old[0].alpha > 0 && old[0].alpha <= 0.22);
        const oldSpark = calls.find(x => x.kind === 'spark' && x.col === '#fff6d8'); assert(oldSpark);
        near(oldSpark.x, oldTip.x); near(oldSpark.y, oldTip.y); near(oldSpark.r, 36); near(oldSpark.rot, t * 9); near(oldSpark.alpha, old[0].alpha);
      } else assert.equal(old.length, 0);
    }
    function luminosity(t) { const r = run(mk(t), sx); return r.calls.filter(x => x.kind === 'glow').reduce((sum, x) => sum + x.alpha, 0); }
    for (const t of [0.67, 0.75, 0.85]) assert(Math.abs(luminosity(t - 1e-6) - luminosity(t + 1e-6)) < 0.001, `continuous light at ${t}`);
    const before = run(mk(0.75 - 1e-7), sx).calls, after = run(mk(0.75 + 1e-7), sx).calls;
    const oldBefore = before.find(x => x.kind === 'glow' && x.col === '255,140,50'), oldAfter = after.find(x => x.kind === 'glow' && x.col === '255,140,50');
    const sparkBefore = before.find(x => x.kind === 'spark' && x.col === '#fff6d8'), sparkAfter = after.find(x => x.kind === 'spark' && x.col === '#fff6d8');
    assert(oldBefore && oldAfter && sparkBefore && sparkAfter); near(oldBefore.r, oldAfter.r, 0.001); near(oldBefore.alpha, oldAfter.alpha, 0.001);
    near(sparkBefore.r, sparkAfter.r, 0.001); near(sparkBefore.alpha, sparkAfter.alpha, 0.001); near(sparkBefore.rot, sparkAfter.rot, 0.001);
    assert(Math.hypot(oldBefore.x - oldAfter.x, oldBefore.y - oldAfter.y) < 2, 'remaining old-tip jump measured for review');
    near(sparkAfter.x, oldAfter.x); near(sparkAfter.y, oldAfter.y);
    for (const fps of [30, 60, 120, 144]) for (let phase = 0; phase < 10; phase++) {
      let prev = null; for (let t = 0.64 + phase / (fps * 10); t < 0.90; t += 1 / fps) {
        const now = luminosity(t); assert(now >= 0 && now <= 1.001);
        if (prev !== null) assert(Math.abs(now - prev) < (fps === 30 ? 0.50 : fps === 60 ? 0.26 : fps === 120 ? 0.14 : 0.12), `${fps}Hz light jump`);
        prev = now;
      }
      let previous = null;
      for (let t = 0.66 + phase / (fps * 10); t < 0.85; t += 1 / fps) {
        const calls = run(mk(t), sx).calls, oldGlow = calls.find(x => x.kind === 'glow' && x.col === '255,140,50'), oldSpark = calls.find(x => x.kind === 'spark' && x.col === '#fff6d8');
        if (oldGlow && oldSpark && previous) {
          assert(Math.abs(oldGlow.r - previous.oldGlow.r) < 15 * 30 / fps, `${fps}Hz old glow radius jump`);
          assert(Math.abs(oldSpark.r - previous.oldSpark.r) < 3.1 * 30 / fps, `${fps}Hz old sparkle radius jump`);
          assert(Math.abs(oldSpark.rot - previous.oldSpark.rot) <= 9 / fps + 1e-6, `${fps}Hz old sparkle rotation jump`);
          assert(Math.abs(oldSpark.alpha - previous.oldSpark.alpha) < 0.50 * 30 / fps, `${fps}Hz old sparkle alpha jump`);
          near(oldGlow.x, oldSpark.x); near(oldGlow.y, oldSpark.y);
        }
        previous = oldGlow && oldSpark ? { oldGlow, oldSpark } : null;
      }
    }
    for (const opts of [{ short: true }, { skipped: true }, { after: 0 }]) {
      const result = run(mk(0.78, opts), sx); assert(!result.calls.some(x => x.kind === 'glow' && x.col === '255,140,50'));
    }
    const reduced = run(mk(0.78), sx, { allowed: true }, true); assert(!reduced.calls.some(x => x.kind === 'glow' && x.col === '255,140,50'));
    const disabled = run(mk(0.78), sx, { allowed: false }); assert(!disabled.calls.some(x => x.kind === 'glow' && x.col === '255,140,50'));
    const originalPoint = S.castPoint;
    S.castPoint = function (...args) { if (args[3] === 'WINDUP') throw new Error('old hotspot lookup'); return originalPoint.apply(this, args); };
    const failedOld = run(mk(0.78), sx); assert.equal(failedOld.gate.allowed, false); assert(!failedOld.calls.some(x => x.kind === 'glow' && x.col === '255,140,50'));
    S.castPoint = () => { throw new Error('current hotspot lookup'); };
    const failedCurrent = run(mk(0.78), sx); assert.equal(failedCurrent.gate.allowed, false); assert(failedCurrent.calls.every(x => Number.isFinite(x.x) && Number.isFinite(x.y)));
    S.castPoint = originalPoint;
    for (const type of ['STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) {
      const other = mk(0.78, { type, climax: C.grandClimax[type] });
      const without = JSON.stringify(run(other, sx, null).calls), withGate = JSON.stringify(run(other, sx, { allowed: true }).calls);
      assert.equal(withGate, without, `${type} rendering is unchanged`);
    }
  }
  console.log('DASH sword light PASS: true sword tips, left/right, 30–144Hz, light boundaries, reduced/skip/after, lookup fallback and scene purity.');
} finally { if (saved.slots) S.castAssets.DASH = saved.slots; else delete S.castAssets.DASH; G.grandGlow = saved.glow; G.spark = saved.spark; G.grandTrail = saved.trail; S.castPoint = saved.point; }
