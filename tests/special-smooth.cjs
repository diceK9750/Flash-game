// SPECIAL presentation smoothing (2026-10-15, display only): continuous cut-in envelopes, eased band exit,
// continuous (non-stepped) combo shake, blended combo camera at the fighter eruption, label pop / fade,
// pose cross-fades, combo smear, sub-step scene clock. Checks:
//  1) game results for every DEBUG kind + normal play (watch / skip / short / plain) identical to the f87b758
//     baseline (tests/fixtures/special-smooth-baseline-f87b758.json): distances, heights, labels, SPECIAL counts,
//     number of steps until RESULT (game-time freeze unchanged) and a trajectory fingerprint;
//  2) easing continuity: no per-frame (1/60 s) jump above a threshold in the cut-in / camera / shake / labels;
//  3) uniform scale only; 4) skip and reduced motion unchanged; 5) full smooth draw of every SPECIAL never throws.
// Run: node tests/special-smooth.cjs   (regenerate the fixture: node tests/special-smooth.cjs --baseline <old js dir>)
const adjacentGateOff = require('./fixtures/adjacent-gate-off.cjs');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'special-smooth-baseline-f87b758.json');
const calls = [];
const ctxProxy = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) :
  k === 'measureText' ? () => ({ width: 100 }) : k === 'scale' ? (x, y) => calls.push(['scale', x, y]) : () => {}, set: (o, k, v) => (o[k] = v, true) });
