// Warrior (DASH 戦陣突破) SPECIAL rate (2026-10-13). Before: the SPECIAL needed specialArmed.dash (an earlier
// warrior contact with no BOOST / BOUNCE / STOPPER in between); the 1-per-screen spacing (castRepeatWindow) puts
// the next warrior >= 1400 px later, so it was eligible on ~5% of warrior contacts vs ~34-39% for 魔法使い / 武闘家.
// Now an unarmed warrior contact also draws dashSpecialChance (no draw when armed or when a merchant SPECIAL takes
// the contact). Speed / angle of 戦陣突破 are unchanged. dashSpecialChance 0 reproduces the old game exactly.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(chance) {
  const scope = {}; scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game']) {
    let src = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
    if (name === 'config' && chance !== undefined) { assert(/dashSpecialChance: [\d.]+,/.test(src)); src = src.replace(/dashSpecialChance: [\d.]+,/, `dashSpecialChance: ${chance},`); }
    // Sage condition (2026-10-13d 先見の結界, was guardSpecialChance in 2026-10-13c) off ("none") here so this test
    // isolates the warrior draw (see sage-special.cjs); "none" is identical to the old guardSpecialChance 0.
    if (name === 'config') { assert(/sageCondition: "foresight",/.test(src)); src = src.replace(/sageCondition: "foresight",/, 'sageCondition: "none",'); }
    vm.runInContext(src, scope, { filename: name });
  }
  return scope.Hop;
}
const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const TYPES = ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER'];
// Seeded "active" player (same policy as merchant-rare-cast-spacing.cjs): accept every SPECIAL after 0.25 s, sometimes AERIAL.
function rates(H, plays) {
  const c = H.CONFIG, enc = {}, sp = {}; TYPES.forEach(t => { enc[t] = 0; sp[t] = 0; }); let dist = 0;
  for (let i = 1; i <= plays; i++) {
    const seed = i * 104729 + 1, g = new H.Game(random(seed)), pr = random(seed * 7919 + 13);
    g.act(); g.angle = c.angleMin + (c.angleMax - c.angleMin) * pr(); g.act(); g.power = c.powerMin + (c.powerMax - c.powerMin) * pr(); g.act();
    let t = 0, age = 0, seen = null;
    while (g.state === 'FLYING' && t < 600) {
      g.update(1 / 60); t += 1 / 60;
      if (g.special && g.special !== seen) { seen = g.special; if (!g.special.merchantType) sp[g.special.type]++; }
      if (g.special) { age += 1 / 60; if (age >= 0.25) { g.act(); age = 0; } continue; }
      age = 0; if (g.airborne() && pr() < 0.02) g.act();
    }
    TYPES.forEach(k => { enc[k] += g.counts[k]; }); dist += g.body.x / c.pixelsPerMeter;
  }
  return { rate: Object.fromEntries(TYPES.map(k => [k, 100 * sp[k] / enc[k]])), enc, dist: dist / plays };
}
function animSim(H) {
  const out = [];
  for (let seed = 1; seed <= 24; seed++) {
    let s = seed; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const g = new H.Game(rnd); g.act(); g.angle = 20 + seed * 2; g.act(); g.power = 0.5 + (seed % 5) / 10; g.act();
    for (let i = 0; i < 20000 && g.state === 'FLYING'; i++) { g.update(1 / 60); if (seed % 2 && i % 37 === 0) g.act(); }
    out.push([g.state, g.finalDistance, g.body.x, g.body.bounces, g.specialSuccesses]);
  }
  return out;
}
// Same 160-play fingerprint as debug-kinds.cjs.
function fingerprint(H) {
  const c = H.CONFIG, lines = [];
  for (let seed = 1; seed <= 160; seed++) {
    let draws = 0; const base = random(seed * 31 + 7);
    const g = new H.Game(() => { draws++; return base(); });
    g.act(); g.angle = 15 + (seed * 7) % 55; g.act(); g.power = 0.4 + (seed % 7) * 0.1; g.act();
    let f = 0;
    while (g.state === 'FLYING' && f < 120 * 300) {
      if (g.special && (seed % 3 !== 0)) g.act();
      else if (g.combo && seed % 2) g.act();
      else if (!g.special && !g.combo && f % (97 + seed) === 0 && seed % 4 === 1) g.act();
      g.update(c.physicsStep); f++;
    }
    lines.push([g.state, g.finalDistance.toFixed(3), g.maxHeight.toFixed(3), g.maxSpeed.toFixed(3), g.body.bounces, g.history.map(e => e.label).join(','), g.specialCount, g.specialSuccesses, JSON.stringify(g.merchantStats), draws, f].join('|'));
  }
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}
const now = load(), old = load(0), c = now.CONFIG;
assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.merchantChance, 0.20, 'merchant draw stays 20%');
assert.equal(JSON.stringify(c.specials.DASH), JSON.stringify({ trigger: 'dash', speed: 2000, angle: 25, name: '戦陣突破' }), 'same gain per activation');
assert.equal(c.angleSpecialChance, 0.10);
// Old behaviour reproduced exactly with the chance at 0 (proves every baseline change comes from the warrior draw).
assert.deepEqual(animSim(old), JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline.json'), 'utf8')));
assert.equal(fingerprint(old), '8cfecc1beadfd41906ebe1bf22f525fcf4911817a97b7a78ef8a1b00e212d12a');
assert.deepEqual(animSim(now), JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-warrior.json'), 'utf8')));
// Unit: draw only when unarmed and not taken by a merchant; armed = no draw.
{
  const mk = r => { const g = new now.Game(r); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); return g; };
  const hit = (g, x = 760) => { g.objects = [{ x: g.body.x + 5, type: 'DASH', used: false }]; const prev = { x: g.body.x, y: g.body.y }; g.contactObjects(prev); };
  let draws = 0; const win = mk(() => { draws++; return c.dashSpecialChance - 1e-9; }); draws = 0; hit(win);
  assert.equal(draws, 1); assert.equal(win.special?.type, 'DASH');
  const lose = mk(() => { draws++; return c.dashSpecialChance; }); draws = 0; hit(lose); assert.equal(draws, 1); assert.equal(lose.special, null);
  assert.equal(lose.specialArmed.dash, true, 'arming rule unchanged');
  const armed = mk(() => { draws++; return 0.99; }); armed.specialArmed.dash = true; draws = 0; hit(armed); assert.equal(draws, 0); assert.equal(armed.special?.type, 'DASH');
  const zero = new old.Game(() => { draws++; return 0; }); zero.objects = []; zero.nextObjectX = Infinity; zero.nextBoundaryX = Infinity; zero.act(); zero.act(); zero.act();
  draws = 0; zero.objects = [{ x: zero.body.x + 5, type: 'DASH', used: false }]; zero.contactObjects({ x: zero.body.x, y: zero.body.y }); assert.equal(draws, 0); assert.equal(zero.special, null);
}
// Deterministic sim (1000 fixed-seed plays; the 3000-play measurement is in the README).
const PLAYS = 1000, before = rates(old, PLAYS), after = rates(now, PLAYS);
const band = (after.rate.BOOST + after.rate.BOUNCE) / 2;
assert(Math.abs(after.rate.DASH - band) <= 3, `warrior ${after.rate.DASH.toFixed(2)} vs witch/fighter ${band.toFixed(2)}`);
assert(before.rate.DASH < 10, 'was low before');
// Other characters: rules untouched; their rates move only by sampling (later encounters differ after a warrior
// SPECIAL), so allow 3 standard errors of the difference (at least 2 pp).
for (const t of TYPES.filter(t => t !== 'DASH')) {
  const p = (before.rate[t] + after.rate[t]) / 200, se = 100 * Math.sqrt(p * (1 - p) * (1 / before.enc[t] + 1 / after.enc[t]));
  assert(Math.abs(after.rate[t] - before.rate[t]) <= Math.max(2, 3 * se), `${t} unchanged ${before.rate[t].toFixed(2)} -> ${after.rate[t].toFixed(2)}`);
}
const fmt = r => Object.fromEntries(TYPES.map(t => [t, +r.rate[t].toFixed(2)]));
console.log(JSON.stringify({ warriorSpecial: 'PASS', plays: PLAYS, before: fmt(before), after: fmt(after), avgDistanceM: [+before.dist.toFixed(1), +after.dist.toFixed(1)], newFingerprint: fingerprint(now) }));
