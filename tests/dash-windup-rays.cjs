// The twelve DASH wind-up rays fade smoothly at the pose switch without changing their geometry.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { scope } = require('./phase2.cjs'), H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const saved = { slots: S.castAssets.DASH, glow: G.grandGlow, spark: G.spark, trail: G.grandTrail, point: S.castPoint };
const ground = C.groundY, sy = y => ground - C.playerRadius - y;
const near = (a, b, eps = 1e-7) => assert(Math.abs(a - b) <= eps, `${a} != ${b}`);
const mk = (t, extra = {}) => ({ type: 'DASH', t, end: 2.43, climax: C.grandClimax.DASH, grand: true, heroWX: 1200,
  heroY: 50, source: { x: 900 }, after: null, afterTotal: 0.6, short: false, skipped: false, ...extra });
function asset(name) {
  const data = JSON.parse(fs.readFileSync(S.definitions.CAST.DASH[name].metadata, 'utf8')); assert(S.normalizeCell(data));
  return { ready: true, image: { complete: true, naturalWidth: data.frameWidth, naturalHeight: data.frameHeight }, data };
}
function context() {
  const log = [], stack = [], o = { globalAlpha: 1, log, path: [],
    save() { stack.push({ globalAlpha: this.globalAlpha, strokeStyle: this.strokeStyle, fillStyle: this.fillStyle, lineWidth: this.lineWidth, lineCap: this.lineCap, globalCompositeOperation: this.globalCompositeOperation }); },
    restore() { Object.assign(this, stack.pop()); }, beginPath() { this.path = []; }, moveTo(x, y) { this.path.push(['M', x, y]); },
    lineTo(x, y) { this.path.push(['L', x, y]); }, ellipse(...p) { this.path.push(['E', ...p]); },
    stroke() { log.push({ path: this.path.slice(), color: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha }); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v, k, x) => (v[k] = x, true) });
}
try {
  S.castAssets.DASH = { ...saved.slots, WINDUP: asset('WINDUP'), THRUST: asset('THRUST') };
  G.grandGlow = () => {}; G.spark = () => {}; G.grandTrail = () => 0;
  function sample(t, sx, enabled, extra = {}, reduced = false) {
    const st = mk(t, extra), before = JSON.stringify(st), A = G.grandActor(st, sx, sy, ground), c = context(), gate = { allowed: enabled };
    G.grandPoseFx(c, st, A, sx, sy, ground, 1, false, reduced, gate);
    assert.equal(JSON.stringify(st), before, 'drawing leaves the scene unchanged'); near(c.globalAlpha, 1);
    return { strokes: c.log.slice(), gate };
  }
  const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  for (const screen of [110, 640, 1100]) {
    const sx = x => screen + x - 1200;
    for (const t of [0.50, 0.66, 0.67, 0.68, 0.70, 0.72, 0.74, 0.749999, 0.75, 0.76]) {
      const old = sample(t, sx, false).strokes, changed = sample(t, sx, true).strokes;
      assert.equal(changed.length, old.length, 'stroke count unchanged');
      const factor = t >= 0.67 && t < 0.75 ? 1 - smooth((t - 0.67) / 0.08) : 1;
      for (let i = 0; i < old.length; i++) {
        assert.deepEqual(changed[i].path, old[i].path, 'coordinates unchanged'); assert.equal(changed[i].color, old[i].color); near(changed[i].width, old[i].width);
        near(changed[i].alpha, old[i].alpha * factor, 1e-6);
      }
      if (t < 0.75) assert.equal(old.length, 12, 'twelve rays');
    }
    const alpha = t => sample(t, sx, true).strokes[0]?.alpha ?? 0;
    assert(Math.abs(alpha(0.67 - 1e-6) - alpha(0.67 + 1e-6)) < 0.001, 'fade starts continuously');
    assert(alpha(0.75 - 1e-6) < 1e-7, 'rays approach zero before pose switch');
    for (const fps of [30, 60, 120, 144]) for (let phase = 0; phase < 10; phase++) {
      let prev = null; for (let t = 0.64 + phase / (fps * 10); t < 0.751; t += 1 / fps) {
        const a = t < 0.75 ? alpha(t) : 0;
        if (prev !== null) assert(Math.abs(a - prev) < (fps === 30 ? 0.36 : fps === 60 ? 0.19 : fps === 120 ? 0.10 : 0.09), `${fps}Hz alpha step`);
        prev = a;
      }
    }
    for (const flags of [{ short: true }, { skipped: true }, { after: 0 }]) assert.deepEqual(sample(0.72, sx, true, flags).strokes, sample(0.72, sx, false, flags).strokes);
    assert.deepEqual(sample(0.72, sx, true, {}, true).strokes, sample(0.72, sx, false, {}, true).strokes, 'live reduced motion retains legacy rays');
    const point = S.castPoint; S.castPoint = () => { throw new Error('lookup'); };
    const failed = sample(0.72, sx, true); assert.equal(failed.gate.allowed, false);
    assert.deepEqual(failed.strokes, sample(0.72, sx, false).strokes, 'lookup failure retains legacy rays'); S.castPoint = point;
    for (const type of ['STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) {
      const extra = { type, climax: C.grandClimax[type] };
      assert.deepEqual(sample(0.72, sx, true, extra).strokes, sample(0.72, sx, false, extra).strokes, `${type} unchanged`);
    }
  }
  console.log('DASH wind-up rays PASS: unchanged geometry/colors/count, smooth 30–144Hz, both directions, reduced/skip/after/short, fallback and scene purity.');
} finally { if (saved.slots) S.castAssets.DASH = saved.slots; else delete S.castAssets.DASH; G.grandGlow = saved.glow; G.spark = saved.spark; G.grandTrail = saved.trail; S.castPoint = saved.point; }
