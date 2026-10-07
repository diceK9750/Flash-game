// Merchant = hidden "greatest secret art" (rare draw, miss -> normal SPECIAL rules) and
// no same roadside character twice within one screen (placement draw only).
const assert = require('node:assert/strict');
const { scope, launch, random } = require('./phase2.cjs');
const { isolated, hit } = require('./specials.cjs');
const { Game, CONFIG: c } = scope.Hop;
let cases = 0;
function test(name, fn) { try { fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
const types = Object.keys(c.objectWeights);

test('config: rare merchant chance, window covers the whole screen plus name tags', () => {
  assert(c.merchantChance > 0 && c.merchantChance <= 0.1, 'merchantChance ' + c.merchantChance);
  assert(c.castRepeatWindow >= c.width + 2 * 59, 'window >= screen + tag halves');
  assert.deepEqual(Object.keys(c.castPickWeights), types);
});

test('draw happens once, only for a merchant candidate; win -> merchant', () => {
  const g = isolated(); g.normalGuard = 1; let draws = 0; g.random = () => { draws++; return c.merchantChance - 1e-9; };
  hit(g, 'DASH', { x: 800 }); assert.equal(g.special.merchantType, 'B'); assert.equal(draws, 1); assert.equal(g.merchantStats.attempts, 1);
  const n = isolated(); n.normalGuard = 1; draws = 0; n.random = () => { draws++; return 0; };
  hit(n, 'DASH', { x: 760 }); assert.equal(draws, 0, 'not at the boundary: no draw'); assert.equal(n.special, null);
  const b = isolated(); b.normalGuard = 1; draws = 0; b.random = () => { draws++; return 0; };
  hit(b, 'BRAKE', { x: 800 }); assert.equal(draws, 0, 'non-merchant type: no draw');
});

test('lost draw falls back to the normal SPECIAL rules (no loss for the player)', () => {
  const lose = () => c.merchantChance;
  // DASH armed -> DASH SPECIAL instead of merchant B.
  const d = isolated(); d.normalGuard = 1; d.specialArmed.dash = true; d.random = lose; hit(d, 'DASH', { x: 800 });
  assert(d.special); assert.equal(d.special.merchantType, null); assert.equal(d.special.type, 'DASH'); assert.equal(d.merchantStats.attempts, 0); assert.equal(d.specialCount, 1);
  d.act(); assert.equal(d.specialSuccesses, 1); assert.equal(d.merchant, null); assert.equal(d.specialCutin.type, 'DASH');
  // BOOST with an adjacent BOUNCE -> BOOST SPECIAL.
  const a = isolated(); a.normalGuard = 1; a.random = lose; hit(a, 'BOOST', { x: 800, next: [{ x: 1300, type: 'BOUNCE', used: false }] });
  assert.equal(a.special.type, 'BOOST'); assert.equal(a.special.merchantType, null);
  // Not eligible -> the same ordinary contact as without the merchant (normal GUARD blocks STOPPER).
  const s = isolated(); s.normalGuard = 1; s.random = lose; hit(s, 'STOPPER', { x: 800 });
  assert.equal(s.special, null); assert.equal(s.body.stopped, false); assert.equal(s.normalGuard, 0); assert.match(s.contact.label, /GUARD BLOCK/);
  // GUARD SPECIAL shield path too.
  const g = isolated(); g.guardSpecial = { active: true, remaining: 7 }; g.random = lose; hit(g, 'BOUNCE', { x: 800 });
  assert.equal(g.special, null); assert.equal(g.merchantStats.attempts, 0);
});

test('DEBUG plays skip the draw so the merchant can be checked', () => {
  const g = isolated(); g.debug = true; g.normalGuard = 1; let draws = 0; g.random = () => { draws++; return 0.99; };
  hit(g, 'BOUNCE', { x: 800 }); assert.equal(g.special.merchantType, 'D'); assert.equal(draws, 0);
});

// Seeded play: accept every SPECIAL after 0.25 s, sometimes use AERIAL (same as phase_c/merchant_rate/sim.cjs "active").
function play(seed) {
  const g = new Game(random(seed)), pr = random(seed * 7919 + 13);
  g.act(); g.angle = c.angleMin + (c.angleMax - c.angleMin) * pr(); g.act(); g.power = c.powerMin + (c.powerMax - c.powerMin) * pr(); g.act();
  let t = 0, age = 0;
  while (g.state === 'FLYING' && t < 600) {
    g.update(1 / 60); t += 1 / 60;
    if (g.special) { age += 1 / 60; if (age >= 0.25) { g.act(); age = 0; } continue; }
    age = 0; if (g.airborne() && pr() < 0.02) g.act();
  }
  return g.merchantStats.successes;
}
test('merchant rate: rare (tens of plays per merchant), but still reachable', () => {
  let s = 0; const PLAYS = 300;
  for (let i = 1; i <= PLAYS; i++) s += play(i * 104729 + 1);
  assert(s >= 1, 'merchant still appears');
  assert(PLAYS / s >= 12 && PLAYS / s <= 150, 'plays per merchant ' + (PLAYS / s).toFixed(1));
  test.rate = +(PLAYS / s).toFixed(1);
});

function generate(seed, meters) {
  const g = new Game(random(seed)); let draws = 0; const r = g.random; g.random = () => { draws++; return r(); };
  const seen = new Map();
  for (let x = 0; x < meters * c.pixelsPerMeter; x += 40) { g.body.x = x; g.generateObjects(); for (const o of g.objects) seen.set(o, o); }
  return { objects: [...seen.values()].sort((a, b) => a.x - b.x), draws };
}
test('no same type twice within the screen window over long runs; spacing/boundaries unchanged', () => {
  const counts = Object.fromEntries(types.map(t => [t, 0])); let total = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { objects } = generate(seed * 31 + 7, 4000);
    for (let i = 0; i < objects.length; i++) {
      counts[objects[i].type]++; total++;
      for (let j = i + 1; j < objects.length && objects[j].x - objects[i].x < c.castRepeatWindow; j++) assert.notEqual(objects[j].type, objects[i].type, `seed ${seed} x ${objects[i].x}/${objects[j].x}`);
      const o = objects[i];
      if (o.boundary) assert.equal(o.x % (c.boundaryMeters * c.pixelsPerMeter), 0);
      else assert(Math.abs(o.x - Math.max(1, Math.round(o.x / 800)) * 800) >= c.boundaryClearance);
    }
    const regular = objects.filter(o => !o.boundary);
    for (let i = 1; i < regular.length; i++) assert(regular[i].x - regular[i - 1].x >= c.objectGapMin - 1e-9);
  }
  const sum = types.reduce((a, t) => a + c.objectWeights[t], 0);
  for (const t of types) {
    const share = counts[t] / total, want = c.objectWeights[t] / sum;
    assert(Math.abs(share - want) <= (t === 'BOOST' ? 0.045 : 0.02), `${t} share ${share.toFixed(3)} vs ${want}`);
  }
  assert(Math.abs(counts.STOPPER / total - 0.05) <= 0.01, 'STOPPER (run ender) stays ~5%');
});

test('one random() per placed type, as before (positions/gap draws unchanged)', () => {
  for (const nearby of [[], types.slice(0, 6)]) {
    const g = launch(); g.nextBoundaryX = Infinity; g.nextObjectX = 10000; g.body.x = 10000 - c.objectAhead + 1;
    g.objects = nearby.map((type, i) => ({ x: 10000 - 300 - 150 * i, type, used: false }));
    let draws = 0; const r = g.random; g.random = () => { draws++; return r(); };
    g.generateObjects();
    assert.equal(draws, 2, 'type + gap'); const placed = g.objects.find(o => o.x === 10000);
    if (nearby.length) assert.equal(placed.type, types[6]);
  }
});

test('all types nearby -> the type whose nearest copy is farthest (always decided)', () => {
  const g = launch(); g.objects = types.map((type, i) => ({ x: 10000 - 100 * (i + 1), type, used: false }));
  g.nextBoundaryX = Infinity; g.nextObjectX = 10000; g.body.x = 10000 - c.objectAhead + 1; g.random = () => 0.5;
  g.generateObjects();
  const placed = g.objects.find(o => o.x === 10000); assert(placed); assert.equal(placed.type, types[types.length - 1]);
});

test('debug placement order unchanged', () => {
  const g = new Game(random(3)); g.debug = true; g.reset(); g.body.x = 5000; g.generateObjects();
  const seq = g.objects.slice().sort((a, b) => a.x - b.x).map(o => o.type);
  const start = types.indexOf(seq[0]);
  assert(seq.length >= 3); assert.deepEqual(seq, seq.map((_, i) => types[(start + i) % types.length]));
});

console.log(JSON.stringify({ merchantRareCastSpacing: 'PASS', cases, playsPerMerchant: test.rate }));

// Hidden character: no merchant hints for players (rules / zone / markers / result totals) outside DEBUG.
{
  const fs = require('node:fs'), path = require('node:path');
  const { element } = require('./phase2.cjs');
  const { UI } = scope.Hop;
  test('player rules: no merchant condition or chance, only a vague line', () => {
    const g = isolated(); const ui = new UI(g, element('canvas')); ui.update();
    const rules = element('special-rules').textContent;
    assert(rules.includes('ごくまれに謎の商人が現れる…？'));
    for (const bad of ['商人SPECIAL', '%）', `${Math.round(c.merchantChance * 100)}%`, `最後${c.merchantZoneMeters}m`, 'MERCHANT']) assert(!rules.includes(bad), bad);
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const rulesHtml = html.slice(html.indexOf('<details class="rules">'), html.indexOf('</details>', html.indexOf('開発用')));
    assert(rulesHtml.includes('ごくまれに謎の商人が現れる…？'));
    for (const bad of ['商人：', 'STOPPER→A', '商人SPECIAL', '商人登場', '商人成功', '8%']) assert(!rulesHtml.includes(bad), bad);
  });
  test('no marker / zone in normal play even at a guarded boundary approach; DEBUG keeps them', () => {
    const g = isolated(); const ui = new UI(g, element('canvas'));
    g.normalGuard = 1; g.body.x = 752; g.objects = [{ x: 800, type: 'BOUNCE', used: false }]; ui.update();
    assert.equal(UI.readyTargets(g).length, 0); assert(element('merchant-zone').hidden);
    assert.equal(element('ready-targets').textContent.includes('商人'), false);
    g.guardSpecial = { active: true, remaining: 7 }; g.normalGuard = 0; ui.update(); assert.equal(UI.readyTargets(g).length, 0); assert(element('merchant-zone').hidden);
    g.debug = true; ui.update(); assert.equal(UI.readyTargets(g)[0].label, 'MERCHANT'); assert(!element('merchant-zone').hidden);
  });
  test('result: merchant totals only after meeting the merchant (or DEBUG); success display unchanged', () => {
    const g = isolated(); const ui = new UI(g, element('canvas')); g.finish(); ui.update();
    assert(element('merchant-totals').hidden); assert.equal(element('merchant-totals').textContent, '');
    const m = isolated(); const mu = new UI(m, element('canvas')); m.normalGuard = 1; m.random = () => 0;
    hit(m, 'DASH', { x: 800 }); mu.update(); assert.equal(element('special-title').textContent, 'MERCHANT SPECIAL!');
    m.act(); mu.update(); assert(element('merchant-hud-text').textContent.includes('CHARGE'));
    m.finish(); mu.update(); assert(!element('merchant-totals').hidden); assert(element('merchant-totals').textContent.includes('発生 1 / 成功 1'));
  });
}
console.log(JSON.stringify({ merchantHidden: 'PASS', cases }));
