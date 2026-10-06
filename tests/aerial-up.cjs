// AERIAL UP strength: a BOOST-strength kick (same impulse / angle as a BOOST contact). A falling hero first loses its
// downward speed, so the kick always lifts. Uses (3), the speed caps and merchant effects are unchanged; AERIAL DOWN is the reflection-lock dive;
// merchant A / B do not apply to AERIAL UP (they act on companion contacts).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const scope = { localStorage: { getItem: () => null, setItem() {} } }; scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, c = H.CONFIG;
const near = (a, b, label, eps = 1e-9) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);
const rnd = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// A flying game with no objects ahead and the given body.
function flying(body) {
  const g = new H.Game(rnd(1)); g.act(); g.act(); g.act(); assert.equal(g.state, 'FLYING');
  g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity;
  Object.assign(g.body, { x: 800, y: 200, vx: 600, vy: -400, grounded: false, stopped: false }, body); g.updateAerialMode();
  return g;
}
const run = g => { for (let i = 0; i < 120 * 300 && g.state !== 'RESULT'; i++) g.update(c.physicsStep); return g.finalDistance; };
const kx = c.boostImpulse * Math.cos(c.boostAngle * Math.PI / 180), ky = c.boostImpulse * Math.sin(c.boostAngle * Math.PI / 180);
let cases = 0;
// Config: the BOOST values, 3 uses, no hard-coded numbers left from the old 620 / 85 kick.
assert.deepEqual([c.aerialUpUses, c.aerialUpImpulse, c.aerialUpAngle, c.aerialUpCancelFall], [3, c.boostImpulse, c.boostAngle, true]);
assert.equal(c.aerialUpVertical, undefined); assert.equal(c.aerialUpHorizontal, undefined);
assert.deepEqual([c.aerialDownLockAngle, c.aerialDownMinAngleDeg, c.aerialDownSpeedScale, c.maxHorizontalSpeed, c.maxVerticalSpeed, c.boostImpulse, c.boostAngle], [true, 30, 1, 2000, 1500, 800, 45]);
assert.equal(c.aerialDownVertical, undefined); assert.equal(c.aerialDownHorizontal, undefined);
const src = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8'), up = src.slice(src.indexOf('if (direction === "UP")'), src.indexOf('} else if (direction === "DOWN")'));
assert(!/\b\d{2,}\b/.test(up.replace(/180/g, '')), 'no literal strengths in aerial("UP")'); cases++;
// Falling: downward speed cancelled, then +boost on both axes; mode flips to DOWN (rising).
{ const g = flying({ vy: -400 }); assert.equal(g.aerialMode, 'UP'); assert.equal(g.aerial('UP'), true);
  near(g.body.vx, 600 + kx, 'vx'); near(g.body.vy, ky, 'vy'); assert(g.body.vy > 0, 'lifts'); assert.equal(g.upRemaining, 2);
  assert.equal(g.aerialMode, 'DOWN'); assert.equal(g.effect.label, 'AERIAL UP'); assert.equal(g.specialArmed.brake, false); cases++; }
// Very fast fall (-1500): still lifts by the full kick.
{ const g = flying({ vy: -1500 }); g.aerial('UP'); near(g.body.vy, ky, 'fast fall'); cases++; }
// UP mode kept inside the +-40 band: a slightly rising hero keeps its upward speed (nothing to cancel).
{ const g = flying({ vy: -100 }); g.body.vy = 20; assert.equal(g.updateAerialMode(), 'UP'); g.aerial('UP'); near(g.body.vy, 20 + ky, 'rising kept'); cases++; }
// Same velocity change as a BOOST contact once the fall is cancelled (no merchant).
{ const a = flying({ vy: 0 }), b = flying({ vy: 0 }); a.aerial('UP'); b.applyContact('BOOST');
  near(a.body.vx, b.body.vx, 'vx = BOOST'); near(a.body.vy, b.body.vy, 'vy = BOOST'); cases++; }
// Speed caps unchanged (limitSpeed).
{ const g = flying({ vx: 1900, vy: -300 }); g.aerial('UP'); assert.equal(g.body.vx, c.maxHorizontalSpeed); cases++; }
// 3 uses, then nothing; not on the ground / during a special / Type C.
{ const g = flying({});
  for (let i = 0; i < 3; i++) { g.body.vy = -300; g.updateAerialMode(); assert.equal(g.aerial('UP'), true); }
  g.body.vy = -300; const before = { ...g.body }; assert.equal(g.aerial('UP'), false); assert.deepEqual({ ...g.body }, before); assert.equal(g.upRemaining, 0);
  const s = flying({}); s.special = { type: 'BOOST' }; assert.equal(s.aerial('UP'), false);
  const t = flying({}); t.merchant = { type: 'C' }; assert.equal(t.aerial('UP'), false);
  const gr = flying({ y: 0, grounded: true, vy: 0 }); assert.equal(gr.aerial('UP'), false); cases++; }
