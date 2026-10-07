// Deterministic formal-SPECIAL scenarios; no runtime dependencies.
require('./phase3.cjs');
const assert = require('node:assert/strict');
const { scope, launch, element, document, random } = require('./phase2.cjs');
const { CONFIG: c, Physics, Game, UI } = scope.Hop;
let cases = 0;
function test(name, fn) { try { fn(); cases++; } catch (error) { error.message = name + ': ' + error.message; throw error; } }
function near(actual, expected) { assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`); }
function isolated() { const g = launch(); g.objects = []; g.nextObjectX = g.nextBoundaryX = Infinity; g.random=()=>0.9; return g; }
function hit(g, type, options = {}) {
  const { x = 500, vx = 500, vy = -100, next = [] } = options;
  Object.assign(g.body, { x: x - 20, y: 10, vx, vy, grounded: false, stopped: false });
  const source = { x, type, used: false };
  g.objects = [source, ...next];
  g.contactObjects({ x: x - 70, y: 10 });
  return source;
}
// The merchant also needs its rare draw (random() < merchantChance); 0 always wins it.
function merchant(type) {
  const g = isolated(); g.normalGuard = 1; g.random = () => 0;
  hit(g, type, { x: 800 });
  assert.equal(g.special.merchantType, c.merchantTypes[type]);
  assert.equal(g.normalGuard, 0); g.act(); assert.equal(g.normalGuard, 0);
  return g;
}
function impact(g, vx = 500, vy = -400) {
  Object.assign(g.body, { y: 0.1, vx, vy, grounded: false, stopped: false });
  const event = Physics.step(g.body, c.physicsStep); assert(event); g.groundImpact(event); return event;
}
for (const type of ['BOOST', 'BOUNCE']) {
  test(type + ' sorted unused adjacency, exact vector, pair single use', () => {
    const g = isolated(), partner = { x: 900, type: c.specials[type].partner, used: false };
    hit(g, type, { next: [{ x: 1100, type: 'BRAKE' }, partner, { x: 650, type: 'GUARD', used: true }] });
    assert(g.special); g.act();
    near(Math.hypot(g.body.vx, g.body.vy), c.specials[type].speed);
    near(Math.atan2(g.body.vy, g.body.vx) * 180 / Math.PI, c.specials[type].angle);
    assert(partner.used); const count = g.history.length;
    g.body.x = 950; g.contactObjects({ x: 450, y: 10 }); assert.equal(g.history.length, count);
  });
  test(type + ' intervening unused blocks special', () => {
    const g = isolated(); hit(g, type, { next: [{ x: 650, type: 'BRAKE' }, { x: 900, type: c.specials[type].partner }] });
    assert.equal(g.special, null);
  });
  test(type + ' miss retains partner and normal effect only', () => {
    const g = isolated(), partner = { x: 900, type: c.specials[type].partner, used: false };
    hit(g, type, { next: [partner] }); g.resolveSpecial(false);
    assert.equal(partner.used, false); assert.equal(g.special, null);
    near(g.body.vx, 500 + (type === 'BOOST' ? (c.boostImpulse*Math.cos(Math.PI/4)) : (c.boostImpulse*c.bounceImpulseRatio*Math.cos(Math.PI/3))));
  });
}
test('DASH survives ground, BRAKE, ANGLE, GUARD, then starts once', () => {
  const g = isolated(); hit(g, 'DASH'); assert(g.specialArmed.dash);
  impact(g); assert(g.specialArmed.dash);
  for (const type of ['BRAKE', 'ANGLE', 'GUARD']) { hit(g, type); assert(g.specialArmed.dash); }
  hit(g, 'DASH'); assert(g.special); assert.equal(g.specialArmed.dash, false);
  g.resolveSpecial(false); assert.equal(g.specialArmed.dash, false);
  hit(g, 'DASH'); assert.equal(g.special, null); assert(g.specialArmed.dash);
});
for (const cancel of ['BOOST', 'BOUNCE', 'STOPPER']) test('DASH canceled by ' + cancel, () => {
  const g = isolated(); hit(g, 'DASH'); hit(g, cancel);
  assert.equal(g.specialArmed.dash, false);
  if (g.special) g.resolveSpecial(false);
  hit(g, 'DASH'); assert.equal(g.special, null);
});
for (const source of ['BOOST', 'BOUNCE', 'DASH']) test(source + ' arms STOPPER through BRAKE and ANGLE', () => {
  const g = isolated(); hit(g, source); assert(g.specialArmed.stopper);
  hit(g, 'BRAKE'); hit(g, 'ANGLE'); assert(g.specialArmed.stopper);
  hit(g, 'STOPPER'); assert(g.special); assert.equal(g.specialArmed.stopper, false);
  g.act(); near(Math.hypot(g.body.vx, g.body.vy), 2300);
});
for (const cancel of ['GROUND', 'GUARD']) test('STOPPER canceled by ' + cancel, () => {
  const g = isolated(); hit(g, 'BOOST');
  if (cancel === 'GROUND') impact(g); else hit(g, cancel);
  assert.equal(g.specialArmed.stopper, false); hit(g, 'STOPPER'); assert.equal(g.special, null);
});
test('ordinary SPECIAL before GUARD BLOCK, miss uses remaining shield', () => {
  const g = isolated(); hit(g, 'BOOST'); g.normalGuard = 1; hit(g, 'STOPPER');
  assert(g.special); assert.equal(g.normalGuard, 0); g.resolveSpecial(false);
  assert.equal(g.normalGuard, 0); near(g.body.vx, 500); assert.equal(g.special, null);
});
for (const type of Object.keys(c.merchantTypes)) {
  for (const success of [true, false]) test(`merchant ${type} priority and ${success ? 'success' : 'miss'}`, () => {
    const g = isolated(); g.normalGuard = 1; g.specialArmed.dash = g.specialArmed.stopper = true; g.random = () => 0;
    const partner = { x: 1100, type: c.specials[type].partner || 'BRAKE', used: false };
    hit(g, type, { x: 800, next: [partner] });
    assert.equal(g.special.merchantType, c.merchantTypes[type]); assert.equal(g.specialCount, 0);
    assert.equal(g.normalGuard, 0); assert.equal(g.merchantStats.attempts, 1);
    g.resolveSpecial(success); assert.equal(g.special, null); assert.equal(g.specialArmed.dash, false);
    assert.equal(g.merchantStats.successes, Number(success)); assert.equal(partner.used, false);
    if (success) { assert.equal(g.normalGuard, 0); assert.equal(g.merchant.type, c.merchantTypes[type]); }
    else {
      assert.equal(g.merchant, null); assert.equal(g.normalGuard, 0);
      near(g.body.vx,500);
    }
    assert.equal(g.resolveSpecial(true), false);
  });
}
test('merchant requires guard, supported type, and exact positive boundary', () => {
  for (const [guard, type, x] of [[0, 'BOOST', 800], [1, 'BOOST', 760], [1, 'BOOST', 801], [1, 'BRAKE', 800], [1, 'GUARD', 800], [1, 'ANGLE', 800], [1, 'STOPPER', 0]]) {
    const g = isolated(); g.normalGuard = guard; g.random = () => 0; hit(g, type, { x }); assert(!g.special?.merchantType);
  }
  for (const x of [800, 1600, 6400, 80000]) { const g = isolated(); g.normalGuard = 1; g.random = () => 0; hit(g, 'BOOST', { x }); assert.equal(g.special.merchantType, 'C'); }
});
test('A doubles incremental acceleration for exactly three events', () => {
  const g = merchant('STOPPER');
  for (let i = 0; i < 4; i++) {
    Object.assign(g.body, { vx: 100, vy: 0 }); g.applyContact('BOOST');
    near(g.body.vx, 100 + (c.boostImpulse*Math.cos(Math.PI/4)) * (i < 3 ? 2 : 1));
    assert.equal(g.merchant?.remaining ?? 0, Math.max(0, 2 - i));
  }
});
test('A excludes aerial, angle, brake, guard, launch and ordinary ground', () => {
  const g = merchant('STOPPER'); g.body.y = 300;
  g.aerial('UP'); g.aerial('DOWN');
  for (const type of ['ANGLE', 'BRAKE', 'GUARD', 'STOPPER']) g.applyContact(type);
  Physics.launch(g.body, 40, 1); impact(g); assert.equal(g.merchant.remaining, 3);
});
for (const type of ['BOUNCE', 'DASH', 'SPECIAL']) test('A covers ' + type, () => {
  const g = merchant('STOPPER'); Object.assign(g.body, { vx: 100, vy: -10 });
  if (type === 'SPECIAL') {
    hit(g, 'BOOST', { vx: 100, vy: -10, next: [{ x: 900, type: 'BOUNCE' }] }); g.act();
    near(g.body.vx, Math.min(c.maxHorizontalSpeed, 2 * c.specials.BOOST.speed * Math.cos(Math.PI / 4) - 100));
  } else {
    g.applyContact(type);
    near(g.body.vx, Math.min(c.maxHorizontalSpeed, 100 + 2 * (type === 'DASH' ? (c.boostImpulse*c.dashImpulseRatio*Math.cos(25*Math.PI/180)) : (c.boostImpulse*c.bounceImpulseRatio*Math.cos(Math.PI/3)))));
  }
  assert.equal(g.merchant.remaining, 2);
});
test('B charges beneficial events once, caps at ten, revives once then can reacquire', () => {
  const g = merchant('DASH'); assert.equal(g.merchant.charge, 0);
  for (const type of ['ANGLE', 'BRAKE', 'GUARD']) g.applyContact(type);
  assert.equal(g.merchant.charge, 0);
  for (let i = 0; i < 12; i++) g.applyContact(['BOOST', 'BOUNCE', 'DASH'][i % 3]);
  assert.equal(g.merchant.charge, 10); g.objects = [];
  Object.assign(g.body, { y: 0, grounded: true, vx: 1, vy: 0 }); g.update(c.physicsStep);
  assert.equal(g.state, 'FLYING'); assert.equal(g.merchant, null); assert.equal(g.merchantStats.revives, 1);
  near(Math.hypot(g.body.vx, g.body.vy), c.typeBBaseSpeed + 10 * c.typeBChargeBonus);
  assert.equal(g.revive(), false); g.acquireMerchant('B'); g.applyContact('BOOST'); assert(g.revive());
  assert.equal(g.merchantStats.revives, 2);
});
test('B SPECIAL counts one charge; normal STOPPER stop-equivalent revives', () => {
  const g = merchant('DASH'); hit(g, 'BOOST', { next: [{ x: 900, type: 'BOUNCE' }] }); g.act();
  assert.equal(g.merchant.charge, 1); g.body.vx = 100; g.applyContact('STOPPER');
  assert.equal(g.merchant, null); assert.equal(g.merchantStats.revives, 1);
  near(Math.hypot(g.body.vx, g.body.vy), c.typeBBaseSpeed + c.typeBChargeBonus);
});
test('B zero charge does not revive', () => {
  const g = merchant('DASH'); g.objects = [];
  Object.assign(g.body, { vx: 1, vy: 0, y: 0, grounded: true }); g.update(c.physicsStep);
  assert.equal(g.state, 'RESULT'); assert.equal(g.merchantStats.revives, 0);
});
test('C counts actual overtaken characters, ignores collision/aerial, applies exit once', () => {
  const g = merchant('BOOST'); const start = g.body.x;
  g.objects = Array.from({ length: 101 }, (_, i) => ({ x: start + 10 + i * 20, type: 'BRAKE', used: false }));
  const before = g.history.length, uses = g.upRemaining;
  assert.equal(g.aerial('UP'), false); assert.equal(g.aerial('DOWN'), false); g.act(); assert.equal(g.upRemaining, uses);
  g.floatStep(1 / c.typeCSpeed * 9); assert.equal(g.merchant.remaining, 100);
  g.floatStep(1 / c.typeCSpeed * 2); assert.equal(g.merchant.remaining, 99);
  near(g.body.y, c.typeCHeight); near(g.body.vy, 0); near(g.body.vx, c.typeCSpeed);
  g.contactObjects({ x: start, y: 10 }); assert.equal(g.history.length, before);
  g.floatStep(2); assert.equal(g.merchant, null); assert.equal(g.objects.filter(o => o.used).length, 100);
  near(g.body.x, start + 1990); near(g.body.vx, Math.min(c.maxHorizontalSpeed, c.typeCSpeed + (c.boostImpulse*Math.cos(Math.PI/4))));
  g.objects = []; g.update(c.physicsStep); assert(g.body.vx < c.maxHorizontalSpeed); assert(g.body.y > c.typeCHeight);
});
for (const fps of [30, 60, 120, 144]) test('C streams full 100 with fixed physics at ' + fps + 'fps', () => {
  const g = launch(39); g.acquireMerchant('C'); let frames = 0;
  while (g.merchant && frames++ < fps * 100) {
    g.update(1 / fps); assert(g.objects.length < 12); assert(Number.isFinite(g.body.x));
    if (g.merchant) { near(g.body.y, c.typeCHeight); near(g.body.vx, c.typeCSpeed); }
  }
  assert.equal(g.merchant, null); assert(g.body.x > 20000); assert(g.cameraX > 0); assert.equal(g.history.length, 0);
});
test('D five impact events accelerate, sixth uses original restitution', () => {
  const g = merchant('BOUNCE');
  for (let i = 0; i < 6; i++) {
    const event = impact(g);
    near(g.body.vx, event.vx * (i < 5 ? c.typeDMultiplier : c.bounceHorizontalRetention));
    near(g.body.vy, i < 5 ? Math.max(c.typeDMinVertical, -event.vy * c.typeDMultiplier) : -event.vy * c.restitution);
    assert.equal(g.merchant?.remaining ?? 0, Math.max(0, 4 - i));
  }
  assert.equal(g.body.bounces, 6);
});
test('rolling ground emits no repeated impact', () => {
  const b = Physics.create(); Object.assign(b, { y: 0.1, vy: -10, vx: 100, grounded: false });
  assert(Physics.step(b, c.physicsStep)); assert(b.grounded);
  for (let i = 0; i < 30; i++) assert.equal(Physics.step(b, c.physicsStep), undefined);
  assert.equal(b.bounces, 1);
});
test('all merchant replacements discard previous counters', () => {
  for (const old of ['A', 'B', 'C', 'D']) for (const type of ['A', 'B', 'C', 'D']) {
    const g = isolated(); g.acquireMerchant(old); g.merchant.charge = 9; g.merchant.remaining = 1;
    g.acquireMerchant(type); assert.equal(g.merchant.type, type);
    if (type === 'B') { assert.equal(g.merchant.charge, 0); assert.equal(g.merchant.remaining, undefined); }
    else { assert.equal(g.merchant.charge, undefined); assert.equal(g.merchant.remaining, { A: 3, C: 100, D: 5 }[type]); }
  }
});
test('normal generation: exactly one per boundary, clearance, no merchant, bounded memory', () => {
  const g = new Game(random(33)), seen = new Map();
  for (let x = 0; x < 80000; x += 100) {
    g.body.x = x; g.generateObjects(); assert(g.objects.length < 12);
    const xs = new Set();
    for (const o of g.objects) {
      assert(!xs.has(o.x)); xs.add(o.x); assert.notEqual(o.type, 'SPECIAL_ONLY');
      if (o.boundary) { assert.equal(o.x % 800, 0); seen.set(o.x, o); }
      else assert(Math.abs(o.x - Math.max(1, Math.round(o.x / 800)) * 800) >= c.boundaryClearance);
    }
  }
  for (let x = 800; x <= 80000; x += 800) assert(seen.has(x));
});
test('retry clears all new state and preserves BEST', () => {
  for (const type of ['A', 'B', 'C', 'D']) {
    const g = isolated(); g.debug = g.debugUsed = true; g.best.distance = 999; g.acquireMerchant(type);
    g.specialArmed = { dash: true, stopper: true }; g.special = { remaining: 0.8 };
    g.normalGuard = 1; g.upRemaining = 0; g.downCharge = 0.5; g.merchantStats.attempts = 5;
    g.merchantVisual = { type, remaining: 1 }; g.finish(); g.act();
    assert.equal(g.state, 'AIM_ANGLE'); assert.equal(g.best.distance, 999); assert.equal(g.merchant, null);
    assert.equal(g.special, null); assert.equal(g.merchantVisual, null); assert.equal(g.normalGuard, 0);
    assert.equal(g.specialArmed.dash, false); assert.equal(g.specialArmed.stopper, false);
    assert.equal(g.merchantStats.attempts, 0); assert.equal(g.merchantStats.lastType, null);
    assert.equal(g.upRemaining, 3); assert.equal(g.downCharge, 1); assert.equal(g.history.length, 0);
    assert(g.objects.every(o => !o.used));
  }
});
for (const fps of [30, 60, 120, 144]) test('merchant window, input isolation at ' + fps + 'fps', () => {
  const g = isolated(); g.normalGuard = 1; g.random = () => 0; hit(g, 'STOPPER', { x: 800 });
  const x = g.body.x;
  for (let i = 0; i < fps - 1; i++) g.update(1 / fps);
  assert(g.special); near(g.body.x, x); g.update(1 / fps);
  assert.equal(g.special, null); assert.equal(g.specialMessage.label, 'SPECIAL MISS'); assert.equal(g.normalGuard, 0);
});
test('merchant pointer priority, HUD, result', () => {
  const g = isolated(), ui = new UI(g, element('canvas')); scope.Hop.bindInput(g, ui); g.random = () => 0;
  for (const type of ['DASH', 'BOUNCE']) {
    g.normalGuard = 1; hit(g, type, { x: 800 }); ui.update(); ui.draw();
    assert.equal(element('special-title').textContent, 'MERCHANT SPECIAL!');
    element('stage').listeners.pointerdown({button:0,isPrimary:true,preventDefault(){}});
    assert.equal(g.special, null); assert.equal(g.upRemaining, 3);
  }
  ui.update(); assert(element('merchant-hud-text').textContent.includes('BOUND ×5'));
  g.debugUsed = true; g.finish(); ui.update(); ui.draw();
  assert.equal(element('special-panel').hidden, true); assert.equal(element('contact-tag').hidden, true);
  assert(element('merchant-totals').textContent.includes('発生 2 / 成功 2'));
  element('stage').listeners.pointerdown({button:0,isPrimary:true,preventDefault(){}}); assert.equal(g.state, 'AIM_ANGLE');
});
test('bounded active SPECIAL/merchant runs terminate after releasing controls', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = launch(seed); g.acquireMerchant(['A', 'B', 'C', 'D'][seed % 4]);
    let frames = 0;
    while (g.state === 'FLYING' && frames < 120 * 300) {
      if (frames < 1200) {
        if (g.special) g.act();
        if (frames % 100 === 0) g.aerial('UP');
        if (frames % 200 === 0) g.aerial('DOWN');
      }
      g.update(c.physicsStep); frames++; assert(Number.isFinite(g.body.x)); assert(g.objects.length < 12);
    }
    assert.equal(g.state, 'RESULT', 'seed ' + seed);
  }
});
console.log(JSON.stringify({ formalSpecials: 'PASS', cases, activeRuns: 40, fps: [30, 60, 120, 144], coverage: '4 specials; arming; priorities; merchant A-D; generation; input; reset; termination' }, null, 2));

module.exports={test,near,isolated,hit,impact,merchant};
