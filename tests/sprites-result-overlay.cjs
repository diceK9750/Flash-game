// RESULT overlay fade (display only): transparent while STOP_RESULT plays, then fades in.
// Input/RETRY, aria-live, RESULT content and game state must be identical to the immediate overlay.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { scope, launch, element } = require('./phase2.cjs');
const s = scope.Hop.Sprites, def = s.definitions.HERO.STOP_RESULT, ST = scope.Hop.STATES;
const SEQ = [0, 0, 1, 2, 3, 3, 4, 5, 6, 7], DUR = SEQ.length / 12, FADE = def.overlayFade;
assert.equal(FADE, 0.2);
const mockMeta = { id: 'HERO', animation: 'STOP_RESULT', frameWidth: 96, frameHeight: 96, frames: 8, fps: 12, loop: false, sequence: SEQ, pivot: { x: 48, y: 88 } };
const SR = { ready: true, image: { complete: true, naturalWidth: 768 }, data: mockMeta };
const saved = s.heroStopResult, overlay = element('overlay');
const ids = ['state', 'final', 'hint', 'overlay-label', 'overlay-title', 'overlay-detail', 'overlay-prompt', 'result-stats', 'result-highlights', 'special-panel', 'aim-display'];
const snapshot = () => JSON.stringify({ hidden: overlay.hidden, els: ids.map(id => [element(id).textContent, element(id).hidden]), live: element('live')?.textContent });
const expected = t => t < DUR ? 0 : Math.min(1, (t - DUR) / FADE);
const opacityOf = () => overlay.style.opacity === '' ? 1 : Number(overlay.style.opacity);
function run(asset, { seed = 3, reduced = false } = {}) {
  s.heroStopResult = asset;
  const game = launch(seed, 30, 0.35), ui = new scope.Hop.UI(game, element('canvas'));
  game.objects = []; game.nextObjectX = 1e12; game.nextBoundaryX = 1e12;
  ui.visual.reducedMotion = reduced; ui.lastState = 'AIM_POWER'; ui.update();
  return { game, ui };
}
// Timeline at each refresh rate, compared step by step with the asset-less (immediate overlay) run.
for (const hz of [30, 60, 120, 144]) {
  const a = run(SR), b = run({ ready: false });
  let guard = 0, sawZero = false, sawFade = false, sawFull = false;
  for (;;) {
    s.heroStopResult = { ready: false }; b.game.update(1 / hz); b.ui.update(); s.heroStopResult = SR; a.game.update(1 / hz); a.ui.update();
    assert.equal(JSON.stringify(a.game), JSON.stringify(b.game), 'game state/timing identical');
    if (a.game.state !== ST.RESULT) { assert.equal(overlay.style.opacity, ''); assert(++guard < hz * 120); continue; }
    const t = a.game.phaseTime - a.ui.visual.stopAt, want = expected(t), got = opacityOf();
    assert(Math.abs(got - want) <= 0.0005 + 1e-9, `${hz}Hz t=${t.toFixed(4)} want ${want} got ${got}`);
    assert.equal(overlay.hidden, false, 'overlay is never hidden in RESULT (content/aria unchanged)');
    if (got === 0) sawZero = true; else if (got < 1) sawFade = true; else sawFull = true;
    // Same RESULT content/highlights/announcements as the immediate overlay (refresh b's DOM, then a's).
    s.heroStopResult = { ready: false }; b.ui.update(); const sb = snapshot(); s.heroStopResult = SR; a.ui.update();
    assert.equal(snapshot(), sb, 'RESULT DOM content identical');
    if (t > DUR + FADE + 0.5) break;
  }
  assert(sawZero && sawFade && sawFull, `${hz}Hz: transparent -> fade -> full`);
  assert.equal(overlay.style.opacity, '', 'full opacity restores the CSS value');
}
// RETRY is accepted exactly as before, even while the overlay is fully transparent.
for (const when of [0.05, DUR + FADE / 2]) {
  const a = run(SR); while (a.game.state !== ST.RESULT) { a.game.update(1 / 60); a.ui.update(); }
  const start = a.ui.visual.stopAt; while (a.game.phaseTime - start < when) { a.game.update(1 / 60); a.ui.update(); }
  assert(opacityOf() < 1);
  a.game.act(); a.ui.update();
  assert.equal(a.game.state, ST.AIM_ANGLE, 'tap during the fade = RETRY (unchanged)'); assert.equal(overlay.style.opacity, ''); assert.equal(overlay.hidden, true);
}
// Excluded cases keep the immediate overlay: missing asset, reduced motion, mid-air stop (no stopAt).
for (const [label, opts, asset] of [['missing asset', {}, { ready: false }], ['reduced motion', { reduced: true }, SR]]) {
  const a = run(asset, opts); while (a.game.state !== ST.RESULT) { a.game.update(1 / 60); a.ui.update(); }
  for (let i = 0; i < 90; i++) { assert.equal(overlay.style.opacity, '', label); a.game.update(1 / 60); a.ui.update(); }
}
s.heroStopResult = SR;
assert.equal(s.resultOverlayAlpha({ stopAt: null }, 5, ST.RESULT), 1, 'mid-air stop');
assert.equal(s.resultOverlayAlpha({ stopAt: 4.9 }, 5, ST.FLYING), 1, 'only in RESULT');
assert.equal(s.resultOverlayAlpha({ stopAt: 4.9 }, 5, ST.RESULT), 0);
assert(Math.abs(s.resultOverlayAlpha({ stopAt: 0 }, DUR + FADE / 2, ST.RESULT) - 0.5) < 1e-9);
assert.equal(s.resultOverlayAlpha({ stopAt: 0 }, DUR + FADE, ST.RESULT), 1);
{ // Real mid-air STOPPER stop: RESULT with no STOP_RESULT clock -> immediate overlay.
  const a = run(SR); for (let i = 0; i < 20; i++) { a.game.update(1 / 60); a.ui.update(); }
  assert(a.game.body.y > 1); a.game.applyContact('STOPPER'); a.game.finish(); a.ui.update();
  assert.equal(a.game.state, ST.RESULT); assert.equal(a.ui.visual.stopAt, null); assert.equal(overlay.style.opacity, '');
}
s.heroStopResult = saved;
console.log('Result overlay PASS: alpha 0 during STOP_RESULT then 0.2 s fade at 30/60/120/144Hz, game state + RESULT DOM identical to the immediate overlay, RETRY tap unchanged during the fade, missing asset / reduced motion / mid-air stop = immediate overlay.');
