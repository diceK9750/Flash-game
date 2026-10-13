// Sage (GUARD 聖護結界) SPECIAL condition (2026-10-13d, 先見の結界 / "foresight").
// History: before 2026-10-13c the SPECIAL needed a held GUARD (GUARD then GUARD with no other contact; ~1.8% of
// sage contacts). 2026-10-13c (main 3d13336) added a flat guardSpecialChance 0.13 draw. 2026-10-13d replaces that
// draw with a sage-specific, deterministic condition (no random()): an untouched 僧侶 (STOPPER) or 盗賊 (BRAKE)
// within sageForesightRange (460 px) beyond the sage at the contact. The held-GUARD path is unchanged; nothing
// triggers while 聖護結界 is active or when a merchant SPECIAL takes the contact; the effect (10 s STOPPER block)
// is unchanged. sageCondition "none" reproduces the warrior-fix game exactly (fixture + fingerprint bd3ce787...).
// Main 3d13336's 1000-play rates are stored in fixtures/sage-main-rates-1000.json (same seeded player as below).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(mode, patch = s => s) {
  const els = new Map();
  const stub = () => new Proxy({ calls: [] }, { get: (o, k) => k in o ? o[k] : (...a) => { o.calls.push(k); return k === 'measureText' ? { width: 10 } : undefined; }, set: (o, k, v) => (o[k] = v, true) });
  const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', hidden: false, style: {}, addEventListener() {}, getContext: stub }); return els.get(id); };
  const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game', 'sprites', 'graphics']) {
    let src = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
    if (name === 'config' && mode !== undefined) { assert(/sageCondition: "foresight",/.test(src)); src = src.replace(/sageCondition: "foresight",/, `sageCondition: "${mode}",`); }
    if (name === 'config') src = patch(src);
    vm.runInContext(src, scope, { filename: name });
  }
  scope.Hop.stub = stub;
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
const now = load(), old = load('none'), c = now.CONFIG;
assert.equal(c.sageCondition, 'foresight'); assert.equal(c.sageForesightRange, 460);
assert(!('guardSpecialChance' in c), 'flat sage draw removed');
for (const k of ['sageCalmMaxSpeed', 'sageQuietTime']) assert(!(k in c), `unused candidate ${k} removed`);
assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.merchantChance, 0.20, 'merchant draw stays 20%');
assert.equal(JSON.stringify(c.specials.GUARD), JSON.stringify({ trigger: 'guard', name: '聖護結界' }));
assert.equal(c.guardSpecialDuration, 10.0, 'same effect per activation'); assert.equal(c.angleSpecialChance, 0.10);
// Warrior-fix behaviour reproduced exactly with the sage condition off.
assert.deepEqual(animSim(old), JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-warrior.json'), 'utf8')));
assert.equal(fingerprint(old), 'bd3ce7876ece75a432333172e6940557398cff0bc32ab6428f852ca1fd86dcdd');
// New baseline (2026-10-13d foresight; was the 3d13336 guardSpecialChance run).
assert.deepEqual(animSim(now), JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline-sage.json'), 'utf8')));
// Unit: condition true / false.
{
  const R = c.sageForesightRange;
  const mk = () => { let draws = 0; const g = new now.Game(() => { draws++; return 0.99; }); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); g.draws = () => draws; return g; };
  const setup = (g, others) => { const sage = { x: g.body.x + 5, type: 'GUARD', used: false }; g.objects = [sage, ...others.map(([dx, type, used]) => ({ x: sage.x + dx, type, used: !!used }))]; return sage; };
  const hit = g => { const before = g.draws(); g.contactObjects({ x: g.body.x, y: g.body.y }); assert.equal(g.draws(), before, 'no random() for the sage condition'); return g.special; };
  const cases = [
    ['cleric in range', [[300, 'STOPPER']], true], ['thief in range', [[300, 'BRAKE']], true],
    ['cleric at range edge', [[R, 'STOPPER']], true], ['thief just past range', [[R + 0.5, 'BRAKE']], false],
    ['touched cleric', [[200, 'STOPPER', true]], false], ['touched thief', [[200, 'BRAKE', true]], false],
    ['other character (witch)', [[200, 'BOOST']], false], ['other character (jester)', [[200, 'ANGLE']], false],
    ['cleric behind the sage', [[-200, 'STOPPER']], false], ['nobody', [], false],
    ['touched cleric + untouched thief', [[100, 'STOPPER', true], [400, 'BRAKE']], true],
  ];
  for (const [name, others, want] of cases) {
    const g = mk(), sage = setup(g, others);
    assert.equal(g.sageConditionMet(sage), want, name);
    const sp = hit(g); assert.equal(sp?.type === 'GUARD', want, `${name}: SPECIAL`);
    if (!want) assert.equal(g.normalGuard, 1, `${name}: normal GUARD contact unchanged`);
  }
  // Barrier active: no trigger.
  { const g = mk(); setup(g, [[200, 'STOPPER']]); g.guardSpecial = { active: true, remaining: 5 }; assert.equal(hit(g), null); }
  // Held GUARD still works without any cleric / thief.
  { const g = mk(); setup(g, []); g.normalGuard = 1; assert.equal(hit(g)?.type, 'GUARD'); }
  // Merchant takes the contact: merchant SPECIAL, not 聖護結界. The game has no sage merchant (merchantTypes has no
  // GUARD), so a config variant maps GUARD to merchant "A" to prove the sage condition yields to the merchant.
  assert(!('GUARD' in c.merchantTypes));
  { const M = load(undefined, src => src.replace('merchantTypes: Object.freeze({ STOPPER: "A",', 'merchantTypes: Object.freeze({ GUARD: "A", STOPPER: "A",'));
    const g = new M.Game(() => 0); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.act(); g.act();
    const sage = { x: g.body.x + 5, type: 'GUARD', used: false, debugBoundary: true }; g.objects = [sage, { x: sage.x + 200, type: 'STOPPER', used: false }];
    assert.equal(g.sageConditionMet(sage), true); g.guardSpecial = { active: true, remaining: 5 };
    g.contactObjects({ x: g.body.x, y: g.body.y }); assert.equal(g.special?.merchantType, 'A', 'merchant took the contact'); assert.equal(g.specialCount, 0, 'no 聖護結界'); }
  { const M = load(undefined, src => src.replace('merchantTypes: Object.freeze({ STOPPER: "A",', 'merchantTypes: Object.freeze({ GUARD: "A", STOPPER: "A",'));
    const g = new M.Game(() => 0.99); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.act(); g.act();
    const sage = { x: g.body.x + 5, type: 'GUARD', used: false, debugBoundary: true }; g.objects = [sage, { x: sage.x + 200, type: 'STOPPER', used: false }]; g.normalGuard = 1;
    g.contactObjects({ x: g.body.x, y: g.body.y }); assert.equal(g.special?.merchantType, null, 'merchant draw lost -> held GUARD SPECIAL'); assert.equal(g.special?.type, 'GUARD'); }
  // "none": condition never met.
  { const g = new old.Game(() => 0.99); g.objects = [{ x: 0, type: 'GUARD', used: false }, { x: 100, type: 'STOPPER', used: false }]; assert.equal(g.sageConditionMet(g.objects[0]), false); }
}
// Hint draw (graphics.js): only for an untouched on-screen sage whose condition is met; static under reduced motion.
{
  const G = now.Graphics, ground = 600, sx = x => x;
  const scene = others => { const g = new now.Game(() => 0.5); const sage = { x: 300, type: 'GUARD', used: false }; g.objects = [sage, ...others.map(([dx, type, used]) => ({ x: 300 + dx, type, used: !!used }))]; return { g, sage }; };
  const draw = (g, rm, t = 0.4) => { const ctx = now.stub(); return { n: G.sageForesightHints(ctx, g, sx, ground, t, rm), ctx }; };
  assert.equal(draw(scene([[300, 'STOPPER']]).g, false).n, 1);
  assert.equal(draw(scene([[300, 'BRAKE']]).g, true).n, 1);
  assert.equal(draw(scene([[600, 'STOPPER']]).g, false).n, 0, 'out of range');
  assert.equal(draw(scene([[300, 'BOOST']]).g, false).n, 0, 'other character');
  assert.equal(draw(scene([[300, 'STOPPER', true]]).g, false).n, 0, 'touched cleric');
  { const { g, sage } = scene([[300, 'STOPPER']]); sage.used = true; assert.equal(draw(g, false).n, 0, 'used sage'); }
  { const { g, sage } = scene([[300, 'STOPPER']]); sage.x = 5000; g.objects[1].x = 5200; assert.equal(draw(g, false).n, 0, 'off-screen sage'); }
  assert.equal(draw(scene([[300, 'STOPPER']]).g, false).ctx.calls.includes('quadraticCurveTo'), true);
  assert.equal(draw(scene([]).g, false).ctx.calls.length, 0, 'nothing drawn without the condition');
  // Reduced motion: same alpha at any time (no pulse).
  const alphas = (rm, t) => { const ctx = now.stub(); G.sageForesightHints(ctx, scene([[300, 'BRAKE']]).g, sx, ground, t, rm); return ctx.globalAlpha; };
  assert.equal(alphas(true, 0.1), alphas(true, 1.3)); assert.notEqual(alphas(false, 0.1), alphas(false, 0.6));
}
const main = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sage-main-rates-1000.json'), 'utf8'));
const PLAYS = 1000, before = { rate: Object.fromEntries(TYPES.map(k => [k, 100 * main.sp[k] / main.enc[k]])), enc: main.enc, dist: main.avgDistanceM }, after = rates(now, PLAYS);
assert.equal(main.plays, PLAYS);
assert(after.rate.GUARD >= 10 && after.rate.GUARD <= 17, `sage ${after.rate.GUARD.toFixed(2)}`);
for (const t of TYPES.filter(t => t !== 'GUARD')) {
  const p = (before.rate[t] + after.rate[t]) / 200, se = 100 * Math.sqrt(p * (1 - p) * (1 / before.enc[t] + 1 / after.enc[t]));
  assert(Math.abs(after.rate[t] - before.rate[t]) <= 3 * se, `${t} vs main ${before.rate[t].toFixed(2)} -> ${after.rate[t].toFixed(2)} (3se ${(3 * se).toFixed(2)})`);
}
const fmt = r => Object.fromEntries(TYPES.map(t => [t, +r.rate[t].toFixed(2)]));
console.log(JSON.stringify({ sageSpecial: 'PASS', plays: PLAYS, main: fmt(before), foresight: fmt(after), avgDistanceM: [+before.dist.toFixed(1), +after.dist.toFixed(1)], newFingerprint: fingerprint(now) }));
