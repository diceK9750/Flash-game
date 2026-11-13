// Exercise the witch wind gate through an actual SPECIAL and RETRY, and check its
// display clock at equal elapsed times rather than depending on the render rate.
const assert = require('node:assert/strict');
const { scope, element, launch } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const saved = { slots: S.castAssets.BOOST, cache: S.witchWindCache, drawCast: S.drawCastScaled, sourceValid: S.witchWindSourceValid, smooth: G.smooth };
const source = { ready: true }, cache = { ready: true, sourceAsset: source };
const frames = { frames: 16, fps: 16 / 1.3, loop: true };
let calls = [];
const near = (a, b, label, eps = 1e-7) => assert(Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
function draw(ui) {
  calls = []; const before = JSON.stringify(ui.game); ui.draw();
  assert.equal(JSON.stringify(ui.game), before, 'render leaves game and physics untouched');
  return calls.filter(c => c.pose === 'CAST').at(-1);
}
function arm(game) {
  game.launchCutin = null; game.specialCutin = null;
  Object.assign(game.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
  const sourceObject = { x: 1230, type: 'BOOST', used: false };
  const partner = { x: 1700, type: 'BOUNCE', used: false };
  game.objects = [sourceObject, partner]; game.nextObjectX = game.nextBoundaryX = Infinity;
  game.contactObjects({ x: 1100, y: 30 });
  assert(game.special && game.special.type === 'BOOST'); game.act();
  assert(game.combo && game.combo.type === 'BOOST');
  assert.equal(game.specialSuccesses, 1); assert(game.history.length > 0);
  return game.combo;
}
try {
  S.castAssets.BOOST = { ...saved.slots, CAST: source }; S.witchWindCache = cache;
  S.witchWindSourceValid = item => item === cache;
  S.drawCastScaled = (ctx, id, x, feet, pose, mul, opts) => { if (id === 'BOOST') calls.push({ pose, ...opts }); return { w: 1 }; };
  G.smooth = false;
  const game = launch(), ui = new H.UI(game, element('canvas'));
  // DEBUG excludes any score write while exercising the real result/retry actions.
  game.debugUsed = true;
  const first = arm(game); first.elapsed = G.comboSceneStart(false) + 0.35;
  const firstCast = draw(ui); assert(firstCast && Number.isFinite(firstCast.windTime));
  assert(ui.visual.witchWindAllowed); assert.strictEqual(ui.visual.witchWindScene, first);
  assert(game.endCombo(true)); game.finish(); assert.equal(game.state, 'RESULT');
  draw(ui); assert.equal(ui.visual.witchWindScene, null); assert.equal(ui.visual.witchWindAllowed, false);
  game.act(); assert.equal(game.state, 'AIM_ANGLE');
  assert.equal(game.history.length, 0); assert.equal(game.specialSuccesses, 0); assert.equal(game.specialCount, 0);
  draw(ui); assert.equal(ui.visual.witchWindScene, null);
  game.angle = 40; game.act(); assert.equal(game.state, 'AIM_POWER'); game.power = 0.8; game.act(); assert.equal(game.state, 'FLYING');
  game.debugUsed = true;
  const second = arm(game); assert.notStrictEqual(second, first); second.elapsed = G.comboSceneStart(false) + 0.35;
  const secondCast = draw(ui); assert(secondCast && Number.isFinite(secondCast.windTime));
  assert(ui.visual.witchWindAllowed); assert.strictEqual(ui.visual.witchWindScene, second);
  near(firstCast.windTime, secondCast.windTime, 'same elapsed time after RETRY');

  // Entrance transition uses the real combo pose: alpha starts at zero, is smooth
  // at its midpoint and reaches one at 0.15s. Repeated paused draws match exactly.
  for (const [offset, alpha] of [[0, 0], [0.075, 0.5], [0.15, 1]]) {
    second.elapsed = G.comboSceneStart(false) + 0.15 + offset;
    const a = draw(ui), b = draw(ui); assert(a && b); near(a.windAlpha, alpha, 'entry alpha');
    near(a.windTime, b.windTime, 'paused time'); near(a.windAlpha, b.windAlpha, 'paused alpha');
  }
  for (const offset of [1e-6, 0.15 - 1e-6]) {
    second.elapsed = G.comboSceneStart(false) + 0.15 + offset;
    const a = draw(ui); assert(a && (offset < 0.01 ? a.windAlpha < 1e-10 : 1 - a.windAlpha < 1e-10), 'entry has no opacity pop');
  }

  const across = [];
  for (const fps of [30, 60, 120, 144]) {
    const g = launch(), view = new H.UI(g, element('canvas')); g.debugUsed = true;
    const combo = arm(g); g.specialCutin = null;
    // Begin at CAST's entry; each FPS reaches the same 0, 0.5, 1 second marks.
    combo.elapsed = G.comboSceneStart(false) + 0.15; g.accumulator = 0;
    G.smooth = true; const samples = [];
    for (let frame = 0; frame <= fps; frame++) {
      if (frame === 0 || frame === fps / 2 || frame === fps) {
        const one = draw(view), repeat = draw(view); assert(one && repeat, `${fps}fps CAST present`);
        near(one.windTime, repeat.windTime, 'paused clock'); near(one.windAlpha, repeat.windAlpha, 'paused fade');
        samples.push({ time: one.windTime, alpha: one.windAlpha, frame: S.frameAt(frames, one.windTime) });
      }
      if (frame < fps) g.update(1 / fps);
    }
    across.push(samples);
  }
  for (const samples of across.slice(1)) for (let i = 0; i < samples.length; i++) {
    near(samples[i].time, across[0][i].time, 'same elapsed time at 30–144fps', 1e-6);
    near(samples[i].alpha, across[0][i].alpha, 'same fade at 30–144fps', 1e-6);
    assert.equal(samples[i].frame, across[0][i].frame, 'same sprite frame at equal elapsed time');
  }
  console.log('Witch wind RETRY/fps PASS: real SPECIAL/result/retry, history reset, cache reuse, paused redraw, entry continuity and equal 30–144Hz timing.');
} finally {
  S.castAssets.BOOST = saved.slots; S.witchWindCache = saved.cache; S.drawCastScaled = saved.drawCast; S.witchWindSourceValid = saved.sourceValid; G.smooth = saved.smooth;
}