// AERIAL DOWN: reflection + angle lock (see aerial-down.cjs); still arms BRAKE.
{ const g = flying({ vy: 300 }); g.updateAerialMode(); assert.equal(g.aerial('DOWN'), true);
  // Reflection of atan2(300,600) is below the 30° floor, so dive is -30° at the same |v|.
  const sp = Math.hypot(600, 300), ang = -30 * Math.PI / 180;
  near(g.body.vx, sp * Math.cos(ang), 'down vx'); near(g.body.vy, sp * Math.sin(ang), 'down vy');
  assert.equal(g.aerialDownLock, ang); assert(g.specialArmed.brake); cases++; }
// Merchant A / B: not applied to AERIAL UP and not consumed / charged by it; BOOST contacts still use them.
{ const a = flying({ vy: -400 }); a.merchant = { type: 'A', remaining: 3 }; a.aerial('UP');
  near(a.body.vx, 600 + kx, 'A not doubled'); near(a.body.vy, ky, 'A not doubled vy'); assert.deepEqual(a.merchant, { type: 'A', remaining: 3 });
  const b = flying({ vy: -400 }); b.merchant = { type: 'B', charge: 2 }; b.aerial('UP'); assert.deepEqual(b.merchant, { type: 'B', charge: 2 });
  const a2 = flying({ vy: 0 }); a2.merchant = { type: 'A', remaining: 3 }; a2.applyContact('BOOST'); near(a2.body.vx, 600 + 2 * kx, 'BOOST still doubled'); assert.equal(a2.merchant.remaining, 2);
  const b2 = flying({ vy: 0 }); b2.merchant = { type: 'B', charge: 2 }; b2.applyContact('BOOST'); assert.equal(b2.merchant.charge, 3); cases++; }
// Strength, same moment: from falling states the distance gained by one AERIAL UP is at least that of a BOOST contact
// at the same moment (the cancelled fall only adds lift) and several times the old +620 / +85 kick.
const clean = body => { const g = flying(body); return run(g); };
{ const states = [{ y: 400, vx: 700, vy: -60 }, { y: 250, vx: 650, vy: -400 }, { y: 80, vx: 600, vy: -650 }, { y: 150, vx: 400, vy: -300 }];
  for (const st of states) {
    const base = clean(st);
    const u = flying(st); u.aerial('UP'); const gu = run(u) - base;
    const b = flying(st); b.applyContact('BOOST'); const gb = run(b) - base;
    const o = flying(st); o.body.vy += 620; o.body.vx += 85; o.limitSpeed(); const go = run(o) - base;
    assert(gu >= gb - 1e-6, `>= BOOST at the same moment ${JSON.stringify(st)}: up ${gu.toFixed(1)} boost ${gb.toFixed(1)}`);
    assert(gu > 2.5 * go, `stronger than the old kick ${JSON.stringify(st)}: ${gu.toFixed(1)} vs ${go.toFixed(1)}`);
  }
  cases++; }
// Strength, typical use: average gain of one AERIAL UP over the moments it can be used in real games (every 0.5 s
// while falling) vs the average gain of one real BOOST contact (body right before the contact), both measured as clean
// continuations (no objects afterwards). Full measurement (360 games): phase_c/aerial_up_measure. Here: 36 games.
{ const ups = [], boosts = [];
  for (let seed = 1; seed <= 6; seed++) for (const angle of [30, 45, 60]) for (const power of [0.7, 1]) {
    const g = new H.Game(rnd(seed)); g.act(); g.angle = angle; g.act(); g.power = power; g.act();
    const orig = g.applyContact.bind(g); g.applyContact = type => { if (type === 'BOOST' && !g.merchant) boosts.push({ ...g.body }); return orig(type); };
    let next = 0;
    for (let i = 0; i < 120 * 200 && g.state !== 'RESULT'; i++) {
      g.update(c.physicsStep); const t = i * c.physicsStep;
      if (t >= next && g.airborne() && g.body.vy < -c.aerialDirectionThreshold && !g.special && !g.merchant) { ups.push({ ...g.body }); next = t + 0.5; }
    }
  }
  const gain = (body, apply) => { const base = clean(body), g = flying(body); apply(g); return run(g) - base; };
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const up = mean(ups.map(b => gain(b, g => g.aerial('UP')))), boost = mean(boosts.map(b => gain(b, g => g.applyContact('BOOST'))));
  const old = mean(ups.map(b => gain(b, g => { g.body.vy += 620; g.body.vx += 85; g.limitSpeed(); })));
  assert(ups.length > 100 && boosts.length >= 10, `samples ${ups.length} / ${boosts.length}`);
  assert(up >= 0.8 * boost && up <= 1.2 * boost, `typical AERIAL UP ${up.toFixed(1)} m vs BOOST contact ${boost.toFixed(1)} m`);
  assert(old < 0.5 * boost, 'the old kick was weak');
  cases++;
  var summary = { upGain: +up.toFixed(1), boostGain: +boost.toFixed(1), oldGain: +old.toFixed(1), ratio: +(up / boost).toFixed(3), samples: [ups.length, boosts.length] }; }
console.log(JSON.stringify({ aerialUp: 'PASS', cases, ...summary }));
