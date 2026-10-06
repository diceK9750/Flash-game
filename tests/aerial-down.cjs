// AERIAL DOWN: reflect the current flight angle over the horizontal and lock that dive until ground,
// character contact, UP, or reset. Shallow ascents floor at aerialDownMinAngleDeg. Speed = |v| * scale.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const scope = { localStorage: { getItem: () => null, setItem() {} } }; scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, c = H.CONFIG;
const near = (a, b, label, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);
const rnd = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function flying(body) {
  const g = new H.Game(rnd(1)); g.act(); g.act(); g.act(); assert.equal(g.state, 'FLYING');
  g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity;
  Object.assign(g.body, { x: 800, y: 300, vx: 600, vy: 400, grounded: false, stopped: false, bounces: 0 }, body);
  g.updateAerialMode(); return g;
}
let cases = 0;
// Config: lock flags, no old vertical/horizontal kick keys, recharge / caps / UP unchanged.
assert.deepEqual([c.aerialDownLockAngle, c.aerialDownMinAngleDeg, c.aerialDownSpeedScale, c.aerialDownRechargeTime], [true, 30, 1, 1.5]);
assert.equal(c.aerialDownVertical, undefined); assert.equal(c.aerialDownHorizontal, undefined);
assert.deepEqual([c.aerialUpImpulse, c.aerialUpAngle, c.maxHorizontalSpeed, c.maxVerticalSpeed], [800, 45, 2000, 1500]);
cases++;
// No magic numbers in aerial("DOWN") (allow 180 for deg→rad if present; min angle comes from CONFIG).
{ const src = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
  const down = src.slice(src.indexOf('} else if (direction === "DOWN")'), src.indexOf('} else return false;'));
  assert(!/\b760\b|\b35\b/.test(down), 'old kick literals gone');
  assert(down.includes('aerialDownMinAngleDeg') && down.includes('aerialDownSpeedScale') && down.includes('aerialDownLockAngle'));
  cases++; }
// Reflection of a steep ascent (θ > 30°): lock = −θ, |v| kept, BRAKE armed, charge spent, mode → UP.
{ const g = flying({ vx: 600, vy: 600 }); // 45°
  assert.equal(g.aerialMode, 'DOWN'); assert.equal(g.aerial('DOWN'), true);
  const sp = Math.hypot(600, 600), ang = -Math.PI / 4;
  near(g.body.vx, sp * Math.cos(ang), 'vx45'); near(g.body.vy, sp * Math.sin(ang), 'vy45');
  near(g.aerialDownLock, ang, 'lock45'); assert.equal(g.downCharge, 0); assert(g.specialArmed.brake);
  assert.equal(g.aerialMode, 'UP'); assert.equal(g.effect.label, 'AERIAL DOWN'); cases++; }
// Shallow ascent floors at −30°.
{ const g = flying({ vx: 800, vy: 100 }); // ~7.1°
  assert.equal(g.aerial('DOWN'), true);
  const sp = Math.hypot(800, 100), ang = -30 * Math.PI / 180;
  near(g.body.vx, sp * Math.cos(ang), 'vx30'); near(g.body.vy, sp * Math.sin(ang), 'vy30');
  near(g.aerialDownLock, ang, 'lock30'); cases++; }
// Angle lock holds through many steps (no objects): angle error stays tiny, path reaches y=0.
{ const g = flying({ vx: 700, vy: 500, y: 400 });
  assert.equal(g.aerial('DOWN'), true); const lock = g.aerialDownLock; let maxErr = 0, steps = 0;
  for (; steps < 120 * 20 && g.state === 'FLYING' && !g.body.grounded && g.body.y > 0; steps++) {
    g.update(c.physicsStep);
    if (g.aerialDownLock != null) maxErr = Math.max(maxErr, Math.abs(Math.atan2(g.body.vy, g.body.vx) - lock));
  }
  assert(maxErr < 1e-4, 'angle drift ' + maxErr);
  assert.equal(g.aerialDownLock, null, 'cleared on ground');
  assert(g.body.y <= 1e-6 || g.body.grounded || g.body.bounces > 0, 'reached ground');
  cases++; }
// Character contact clears the lock (BOOST companion).
{ const g = flying({ vx: 600, vy: 300, x: 100, y: 120 });
  assert.equal(g.aerial('DOWN'), true); assert(g.aerialDownLock != null);
  g.objects = [{ type: 'BOOST', x: 280, used: false }];
  for (let i = 0; i < 120 * 5 && g.aerialDownLock != null; i++) g.update(c.physicsStep);
  assert.equal(g.aerialDownLock, null, 'cleared on character');
  assert(g.counts.BOOST > 0 || g.history.some(h => h.type === 'BOOST') || g.special?.type === 'BOOST', 'touched BOOST');
  cases++; }
