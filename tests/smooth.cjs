// Smooth display (Hop.Smooth + Graphics.smooth): render interpolation, spring camera, eased tilt, pose / sprite
// cross-fades and the extra ambient motion are display only. Fixed-seed distances must equal the physics baseline
// of main 2f4d0af (fixtures/anim-physics-baseline-sage.json); easing is continuous; the camera spring does not
// overshoot; pose transitions blend; interpolation stays between physics steps.
const adjacentGateOff = require('./fixtures/adjacent-gate-off.cjs');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load() {
  const ctx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (o, k, v) => (o[k] = v, true) });
  const element = () => ({ setAttribute() {}, textContent: '', hidden: false, style: {}, addEventListener() {}, getContext: ctx });
  const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope;
  vm.createContext(scope);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(adjacentGateOff(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), n), scope, { filename: n });
  return { Hop: scope.Hop, ctx: ctx() };
}
const { Hop, ctx } = load(), S = Hop.Smooth, G = Hop.Graphics, c = Hop.CONFIG;
assert.equal(G.smooth, false, 'smooth display is opt-in (main.js); geometry tests keep the raw camera');
assert(/Hop\.Graphics\.smooth = true/.test(fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8')), 'main.js enables it in the browser game');
const rndOf = seed => { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
// 1. Physics identical: baseline seeds, smooth draw every frame (jittered dt), vs the 2f4d0af fixture and vs no draw.
function sim(draw, jitter) {
  G.smooth = draw; const out = [], traj = [];
  for (let seed = 1; seed <= 24; seed++) {
    const g = new Hop.Game(rndOf(seed)); g.act(); g.angle = 20 + seed * 2; g.act(); g.power = 0.5 + (seed % 5) / 10; g.act();
    const visual = { launchAt: 0, contactAt: -Infinity, reducedMotion: seed % 3 === 0, readyTargets: [] }, jr = rndOf(seed + 99);
    for (let i = 0; i < 20000 && g.state === 'FLYING'; i++) {
      g.update(jitter ? 1 / 60 + (jr() - 0.5) * 0.006 : 1 / 60); if (seed % 2 && i % 37 === 0) g.act();
      if (draw) G.draw(ctx, g, visual);
      if (seed === 5) traj.push(g.body.x, g.body.y);
    }
    out.push([g.state, g.finalDistance, g.body.x, g.body.bounces, g.specialSuccesses]);
  }
  G.smooth = false; return { out, traj };
}
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-sage.json'), 'utf8'));
assert.deepEqual(sim(true, false).out, baseline, 'smooth draw: distances == main 2f4d0af baseline');
const a = sim(true, true), b = sim(false, true);
assert.deepEqual(a.out, b.out); assert.deepEqual(a.traj, b.traj); // per-update trajectory identical too
// 2. Interpolation: displayed position lies on the segment between the previous and current physics step,
// and is the body itself outside FLYING.
{
  G.smooth = true;
  const g = new Hop.Game(rndOf(7)); g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act(); g.skipLaunchCutin?.();
  const visual = { launchAt: 0, contactAt: -Infinity, reducedMotion: false, readyTargets: [] };
  let checked = 0;
  for (let i = 0; i < 400 && g.state === 'FLYING'; i++) {
    g.update(0.0069 + (i % 3) * 0.001); G.draw(ctx, g, visual);
    const d = S.cache.get(visual), lo = Math.min(g.renderPrevX, g.body.x) - 1e-9, hi = Math.max(g.renderPrevX, g.body.x) + 1e-9;
    assert(d.bx >= lo && d.bx <= hi, 'interpolated x between steps'); assert(g.renderAlpha >= 0 && g.renderAlpha <= 1); checked++;
    assert(Number.isFinite(G.lastDisplay.camX) && Number.isFinite(G.lastDisplay.heroX));
  }
  assert(checked > 100);
  const r = new Hop.Game(rndOf(3)); r.update(0.016); G.draw(ctx, r, { launchAt: -Infinity, contactAt: -Infinity, readyTargets: [] });
  G.smooth = false;
}
// 3. Easing functions: continuous (small step -> small change), 0 -> 0, 1 -> 1, monotone where intended.
for (const f of ['smoothstep', 'easeInOutCubic', 'easeOutCubic']) {
  assert.equal(S[f](0), 0); assert.equal(S[f](1), 1); assert.equal(S[f](-1), 0); assert.equal(S[f](2), 1);
  let prev = S[f](0);
  for (let u = 0.001; u <= 1.0001; u += 0.001) { const v = S[f](u); assert(Math.abs(v - prev) < 0.004, `${f} continuous at ${u}`); assert(v >= prev - 1e-12, `${f} monotone`); prev = v; }
}
{ // Landing settle: starts at 1, overshoots below 0 (stretch), continuous and exactly 0 at / after 0.5 s.
  const A = Hop.Anim; assert.equal(A.settle(0), 1); assert.equal(A.settle(0.5), 0); assert.equal(A.settle(3), 0);
  let prev = 1, min = 1;
  for (let t = 0.001; t <= 0.6; t += 0.001) { const v = A.settle(t); assert(Math.abs(v - prev) < 0.03, 'settle continuous'); prev = v; min = Math.min(min, v); }
  assert(min < -0.05 && min > -0.5, 'one bounded overshoot');
}
// 4. Camera spring: critically damped -> from rest no overshoot past the target; stable for any dt (tab return).
for (const w of [S.CAM_W, S.CAM_WY]) for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.1]) {
  const st = { x: 0, xV: 0 }; let max = 0;
  for (let t = 0; t < 3; t += dt) { S.spring(st, 'x', 500, w, dt); max = Math.max(max, st.x); }
  assert(max <= 500 + 1e-6, `no overshoot w=${w} dt=${dt}`); assert(Math.abs(st.x - 500) < 1, 'converges');
}
{ // Moving target then stop (hero landing): overshoot bounded by a few px.
  const st = { x: 0, xV: 0 }; let target = 0, max = 0;
  for (let i = 0; i < 300; i++) { if (i < 120) target += 1500 / 60; S.spring(st, 'x', target, S.CAM_W, 1 / 60); max = Math.max(max, st.x); }
  assert(max - target <= 0.2 * 1500 / S.CAM_W, `bounded overshoot ${max - target}`);
}
// 5. Pose transitions blend (~120 ms) instead of snapping, and wrap rotation the short way.
{
  const d = { time: 0, blendAt: 0, from: { sx: 0.92, sy: 1.08, rot: Math.PI * 2 - 0.1, dx: 4, dy: -2 }, last: {} };
  const pose = t => { d.time = t; return S.blendPose(d, { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 }, 'RESULT'); };
  const p0 = pose(0); assert(Math.abs(p0.sx - 0.92) < 1e-9 && Math.abs(p0.rot + 0.1) < 1e-9, 'starts from the previous pose (rotation wrapped)');
  const mid = pose(S.BLEND / 2); assert(mid.sx > 0.92 && mid.sx < 1);
  assert.deepEqual(pose(S.BLEND), { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 });
  assert(S.BLEND >= 0.08 && S.BLEND <= 0.15 && S.FADE >= 0.08 && S.FADE <= 0.15);
  let prev = pose(0).sx; for (let t = 0.001; t <= S.BLEND; t += 0.001) { const v = pose(t).sx; assert(Math.abs(v - prev) < 0.003, 'pose blend continuous'); prev = v; }
}
// 6. Draw-level: state change READY -> FLYING blends the hero pose; no snap in displayed tilt across an impulse.
{
  G.smooth = true;
  const g = new Hop.Game(rndOf(11)); const visual = { launchAt: -Infinity, contactAt: -Infinity, reducedMotion: false, readyTargets: [] };
  g.update(1 / 60); G.draw(ctx, g, visual); g.act(); g.update(1 / 60); G.draw(ctx, g, visual);
  const d = S.cache.get(visual); assert.equal(d.state, 'AIM_ANGLE'); assert(d.blendAt > -Infinity, 'state change starts a blend');
  g.angle = 45; g.act(); g.power = 1; g.act(); g.skipLaunchCutin?.(); visual.launchAt = g.phaseTime;
  let maxStep = 0, prev = null;
  for (let i = 0; i < 600 && g.state === 'FLYING'; i++) { g.update(1 / 60); if (i === 30) g.act(); G.draw(ctx, g, visual); if (prev !== null) maxStep = Math.max(maxStep, Math.abs(d.rot - prev)); prev = d.rot; }
  assert(maxStep < 0.2, `tilt eased (max per-frame change ${maxStep.toFixed(3)} rad)`);
  // Reduced motion: no tilt, no lookahead, no drift.
  visual.reducedMotion = true; G.draw(ctx, g, visual); assert.equal(S.cache.get(visual).rm, true);
  G.smooth = false;
}
// 7. Roadside reaction weight: bounded, 0 far away / high up, continuous in distance.
{
  assert.equal(S.near(-500, 0), 0); assert.equal(S.near(0, 400), 0); assert.equal(Math.abs(S.near(0, 0)), 0); assert(S.near(-60, 0) > 0.3 && S.near(60, 0) < -0.3);
  let prev = S.near(-430, 50);
  for (let dx = -429; dx <= 430; dx++) { const v = S.near(dx, 50); assert(Math.abs(v) <= 1); assert(Math.abs(v - prev) < 0.03, `near continuous at ${dx}`); prev = v; }
  const p = Hop.Anim.cast({}, 'BOOST', 1, false, Infinity, false, 1); assert(p.sx >= 0.92 && p.sx <= 1.08 && p.sy >= 0.92 && p.sy <= 1.08);
  assert.deepEqual(Hop.Anim.cast({}, 'BOOST', 1, false, Infinity, true, 1), Hop.Anim.cast({}, 'BOOST', 1, false, Infinity, true, 0), 'reduced motion ignores near');
}
console.log('smooth.cjs OK (physics == 2f4d0af baseline with smooth draw, interpolation bounded, easing continuous, spring no overshoot, pose blend, tilt eased, reactions bounded)');
