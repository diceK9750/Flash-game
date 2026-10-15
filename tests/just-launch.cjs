// JUST! launch (2026-10-15): power >= justPowerMin and |angle - justAngleCenter| <= justAngleHalfWidth at the launch
// tap multiplies the launch speed by justLaunchMultiplier, queues a "JUST" fx (SE + pop near the hero) and marks the
// launch cut-in (cut.just -> "JUST!" text). Disabled (justLaunchEnabled false) = the old game exactly; SPECIAL rules
// untouched. Distance effect per policy is measured in /workspace/truckcrash/rank_rate_20261015/sim.cjs (README).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const adjacentGateOff = require('./fixtures/adjacent-gate-off.cjs');
const root = path.resolve(__dirname, '..');
function load(patch = s => s) {
  const scope = {}; scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game', 'audio']) {
    let src = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
    if (name === 'config') src = patch(src);
    vm.runInContext(src, scope, { filename: name });
  }
  return scope.Hop;
}
const H = load(), c = H.CONFIG, G = H.Game;
const OFF = load(src => src.replace(/justLaunchEnabled: true,/, 'justLaunchEnabled: false,'));
assert.equal(c.justLaunchEnabled, true); assert.equal(c.justPowerMin, 0.97); assert.equal(c.justAngleCenter, 42);
assert.equal(c.justAngleHalfWidth, 3); assert.equal(c.justLaunchMultiplier, 1.15);
assert(c.justLaunchMultiplier >= 1.10 && c.justLaunchMultiplier <= 1.20, 'modest boost');
// SPECIAL knobs unchanged.
assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.boostSpecialChance, 0.5); assert.equal(c.bounceSpecialChance, 0.5);
assert.equal(c.angleSpecialChance, 0.10); assert.equal(c.merchantChance, 0.20);
// Window edges.
for (const [a, p, want] of [[42, 1, true], [39, 0.97, true], [45, 0.97, true], [38.99, 1, false], [45.01, 1, false], [42, 0.9699, false], [42, 0.5, false]])
  assert.equal(G.isJust(a, p), want, `${a}° ${p}`);
assert.equal(OFF.Game.isJust(42, 1), false, 'disabled');
// Launch: speed x multiplier, fx queued, cut-in marked; miss = normal launch, no fx.
function launch(Hop, angle, power, cutin = false) {
  const g = new Hop.Game(() => 0.5); g.launchCutinEnabled = cutin; g.act(); g.act(); g.angle = angle; g.power = power; g.act(); return g;
}
const hit = launch(H, 42, 1), miss = launch(H, 42, 0.96), off = launch(OFF, 42, 1);
assert.equal(hit.justLaunch, true); assert.equal(miss.justLaunch, false); assert.equal(off.justLaunch, false);
assert(Math.abs(Math.hypot(hit.body.vx, hit.body.vy) - c.launchSpeed * 1 * c.justLaunchMultiplier) < 1e-9);
assert(Math.abs(Math.hypot(off.body.vx, off.body.vy) - c.launchSpeed) < 1e-9);
assert(Math.abs(Math.atan2(hit.body.vy, hit.body.vx) * 180 / Math.PI - 42) < 1e-9, 'angle unchanged');
assert.equal(JSON.stringify(hit.fxEvents.map(e => e.kind)), '["JUST"]'); assert.equal(miss.fxEvents.length, 0); assert.equal(off.fxEvents.length, 0);
assert.equal(launch(H, 42, 1, true).launchCutin?.just, true); assert.equal(launch(H, 42, 0.5, true).launchCutin?.just, false);
// RETRY clears the flag.
hit.reset(); assert.equal(hit.justLaunch, false);
// Disabled game is bit-identical to a game whose config never had the feature (same random draws, same result).
function run(Hop, angle, power) {
  let s = 12345, draws = 0; const g = new Hop.Game(() => { draws++; return ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); });
  g.act(); g.act(); g.angle = angle; g.power = power; g.act();
  for (let i = 0; i < 60 * 300 && g.state === 'FLYING'; i++) { if (g.special) g.act(); g.update(1 / 60); }
  return [g.finalDistance, g.body.bounces, g.history.length, draws];
}
// The fixture used by the historical baselines disables the feature.
assert.equal(load(src => adjacentGateOff(src, 'config')).CONFIG.justLaunchEnabled, false);
assert.equal(JSON.stringify(run(H, 42, 0.9)), JSON.stringify( run(load(s => s.replace(/justLaunchMultiplier: [\d.]+,/, 'justLaunchMultiplier: 1,')), 42, 0.9)), 'outside the window nothing changes');
const far = run(H, 42, 1)[0], plain = run(OFF, 42, 1)[0];
assert(Number.isFinite(far) && Number.isFinite(plain));
// SE: crisp recipe exists, valid voices, stays under the shared cap (render scales peaks to specialPeakCap).
const A = H.Audio, rec = A.fxRecipes.JUST;
assert(rec?.length >= 2); assert(A.peakSum(rec) > 0 && A.peakSum(rec) <= 0.3);
for (const v of rec) assert(['tone', 'noise'].includes(v[0]) && v.length === 8);
console.log(JSON.stringify({ justLaunch: 'PASS', window: { powerMin: c.justPowerMin, angle: [c.justAngleCenter - c.justAngleHalfWidth, c.justAngleCenter + c.justAngleHalfWidth] }, multiplier: c.justLaunchMultiplier, sample: { just: +far.toFixed(1), off: +plain.toFixed(1) } }));
