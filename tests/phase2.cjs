// Run with: node tests/phase2.cjs (test-only; the game needs no Node.js).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    setAttribute(key, value) { this[key] = value; },
    textContent: '', hidden: false, disabled: false, style: {}, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); }
  });
  return elements.get(id);
}
const document = { getElementById: element, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
const scope = { document, requestAnimationFrame() {} }; scope.window = scope;
vm.createContext(scope);
for (const name of ['config', 'physics', 'game', 'graphics', 'ui', 'audio', 'input', 'main']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), scope, { filename: name });
}
const { Game, CONFIG: c } = scope.Hop;
function random(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
function launch(seed = 1, angle = 40, power = 1) {
  const game = new Game(random(seed));
  assert.equal(game.state, 'READY'); game.act(); assert.equal(game.state, 'AIM_ANGLE');
  game.angle = angle; game.act(); assert.equal(game.state, 'AIM_POWER'); game.power = power; game.act();
  assert.equal(game.state, 'FLYING'); return game;
}
const g = launch();
assert.equal(g.aerial('UP'), false); // exact ground contact at launch
g.update(1 / 60);
for (let i = 0; i < 3; i++) assert.equal(g.aerial('UP'), true);
assert.equal(g.upRemaining, 0); assert.equal(g.aerial('UP'), false);
assert.equal(g.aerial('DOWN'), true); assert.equal(g.aerial('DOWN'), false);
assert.equal(g.downCharge, 0);
g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity;
for (let i = 0; i < 179; i++) g.update(c.physicsStep);
assert(g.downCharge < 1); g.update(c.physicsStep); assert.equal(g.downCharge, 1);
g.body.grounded = true; g.body.y = 0;
assert.equal(g.aerial('UP'), false); assert.equal(g.aerial('DOWN'), false);

for (const type of ['BOOST', 'BOUNCE', 'BRAKE']) {
  const game = launch();
  game.objects = [{ x: 500, type, used: false }];
  Object.assign(game.body, { x: 600, y: 10, vx: 500, vy: -100 });
  game.contactObjects({ x: 400, y: 10 }); // one segment crosses the whole box
  assert(game.objects[0].used); assert.equal(game.contact.label, type);
  if (type === 'BOOST') assert.equal(game.body.vx, 500 + c.boostImpulse * Math.cos(Math.PI / 4));
  if (type === 'BOUNCE') { assert.equal(game.body.vy, -100 + c.boostImpulse * c.bounceImpulseRatio * Math.sin(Math.PI / 3)); assert.equal(game.body.grounded, false); }
  if (type === 'BRAKE') assert.equal(game.body.vx, 500 * c.brakeRetention);
  const velocity = [game.body.vx, game.body.vy];
  game.contactObjects({ x: 400, y: 10 }); assert.deepEqual([game.body.vx, game.body.vy], velocity);
  assert.equal(game.touches({ x: 500 }, { x: 600, y: 300 }), false);
}
// Integration: collision after movement, including the frame that would stop.
const stopping = launch();
Object.assign(stopping.body, { x: 500, y: 0, vx: 1, vy: 0, grounded: true });
stopping.objects = [{ x: 500, type: 'BOUNCE', used: false }]; stopping.nextObjectX = Infinity;
stopping.update(c.physicsStep); assert.equal(stopping.state, 'FLYING'); assert(stopping.body.vy > 0);

const generated = new Game(random(99)); const types = new Set();
for (let x = 0; x < 100000; x += 300) {
  generated.body.x = x; generated.generateObjects();
  assert(generated.nextObjectX >= x + c.objectAhead);
  assert(generated.objects.length < 12);
  for (const o of generated.objects) { assert(o.x >= x - c.objectBehind); types.add(o.type); }
}
assert.equal(types.size, 7); // Phase 3 extends the same generator; retain all regression checks.

let runs = 0, longest = 0, maxDistance = 0;
for (let seed = 1; seed <= 80; seed++) {
  const distances = [];
  for (const fps of [30, 60, 120, 144]) {
    const game = launch(seed, 10 + (seed % 13) * 5, [0.3, 0.5, 0.75, 1][seed % 4]);
    let frames = 0;
    while (game.state === 'FLYING' && frames < fps * 120) {
      game.update(1 / fps); frames++;
      assert(Number.isFinite(game.body.x)); assert(game.body.y >= 0);
      assert(c.launchX + game.body.x - game.cameraX < c.width);
    }
    assert.equal(game.state, 'RESULT', `seed ${seed}`);
    assert.equal(game.body.vx, 0); assert.equal(game.body.vy, 0);
    longest = Math.max(longest, frames / fps); maxDistance = Math.max(maxDistance, game.finalDistance);
    distances.push(game.finalDistance);
    game.act(); assert.equal(game.state, 'AIM_ANGLE'); assert.equal(game.body.x, 0);
    assert.equal(game.upRemaining, 3); assert.equal(game.downCharge, 1); assert.equal(game.contact, null);
    assert.equal(game.effect, null); assert.equal(game.finalDistance, null); assert(game.objects.every(o => !o.used)); runs++;
  }
  assert(Math.max(...distances) - Math.min(...distances) < 1e-7, `fps mismatch seed ${seed}`);
}
// Bounded active input, then release all controls: natural stopping must return.
for (let seed = 1; seed <= 80; seed++) {
  const game = launch(seed); let frame = 0;
  while (game.state === 'FLYING' && frame < 14400) {
    if (frame < 1200 && frame % 90 === 0) game.aerial('UP');
    if (frame < 1200 && frame % 210 === 0) game.aerial('DOWN');
    game.update(c.physicsStep); frame++;
  }
  assert.equal(game.state, 'RESULT', `active seed ${seed}`); runs++;
}
const input = launch(); input.update(1 / 60);
const ui = new scope.Hop.UI(input, element('canvas')); scope.Hop.bindInput(input, ui);
const pointer = () => element('stage').listeners.pointerdown({button:0,isPrimary:true,preventDefault(){}});
pointer(); assert.equal(input.upRemaining,3); assert.equal(input.downCharge,0);
input.body.vy=-100; pointer(); assert.equal(input.upRemaining,2);
ui.update();ui.draw();
for(let i=0;i<14400 && input.state==='FLYING';i++){input.update(c.physicsStep);ui.update();ui.draw();}
assert.equal(input.state,'RESULT'); pointer(); assert.equal(input.state,'AIM_ANGLE');assert.equal(element('final').textContent,'—');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, file] of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert(fs.existsSync(path.join(root, file)));
console.log(JSON.stringify({ runs, longestPassiveSeconds: longest, maxPassiveMeters: maxDistance, fpsAgreement: true, effects: '3 types; swept collision; single use', input: 'UP limit; DOWN charge; primary pointer; automatic direction', retry: 'pass', pathsAndScripts: 'pass' }, null, 2));
module.exports = { scope, element, document, launch, random };
