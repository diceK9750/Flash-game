// Runs the complete phase-2 regression suite first, then phase-3 checks.
const assert = require('node:assert/strict');
const { scope, element, document, launch, random } = require('./phase2.cjs');
const { Game, CONFIG: c } = scope.Hop;
let writes = 0, saved = null;
scope.localStorage = { getItem() { return saved; }, setItem(key, value) { assert.equal(key, c.storageKey); writes++; saved = value; } };
function contact(game, type, vx = 500, vy = -100, x = 500, eligible = false) {
  Object.assign(game.body, { x, y: 10, vx, vy, grounded: false, stopped: false });
  game.objects = [{ x, type, used: false }]; game.nextObjectX = Infinity; game.nextBoundaryX = Infinity;
  if (eligible) {
    const rule = c.specials[type];
    if (rule.partner) game.objects.push({ x: x + 300, type: rule.partner, used: false });
    else game.specialArmed[rule.trigger] = true;
  }
  game.contactObjects({ x: x - 70, y: 10, vx, vy });
}
assert(Math.abs(Object.values(c.objectWeights).reduce((a, b) => a + b, 0) - 1) < 1e-10);
for (const type of Object.keys(c.objectWeights)) {
  const game = launch(); contact(game, type);
  assert.equal(game.history.length, 1); assert.equal(game.counts[type], 1);
  assert.equal(game.special, null);
  if (type === 'BOOST') assert.equal(game.body.vx, 960);
  if (type === 'BOUNCE') assert.equal(game.body.vy, 780);
  if (type === 'BRAKE') assert.equal(game.body.vx, 125);
  if (type === 'DASH') { assert.equal(game.body.vx, 1400); assert.equal(game.body.vy, 90); }
  if (type === 'STOPPER') assert.equal(game.body.vx, 30);
  if (type === 'GUARD') { assert.equal(game.guard, 1); contact(game, 'GUARD'); assert.equal(game.guard, 1); }
  if (type === 'ANGLE') {
    assert(Math.abs(Math.hypot(game.body.vx, game.body.vy) - Math.hypot(500, -100)) < 1e-9);
    assert(Math.abs(Math.atan2(game.body.vy, game.body.vx) * 180 / Math.PI - c.angleDegrees) < 1e-9);
  }
  const before = [game.body.vx, game.body.vy, game.history.length];
  game.contactObjects({ x: game.body.x - 70, y: 10 });
  assert.deepEqual([game.body.vx, game.body.vy, game.history.length], before);
}
for (const harmful of ['BRAKE', 'STOPPER']) {
  const game = launch(); contact(game, 'GUARD'); contact(game, harmful, 1000, -100);
  assert.equal(game.guard, 0); assert.equal(game.body.vx, 1000); assert.equal(game.body.vy, -100);
  assert.equal(game.special, null); assert.equal(game.specialCount, 0);
  assert(game.history.at(-1).label.includes('GUARDED'));
}
const scenarios = { BOOST: [500, -100, 500, true], STOPPER: [800, -100, 500, true], BOUNCE: [500, -100, 2000, true], DASH: [300, -100, 500, true] };
let specialChecks = 0;
for (const [type, args] of Object.entries(scenarios)) {
  for (const fps of [30, 60, 120, 144]) {
    for (const success of [true, false]) {
      const game = launch(); contact(game, type, ...args);
      assert(game.special); assert.equal(game.specialCount, 1);
      const pos = game.body.x, vx = game.body.vx, remaining = game.upRemaining;
      assert.equal(game.aerial('UP'), false); assert.equal(game.aerial('DOWN'), false);
      game.update(1 / fps); assert.equal(game.body.x, pos); assert.equal(game.body.vx, vx);
      if (success) {
        game.act(); assert.equal(game.specialSuccesses, 1); assert.equal(game.upRemaining, remaining);
        assert(Math.abs(Math.hypot(game.body.vx, game.body.vy) - c.specials[type].speed) < 1e-9);
        assert(Math.abs(Math.atan2(game.body.vy, game.body.vx) * 180 / Math.PI - c.specials[type].angle) < 1e-9);
        assert.equal(game.history[0].label, type + ' SPECIAL'); assert(game.flash > 0); assert(game.specialTrail > 0);
      } else {
        for (let frame = 1; frame < Math.ceil(c.specialWindow * fps); frame++) game.update(1 / fps);
        assert.equal(game.specialSuccesses, 0); assert.equal(game.special, null);
        assert.equal(game.specialMessage.label, 'SPECIAL MISS');
        if (type === 'STOPPER') assert(game.body.vx <= vx * c.stopperRetention + 1e-6);
      }
      assert.equal(game.resolveSpecial(true), false);
      game.objects = []; // Isolate the already-checked source from subsequent ordinary partner contact.
      for (let i = 0; i < 14400 && game.state === 'FLYING'; i++) game.update(c.physicsStep);
      assert.equal(game.state, 'RESULT'); assert.equal(game.history.length, 1);
      assert.equal(game.counts[type], 1); assert.equal(game.specialCount, 1);
      specialChecks++;
    }
  }
}
// Old speed/distance thresholds alone no longer start SPECIAL.
for (const [type, vx, vy, x] of [
  ['STOPPER', 1500, 0, 500], ['BOUNCE', 500, 0, 16000], ['DASH', 1, 0, 500]
]) { const game = launch(); contact(game, type, vx, vy, x); assert.equal(game.special, null); }

