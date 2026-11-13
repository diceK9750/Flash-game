'use strict';
// Character-entry timing through the shipped Game.update and Physics implementations.
// No user storage, browser, historical config override, or test-only game mutation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const scope = { localStorage: { getItem: () => null, setItem() {} } };
scope.window = scope;
vm.createContext(scope);
for (const name of ['config', 'physics', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', `${name}.js`), 'utf8'), scope, { filename: `${name}.js` });
}
const { Game, CONFIG: c, STATES } = scope.Hop;
const dt = c.physicsStep;
const near = (actual, expected, tolerance, label) =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected} (±${tolerance})`);
function make({ y = 50, vx = 2000, vy = -500, objects = [{ x: 500, type: 'GUARD', used: false }] } = {}) {
  const g = new Game(() => .999999);
  g.state = STATES.FLYING; g.comboEnabled = false;
  Object.assign(g.body, { x: 450, y, vx, vy, grounded: false, stopped: false });
  g.objects = objects; g.nextObjectX = g.nextBoundaryX = Infinity;
  return g;
}
function observe(g) {
  const events = [], normal = g.normalContact, ground = g.groundImpact;
  g.normalContact = function (type, entry, guard) {
    events.push({ type, x: this.body.x, y: this.body.y, vx: this.body.vx, vy: this.body.vy,
      guardActive: this.guardSpecial.active, guardRemaining: this.guardSpecial.remaining, downCharge: this.downCharge });
    return normal.call(this, type, entry, guard);
  };
  g.groundImpact = function (...args) { events.push({ type: 'GROUND' }); return ground.apply(this, args); };
  return events;
}
// Reference motion uses the same partial-step integration rule as Physics.step.
// The root is solved independently of the collision detector under test.
function advance(b, t) {
  const drag = Math.exp(-c.airDrag * t), vx = b.vx * drag, vy = b.vy * drag - c.gravity * t;
  return { x: b.x + vx * t, y: b.y + vy * t, vx, vy };
}
function hitTime(b, x) {
  const boundary = x - c.objectWidth / 2 - c.playerRadius;
  let lo = 0, hi = dt;
  assert(advance(b, hi).x >= boundary, 'fixture crosses the contact boundary');
  for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (advance(b, m).x < boundary) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// The character must be struck at the swept entry, not at the end of the step;
// the remaining time must then move the already-reflected hero in the same update.
{
  const g = make(), before = { ...g.body }, events = observe(g), t = hitTime(before, 500);
  const incoming = advance(before, t), expected = advance({ ...incoming, vy: -incoming.vy }, dt - t);
  g.update(dt);
  assert.equal(events.length, 1); assert.equal(events[0].type, 'GUARD');
  near(events[0].x, 455, .02, 'contact at character boundary');
  near(events[0].y, incoming.y, .05, 'height at contact');
  near(events[0].vy, -incoming.vy, .1, 'vertical speed reflected at contact');
  near(g.body.x, expected.x, .06, 'remaining-time x'); near(g.body.y, expected.y, .06, 'remaining-time y');
  near(g.body.vx, expected.vx, .1, 'remaining-time vx'); near(g.body.vy, expected.vy, .1, 'remaining-time vy');
  assert.equal(g.body.bounces, 0); assert.equal(g.counts.GUARD, 1);
}

// Ground and character order depend on their actual time of impact. In the
// equal-time case either single deterministic ordering is acceptable, but no
// character may be counted twice or leave a non-finite state.
{
  const first = make({ y: 3 }), a = observe(first); first.update(dt);
  assert.equal(a[0].type, 'GUARD', 'character reaches its boundary first');
  assert(!a.some(e => e.type === 'GROUND'), 'no ground bounce after upward character reflection');
  assert.equal(first.body.bounces, 0); assert(first.body.y > 0);
  const second = make({ y: .2 }), b = observe(second); second.update(dt);
  assert.deepEqual(b.map(e => e.type), ['GROUND', 'GUARD'], 'ground reaches first and retains its own bounce');
  assert.equal(second.body.bounces, 1); assert.equal(second.counts.GUARD, 1);
  const probe = make({ y: 0 }), start = { ...probe.body }, t = hitTime(start, 500);
  const tieY = -advance({ ...start, y: 0 }, t).y;
  const runTie = () => { const g = make({ y: tieY }), e = observe(g); g.update(dt); return { g, e }; };
  const left = runTie(), right = runTie();
  assert.equal(left.g.counts.GUARD, 1); assert(left.g.body.bounces <= 1);
  assert([left.g.body.x, left.g.body.y, left.g.body.vx, left.g.body.vy].every(Number.isFinite));
  assert.deepEqual(left.e.map(e => e.type), right.e.map(e => e.type), 'equal-time order is deterministic');
}
// Merchant D is triggered only by a real ground impact, not by the new
// character rebound; ground-first still consumes exactly one shoe bounce.
for (const [y, groundFirst] of [[3, false], [.2, true]]) {
  const g = make({ y }); g.acquireMerchant('D'); const remaining = g.merchant.remaining, e = observe(g);
  g.update(dt); assert.equal(g.counts.GUARD, 1, 'character contact with merchant D');
  assert.equal(g.body.bounces, groundFirst ? 1 : 0, 'only the actual floor counts as a ground bounce');
  assert.equal(g.merchant.remaining, remaining - (groundFirst ? 1 : 0), 'merchant D consumes only a real floor bounce');
  assert.equal(e[0].type, groundFirst ? 'GROUND' : 'GUARD', 'merchant D event order');
}
// A ground impact can accelerate the hero (merchant D). An object beyond the
// original velocity's reach is still contacted in this same fixed step when
// the bounce increases horizontal speed enough to cross its near boundary.
{
  const g = make({ y: .001, vx: 100, vy: -500, objects: [{ x: 45.9, type: 'GUARD', used: false }] });
  g.body.x = 0; g.acquireMerchant('D'); const e = observe(g);
  g.update(dt);
  assert.deepEqual(e.map(event => event.type), ['GROUND', 'GUARD'], 'merchant D ground acceleration reaches character within the same step');
  near(e[1].x, .9, .02, 'post-bounce character boundary');
  assert.equal(g.body.bounces, 1); assert.equal(g.counts.GUARD, 1);
  assert(g.body.x > e[1].x, 'remaining time advances after the character contact');
  g.update(dt); assert.equal(g.counts.GUARD, 1, 'post-bounce character is single use');
}

// Horizontal broad-phase bounds must include stationary vertical contacts,
// backward travel and contacts far along a long run.
{
  const g = make({ y: 70, vx: 0, vy: -1500, objects: [{ x: 495, type: 'GUARD', used: false }] });
  const e = observe(g); g.update(dt);
  assert.equal(e.length, 1, 'stationary horizontal edge detects vertical contact');
  near(e[0].y, c.objectHeight, .02, 'vertical contact at object top'); assert(e[0].vy > 0);
}
{
  const g = make({ y: 50, vx: -1000, vy: -500, objects: [{ x: 500, type: 'GUARD', used: false }] });
  g.body.x = 550; const e = observe(g); g.update(dt);
  assert.equal(e.length, 1, 'negative horizontal velocity reaches the right edge');
  near(e[0].x, 545, .02, 'right-side contact boundary'); assert(e[0].vy > 0);
}
{
  const base = 1e9, g = make({ y: 50, vx: 1000, vy: -1000, objects: [{ x: base + 50, type: 'GUARD', used: false }] });
  g.body.x = base; g.aerialDownLock = -Math.PI / 4; const e = observe(g); g.update(dt);
  assert.equal(e.length, 1, 'contact is detected at large world coordinates');
  near(e[0].x, base + 5, .02, 'large-coordinate contact boundary');
  near(e[0].vy / e[0].vx, 1, 1e-8, 'locked downward angle is reflected at contact');
  assert.equal(g.aerialDownLock, null, 'real contact clears the dive lock');
}

// Guard expiry must be compared with the actual contact time, not the end of
// the enclosing fixed step. The guard blocks the effect, not the reflection.
for (const [remaining, blocked] of [[.004, true], [.001, false]]) {
  const g = make({ y: 3, objects: [{ x: 500, type: 'STOPPER', used: false }] });
  g.guardSpecial = { active: true, remaining }; const events = observe(g);
  g.update(dt);
  const hit = events.find(e => e.type === 'STOPPER'); assert(hit, 'STOPPER contact');
  assert.equal(hit.guardActive, blocked, 'guard status at the actual contact');
  assert.equal(!!g.body.stopped, !blocked, 'only an expired guard permits STOPPER');
  assert.equal(g.counts.STOPPER, 1);
}

// DOWN charging progresses until SPECIAL starts and remains paused throughout
// its decision window. Position must not advance while waiting for input.
{
  const g = make({ y: 3, objects: [{ x: 500, type: 'BOOST', used: false }, { x: 900, type: 'BOUNCE', used: false }] });
  const initial = { ...g.body }, t = hitTime(initial, 500); g.downCharge = .2;
  g.update(dt); assert(g.special, 'BOOST SPECIAL opened');
  near(g.downCharge, .2 + t / c.aerialDownRechargeTime, .00005, 'charge stops at the contact time');
  const atContact = { x: g.body.x, y: g.body.y }, charge = g.downCharge;
  const remaining = g.special.remaining;
  assert(remaining > c.specialWindow - dt - 1e-8 && remaining <= c.specialWindow, 'decision window accounts for at most the remainder of this step');
  g.update(dt * 12);
  near(g.body.x, atContact.x, 1e-8, 'SPECIAL wait freezes x'); near(g.body.y, atContact.y, 1e-8, 'SPECIAL wait freezes y');
  near(g.downCharge, charge, 1e-8, 'SPECIAL wait freezes charge'); assert(g.special);
  assert(g.special.remaining < remaining, 'decision window advances while waiting');
  assert(g.resolveSpecial(true));
  const x = g.body.x; g.update(dt); assert(g.body.x > x, 'flight resumes after SPECIAL');
  assert.equal(g.counts.BOOST, 1, 'SPECIAL does not replay the contact');
}
// With the actual combo enabled, the post-SPECIAL body stays frozen while the
// animation is active; both natural completion and skipping resume flight.
for (const skip of [false, true]) {
  const g = make({ y: 3, objects: [{ x: 500, type: 'BOOST', used: false }, { x: 900, type: 'BOUNCE', used: false }] });
  g.comboEnabled = true; g.update(dt); assert(g.special); g.act(); assert(g.combo, 'combo starts after SPECIAL success');
  const before = { x: g.body.x, y: g.body.y, vx: g.body.vx, vy: g.body.vy };
  for (let i = 0; i < 5; i++) g.update(dt);
  assert(g.combo); assert.deepEqual({ x: g.body.x, y: g.body.y, vx: g.body.vx, vy: g.body.vy }, before, 'combo freezes physics');
  if (skip) { g.act(); assert.equal(g.combo, null, 'tap skips combo'); }
  else {
    let frames = 0;
    while (g.combo && frames++ < 1000) {
      g.update(dt);
      if (g.combo) assert.deepEqual({ x: g.body.x, y: g.body.y, vx: g.body.vx, vy: g.body.vy }, before, 'physics stays frozen until the combo ends');
    }
    assert.equal(g.combo, null, 'combo ends naturally');
  }
  const x = g.body.x; g.update(dt); assert(g.body.x > x, 'flight resumes after combo');
  assert.equal(g.counts.BOOST, 1, 'combo does not replay the contact');
}
// If a decision window times out partway through a fixed step, the remainder
// belongs to flight after the MISS and must not disappear.
{
  const g = make({ y: 3, objects: [{ x: 500, type: 'BOOST', used: false }, { x: 900, type: 'BOUNCE', used: false }] });
  g.update(dt); assert(g.special);
  let steps = 0;
  while (g.special && g.special.remaining >= dt && steps++ < 300) g.update(dt);
  assert(g.special && g.special.remaining > 0 && g.special.remaining < dt, 'fractional timeout boundary reached');
  const x = g.body.x, residual = dt - g.special.remaining;
  g.update(dt); assert.equal(g.special, null, 'SPECIAL times out');
  assert(g.body.x > x + residual * 1000, 'unused portion advances flight after the MISS');
  assert.equal(g.counts.BOOST, 1, 'MISS does not repeat the contact');
}
// A STOPPER MISS can finish the run before this step's remainder is consumed.
// RESULT must discard that remainder rather than contact another object or save twice.
{
  const oldStorage = scope.localStorage; let writes = 0;
  scope.localStorage = { getItem: () => null, setItem() { writes++; } };
  try {
    const g = make({ y: 3, objects: [{ x: 500, type: 'STOPPER', used: false }, { x: 500, type: 'GUARD', used: false }] });
    g.specialArmed.stopper = true; g.update(dt); assert(g.special, 'STOPPER SPECIAL opened');
    let steps = 0;
    while (g.special && g.special.remaining >= dt && steps++ < 300) g.update(dt);
    assert(g.special && g.special.remaining > 0 && g.special.remaining < dt, 'fractional timeout boundary reached');
    g.update(dt);
    assert.equal(g.state, STATES.RESULT); assert.equal(g.history.length, 1, 'no contact after RESULT');
    assert.equal(g.counts.GUARD, 0); assert.equal(g.objects[1].used, false);
    assert.equal(writes, 1, 'RESULT is saved exactly once'); assert.equal(g.accumulator, 0, 'RESULT discards remaining time');
  } finally { scope.localStorage = oldStorage; }
}

// Two separate object boundaries inside one fixed step must resolve in time
// order and once each, using the first contact's changed velocity for the next.
{
  const g = make({ y: 50, objects: [{ x: 500, type: 'BRAKE', used: false }, { x: 501, type: 'ANGLE', used: false }] });
  const events = observe(g); g.update(dt);
  assert.deepEqual(events.map(e => e.type), ['BRAKE', 'ANGLE']);
  near(events[0].x, 455, .02, 'first contact boundary'); near(events[1].x, 456, .02, 'second contact boundary');
  assert.equal(g.history.length, 2); assert.equal(g.counts.BRAKE, 1); assert.equal(g.counts.ANGLE, 1);
  g.update(dt); assert.equal(g.history.length, 2, 'both objects are single use');
}

// Same continuous initial conditions / total time must not depend on display
// frame rate. Include a SPECIAL that times out naturally after an early contact.
const trajectories = [];
for (const fps of [30, 60, 120, 144]) {
  const g = make({ y: 3, objects: [{ x: 500, type: 'BOOST', used: false }, { x: 900, type: 'BOUNCE', used: false }] });
  for (let i = 0; i < fps * 2; i++) g.update(1 / fps);
  assert.equal(g.counts.BOOST, 1, `${fps}fps contact`); assert.equal(g.specialSuccesses, 0, `${fps}fps no automatic success`);
  trajectories.push([g.body.x, g.body.y, g.body.vx, g.body.vy]);
}
for (const row of trajectories.slice(1)) for (let i = 0; i < row.length; i++) near(row[i], trajectories[0][i], 1e-6, 'frame-rate independent trajectory');

// Protect the suite from an infinite zero-time-contact loop in a separate
// process with a timeout; dense artificial objects are not a gameplay claim.
const child = String.raw`
const fs=require('fs'),vm=require('vm'),scope={localStorage:{getItem(){return null},setItem(){}}};scope.window=scope;vm.createContext(scope);
for(const n of ['config','physics','game'])vm.runInContext(fs.readFileSync('js/'+n+'.js','utf8'),scope);
const H=scope.Hop,g=new H.Game(()=>.999999);g.state=H.STATES.FLYING;
Object.assign(g.body,{x:455,y:3,vx:2000,vy:-500,grounded:false,stopped:false});
g.objects=Array.from({length:64},()=>({x:500,type:'BRAKE',used:false}));g.nextObjectX=g.nextBoundaryX=Infinity;
g.update(H.CONFIG.physicsStep);if(g.history.length!==64)throw Error('not all overlapping objects resolved exactly once');`;
execFileSync(process.execPath, ['-e', child], { cwd: path.join(__dirname, '..'), timeout: 8000, stdio: 'pipe' });
console.log('Elastic contact timing PASS: exact contact, remaining time, ground order, timer boundary, SPECIAL, simultaneous contacts, FPS and bounded execution.');
