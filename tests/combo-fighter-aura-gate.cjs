// UPPER availability is latched per scene: late loads and transient failures cannot pop the FX in mid-play.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG, F = C.comboFighterTimes;
const saved = { assets: S.castAssets.BOUNCE, draw: S.drawCastScaled, point: S.castPoint, aura: G.comboFighterFistAura, smooth: G.smooth };
const upper = { ready: false, image: { complete: false, naturalWidth: 0 }, data: { pivot: { x: 144, y: 264 }, unit: 3, frameWidth: 288, frameHeight: 288 } };
S.castAssets.BOUNCE = { ...saved.assets, UPPER: upper };
let failDraw = false, calls = [];
S.drawCastScaled = (ctx, id, x, feet, pose) => failDraw && id === 'BOUNCE' && pose === 'UPPER' ? null : { w: 1 };
G.comboFighterFistAura = function (...args) { const result = saved.aura.apply(this, args); calls.push(result); return result; };
const game = launch(), ui = new H.UI(game, element('canvas'));
game.objects = []; game.trail = []; game.launchCutin = null; game.specialCutin = null; game.comboAfter = null;
const scene = () => ({ type: 'BOUNCE', elapsed: G.comboSceneStart(false) + F.rise + 0.1, short: false,
  heroX: 1200, heroY: 50, source: { x: 1230 }, partner: { x: 1700 }, skipped: false, total: C.comboFighterDuration });
function ready(value) { upper.ready = value; upper.image.complete = value; upper.image.naturalWidth = value ? 288 : 0; }
function draw() { const before = JSON.stringify(game); calls = []; ui.draw(); assert.equal(JSON.stringify(game), before, 'render does not mutate game'); return calls.at(-1); }
try {
  G.smooth = false; ui.visual.reducedMotion = false;
  ui.update();
  const initialVisual = JSON.stringify(ui.visual), initialGame = JSON.stringify(game);
  ui.draw();
  assert.equal(JSON.stringify(ui.visual), initialVisual, 'ordinary flight does not add unused scene gates');
  assert.equal(JSON.stringify(game), initialGame, 'ordinary flight render leaves game unchanged');
  // The first rendered frame of a scene snapshots unavailable UPPER, even before the visible uppercut.
  game.combo = scene(); assert.equal(draw(), null); assert.equal(ui.visual.fighterAuraGate.allowed, false);
  ready(true); assert.equal(draw(), null); assert.equal(ui.visual.fighterAuraGate.allowed, false, 'late load waits for next scene');
  game.combo = scene(); assert.notEqual(draw(), null); assert.equal(ui.visual.fighterAuraGate.allowed, true, 'new scene accepts ready UPPER');

  ui.visual.reducedMotion = true; assert.equal(draw(), null); assert.equal(ui.visual.fighterAuraGate.allowed, false);
  ui.visual.reducedMotion = false; assert.equal(draw(), null, 'turning reduced motion off does not reintroduce FX mid-scene');
  game.combo = scene(); assert.notEqual(draw(), null, 'next scene can re-enable FX');
  game.combo.skipped = true; assert.equal(draw(), null); assert.equal(ui.visual.fighterAuraGate.allowed, false, 'skip disables gate');
  game.combo.skipped = false; assert.equal(draw(), null, 'even an unexpected skip reversal stays disabled');
  game.combo = scene(); assert.notEqual(draw(), null);

  // Image loss, stale asset identity and lookup errors latch off until a new scene.
  ready(false); assert.equal(draw(), null); ready(true); assert.equal(draw(), null, 'image recovery waits for next scene');
  game.combo = scene(); assert.notEqual(draw(), null);
  S.castAssets.BOUNCE.UPPER = { ...upper }; assert.equal(draw(), null); S.castAssets.BOUNCE.UPPER = upper;
  assert.equal(draw(), null, 'asset identity changes cannot revive FX during the same scene');
  game.combo = scene(); assert.notEqual(draw(), null);
  S.castPoint = () => { throw new Error('transient lookup failure'); }; assert.equal(draw(), null);
  S.castPoint = saved.point; assert.equal(draw(), null, 'lookup recovery waits for next scene');
  game.combo = scene(); assert.notEqual(draw(), null);

  // A genuine sprite draw failure returns to Canvas and latches the accent off for the scene.
  failDraw = true; draw(); assert.equal(ui.visual.fighterAuraGate.allowed, false, 'failed sprite draw disables later accent');
  failDraw = false; assert.equal(draw(), null, 'draw recovery waits for next scene');
  game.combo = scene(); assert.notEqual(draw(), null, 'new scene recovers after draw failure');

  // RETRY clears the scene gate. Short scenes never enable the accent.
  game.combo = null; game.state = H.STATES.READY; draw(); assert.equal(ui.visual.fighterAuraGate, null);
  game.state = H.STATES.FLYING; game.combo = { ...scene(), short: true }; draw(); assert.equal(ui.visual.fighterAuraGate.allowed, false);
  game.combo = scene(); assert.notEqual(draw(), null, 'next full play starts cleanly');
  console.log('Fighter aura gate PASS: late load, same-scene failures/recovery, reduced ON/OFF, skip, retry, short and game purity.');
} finally {
  if (saved.assets) S.castAssets.BOUNCE = saved.assets; else delete S.castAssets.BOUNCE;
  S.drawCastScaled = saved.draw; S.castPoint = saved.point; G.comboFighterFistAura = saved.aura; G.smooth = saved.smooth;
}
