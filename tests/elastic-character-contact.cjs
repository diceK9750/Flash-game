// Character contacts reflect a downward velocity once, then apply the existing effect.
// This loads the shipped physics and game directly: the historical phase fixtures pin
// earlier rules and are intentionally not used as the expected values here.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = { console, localStorage: { getItem: () => null, setItem() {} } };
scope.window = scope;
vm.createContext(scope);
for (const name of ['config', 'physics', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8'), scope, { filename: name + '.js' });
}
const { Game, CONFIG: c, STATES } = scope.Hop;
const near = (actual, expected, what, eps = 1e-7) => assert(Math.abs(actual - expected) < eps, `${what}: ${actual} != ${expected}`);
function game() {
  const g = new Game(() => .999999);
  g.state = STATES.FLYING; g.comboEnabled = false;
  g.objects = []; g.nextObjectX = g.nextBoundaryX = Infinity;
  Object.assign(g.body, { x: 480, y: 10, vx: 500, vy: -100, grounded: false, stopped: false });
  return g;
}
function contact(g, type, opts = {}) {
  const x = opts.x ?? 500;
  Object.assign(g.body, { x: x - 20, y: 10, vx: opts.vx ?? 500, vy: opts.vy ?? -100, grounded: false, stopped: false });
  const object = { x, type, used: false };
  g.objects = [object, ...(opts.next || [])]; g.nextObjectX = g.nextBoundaryX = Infinity;
  g.contactObjects({ x: x - 70, y: 10 });
  assert(object.used, type + ' detected via swept contact');
  return object;
}
function watchCollisionOrder(g) {
  const events = [], ground = g.groundImpact, normal = g.normalContact;
  g.groundImpact = function (impact) {
    const incoming = { vx: impact.vx, vy: impact.vy }, result = ground.call(this, impact);
    events.push({ type: 'ground', incoming, x: this.body.x, y: this.body.y, vx: this.body.vx, vy: this.body.vy });
    return result;
  };
  g.normalContact = function (...args) {
    events.push({ type: args[0], x: this.body.x, y: this.body.y, vx: this.body.vx, vy: this.body.vy });
    return normal.apply(this, args);
  };
  return events;
}

// Every ordinary contact gets the same reflected incoming vector before its effect,
// including non-additive effects and STOPPER (whose final vector is zero).
for (const type of ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER']) {
  const g = game(), original = g.applyContact; let input;
  g.applyContact = function (kind) { input = { vx: this.body.vx, vy: this.body.vy }; return original.call(this, kind); };
  const object = contact(g, type);
  assert.equal(g.special, null, type + ' is a normal contact');
  near(input.vx, 500, type + ' incoming vx'); near(input.vy, 100, type + ' reflected vy');
  if (type === 'BOOST' || type === 'BOUNCE' || type === 'DASH') {
    const gain = type === 'BOOST' ? c.boostImpulse : c.boostImpulse * (type === 'BOUNCE' ? c.bounceImpulseRatio : c.dashImpulseRatio);
    const a = c[type.toLowerCase() + 'Angle'] * Math.PI / 180;
    near(g.body.vx, 500 + gain * Math.cos(a), type + ' vx');
    near(g.body.vy, 100 + gain * Math.sin(a), type + ' vy');
  } else if (type === 'BRAKE') {
    near(g.body.vx, 500 * c.brakeRetention, 'BRAKE vx'); near(g.body.vy, 100 * c.brakeRetention, 'BRAKE vy');
  } else if (type === 'ANGLE') {
    near(g.body.vx, 100, 'ANGLE vx'); near(g.body.vy, 500, 'ANGLE vy');
  } else if (type === 'GUARD') {
    near(g.body.vx, 500, 'GUARD vx'); near(g.body.vy, 100, 'GUARD vy'); assert.equal(g.normalGuard, 1);
  } else {
    near(g.body.vx, 0, 'STOPPER vx'); near(g.body.vy, 0, 'STOPPER vy'); assert(g.body.stopped);
  }
  const velocity = [g.body.vx, g.body.vy], count = g.history.length;
  g.contactObjects({ x: object.x - 70, y: 10 });
  assert.deepEqual([g.body.vx, g.body.vy], velocity, type + ' cannot trigger again');
  assert.equal(g.history.length, count, type + ' history is single use');
}

// An elastic floor only reflects an incoming downward vector; rising and zero stay as-is.
for (const vy of [250, 0, -250]) {
  const g = game(); contact(g, 'GUARD', { vy });
  near(g.body.vx, 500, 'neutral contact vx'); near(g.body.vy, Math.abs(vy), 'neutral contact vy ' + vy);
}
for (const type of ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER']) for (const vy of [0, 250]) {
  const g = game(), original = g.applyContact; let incoming;
  g.applyContact = function (kind) { incoming = this.body.vy; return original.call(this, kind); };
  contact(g, type, { vy }); near(incoming, vy, type + ' non-descending input unchanged');
}
{
  const g = game(); g.aerialDownLock = -Math.PI / 6; g.aerialMode = 'UP';
  contact(g, 'GUARD', { vy: -250 });
  assert.equal(g.aerialDownLock, null, 'contact clears the prior dive lock');
  assert.equal(g.aerialMode, 'DOWN', 'the reflected upward vector selects DOWN');
}
{
  const g = game(); contact(g, 'BOOST', { vx: 1900, vy: -1400 });
  near(g.body.vx, c.maxHorizontalSpeed, 'BOOST keeps existing horizontal speed cap after vector addition');
  near(g.body.vy, c.maxVerticalSpeed, 'BOOST keeps existing vertical speed cap after vector addition');
}

// Guard blocks the character effect, not the mechanical reflection of the encounter.
for (const type of ['BOOST', 'BOUNCE', 'DASH', 'STOPPER']) {
  const g = game(); g.normalGuard = 1; contact(g, type);
  assert.equal(g.special, null); assert.equal(g.normalGuard, 0);
  assert.match(g.contact.label, /GUARD BLOCK/);
  near(g.body.vx, 500, type + ' protected vx'); near(g.body.vy, 100, type + ' protected reflected vy');
}
{
  const g = game(); g.guardSpecial = { active: true, remaining: 5 }; g.normalGuard = 1;
  contact(g, 'STOPPER'); assert.equal(g.special, null); assert(g.guardSpecial.active);
  assert.equal(g.normalGuard, 1, 'special guard preserves the normal guard');
  assert.match(g.contact.label, /GUARD BLOCK/); assert(!g.body.stopped);
  near(g.body.vx, 500, 'protected STOPPER vx'); near(g.body.vy, 100, 'protected STOPPER still reflects');
}
{
  const g = game(); g.acquireMerchant('A'); const remaining = g.merchant.remaining;
  contact(g, 'BOOST', { vx: 100, vy: -100 });
  const component = c.boostImpulse * Math.cos(c.boostAngle * Math.PI / 180);
  near(g.body.vx, Math.min(c.maxHorizontalSpeed, 100 + c.typeAMultiplier * component), 'A multiplies BOOST change');
  near(g.body.vy, Math.min(c.maxVerticalSpeed, 100 + c.typeAMultiplier * component), 'A multiplies BOOST after reflection');
  assert.equal(g.merchant.remaining, remaining - 1, 'A charge consumed once');
}
{
  const g = game(); g.acquireMerchant('B'); const charge = g.merchant.charge;
  contact(g, 'BOOST'); near(g.body.vy, 100 + c.boostImpulse * Math.sin(c.boostAngle * Math.PI / 180), 'B BOOST reflected vy');
  assert.equal(g.merchant.charge, Math.min(c.typeBMaxCharge, charge + 1), 'B charges once');
}

// Pending SPECIAL starts with the already reflected velocity. A miss applies the
// ordinary effect once; the original fixed-vector SPECIAL success remains distinct.
for (const type of ['BOOST', 'BOUNCE']) for (const success of [true, false]) {
  const g = game(), rule = c.specials[type];
  contact(g, type, { next: [{ x: 900, type: rule.partner, used: false }] });
  assert(g.special); near(g.body.vy, 100, type + ' pending reflected vy');
  near(g.special.velocity.vy, 100, type + ' pending saved velocity');
  assert(g.resolveSpecial(success));
  if (success) {
    near(g.body.vx, rule.speed * Math.cos(rule.angle * Math.PI / 180), type + ' SPECIAL vx');
    near(g.body.vy, rule.speed * Math.sin(rule.angle * Math.PI / 180), type + ' SPECIAL vy');
  } else {
    const gain = c.boostImpulse * (type === 'BOOST' ? 1 : c.bounceImpulseRatio);
    near(g.body.vy, 100 + gain * Math.sin(c[type.toLowerCase() + 'Angle'] * Math.PI / 180), type + ' SPECIAL MISS vy');
  }
  assert.equal(g.resolveSpecial(true), false);
}

// BRAKE SPECIAL preserves the reflected vector; its MISS halves it. ANGLE
// SPECIAL rotates the reflected vector horizontally without changing speed.
for (const success of [true, false]) {
  const g = game(); g.specialArmed.brake = true; contact(g, 'BRAKE'); assert(g.special);
  near(g.special.velocity.vy, 100, 'BRAKE pending vy'); g.resolveSpecial(success);
  near(g.body.vx, success ? 500 : 500 * c.brakeRetention, 'BRAKE resolved vx');
  near(g.body.vy, success ? 100 : 100 * c.brakeRetention, 'BRAKE resolved vy');
}
{
  const g = game(); g.random = () => 0; contact(g, 'ANGLE'); assert(g.special);
  g.resolveSpecial(true); near(g.body.vx, Math.hypot(500, 100), 'ANGLE SPECIAL speed'); near(g.body.vy, 0, 'ANGLE SPECIAL vy');
}
for (const success of [true, false]) {
  const g = game(); g.normalGuard = 1; contact(g, 'GUARD'); assert(g.special);
  near(g.special.velocity.vy, 100, 'GUARD SPECIAL snapshot'); g.resolveSpecial(success);
  near(g.body.vx, 500, 'GUARD SPECIAL resolved vx'); near(g.body.vy, 100, 'GUARD SPECIAL resolved vy');
  if (success) assert(g.guardSpecial.active); else assert.equal(g.normalGuard, 1);
}
for (const type of ['DASH', 'STOPPER']) for (const success of [true, false]) {
  const g = game(), rule = c.specials[type]; g.specialArmed[rule.trigger] = true;
  contact(g, type); assert(g.special); near(g.special.velocity.vy, 100, type + ' SPECIAL snapshot');
  g.resolveSpecial(success);
  if (success) {
    near(g.body.vx, rule.speed * Math.cos(rule.angle * Math.PI / 180), type + ' SPECIAL vx');
    near(g.body.vy, rule.speed * Math.sin(rule.angle * Math.PI / 180), type + ' SPECIAL vy');
  } else if (type === 'DASH') {
    near(g.body.vx, 500 + c.boostImpulse * c.dashImpulseRatio * Math.cos(c.dashAngle * Math.PI / 180), 'DASH MISS vx');
    near(g.body.vy, 100 + c.boostImpulse * c.dashImpulseRatio * Math.sin(c.dashAngle * Math.PI / 180), 'DASH MISS vy');
  } else assert(g.body.stopped, 'STOPPER MISS applies the existing stop');
}

// Merchant has priority; its effects still run after the one reflected contact.
for (const [type, merchant] of [['STOPPER', 'A'], ['DASH', 'B'], ['BOOST', 'C'], ['BOUNCE', 'D']]) {
  const g = game(); g.normalGuard = 1; g.random = () => 0;
  contact(g, type, { x: 800 }); assert.equal(g.special?.merchantType, merchant);
  near(g.body.vy, 100, merchant + ' merchant pending reflected vy');
  near(g.special.velocity.vy, 100, merchant + ' merchant snapshot');
  g.resolveSpecial(true); assert.equal(g.merchant?.type, merchant);
  if (merchant === 'B' || merchant === 'D') near(g.body.vy, 100, merchant + ' retains reflected vy');
  if (merchant === 'C') { near(g.body.vy, 0, 'C sets float vy'); near(g.body.y, c.typeCHeight, 'C sets float height'); }
}
{
  const g = game(); g.normalGuard = 1; g.random = () => 0;
  contact(g, 'BOOST', { x: 800 }); assert.equal(g.special?.merchantType, 'C');
  g.resolveSpecial(false); near(g.body.vx, 500, 'merchant MISS guard vx'); near(g.body.vy, 100, 'merchant MISS does not reflect twice');
}

// A real ground impact immediately followed by a character in the same physics
// step must retain the pre-existing (inelastic) ground rebound, not reverse it again.
{
  // The left edge of the expanded object box is x=455. Ground is reached
  // before the player travels from x=454 to that edge.
  const g = game(); Object.assign(g.body, { x: 454, y: .1, vx: 500, vy: -200, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'GUARD', used: false }];
  const events = watchCollisionOrder(g);
  g.update(c.physicsStep);
  assert.equal(g.body.bounces, 1); assert.equal(g.counts.GUARD, 1);
  assert.deepEqual(events.map(e => e.type), ['ground', 'GUARD'], 'ground precedes character contact');
  near(events[0].vy, -events[0].incoming.vy * c.restitution, 'ground applies its existing restitution');
  near(events[0].vx, events[0].incoming.vx * c.bounceHorizontalRetention, 'ground applies its existing horizontal retention');
  near(events[1].x, 455, 'later character reached at its crossing', 1e-5);
  assert(events[0].vy > events[1].vy && events[1].vy > 0 && g.body.vy > 0, 'only gravity/drag reduce the already-upward rebound');
}
{
  const g = game(), ground = g.groundImpact, normal = g.normalContact, order = []; let beforeBoost, afterBoost;
  g.groundImpact = function (impact) { order.push('ground'); return ground.call(this, impact); };
  g.normalContact = function (...args) {
    order.push(args[0]); beforeBoost = { vx: this.body.vx, vy: this.body.vy };
    const result = normal.apply(this, args); afterBoost = { vx: this.body.vx, vy: this.body.vy }; return result;
  };
  Object.assign(g.body, { x: 454, y: .1, vx: 500, vy: -200, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'BOOST', used: false }]; g.update(c.physicsStep);
  assert.deepEqual(order, ['ground', 'BOOST']); assert.equal(g.body.bounces, 1); assert(beforeBoost.vy > 0);
  near(afterBoost.vx, beforeBoost.vx + c.boostImpulse * Math.cos(c.boostAngle * Math.PI / 180), 'ground-first BOOST vx');
  near(afterBoost.vy, beforeBoost.vy + c.boostImpulse * Math.sin(c.boostAngle * Math.PI / 180), 'ground-first BOOST vy');
}
// Swept contact enters the character box before the real ground is reached
// inside this same fixed step. The contact must be handled first: otherwise the
// physical floor incorrectly damps the incoming velocity before it is reflected.
{
  const g = game(); Object.assign(g.body, { x: 450, y: 3, vx: 2000, vy: -500, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'GUARD', used: false }];
  g.update(c.physicsStep);
  assert.equal(g.counts.GUARD, 1, 'swept contact detected before ground');
  assert.equal(g.body.bounces, 0, 'character rebound prevents later ground impact in the same step');
  assert(g.body.y > 0 && g.body.vy > 490, 'upward velocity retains the near-elastic incoming vertical speed');
}
// The location and incoming speed at a character crossing matter even when
// the player would not hit the real ground in the current step.
{
  const g = game(), original = g.normalContact; let at;
  g.normalContact = function (...args) { at = { x: this.body.x, y: this.body.y, vy: this.body.vy }; return original.apply(this, args); };
  Object.assign(g.body, { x: 450, y: 50, vx: 2000, vy: -100, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'GUARD', used: false }]; g.update(c.physicsStep);
  assert(at, 'character crossing was reached');
  near(at.x, 455, 'contact is resolved at the character box entry', 1e-5);
  assert(at.y > 49.7 && at.y < 49.8, 'height corresponds to elapsed contact time');
  assert(at.vy > 100 && at.vy < 104, 'incoming speed is reflected at that instant');
  assert.equal(g.body.bounces, 0, 'there was no real ground impact');
}
// The current ordering gives a mathematically simultaneous impact to the real
// ground; it must generate one real bounce and one character contact, without
// an extra inversion. Solve the impact time independently from the step code.
{
  const g = game(), dt = c.physicsStep, vx = 500, vy = -200, gap = 1;
  let lo = 0, hi = dt;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (vx * Math.exp(-c.airDrag * mid) * mid < gap) lo = mid; else hi = mid; }
  const time = (lo + hi) / 2, vyAtHit = vy * Math.exp(-c.airDrag * time) - c.gravity * time;
  Object.assign(g.body, { x: 454, y: -vyAtHit * time, vx, vy, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'GUARD', used: false }];
  const events = watchCollisionOrder(g);
  g.update(dt);
  assert.equal(g.counts.GUARD, 1, 'tied character contact'); assert.equal(g.body.bounces, 1, 'tie resolves real ground first');
  assert.deepEqual(events.map(e => e.type), ['ground', 'GUARD'], 'ground wins simultaneous tie');
  near(events[0].vy, -events[0].incoming.vy * c.restitution, 'tied ground rebound');
  assert(events[1].vy > 0 && g.body.vy > 0, 'tied ground rebound is not inverted again');
}

