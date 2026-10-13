// Sage (GUARD 聖護結界) SPECIAL rate (2026-10-13c). Before: eligible only when normalGuard was still held at the
// sage contact, i.e. GUARD then GUARD with no other contact between (every contact clears normalGuard); the
// 1-per-screen spacing (castRepeatWindow) made that ~1.8% of sage contacts. Now a sage contact that is not eligible
// also draws guardSpecialChance (no draw while 聖護結界 is active or when a merchant SPECIAL takes the contact).
// 聖護結界 itself (10 s STOPPER block) is unchanged. guardSpecialChance 0 reproduces the warrior-fix game exactly.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(chance) {
  const scope = {}; scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game']) {
    let src = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
    if (name === 'config' && chance !== undefined) { assert(/guardSpecialChance: [\d.]+,/.test(src)); src = src.replace(/guardSpecialChance: [\d.]+,/, `guardSpecialChance: ${chance},`); }
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
assert.equal(c.guardSpecialChance, 0.13); assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.merchantChance, 0.20, 'merchant draw stays 20%');
assert.equal(JSON.stringify(c.specials.GUARD), JSON.stringify({ trigger: 'guard', name: '聖護結界' }));
assert.equal(c.guardSpecialDuration, 10.0, 'same effect per activation'); assert.equal(c.angleSpecialChance, 0.10);
// Old (warrior-fix) behaviour reproduced exactly with the chance at 0.
assert.deepEqual(animSim(old), JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-warrior.json'), 'utf8')));
assert.equal(fingerprint(old), 'bd3ce7876ece75a432333172e6940557398cff0bc32ab6428f852ca1fd86dcdd');
assert.deepEqual(animSim(now), JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-sage.json'), 'utf8')));
// Unit: draw only when not eligible, no 聖護結界 active, no merchant; held GUARD = no draw.
{
  const mk = r => { const g = new now.Game(r); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); return g; };
  const hit = g => { g.objects = [{ x: g.body.x + 5, type: 'GUARD', used: false }]; g.contactObjects({ x: g.body.x, y: g.body.y }); };
  let draws = 0;
  const win = mk(() => { draws++; return c.guardSpecialChance - 1e-9; }); draws = 0; hit(win); assert.equal(draws, 1); assert.equal(win.special?.type, 'GUARD');
  const lose = mk(() => { draws++; return c.guardSpecialChance; }); draws = 0; hit(lose); assert.equal(draws, 1); assert.equal(lose.special, null);
  assert.equal(lose.normalGuard, 1, 'normal GUARD contact unchanged');
  const held = mk(() => { draws++; return 0.99; }); held.normalGuard = 1; draws = 0; hit(held); assert.equal(draws, 0); assert.equal(held.special?.type, 'GUARD');
  const active = mk(() => { draws++; return 0; }); active.guardSpecial = { active: true, remaining: 5 }; draws = 0; hit(active); assert.equal(draws, 0); assert.equal(active.special, null);
  const zero = new old.Game(() => { draws++; return 0; }); zero.objects = []; zero.nextObjectX = Infinity; zero.nextBoundaryX = Infinity; zero.act(); zero.act(); zero.act();
  draws = 0; zero.objects = [{ x: zero.body.x + 5, type: 'GUARD', used: false }]; zero.contactObjects({ x: zero.body.x, y: zero.body.y }); assert.equal(draws, 0); assert.equal(zero.special, null);
}
const PLAYS = 1000, before = rates(old, PLAYS), after = rates(now, PLAYS);
assert(after.rate.GUARD >= 10 && after.rate.GUARD <= 17, `sage ${after.rate.GUARD.toFixed(2)}`);
assert(before.rate.GUARD < 5, 'was low before');
for (const t of TYPES.filter(t => t !== 'GUARD')) {
  const p = (before.rate[t] + after.rate[t]) / 200, se = 100 * Math.sqrt(p * (1 - p) * (1 / before.enc[t] + 1 / after.enc[t]));
  assert(Math.abs(after.rate[t] - before.rate[t]) <= 3 * se, `${t} unchanged ${before.rate[t].toFixed(2)} -> ${after.rate[t].toFixed(2)} (3se ${(3 * se).toFixed(2)})`);
}
const fmt = r => Object.fromEntries(TYPES.map(t => [t, +r.rate[t].toFixed(2)]));
console.log(JSON.stringify({ sageSpecial: 'PASS', plays: PLAYS, before: fmt(before), after: fmt(after), avgDistanceM: [+before.dist.toFixed(1), +after.dist.toFixed(1)], newFingerprint: fingerprint(now) }));
