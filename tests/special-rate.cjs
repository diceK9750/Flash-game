// 魔法使い (BOOST 爆裂斜光) / 武闘家 (BOUNCE 巨神昇天拳) SPECIAL rate (2026-10-15). Before: eligible whenever the next
// untouched object was the partner (adjacent rule) -> ~36% of their contacts in the fixed-seed sim. Now the same
// adjacency arms it and a gating draw (boostSpecialChance / bounceSpecialChance 0.5) decides -> ~18%. One random()
// only when the adjacency holds and no merchant SPECIAL takes the contact; debugForce skips it; 1 = old game exactly.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const adjacentGateOff = require('./fixtures/adjacent-gate-off.cjs');
const root = path.resolve(__dirname, '..');
function load(gateOff) {
  const scope = {}; scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game']) {
    let src = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
    if (gateOff) src = adjacentGateOff(src, name);
    // JUST! launch (2026-10-15, tests/just-launch.cjs) off so the fingerprint isolates the BOOST/BOUNCE gate.
    if (name === 'config') src = src.replace(/justLaunchEnabled: true,/, 'justLaunchEnabled: false,');
    // Merchant 2026-10-16 (tests/merchant-grand.cjs) pinned to the old values so the fingerprint isolates the gate.
    if (name === 'config') src = adjacentGateOff.merchantOld(src);
    vm.runInContext(src, scope, { filename: name });
  }
  return scope.Hop;
}
const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const TYPES = ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER'];
// Same seeded "active" player as warrior-special.cjs.
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
    lines.push([g.state, g.finalDistance.toFixed(3), g.body.bounces, g.history.map(e => e.label).join(','), g.specialCount, g.specialSuccesses, JSON.stringify(g.merchantStats), draws, f].join('|'));
  }
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}
const now = load(false), old = load(true), c = now.CONFIG;
assert.equal(c.boostSpecialChance, 0.5); assert.equal(c.bounceSpecialChance, 0.5);
assert.equal(old.CONFIG.boostSpecialChance, 1);
// Other characters' knobs untouched.
assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.angleSpecialChance, 0.10); assert.equal(c.merchantChance, 0.20, 'pinned old merchant in this suite');
assert.equal(c.sageCondition, 'foresight');
assert.equal(JSON.stringify(c.specials.BOOST), JSON.stringify({ trigger: 'adjacent', partner: 'BOUNCE', speed: 2000, angle: 45, name: '爆裂斜光' }));
assert.equal(JSON.stringify(c.specials.BOUNCE), JSON.stringify({ trigger: 'adjacent', partner: 'BOOST', speed: 1700, angle: 60, name: '巨神昇天拳' }));
// Unit: draw only when the partner is next; win < chance, lose >= chance; no partner = no draw; gate 1 = no draw.
{
  const mk = (H, r) => { const g = new H.Game(r); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); return g; };
  const hit = (g, type, partner) => { g.objects = [{ x: g.body.x + 5, type, used: false }]; if (partner) g.objects.push({ x: g.body.x + 600, type: partner, used: false }); g.contactObjects({ x: g.body.x, y: g.body.y }); };
  for (const [type, partner, key] of [['BOOST', 'BOUNCE', 'boostSpecialChance'], ['BOUNCE', 'BOOST', 'bounceSpecialChance']]) {
    let draws = 0;
    const win = mk(now, () => { draws++; return c[key] - 1e-9; }); draws = 0; hit(win, type, partner); assert.equal(draws, 1); assert.equal(win.special?.type, type);
    const lose = mk(now, () => { draws++; return c[key]; }); draws = 0; hit(lose, type, partner); assert.equal(draws, 1); assert.equal(lose.special, null, `${type} gated out`);
    const none = mk(now, () => { draws++; return 0; }); draws = 0; hit(none, type, 'BRAKE'); assert.equal(draws, 0); assert.equal(none.special, null, 'adjacency still required');
    const legacy = mk(old, () => { draws++; return 0.99; }); draws = 0; hit(legacy, type, partner); assert.equal(draws, 0); assert.equal(legacy.special?.type, type);
    const forced = mk(now, () => { draws++; return 0.99; }); draws = 0; forced.objects = [{ x: forced.body.x + 5, type, used: false, debugForce: true }, { x: forced.body.x + 600, type: partner, used: false }];
    forced.contactObjects({ x: forced.body.x, y: forced.body.y }); assert.equal(draws, 0); assert.equal(forced.special?.type, type, 'debugForce skips the gate');
  }
}
const PLAYS = 1000, before = rates(old, PLAYS), after = rates(now, PLAYS);
for (const t of ['BOOST', 'BOUNCE']) {
  assert(before.rate[t] > 30 && before.rate[t] < 42, `${t} before ${before.rate[t]}`);
  assert(after.rate[t] > 14 && after.rate[t] < 22, `${t} after ${after.rate[t]}`);
  assert(Math.abs(after.rate[t] / before.rate[t] - 0.5) < 0.1, `${t} halved`);
}
for (const t of TYPES.filter(t => t !== 'BOOST' && t !== 'BOUNCE')) {
  const p = (before.rate[t] + after.rate[t]) / 200, se = 100 * Math.sqrt(p * (1 - p) * (1 / before.enc[t] + 1 / after.enc[t]));
  assert(Math.abs(after.rate[t] - before.rate[t]) <= Math.max(2, 3 * se), `${t} unchanged ${before.rate[t].toFixed(2)} -> ${after.rate[t].toFixed(2)}`);
}
assert.equal(fingerprint(now), '20d0400ca86a5c6f7b3ea76424080be6b52c42299fb78e9418fa576c477211d4', 'new shipped-config fingerprint (gate 0.5)');
const fmt = r => Object.fromEntries(TYPES.map(t => [t, +r.rate[t].toFixed(2)]));
console.log(JSON.stringify({ specialRate: 'PASS', plays: PLAYS, before: fmt(before), after: fmt(after), avgDistanceM: [+before.dist.toFixed(1), +after.dist.toFixed(1)], fingerprint: fingerprint(now) }));