const input = launch(); contact(input, 'STOPPER', ...scenarios.STOPPER);
const ui = new scope.Hop.UI(input, element('canvas')); scope.Hop.bindInput(input, ui); ui.update(); ui.draw();
assert.equal(element('special-title').textContent, 'SPECIAL!'); assert.equal(element('down-action').disabled, true);
element('down-action').listeners.click({ stopPropagation() {} }); assert(input.special); assert.equal(input.upRemaining, 3);
element('stage').listeners.click({ target: { closest: () => null }, pointerType: 'touch' });
assert.equal(input.special, null); assert.equal(input.upRemaining, 3); assert.equal(input.specialSuccesses, 1);
contact(input, 'DASH', ...scenarios.DASH);
let prevented = false;
document.listeners.keydown({ code: 'Enter', repeat: false, target: { closest: () => ({}) }, preventDefault() { prevented = true; } });
assert(prevented); assert.equal(input.specialSuccesses, 2); assert.equal(input.upRemaining, 3);
ui.update(); assert.equal(element('special-title').textContent, 'SPECIAL SUCCESS'); ui.draw();
document.listeners.keydown({ code: 'Enter', repeat: true, target: { closest: () => ({}) }, preventDefault() {} });
assert.equal(input.upRemaining, 3); // Holding Enter after success must not trigger native UP clicks.
input.finish(); ui.update();
assert(element('contact-totals').textContent.includes('接触総数 2'));
assert(element('contact-totals').textContent.includes('SPECIAL発生 2 / 成功 2'));
assert(element('type-counts').textContent.includes('STOPPER 1'));

saved = null; writes = 0;
const score = new Game(random(1));
score.body.x = 800; score.maxHeight = 400; score.maxSpeed = 1600; score.finish();
assert.equal(writes, 1); assert.equal(score.newRecords.length, 3);
assert.deepEqual(JSON.parse(saved), { distance: 100, height: 50, speed: 200 });
const restored = new Game(); assert.equal(restored.best.distance, 100);
restored.body.x = 80; restored.finish(); assert.equal(restored.newRecords.length, 0); assert.equal(restored.best.speed, 200);
const resultUI = new scope.Hop.UI(score, element('canvas')); resultUI.update();
assert.equal(element('record-status').textContent, 'NEW RECORD!');
assert(element('best-comparison').textContent.includes('BEST 100.0 m'));
assert(element('contact-totals').textContent.includes('接触総数 0'));

const debug = launch(); const beforeWrites = writes;
debug.toggleDebug(); assert(debug.debug); assert(debug.debugUsed);
debug.nextObjectX = 400; debug.objects = []; debug.debugIndex = 0;
debug.body.x = 4000; debug.generateObjects();
// Check exact sequence from the start before pruning.
debug.body.x = 0; debug.objects = []; debug.nextObjectX = 400; debug.debugIndex = 0;
const sequence = [];
for (let x = 0; x < 4200; x += 600) {
  debug.body.x = x; debug.generateObjects();
  for (const object of debug.objects) if (!sequence.some(entry => entry.x === object.x)) sequence.push({ ...object });
}
assert.deepEqual(sequence.slice(0, 7).map(o => o.type), Object.keys(c.objectWeights));
for (let i = 1; i < sequence.length; i++) assert.equal(sequence[i].x - sequence[i - 1].x, c.debugGap);
debug.toggleDebug(); assert.equal(debug.debug, false); assert(debug.debugUsed);
debug.body.x = 80000; debug.finish(); assert.equal(writes, beforeWrites); assert.equal(debug.newRecords.length, 0);
assert.equal(debug.best.distance, 100);
debug.guard = 1; debug.special = { remaining: 0.4 }; debug.downCooldown = 1;
debug.history.push({ type: 'STOPPER', label: 'STOPPER SPECIAL' }); debug.counts.STOPPER = 1;
debug.specialCount = 4; debug.specialSuccesses = 3; debug.upRemaining = 0;
debug.act();
assert.equal(debug.state, 'AIM_ANGLE'); assert.equal(debug.guard, 0); assert.equal(debug.special, null);
assert.equal(debug.downCooldown, 0); assert.equal(debug.history.length, 0); assert.equal(debug.specialCount, 0);
assert.equal(debug.specialSuccesses, 0); assert.equal(debug.upRemaining, 3); assert.equal(debug.debugUsed, false);
assert(Object.values(debug.counts).every(n => n === 0)); assert(debug.objects.every(o => !o.used)); assert.equal(debug.best.distance, 100);
debug.toggleDebug(); debug.reset(); assert(debug.debugUsed); const lastWrites = writes; debug.finish(); assert.equal(writes, lastWrites);

scope.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
const blocked = launch(); blocked.body.x = 800; blocked.finish(); assert.equal(blocked.state, 'RESULT'); assert.equal(blocked.storageAvailable, false);
assert.equal(blocked.best.distance, 100); blocked.act(); assert.equal(blocked.best.distance, 100);
scope.localStorage = { getItem() { return '{bad json'; }, setItem() {} }; assert.equal(new Game().best.distance, 0);
scope.localStorage = { getItem() { return '{"distance":-1,"height":"oops","speed":null}'; }, setItem() {} }; assert.equal(new Game().best.height, 0);
console.log(JSON.stringify({ phase3: 'PASS', specialChecks, effects: 7, guard: 'both harmful types blocked', storage: 'save, reload, record, corruption, denial', debug: 'ordered, spaced, no saving even after OFF', input: 'touch priority, Enter priority, DOWN isolation', retry: 'all transient state reset' }, null, 2));
