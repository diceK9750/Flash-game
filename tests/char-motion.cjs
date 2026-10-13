// Character motion (display only): per-character hit / SPECIAL reactions, overhead look-up, idle fidgets (display
// RNG), hero effect poses / hit flavour / skid / RESULT tiers, truck after-impact hop. Physics, distances and the
// game RNG call count must equal main 40feb39 (fixtures/anim-physics-baseline-sage.json, unchanged since 2f4d0af).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load() {
  const ctx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (o, k, v) => (o[k] = v, true) });
  const element = () => ({ setAttribute() {}, textContent: '', hidden: false, style: {}, addEventListener() {}, getContext: ctx });
  const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope;
  vm.createContext(scope);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
  return { Hop: scope.Hop, ctx: ctx() };
}
const { Hop, ctx } = load(), A = Hop.Anim, G = Hop.Graphics;
const rndOf = seed => { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
// 1. Physics / distances identical to the main baseline, and identical game RNG call counts with and without drawing.
function sim(draw) {
  G.smooth = draw; const out = [], calls = [];
  for (let seed = 1; seed <= 24; seed++) {
    const r = rndOf(seed); let n = 0; const g = new Hop.Game(() => (n++, r()));
    g.act(); g.angle = 20 + seed * 2; g.act(); g.power = 0.5 + (seed % 5) / 10; g.act();
    const visual = { launchAt: 0, contactAt: -Infinity, reducedMotion: seed % 3 === 0, readyTargets: [] };
    for (let i = 0; i < 20000 && g.state === 'FLYING'; i++) { g.update(1 / 60); if (seed % 2 && i % 37 === 0) g.act(); if (draw) G.draw(ctx, g, visual); }
    out.push([g.state, g.finalDistance, g.body.x, g.body.bounces, g.specialSuccesses]); calls.push(n);
  }
  G.smooth = false; return { out, calls };
}
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-sage.json'), 'utf8'));
const drawn = sim(true), plain = sim(false);
assert.deepEqual(drawn.out, baseline, 'distances == main 40feb39 baseline'); assert.deepEqual(plain.out, baseline);
assert.deepEqual(drawn.calls, plain.calls, 'game RNG call count unchanged by drawing');
// 2. Scale bounds (uniform-ish, within +-8%) and determinism over every new motion.
const TYPES = A.CAST_ORDER, p = {}, q = {}, inB = o => o.sx >= 0.92 - 1e-12 && o.sx <= 1.08 + 1e-12 && o.sy >= 0.92 - 1e-12 && o.sy <= 1.08 + 1e-12;
for (const rm of [false, true]) for (const type of TYPES) for (let t = 0; t < 12; t += 0.013) {
  for (const args of [[t, false, t % 0.6, rm, 0, Infinity, 0, 77], [t, false, Infinity, rm, 0, t % 0.8, 0, 77], [t, false, Infinity, rm, 0.3, Infinity, -0.8, 1234], [t, true, Infinity, rm, 0, Infinity, 0, 5]]) {
    A.cast(p, type, ...args); A.cast(q, type, ...args); assert(inB(p), `${type} scale`); assert.deepEqual({ ...p }, { ...q }, 'deterministic');
    assert([p.sx, p.sy, p.rot, p.dx, p.dy].every(Number.isFinite));
  }
}
const ev = { launchAge: 5, hitAge: Infinity, hitDir: 1, landAge: Infinity, specialAge: Infinity, effAge: Infinity, effKind: null, hitType: null, skid: 0, tier: 0 };
for (const rm of [false, true]) for (const kind of ['UP', 'DOWN', 'BOOST', 'DASH', 'BOUNCE']) for (let a = 0; a < 0.6; a += 0.01) {
  A.hero(p, 'FLYING', 3, { ...ev, effAge: a, effKind: kind, hitAge: a, hitType: TYPES[Math.floor(a * 13) % 8], skid: a }, rm); assert(inB(p), 'hero scale');
}
for (const tier of [0, 1, 2]) for (let t = 0; t < 4; t += 0.05) { A.hero(p, 'RESULT', t, { ...ev, tier }, false); assert(inB(p)); }
// 3. Each character has a distinct hit reaction (pose signature) and a distinct SPECIAL reaction; hero hit flavour differs.
const sig = (f) => { const s = []; for (let i = 0; i <= 10; i++) { f(i / 10); s.push([p.sx, p.sy, p.rot, p.dx, p.dy].map(v => v.toFixed(3)).join(',')); } return s.join('|'); };
const hitSigs = TYPES.map(type => sig(u => A.cast(p, type, 0, false, u * A.HIT_T * 0.999, false, 0, Infinity, 0, 0)));
assert.equal(new Set(hitSigs).size, 8, 'distinct hit reactions');
const spSigs = TYPES.map(type => sig(u => A.cast(p, type, 0, false, Infinity, false, 0, u * A.SP_T * 0.999, 0, 0)));
assert.equal(new Set(spSigs).size, 8, 'distinct SPECIAL reactions');
const heroSigs = TYPES.map(type => sig(u => A.hero(p, 'FLYING', 3, { ...ev, hitAge: 0.07 + u * 0.47, hitType: type }, false)));
assert.equal(new Set(heroSigs).size, 8, 'distinct hero hit flavour');
const effSigs = ['UP', 'DOWN', 'BOOST', 'DASH', 'BOUNCE'].map(k => sig(u => A.hero(p, 'FLYING', 3, { ...ev, effAge: u * 0.49, effKind: k }, false)));
assert.equal(new Set(effSigs).size, 5, 'distinct effect poses');
assert.equal(new Set([0, 1, 2].map(tier => sig(u => A.hero(p, 'RESULT', u * 2, { ...ev, tier }, false)))).size, 3, 'RESULT tiers differ');
// 4. Fidgets: display RNG only, seeded per object, occasional (not always, not never), differ by seed.
const fid = seed => { let n = 0; for (let t = 0; t < 60; t += 0.05) { A.reset(p); A.fidget(p, 'BOUNCE', t, seed); if (p.dx || p.dy) n++; } return n; };
assert(fid(1) > 0 && fid(1) < 1200 * 0.5, 'occasional'); assert.equal(fid(1), fid(1)); assert.notEqual(sig(u => (A.reset(p), A.fidget(p, 'GUARD', 30 + u * 30, 1))), sig(u => (A.reset(p), A.fidget(p, 'GUARD', 30 + u * 30, 999))));
// 5. Overhead look-up tracks the side the hero is on.
A.cast(p, 'GUARD', 0.1, false, Infinity, false, 0, Infinity, 0.8, 1); const r1 = p.rot; A.cast(p, 'GUARD', 0.1, false, Infinity, false, 0, Infinity, -0.8, 1); assert(Math.sign(r1) !== Math.sign(p.rot));
assert.equal(A.overhead(0, 100), 0); assert(A.overhead(200, 500) > 0 && A.overhead(-200, 500) < 0);
// 6. Reduced motion: no offsets / rotation from the new motions, only faint scale; disabled = identity.
for (const type of TYPES) for (let u = 0; u < 1; u += 0.05) {
  A.reset(p); A.castHit(p, type, u, A.RM, true); assert.equal(p.rot, 0); assert.equal(p.dx, 0); assert.equal(p.dy, 0); assert(Math.abs(p.sx - 1) <= 0.05 * A.RM + 1e-9);
  A.reset(p); A.castSpecial(p, type, u, A.RM, true); assert.equal(p.rot, 0); assert.equal(p.dx, 0); assert.equal(p.dy, 0);
  A.cast(p, type, u * 10, false, Infinity, true, 0, Infinity, 0.9, 3); assert.equal(p.rot, 0); assert.equal(p.dx, 0);
}
A.hero(p, 'FLYING', 3, { ...ev, effAge: 0.2, effKind: 'DOWN', skid: 1 }, true); assert.equal(p.rot, 0); assert.equal(p.dx, 0);
A.truck(p, 'FLYING', 3, 0.3, true); assert.deepEqual([p.dx, p.dy, p.rot], [0, 0, 0]);
A.enabled = false; A.cast(p, 'BRAKE', 1, false, 0.2, false, 0, 0.2, 0.5, 1); assert.deepEqual([p.sx, p.sy, p.rot, p.dx, p.dy], [1, 1, 0, 0, 0]); A.enabled = true;
// 7. Truck after-impact hop is continuous at the window edges and no scale.
A.truck(p, 'FLYING', 0, 0.12, false); const y0 = p.dy; A.truck(p, 'FLYING', 0, 0.1201, false); assert(Math.abs(p.dy - y0) < 0.1); assert.equal(p.sx, 1);
console.log('char-motion: ok');
