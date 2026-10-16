// 魔法使い (BOOST 爆裂斜光) / 武闘家 (BOUNCE 巨神昇天拳) SPECIAL rate. 2026-10-15 a 0.5 draw after the adjacency rule
// halved it (~36% -> ~18%), but the READY label then lied half the time; 2026-10-16 the draw was abolished (no key, no
// random()) and the rate is halved by placement instead: a witch / fighter right next to its partner is picked with
// weight x castPartnerAdjacentFactor (BOOST 0.15, BOUNCE 0.27). Old placement (fixture) = the pre-2026-10-15 game.
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
    if (name === 'config' && !gateOff) src = adjacentGateOff.merchantOld(src);
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
assert.equal(c.boostSpecialChance, undefined); assert.equal(c.bounceSpecialChance, undefined);
assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.angleSpecialChance, 0.10);
assert.equal(JSON.stringify(c.castPartnerAdjacentFactor), JSON.stringify({ BOOST: 0.15, BOUNCE: 0.27 }));
assert.equal(JSON.stringify(old.CONFIG.castPartnerAdjacentFactor), JSON.stringify({ BOOST: 1, BOUNCE: 1 }));
assert.equal(JSON.stringify(c.specials.BOOST), JSON.stringify({ trigger: 'adjacent', partner: 'BOUNCE', speed: 2000, angle: 45, name: '爆裂斜光' }));
assert.equal(JSON.stringify(c.specials.BOUNCE), JSON.stringify({ trigger: 'adjacent', partner: 'BOOST', speed: 1700, angle: 60, name: '巨神昇天拳' }));
{
  const mk = r => { const g = new now.Game(r); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); return g; };
  const hit = (g, type, partner) => { g.objects = [{ x: g.body.x + 5, type, used: false }]; if (partner) g.objects.push({ x: g.body.x + 600, type: partner, used: false }); g.contactObjects({ x: g.body.x, y: g.body.y }); };
  for (const [type, partner] of [['BOOST', 'BOUNCE'], ['BOUNCE', 'BOOST']]) {
    let draws = 0;
    const win = mk(() => { draws++; return 0.999; }); draws = 0; hit(win, type, partner); assert.equal(draws, 0, 'no draw'); assert.equal(win.special?.type, type, 'adjacency always fires');
    const none = mk(() => { draws++; return 0; }); draws = 0; hit(none, type, 'BRAKE'); assert.equal(draws, 0); assert.equal(none.special, null, 'adjacency still required');
  }
}
const PLAYS = 1000, before = rates(old, PLAYS), after = rates(now, PLAYS);
assert(before.rate.BOOST > 30 && before.rate.BOOST < 40 && before.rate.BOUNCE > 34 && before.rate.BOUNCE < 44, 'old placement ~36%');
for (const t of ['BOOST', 'BOUNCE']) assert(after.rate[t] > 13 && after.rate[t] < 22, `${t} ${after.rate[t]}`);
// Other characters: rules untouched; placement shifts their neighbours a little (allow 4 pp).
for (const t of TYPES.filter(t => t !== 'BOOST' && t !== 'BOUNCE')) assert(Math.abs(after.rate[t] - before.rate[t]) <= 4, `${t} ${before.rate[t].toFixed(2)} -> ${after.rate[t].toFixed(2)}`);
const fmt = r => Object.fromEntries(TYPES.map(t => [t, +r.rate[t].toFixed(2)]));
console.log(JSON.stringify({ specialRate: 'PASS', plays: PLAYS, before: fmt(before), after: fmt(after), avgDistanceM: [+before.dist.toFixed(1), +after.dist.toFixed(1)] }));