function load(jsDir) {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { setAttribute(k, v) { this[k] = v; }, textContent: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext: ctxProxy }); return elements.get(id); };
  const store = {};
  const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
  scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(adjacentGateOff(fs.readFileSync(path.join(jsDir, name + '.js'), 'utf8'), name).replace(/typeCTempo: \d+,/, 'typeCTempo: 1,'), scope, { filename: name }); // baseline counts the x1 Type C ride (cycle 32)
  scope.Hop.Graphics.smooth = false;
  return scope.Hop;
}
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const KINDS = [null, 'all', 'boost', 'bounce', 'dash', 'stopper', 'brake', 'angle', 'guard', 'merchant-a', 'merchant-b', 'merchant-c', 'merchant-d'];
const MODES = ['watch', 'skip', 'short', 'plain'];
const CASES = [];
for (const kind of KINDS) for (let seed = 1; seed <= (kind ? 3 : 10); seed++) CASES.push({ seed, kind, angle: 18 + (seed * 11) % 47, power: 0.55 + (seed % 5) * 0.1 });
function play(Hop, { seed, kind, angle, power }, mode, draw = null) {
  const c = Hop.CONFIG, g = new Hop.Game(rng(seed));
  if (kind) g.setDebugKind(kind);
  g.tempoEnabled = mode !== 'plain'; g.comboShort = mode === 'short'; g.launchCutinEnabled = mode !== 'plain';
  g.act(); g.angle = angle; g.act(); g.power = power; g.act();
  let steps = 0, fp = 0, combos = 0, seen = null;
  while (g.state === 'FLYING' && steps++ < 60 * 240) {
    if (g.special && g.special.remaining <= c.specialWindow - 0.3 + 1e-9) g.act();
    if (g.combo && g.combo !== seen) { seen = g.combo; combos++; }
    if (mode === 'skip' && (g.combo?.elapsed > 0.9 || g.launchCutin?.elapsed > 0.4)) g.act();
    g.update(1 / 60);
    if (draw) draw(g);
    if (steps % 30 === 0) fp = (Math.imul(fp ^ Math.round(g.body.x * 10), 16777619) ^ Math.round(g.body.y * 10)) >>> 0;
  }
  return { state: g.state, x: Math.round(g.body.x * 1000) / 1000, d: g.finalDistance, h: g.maxHeight, labels: g.history.map(x => x.label).join(','), specials: g.specialSuccesses, steps, fp, combos };
}
if (process.argv[2] === '--baseline') {
  const Old = load(path.resolve(process.argv[3]));
  fs.writeFileSync(FIXTURE, JSON.stringify(CASES.flatMap(k => MODES.map(mode => ({ ...k, mode, ...play(Old, k, mode) }))), null, 0).replace(/\},\{/g, '},\n{') + '\n');
  console.log('wrote', FIXTURE); process.exit(0);
}
const Hop = load(path.join(root, 'js')), c = Hop.CONFIG, G = Hop.Graphics;
let checks = 0;
// 1) Identical results (also with the smooth display drawing every frame, reduced motion on and off).
{
  const base = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(base.length, CASES.length * MODES.length);
  for (const b of base) {
    const { seed, kind, angle, power, mode } = b, got = play(Hop, { seed, kind, angle, power }, mode);
    for (const key of ['state', 'x', 'd', 'h', 'labels', 'specials', 'steps', 'fp', 'combos']) assert.deepEqual(got[key], b[key], `${kind}/${seed}/${mode} ${key}`);
  }
  G.smooth = true;
  for (const b of base.filter((x, i) => i % 7 === 0)) {
    for (const rm of [false, true]) {
      const ctx = ctxProxy(), visual = { launchAt: -Infinity, contactAt: -Infinity, readyTargets: [], reducedMotion: rm };
      const got = play(Hop, b, b.mode, g => G.draw(ctx, g, visual));
      for (const key of ['state', 'x', 'd', 'h', 'labels', 'specials', 'steps', 'fp']) assert.deepEqual(got[key], b[key], `smooth draw ${b.kind}/${b.seed}/${b.mode}/rm=${rm} ${key}`);
    }
  }
  G.smooth = false; checks++;
}
// 2) Continuity. Frame = 1/60 s; the hit frames (cut-in impact at age 0, fighter uppercut, witch blast) are the
// only allowed discontinuities (deliberate anime hit frames: flash / shake onset).
const FRAME = 1 / 60, CAM_MAX = 60;
const maxJump = (fn, t0, t1, keys, h = FRAME, skip = () => false) => {
  const out = {}; let prev = fn(t0);
  for (let t = t0 + h; t <= t1 + 1e-9; t += h) { const cur = fn(t); for (const k of keys) { const d = Math.abs(cur[k] - prev[k]); if (!skip(t) && !(d <= (out[k] ?? 0))) out[k] = d; } prev = cur; }
  return out;
};
{
  for (const strong of [false, true]) {
    const j = maxJump(a => G.specialCutinStyle(a, false, strong), 0, c.specialCutinDuration - 0.02, ['wipe', 'alpha', 'flash', 'portraitPop', 'slide']);
    assert(j.flash < 0.12, 'cut-in flash continuous ' + j.flash); assert(j.alpha < 0.12, 'cut-in alpha ' + j.alpha);
    assert(j.wipe < 0.2, 'cut-in wipe ' + j.wipe); assert(j.portraitPop < 0.03, 'cut-in pop ' + j.portraitPop); assert(j.slide < 0.12, 'slide ' + j.slide);
    // shake envelope: continuous at sub-frame scale (no 60 Hz stepping)
    const fine = maxJump(a => G.specialCutinStyle(a, false, strong), 0.001, 0.4, ['shakeX', 'shakeY'], 1 / 2000);
    assert(fine.shakeX < 0.5 && fine.shakeY < 0.5, 'cut-in shake sub-frame ' + JSON.stringify(fine));
    const end = G.specialCutinStyle(c.specialCutinDuration - 1e-4, false, strong); assert(end.alpha < 0.01, 'fades to 0');
  }
  // covering / reduced unchanged
  const S = G.comboSceneStart(false);
  assert.equal(S, c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold);
  assert.deepEqual({ ...G.specialCutinStyle(0.1, true) }, { visible: true, alpha: 1, wipe: 1, portraitPop: 1, shakeX: 0, shakeY: 0, flash: 0, slide: 0 });
  assert.equal(G.specialCutinStyle(c.specialCutinReducedDuration + 0.01, true).visible, false);
  checks++;
}
const scene = (type, partner, opts = {}) => {
  const g = new Hop.Game(rng(3)); g.comboShort = !!opts.short;
  g.act(); g.act(); g.act(); g.launchCutin = null;
  Object.assign(g.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
  const a = type === 'BOUNCE' ? 'BOUNCE' : 'BOOST', b = a === 'BOUNCE' ? 'BOOST' : 'BOUNCE';
  g.objects = [{ x: 1230, type: a, used: false }, { x: 1700, type: b, used: false }]; g.nextObjectX = g.nextBoundaryX = Infinity;
  g.contactObjects({ x: 1100, y: 30 }); assert(g.special?.type === a); g.act(); assert(g.combo?.type === a);
  return g;
};
{
  const ground = c.groundY, sx = x => c.launchX + x - 1000, sy = y => ground - c.playerRadius - y;
  for (const type of ['BOOST', 'BOUNCE']) {
    const g = scene(type), S = G.comboSceneStart(false), total = g.combo.total;
    // camera: on-screen motion of the hero point and the two screen corners under the combo camera
    const d = { time: 0, rm: false }; // drawn camera = spring-follow (camSpring) of the pure comboCamera target
    const cam = t => { g.combo.elapsed = S + t; d.time = t; const st = G.comboState(g), m = G.camSpring(d, G.comboCamera(st, false, sx, sy, ground, sx(1200), sy(30)), st), P = (x, y) => [m.ax + m.z * (x - m.fx), m.ay + m.z * (y - m.fy)];
      const h = P(sx(1200), sy(30)), a = P(0, 0), b = P(c.width, c.height); return { hx: h[0], hy: h[1], ax: a[0], ay: a[1], bx: b[0], by: b[1], z: m.z }; };
    const j = maxJump(cam, 0, total - S - 0.01, ['hx', 'hy', 'ax', 'ay', 'bx', 'by', 'z']);
    assert(j.z < 0.16, type + ' camera zoom per frame ' + j.z);
    assert(Math.max(j.hx, j.hy) < CAM_MAX && Math.max(j.ax, j.ay, j.bx, j.by) < CAM_MAX * 2, type + ' camera motion per frame ' + JSON.stringify(j));
    // shake is a continuous function of time (non-stepped) except the deliberate hit onset
    const F = c.comboFighterTimes, W = c.comboWitchTimes, hitT = type === 'BOUNCE' ? [F.upper, F.upper + F.hitstop, F.rise, F.gone, F.crouch] : [W.blast, W.rushEnd, W.rushEnd + 0.12, W.dash];
    const imp = t => { g.combo.elapsed = S + t; return G.comboImpact(G.comboState(g), false); };
    const fine = maxJump(imp, 0, total - S - 0.01, ['x', 'y'], 1 / 2400, t => hitT.some(h => Math.abs(t - h) < 2 / 2400));
    assert(fine.x < 0.8 && fine.y < 0.8, type + ' shake not stepped ' + JSON.stringify(fine));
    const blank = G.comboImpact(Object.assign(G.comboState(g), { short: true }), false); assert(blank.x === 0 && blank.flash === 0);
  }
  // labels: pop in / fade out continuously, uniform scale only (one scale value), back to 1
  const lj = maxJump(t => G.labelLife(t, 0, 0.6), 0, 0.6, ['a', 's']);
  assert(lj.a < 0.3 && lj.s < 0.2, 'label envelope ' + JSON.stringify(lj));
  assert(G.labelLife(-0.01, 0, 1).a === 0 && Math.abs(G.labelLife(0.4, 0, 1).s - 1) < 1e-9 && G.labelLife(1, 0, 1).a < 1e-9);
  checks++;
}
// 3) Uniform scale: every actor scale is one number; every ctx.scale in the SPECIAL draws has |sx| == |sy|
// except the flat magic-circle ellipse (ground decal, not a character) and the facing mirror (-1, 1).
{
  G.smooth = true; const Sp = Hop.Sprites, orig = Sp.drawCastScaled, seen = [];
  Sp.drawCastScaled = function (ctx, id, x, feet, pose, mul, opts) { seen.push(mul); return orig.apply(this, arguments); };
  for (const type of ['BOOST', 'BOUNCE']) {
    const g = scene(type), visual = { launchAt: -Infinity, contactAt: -Infinity, readyTargets: [], reducedMotion: false };
    while (g.combo) { calls.length = 0; G.draw(ctxProxy(), g, visual); for (const [, x, y] of calls) assert(Math.abs(Math.abs(x) - Math.abs(y)) < 1e-9 || (x === 1 && y === 0.32), `uniform scale ${x},${y}`); g.update(1 / 60); }
  }
  for (const m of seen) assert(typeof m === 'number' && m > 0);
  for (const type of ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER']) for (let a = 0; a < 0.7; a += FRAME) { calls.length = 0; G.contactEffect(ctxProxy(), type, 100, 100, a); for (const [, x, y] of calls) assert.equal(x, y); }
  Sp.drawCastScaled = orig; G.smooth = false; checks++;
}
// 4) Skip and reduced motion: tap ends the scene at once; nothing smooth survives the skip; short versions unchanged.
{
  G.smooth = true;
  for (const type of ['BOOST', 'BOUNCE']) {
    const g = scene(type); g.update(0.5); assert(g.combo); g.act(); assert.equal(g.combo, null); assert(g.comboAfter?.skipped);
    const st = G.comboState(g); assert(st.skipped);
    assert.equal(G.comboCamera(st, false, x => x, y => y, 600, 0, 0).w, 0, 'skip: no zoom');
    const r = scene(type, null, { short: true }); assert(r.combo.short); assert.equal(G.comboImpact(G.comboState(r), false).x, 0);
    const visual = { launchAt: -Infinity, contactAt: -Infinity, readyTargets: [], reducedMotion: true };
    while (r.combo) { G.draw(ctxProxy(), r, visual); r.update(1 / 60); }
  }
  // sub-step clock never runs past the scene and is 0 when the smooth display is off
  { const g = scene('BOUNCE'); g.accumulator = 0.004; assert(G.subStep(g) > 0 && G.subStep(g) <= c.physicsStep); G.smooth = false; assert.equal(G.subStep(g), 0); G.smooth = true; }
  G.smooth = false; checks++;
}
console.log(JSON.stringify({ specialSmooth: 'PASS', checks, baselineCases: CASES.length * MODES.length }));
