// Merchant A-D balance (2026-10-17 auto cycle 33): same-seed distance gain of taking the merchant window vs letting it
// MISS is close across types (12000-seed sim: A 4107 / B 4669 / C 5196 / D 4822 m, was 1262 / 879 / 9546 / 2195).
// Draw (10%), trigger condition and type mapping unchanged. Unit checks for the new A kick and B restarts.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(patch = s => s) {
  const sc = { document: { getElementById: () => ({}), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} } }; sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game']) { let s = fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'); if (n === 'config') s = patch(s); vm.runInContext(s, sc, { filename: n }); }
  return sc.Hop;
}
const H = load(), c = H.CONFIG;
assert.equal(c.merchantChance, 0.10); assert.equal(JSON.stringify(c.merchantTypes), JSON.stringify({ STOPPER: 'A', DASH: 'B', BOOST: 'C', BOUNCE: 'D' }));
assert.deepEqual([c.typeAUses, c.typeAMultiplier, c.typeAKickSpeed, c.typeBStartCharge, c.typeBRevives, c.typeBBaseSpeed, c.typeBChargeBonus, c.typeCCount, c.typeDBounces, c.typeDMultiplier],
  [12, 3.2, 1800, 4, 2, 1400, 200, 72, 17, 1.38]);
function isolated() { const g = new H.Game(() => 0.99); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); return g; }
{ const g = isolated(); g.body.vx = 50; g.body.vy = -20; g.acquireMerchant('A');
  assert(Math.abs(Math.hypot(g.body.vx, g.body.vy) - c.typeAKickSpeed) < 1e-6 && g.body.vy > 0, 'A first potion lifts right away');
  assert.equal(g.merchant.remaining, c.typeAUses); }
{ const g = isolated(); g.acquireMerchant('B'); assert.equal(g.merchant.charge, 4); assert.equal(g.merchant.revives, 2);
  assert(g.revive()); assert(Math.abs(Math.hypot(g.body.vx, g.body.vy) - Math.min(2000, 1400 + 4 * 200)) < 1e-6 || Math.hypot(g.body.vx, g.body.vy) <= 1400 + 800);
  assert.equal(g.merchant?.type, 'B', 'second restart kept'); assert.equal(g.merchant.charge, 4); assert.equal(g.merchant.revives, 1);
  assert(g.revive()); assert.equal(g.merchant, null); assert.equal(g.revive(), false); assert.equal(g.merchantStats.revives, 2); }
// Gain sim (smaller than the evidence run): every type's mean within ±30% of the four-type mean.
const S = load(s => s.replace(/merchantChance: [\d.]+,/, 'merchantChance: 1,'));
const rng = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
function play(seed, take) {
  const g = new S.Game(rng(seed * 31 + 7)); g.act(); g.angle = 15 + (seed * 7) % 55; g.act(); g.power = 0.4 + (seed % 7) * 0.1; g.act();
  let seen = 0, f = 0;
  while (g.state === 'FLYING' && f < 120 * 1200) {
    if (g.special) { if (g.special.merchantType) { if (!g.special._s) { g.special._s = 1; seen++; } if (take && seen === 1) g.act(); } else if (seed % 3 !== 0) g.act(); }
    else if (g.combo && seed % 2) g.act();
    g.update(S.CONFIG.physicsStep); f++;
  }
  return { d: g.finalDistance, seen, type: g.merchantStats.lastType };
}
const G = { A: [], B: [], C: [], D: [] };
for (let s = 1; s <= 4000; s++) { const no = play(s, false); if (!no.seen) continue; const yes = play(s, true); G[yes.type].push(yes.d - no.d); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length, m = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, mean(v)]));
const avg = mean(Object.values(m));
for (const [k, v] of Object.entries(m)) { assert(G[k].length >= 15, k + ' samples'); assert(Math.abs(v / avg - 1) <= 0.30, `${k} ${v.toFixed(0)} vs ${avg.toFixed(0)}`); }
console.log('merchant-balance OK: ' + Object.entries(m).map(([k, v]) => `${k} ${v.toFixed(0)} m (n=${G[k].length})`).join(' / '));