// Two distinct characters at the same crossing are each processed once;
// only the incoming downward motion is reversed, not the already-upward vector
// before applying the second character's ordinary effect.
{
  const g = game(); Object.assign(g.body, { x: 450, y: 3, vx: 2000, vy: -500, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'GUARD', used: false }, { x: 500, type: 'BRAKE', used: false }];
  g.update(c.physicsStep);
  assert.equal(g.counts.GUARD, 1); assert.equal(g.counts.BRAKE, 1);
  assert.deepEqual(Array.from(g.history, h => h.type), ['GUARD', 'BRAKE']);
  assert.equal(g.body.bounces, 0); assert(g.body.vy > 245 && g.body.vy < 260, 'BRAKE halves the reflected vertical velocity');
  const before = [g.body.vx, g.body.vy]; g.contactObjects({ x: 450, y: 3 });
  assert.deepEqual([g.body.vx, g.body.vy], before, 'used characters do not re-trigger');
}
// Two crossings separated in space but both inside a single fixed step should
// resolve chronologically, not at the step endpoint or in reverse object order.
{
  const g = game(), original = g.normalContact, contacts = [];
  g.normalContact = function (...args) { contacts.push({ type: args[0], x: this.body.x }); return original.apply(this, args); };
  g.guardSpecial = { active: true, remaining: 5 }; // avoid GUARD's foresight SPECIAL in this synthetic close-pair case
  Object.assign(g.body, { x: 450, y: 50, vx: 2000, vy: -100, grounded: false, stopped: false });
  g.objects = [{ x: 504, type: 'BRAKE', used: false }, { x: 500, type: 'GUARD', used: false }];
  g.update(c.physicsStep);
  assert.deepEqual(contacts.map(v => v.type), ['GUARD', 'BRAKE'], 'earliest crossing wins over storage order');
  near(contacts[0].x, 455, 'first crossing position', 1e-5); near(contacts[1].x, 459, 'second crossing position', 1e-5);
  assert.equal(g.counts.GUARD, 1); assert.equal(g.counts.BRAKE, 1);
}

