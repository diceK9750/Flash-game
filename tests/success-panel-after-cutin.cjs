// SPECIAL SUCCESS panel waits for the cut-in (display only); aria-live and game state are not delayed/changed.
const assert = require('node:assert/strict');
const { scope, element } = require('./phase2.cjs');
const { isolated } = require('./specials.cjs');
const { UI, Graphics: G, CONFIG: c } = scope.Hop;
let cases = 0;
function test(name, fn) { try { fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
const cover = c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold;
const step = 1 / 60;
function setup(type = 'BOUNCE', reduced = false) {
  const g = isolated(); const ui = new UI(g, element('canvas')); ui.visual.reducedMotion = reduced; ui.update();
  arm(g, type); ui.update();
  assert.equal(element('special-title').textContent, g.special.merchantType ? 'MERCHANT SPECIAL!' : 'SPECIAL!');
  return { g, ui };
}
function arm(g, type, merchantType = null) {
  g.special = { type, merchantType, partner: null, remaining: c.specialWindow, entry: { type, label: type }, guardAtContact: 0, velocity: { vx: g.body.vx, vy: g.body.vy } };
}
// Game timers only (no physics, so the flight cannot end on its own while we watch the UI).
function advance(g, dt) {
  g.phaseTime += dt;
  if (g.specialCutin && (g.specialCutin.remaining -= dt) <= 0) g.specialCutin = null;
  if (g.specialMessage && (g.specialMessage.remaining -= dt) <= 0) g.specialMessage = null;
}
function watch(g, ui, seconds) {
  const shown = [];
  for (let t = 0; t < seconds; t += step) { advance(g, step); ui.update(); if (!element('special-panel').hidden) shown.push(g.phaseTime); }
  return shown;
}

test('covering helper: until the fade-out / reduced still, pure', () => {
  assert.equal(G.specialCutinCovering(null), false);
  const cut = { remaining: c.specialCutinDuration, total: c.specialCutinDuration }, snap = JSON.stringify(cut);
  assert.equal(G.specialCutinCovering(cut, false), true);
  cut.remaining = cut.total - (cover - 0.01); assert.equal(G.specialCutinCovering(cut, false), true);
  assert(G.specialCutinStyle(cover - 0.01, false).visible);
  cut.remaining = cut.total - (cover + 0.01); assert.equal(G.specialCutinCovering(cut, false), false);
  cut.remaining = cut.total - (c.specialCutinReducedDuration - 0.01); assert.equal(G.specialCutinCovering(cut, true), true);
  cut.remaining = cut.total - (c.specialCutinReducedDuration + 0.01); assert.equal(G.specialCutinCovering(cut, true), false);
  cut.remaining = cut.total; JSON.stringify(cut) === snap || assert.fail('mutated');
});

for (const [type, reduced] of [['BOUNCE', false], ['GUARD', false], ['BOOST', true], ['STOPPER', false]]) {
  test(`${type}${reduced ? ' reduced' : ''}: hidden while covering, then shown for specialMessageDuration`, () => {
    const { g, ui } = setup(type, reduced);
    g.act(); assert.equal(g.specialMessage.label, 'SPECIAL SUCCESS'); assert(g.specialCutin);
    if (type === 'STOPPER') g.state = scope.Hop.STATES.FLYING; // keep watching the panel even if STOPPER ended the run
    const msg = JSON.stringify(g.specialMessage), cut = JSON.stringify(g.specialCutin), body = JSON.stringify(g.body);
    ui.update();
    // Game state untouched by the UI hold.
    assert.equal(JSON.stringify(g.specialMessage), msg); assert.equal(JSON.stringify(g.specialCutin), cut); assert.equal(JSON.stringify(g.body), body);
    assert.equal(element('special-panel').hidden, true, 'no panel over the face');
    assert.equal(element('special-title').textContent, 'SPECIAL SUCCESS!');
    assert.equal(element('contact-tag').hidden, true);
    // aria-live is immediate (not delayed with the visual panel).
    const spoken = element('announcements').textContent;
    assert(spoken.startsWith('SPECIAL SUCCESS · ' + c.specials[type].name), spoken);
    const start = g.phaseTime, shown = watch(g, ui, 3);
    const wait = reduced ? c.specialCutinReducedDuration : cover;
    assert(shown.length, 'panel appears after the cut-in');
    const first = shown[0] - start, last = shown[shown.length - 1] - start;
    assert(Math.abs(first - wait) <= step * 1.5, `first ${first} vs ${wait}`);
    assert(Math.abs((last - first) - c.specialMessageDuration) <= step * 1.5, `visible ${last - first}`);
    assert.equal(shown.length, Math.round((last - first) / step) + 1, 'continuous');
    assert.equal(element('special-panel').className, 'special-panel resolved');
    assert.equal(element('special-panel').hidden, true);
    assert.equal(element('announcements').textContent, spoken, 'no second announcement');
  });
}

test('panel shows the success text while game.specialMessage has already expired', () => {
  const { g, ui } = setup('BOOST'); g.act(); ui.update();
  watch(g, ui, cover + c.specialMessageDuration - 0.2);
  assert.equal(g.specialMessage, null); assert.equal(element('special-panel').hidden, false);
  assert.equal(element('special-title').textContent, 'SPECIAL SUCCESS!'); assert.equal(element('special-detail').textContent, c.specials.BOOST.name);
  assert.equal(element('contact-tag').hidden, true);
});

test('merchant success waits too', () => {
  const g = isolated(); const ui = new UI(g, element('canvas')); ui.update();
  arm(g, 'BOUNCE', 'A'); g.act(); ui.update(); assert.equal(g.specialMessage.label, 'SPECIAL SUCCESS');
  assert.equal(element('special-panel').hidden, true);
  const shown = watch(g, ui, 3); assert(shown.length > 60);
});

test('MISS unchanged: panel immediately', () => {
  const { g, ui } = setup('BOUNCE'); g.resolveSpecial(false); ui.update();
  assert.equal(g.specialCutin, null); assert.equal(element('special-panel').hidden, false);
  assert.equal(element('special-title').textContent, 'SPECIAL MISS');
});

test('a new SPECIAL acceptance overrides the waiting/held panel; reset clears it', () => {
  const { g, ui } = setup('BOUNCE'); g.act(); ui.update(); watch(g, ui, cover + 0.2);
  assert.equal(element('special-panel').hidden, false);
  arm(g, 'BOOST'); ui.update(); assert.equal(element('special-title').textContent, 'SPECIAL!'); assert.equal(ui.successPanel, null);
  g.act(); ui.update(); assert.equal(element('special-panel').hidden, true);
  g.state = scope.Hop.STATES.RESULT; g.finalDistance = 0; ui.update(); assert.equal(ui.successPanel, null); assert.equal(element('special-panel').hidden, true);
});

console.log(JSON.stringify({ successPanelAfterCutin: 'PASS', cases }));