// UP during lock clears lock and brake arming, then applies the UP kick.
{ const g = flying({ vx: 600, vy: 400 });
  assert.equal(g.aerial('DOWN'), true); assert(g.aerialDownLock != null); assert(g.specialArmed.brake);
  // Force UP-availability: after DOWN we are falling, so mode is UP.
  assert.equal(g.aerialMode, 'UP');
  assert.equal(g.aerial('UP'), true);
  assert.equal(g.aerialDownLock, null); assert.equal(g.specialArmed.brake, false);
  assert.equal(g.upRemaining, 2); cases++; }
// reset / RETRY clears the lock.
{ const g = flying({ vx: 600, vy: 400 }); g.aerial('DOWN'); assert(g.aerialDownLock != null);
  g.reset(); assert.equal(g.aerialDownLock, null); assert.equal(g.downCharge, 1); cases++; }
// STOPPER stop clears lock via contact.
{ const g = flying({ vx: 600, vy: 300, x: 100, y: 100 });
  g.aerial('DOWN'); g.objects = [{ type: 'STOPPER', x: 260, used: false }];
  for (let i = 0; i < 120 * 5 && g.aerialDownLock != null; i++) g.update(c.physicsStep);
  assert.equal(g.aerialDownLock, null); assert(g.counts.STOPPER > 0 || g.body.stopped || g.special); cases++; }
// Use conditions unchanged: no charge / special / Type C / grounded → refused; lock not set.
{ const g = flying({ vy: 300 }); g.downCharge = 0.5; assert.equal(g.aerial('DOWN'), false); assert.equal(g.aerialDownLock, null);
  const s = flying({ vy: 300 }); s.special = { type: 'BRAKE' }; assert.equal(s.aerial('DOWN'), false);
  const t = flying({ vy: 300 }); t.merchant = { type: 'C', remaining: 10, height: 190 }; assert.equal(t.aerial('DOWN'), false);
  const gr = flying({ y: 0, grounded: true, vy: 0 }); assert.equal(gr.aerial('DOWN'), false); cases++; }
// Recharge still 1.5 s while locked (not paused) and after unlock.
{ const g = flying({ vx: 500, vy: 500, y: 800 }); assert.equal(g.aerial('DOWN'), true); assert.equal(g.downCharge, 0);
  for (let i = 0; i < Math.round(1.5 * 120); i++) g.update(c.physicsStep);
  near(g.downCharge, 1, 'recharged', 1e-3); cases++; }
// BRAKE SPECIAL still keeps pre-contact velocity after a locked dive into BRAKE.
{ const g = flying({ vx: 700, vy: 350, x: 50, y: 140 });
  assert.equal(g.aerial('DOWN'), true); assert(g.specialArmed.brake);
  g.objects = [{ type: 'BRAKE', x: 220, used: false }];
  for (let i = 0; i < 120 * 8 && !g.special; i++) g.update(c.physicsStep);
  assert.equal(g.special?.type, 'BRAKE');
  const kept = { ...g.special.velocity };
  assert.equal(g.aerialDownLock, null, 'lock cleared at contact before special');
  assert.equal(g.resolveSpecial(true), true);
  near(g.body.vx, kept.vx, 'BRAKE keep vx'); near(g.body.vy, kept.vy, 'BRAKE keep vy');
  cases++; }
// Locked dive reaches the ground faster than a no-DOWN continuation from the same rising state.
{ const base = { vx: 650, vy: 450, x: 0, y: 350 };
  const timeToGround = (useDown) => {
    const g = flying(base); if (useDown) assert.equal(g.aerial('DOWN'), true);
    let steps = 0;
    for (; steps < 120 * 30 && g.body.y > 0 && !g.body.grounded && g.state === 'FLYING'; steps++) g.update(c.physicsStep);
    return steps * c.physicsStep;
  };
  assert(timeToGround(true) < timeToGround(false) * 0.7, 'dive reaches ground faster'); cases++; }
// Old kick (−760/+35) is gone: result matches reflection, not the additive kick.
{ const g = flying({ vx: 600, vy: 400 }); g.aerial('DOWN');
  const sp = Math.hypot(600, 400), ang = -Math.atan2(400, 600);
  near(g.body.vx, sp * Math.cos(ang), 'new vx'); near(g.body.vy, sp * Math.sin(ang), 'new vy');
  assert(Math.abs(g.body.vx - (600 + 35)) > 1 || Math.abs(g.body.vy - (400 - 760)) > 1, 'differs from old kick');
  cases++; }

console.log(JSON.stringify({ aerialDown: 'PASS', cases }));