// A SPECIAL reached before the floor freezes at the character crossing. Time
// still advances only through its decision window; a MISS applies normal BOOST
// once to the reflected velocity, and RETRY removes every pending state.
{
  const g = game(), normal = g.normalContact; let afterMiss;
  g.normalContact = function (...args) { const result = normal.apply(this, args); afterMiss = { vx: this.body.vx, vy: this.body.vy }; return result; };
  Object.assign(g.body, { x: 450, y: 3, vx: 2000, vy: -500, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'BOOST', used: false }, { x: 900, type: 'BOUNCE', used: false }];
  g.update(c.physicsStep); assert(g.special); assert.equal(g.body.bounces, 0);
  const at = { x: g.body.x, y: g.body.y, vx: g.body.vx, vy: g.body.vy }, windowAt = g.special.remaining;
  near(g.special.velocity.vy, at.vy, 'SPECIAL captured reflected velocity'); assert(at.y > 0 && at.vy > 490);
  for (let i = 0; i < 60; i++) g.update(c.physicsStep);
  assert(g.special); near(g.special.remaining, windowAt - 60 * c.physicsStep, 'SPECIAL window counts elapsed fixed steps');
  near(g.body.x, at.x, 'SPECIAL freeze x'); near(g.body.y, at.y, 'SPECIAL freeze y');
  for (let i = 0; i < 65 && g.special; i++) g.update(c.physicsStep);
  assert.equal(g.special, null); assert.equal(g.specialMessage?.label, 'SPECIAL MISS');
  assert(afterMiss, 'MISS applied the ordinary effect');
  near(afterMiss.vx, Math.min(c.maxHorizontalSpeed, at.vx + c.boostImpulse * Math.cos(c.boostAngle * Math.PI / 180)), 'SPECIAL MISS vx');
  near(afterMiss.vy, Math.min(c.maxVerticalSpeed, at.vy + c.boostImpulse * Math.sin(c.boostAngle * Math.PI / 180)), 'SPECIAL MISS vy');
  g.debugUsed = true; g.finish(); g.act();
  assert.equal(g.state, STATES.AIM_ANGLE); assert.equal(g.special, null); assert.equal(g.history.length, 0); near(g.accumulator, 0, 'RETRY clears partial step');
}

