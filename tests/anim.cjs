// Character motion (Hop.Anim, display only): determinism, scale bounds (5-head proportions kept: whole-sprite
// squash / stretch within +-8%), reduced motion, and zero physics change (fixed-seed runs drawn every frame
// must match the pre-animation baseline recorded at main 746b9e9).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load() {
  const els = new Map();
  const ctx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (o, k, v) => (o[k] = v, true) });
  const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', hidden: false, style: {}, addEventListener() {}, getContext: ctx }); return els.get(id); };
  const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope;
  vm.createContext(scope);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
  return { Hop: scope.Hop, ctx: ctx() };
}
const { Hop, ctx } = load(), A = Hop.Anim;
const states = ['READY', 'AIM_ANGLE', 'AIM_POWER', 'FLYING', 'RESULT'];
const evs = [];
for (const launchAge of [0, 0.1, 0.29, 2]) for (const hitAge of [0, 0.03, 0.2, 0.5, Infinity]) for (const landAge of [0, 0.1, Infinity]) for (const specialAge of [0, 0.3, Infinity])
  evs.push({ launchAge, hitAge, hitDir: hitAge > 0.1 ? -1 : 1, landAge, specialAge });
const copy = o => ({ sx: o.sx, sy: o.sy, rot: o.rot, dx: o.dx, dy: o.dy });
const inBounds = (p, label) => {
  for (const k of ['sx', 'sy']) assert(p[k] >= 0.92 - 1e-12 && p[k] <= 1.08 + 1e-12, `${label} ${k}=${p[k]}`);
  for (const k of ['rot', 'dx', 'dy']) assert(Number.isFinite(p[k]), `${label} ${k}`);
};
let checks = 0;
for (const rm of [false, true]) for (const st of states) for (let t = 0; t < 6; t += 0.037) for (const ev of evs.filter((_, i) => i % 7 === Math.round(t * 100) % 7)) {
  const a = copy(A.hero({}, st, t, ev, rm)), b = copy(A.hero({ junk: 1 }, st, t, ev, rm));
  assert.deepEqual(a, b); inBounds(a, `hero ${st} t=${t}`); checks++;
  if (rm) assert(Math.abs(a.dx) < 1e-9, 'reduced motion: no shake');
}
for (const type of A.CAST_ORDER) {
  assert(A.CAST_STYLE[type], type);
  for (const rm of [false, true]) for (const ready of [false, true]) for (const rec of [0, 0.05, 0.2, 0.49, Infinity]) for (let t = 0; t < 5; t += 0.05) {
    const a = copy(A.cast({}, type, t, ready, rec, rm)); assert.deepEqual(a, copy(A.cast({}, type, t, ready, rec, rm)));
    inBounds(a, `cast ${type}`); checks++;
    if (rm) { assert.equal(a.rot, 0); assert.equal(a.dx, 0); }
  }
}
for (const st of states) for (let t = 0; t < 3; t += 0.03) for (const la of [-1, 0, 0.2, 0.6]) {
  const a = copy(A.truck({}, st, t, la, false)); assert.deepEqual(a, copy(A.truck({}, st, t, la, false)));
  assert.equal(a.sx, 1); assert.equal(a.sy, 1); assert(Math.abs(a.dx) <= 14 && Math.abs(a.dy) <= 6); checks++;
  assert.deepEqual(copy(A.truck({}, st, t, la, true)), { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 });
}
for (let i = 0; i < 6; i++) { const d = A.dust({}, i, 6, 0.2, 1); assert.deepEqual(d, A.dust({}, i, 6, 0.2, 1)); assert.equal(A.dust({}, i, 6, 0.45, 1).alpha, 0); }
// Uniform-or-bounded: squash keeps sx * sy close to 1 (volume-ish) and never scales a part separately (one transform).
assert.equal(A.clampScale(0.5), 0.92); assert.equal(A.clampScale(2), 1.08);
// Physics unchanged: same seeds, Graphics.draw every frame (normal + reduced motion), vs the main baseline.
function sim(draw) {
  const out = [];
  for (let seed = 1; seed <= 24; seed++) {
    let s = seed; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const g = new Hop.Game(rnd); g.act(); g.angle = 20 + seed * 2; g.act(); g.power = 0.5 + (seed % 5) / 10; g.act();
    const visual = { launchAt: 0, contactAt: -Infinity, reducedMotion: seed % 3 === 0, readyTargets: [] };
    for (let i = 0; i < 20000 && g.state === 'FLYING'; i++) { g.update(1 / 60); if (seed % 2 && i % 37 === 0) g.act(); if (draw) Hop.Graphics.draw(ctx, g, visual); }
    out.push([g.state, g.finalDistance, g.body.x, g.body.bounces, g.specialSuccesses]);
  }
  return out;
}
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline.json'), 'utf8'));
assert.deepEqual(sim(true), baseline); assert.deepEqual(sim(false), baseline);
console.log(`anim.cjs OK (${checks} pose checks, ${baseline.length} fixed-seed runs identical to baseline)`);
// Kill switch: identity poses.
A.enabled = false;
assert.deepEqual(copy(A.hero({}, 'FLYING', 1, evs[0], false)), { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 });
assert.deepEqual(copy(A.cast({}, 'BOOST', 1, true, 0, false)), { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 });
A.enabled = true;
