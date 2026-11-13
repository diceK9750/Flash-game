// Localized fighter aura is display-only, follows the transformed fist, and preserves old fallbacks.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG, F = C.comboFighterTimes;
const saved = { assets: S.castAssets.BOUNCE, cast: G.comboCast, point: S.castPoint, layer: S.comboLayer };
const upper = { ready: true, image: { complete: true, naturalWidth: 288 }, data: { pivot: { x: 144, y: 264 }, unit: 3, frameWidth: 288, frameHeight: 288 } };
S.castAssets.BOUNCE = { ...saved.assets, UPPER: upper };
const scene = (t, changes = {}) => ({ type: 'BOUNCE', t, heroWX: 1200, heroY: 50,
  source: { x: 1230 }, partner: { x: 1700 }, short: false, skipped: false, after: null, afterTotal: 0.6, ...changes });
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b, label, eps = 1e-7) => assert(Math.abs(a - b) < eps, `${label}: ${a} != ${b}`);
function context() {
  const events = [], stack = [], target = { events, globalAlpha: 0.8, globalCompositeOperation: 'source-over', strokeStyle: '',
    save() { stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, lineCap: this.lineCap }); },
    restore() { Object.assign(this, stack.pop()); },
    arc(x, y, r) { this.lastArc = { x, y, r }; },
    stroke() { if (this.strokeStyle === '#ffe584') events.push({ kind: 'ring', ...this.lastArc, alpha: this.globalAlpha, mode: this.globalCompositeOperation }); },
    createRadialGradient() { return { addColorStop() {} }; }
  };
  return new Proxy(target, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) });
}
function draw(st, fighter = G.comboActors(st).fighter, reduced = false, alpha = 0.45, gate = { allowed: true, asset: upper }) {
  const ctx = context(), before = JSON.stringify(st);
  const factor = G.comboFighterFistAura(ctx, st, fighter, sx, ground, alpha, reduced, gate);
  assert.equal(JSON.stringify(st), before, 'scene unchanged');
  near(ctx.globalAlpha, 0.8, 'canvas alpha restored'); assert.equal(ctx.globalCompositeOperation, 'source-over');
  return { ctx, factor };
}
try {
  const st = scene(F.rise + 0.10), actor = G.comboActors(st).fighter, animated = G.comboSakuga(st, 'fighter', actor);
  const spriteScale = 1.25 * animated.scale / 3, dx = (192 - 144) * spriteScale, dy = (41 - 264) * spriteScale, angle = animated.rotate || 0;
  let result = draw(st, actor); assert.equal(result.ctx.events.length, 1);
  near(result.ctx.events[0].x, sx(animated.x) + dx * Math.cos(angle) - dy * Math.sin(angle), 'right fist x');
  near(result.ctx.events[0].y, ground + animated.dy + dx * Math.sin(angle) + dy * Math.cos(angle), 'right fist y');
  assert(result.factor > 1 / 3 && result.factor < 1); assert(result.ctx.events[0].alpha > 0.4);
  const left = { ...actor, face: 'left', rotate: 0.13 }, leftAnimated = G.comboSakuga(st, 'fighter', left);
  const ls = 1.25 * leftAnimated.scale / 3, ldx = -(192 - 144) * ls, ldy = (41 - 264) * ls, la = leftAnimated.rotate || 0;
  result = draw(st, left); near(result.ctx.events[0].x, sx(leftAnimated.x) + ldx * Math.cos(la) - ldy * Math.sin(la), 'mirrored fist x');
  near(result.ctx.events[0].y, ground + leftAnimated.dy + ldx * Math.sin(la) + ldy * Math.cos(la), 'mirrored fist y');

  // Both the new accent and the reduction of the old aura glide from their original values.
  const start = draw(scene(F.rise)); near(start.ctx.events[0].alpha, 0, 'ring begins invisible'); near(start.factor, 1, 'old aura starts unchanged');
  const peak = draw(scene(F.rise + 0.12)); near(peak.factor, 1 / 3, 'old aura settles to one third');
  const tail = draw(scene(F.upper + 0.38)); assert(tail.ctx.events[0].alpha < 1e-8, 'ring fades out before old aura ends');
  for (const fps of [30, 60, 120, 144]) for (let phase = 0; phase < 10; phase++) {
    const first = F.rise + phase / (10 * fps); let previous = draw(scene(first));
    for (let t = first + 1 / fps; t < F.rise + 0.12; t += 1 / fps) {
      const next = draw(scene(t)); assert(Math.abs(next.ctx.events[0].alpha - previous.ctx.events[0].alpha) < 0.30, `${fps}Hz arc continuity`);
      assert(Math.abs(0.45 * (next.factor - previous.factor)) < 0.13, `${fps}Hz original aura continuity`); previous = next;
    }
  }
  for (const change of [{ short: true }, { skipped: true }, { after: 0 }, { type: 'BOOST' }]) {
    result = draw({ ...st, ...change }, actor); assert.equal(result.factor, null); assert.equal(result.ctx.events.length, 0);
  }
  assert.equal(draw(st, actor, true).factor, null, 'live reduced motion uses the old aura');
  for (const t of [F.rise - 0.001, F.upper + 0.45]) assert.equal(draw(scene(t), actor).factor, null, 'outside aura window');

  // Missing optional sprite, invalid hotspot or lookup failure keeps the previous rendering.
  upper.image.complete = false; assert.equal(draw(st, actor).factor, null); upper.image.complete = true;
  upper.image.naturalWidth = 0; assert.equal(draw(st, actor).factor, null); upper.image.naturalWidth = 288;
  S.comboLayer = () => null; assert.equal(draw(st, actor).factor, null); S.comboLayer = saved.layer;
  S.castPoint = () => null; assert.equal(draw(st, actor).factor, null);
  S.castPoint = () => { throw new Error('optional sprite failed'); }; assert.equal(draw(st, actor).factor, null); S.castPoint = saved.point;

  // Real back renderer order: the existing sampled ghosts, localized arc, old lighter aura, then actor.
  const events = [], f = G.comboActors(st).fighter, ghosts = G.comboFighterRiseGhosts(st, f), ctx = context();
  const stroke = ctx.stroke; ctx.stroke = function () { stroke.call(this); if (this.strokeStyle === '#ffe584') events.push({ kind: 'ring', mode: this.globalCompositeOperation }); };
  G.comboCast = (c, id, a, x, y, alpha = 1) => { if (id === 'BOUNCE' && a?.pose === 'UPPER') events.push({ kind: 'cast', dy: a.dy, alpha, mode: c.globalCompositeOperation }); };
  const before = JSON.stringify(st); G.comboBack(ctx, st, sx, sy, ground, false, { allowed: true, asset: upper }); assert.equal(JSON.stringify(st), before);
  const ring = events.findIndex(e => e.kind === 'ring'), aura = events.findIndex(e => e.kind === 'cast' && e.mode === 'lighter');
  const body = events.findIndex((e, i) => i > aura && e.kind === 'cast' && e.mode === 'source-over');
  const prior = events.slice(0, ring).filter(e => e.kind === 'cast' && e.mode === 'source-over' && e.dy > f.dy);
  assert.equal(prior.length, ghosts.length); assert(prior.length > 0); assert(ring < aura && aura < body);
  assert.equal(events[ring].mode, 'source-over'); assert(events[aura].alpha < 0.45, 'whole-body aura is reduced');
  events.length = 0; G.comboBack(context(), st, sx, sy, ground, true, { allowed: true, asset: upper });
  assert(!events.some(e => e.kind === 'ring')); near(events.find(e => e.kind === 'cast' && e.mode === 'lighter').alpha, 0.45, 'reduced mode keeps prior aura');
  console.log('Fighter fist aura PASS: transformed/mirrored anchor, 30–144Hz fades, order, fallback, live reduced-motion and scene purity.');
} finally {
  if (saved.assets) S.castAssets.BOUNCE = saved.assets; else delete S.castAssets.BOUNCE;
  G.comboCast = saved.cast; S.castPoint = saved.point; S.comboLayer = saved.layer;
}