// Same fixed-step trajectory from a timed real collision across common displays.
const trajectories = [];
for (const fps of [30, 60, 120, 144]) {
  const g = game(); Object.assign(g.body, { x: 430, y: 15, vx: 500, vy: -100, grounded: false, stopped: false });
  g.objects = [{ x: 500, type: 'GUARD', used: false }];
  for (let i = 0; i < fps * 2; i++) g.update(1 / fps);
  assert.equal(g.counts.GUARD, 1, fps + 'Hz contact');
  trajectories.push([g.body.x, g.body.y, g.body.vx, g.body.vy]);
}
for (const v of trajectories.slice(1)) for (let i = 0; i < v.length; i++) near(v[i], trajectories[0][i], 'fps independent trajectory');

// RETRY resets transient contact data and leaves the next contact able to reflect.
{
  const g = game(); g.debugUsed = true; contact(g, 'GUARD'); g.finish(); g.act();
  assert.equal(g.state, STATES.AIM_ANGLE); assert.equal(g.history.length, 0); assert.equal(g.counts.GUARD, 0);
  g.state = STATES.FLYING; contact(g, 'GUARD', { vy: -300 }); near(g.body.vy, 300, 'RETRY reflects a new contact');
}
console.log('Character contact elastic rebound PASS: seven types, up/down, guards, SPECIAL/MISS, merchant A-D, single use, ground ordering, 30-144Hz and RETRY.');
