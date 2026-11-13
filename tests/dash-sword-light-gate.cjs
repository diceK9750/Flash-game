// Optional DASH lights are latched per actual solo SPECIAL; later asset changes never pop them in.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const saved = { slots: S.castAssets.DASH, draw: S.drawCastScaled, point: S.castPoint, glow: G.grandGlow, spark: G.spark, trail: G.grandTrail, smooth: G.smooth };
function asset(name, ready = true) {
  const def = S.definitions.CAST.DASH[name], data = JSON.parse(fs.readFileSync(def.metadata, 'utf8')); assert(S.normalizeCell(data));
  return { ready, image: { complete: ready, naturalWidth: ready ? data.frameWidth : 0, naturalHeight: ready ? data.frameHeight : 0 }, data };
}
function ctx() {
  const stack = [], o = { globalAlpha: 1, strokes: [], save() { stack.push({ globalAlpha: this.globalAlpha, filter: this.filter, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, globalCompositeOperation: this.globalCompositeOperation }); },
    restore() { Object.assign(this, stack.pop()); }, stroke() { if (this.strokeStyle === '#ffd27a' || this.strokeStyle === '#ff6a2a') this.strokes.push({ color: this.strokeStyle, alpha: this.globalAlpha }); } };
  return new Proxy(o, { get: (v, k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'getTransform' ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) : () => {}, set: (v, k, x) => (v[k] = x, true) });
}
const windup = asset('WINDUP', false), thrust = asset('THRUST', false);
let drawFailure = false, throwDraw = false, lookupMode = '', glow = [];
function ready(a, value) { a.ready = value; a.image.complete = value; a.image.naturalWidth = value ? a.data.frameWidth : 0; a.image.naturalHeight = value ? a.data.frameHeight : 0; }
try {
  S.castAssets.DASH = { ...saved.slots, WINDUP: windup, THRUST: thrust };
  S.drawCastScaled = (c, id, x, feet, pose) => {
    if (id === 'DASH' && (pose === 'WINDUP' || pose === 'THRUST')) { if (throwDraw) throw new Error('draw failure'); if (drawFailure) return null; }
    return { w: 1, h: 1 };
  };
  S.castPoint = function (...args) { if (lookupMode && args[3] === lookupMode) throw new Error('optional lookup failure'); return saved.point.apply(this, args); };
  G.grandGlow = (c, x, y, r, col, a) => glow.push({ x, y, r, col, a }); G.spark = () => {}; G.grandTrail = () => 0; G.smooth = false;
  const game = launch(), ui = new H.UI(game, element('canvas')); ui.ctx = ctx();
  game.objects = []; game.trail = []; game.launchCutin = null; game.specialCutin = null; game.comboAfter = null; game.debugUsed = true;
  ui.visual.reducedMotion = false; ui.update();
  function render() { glow = []; ui.ctx.strokes = []; const before = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), before, 'draw does not change game state'); return glow.slice(); }
  function scene() {
    game.comboAfter = null; game.startCombo({ type: 'DASH', source: { x: game.body.x - 300 } }, true);
    game.combo.elapsed = G.comboSceneStart(false) + 0.78; return game.combo;
  }
  function oldLight(calls) { return calls.some(x => x.col === '255,140,50'); }
  const initial = JSON.stringify(ui.visual); render(); assert.equal(JSON.stringify(ui.visual), initial, 'normal flight does not add unused gate state');

  const first = scene(); assert(!oldLight(render())); assert.strictEqual(ui.visual.warriorGlowGate.scene, first); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  ready(windup, true); ready(thrust, true); assert(!oldLight(render())); assert.equal(ui.visual.warriorGlowGate.allowed, false, 'late loads wait for a new scene');
  const second = scene(); assert.notStrictEqual(first, second); assert(oldLight(render())); assert.equal(ui.visual.warriorGlowGate.allowed, true);

  ui.visual.reducedMotion = true; assert(!oldLight(render())); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  ui.visual.reducedMotion = false; assert(!oldLight(render()), 'turning reduced motion off cannot reintroduce the effect');
  scene(); assert(oldLight(render())); game.combo.skipped = true; assert(!oldLight(render()));
  game.combo.skipped = false; assert(!oldLight(render()), 'unexpected skip reversal cannot reintroduce the effect');
  scene(); assert(oldLight(render()));

  ready(windup, false); assert(!oldLight(render())); ready(windup, true); assert(!oldLight(render()), 'asset recovery waits for a new scene');
  scene(); assert(oldLight(render())); S.castAssets.DASH.WINDUP = { ...windup }; assert(!oldLight(render()));
  S.castAssets.DASH.WINDUP = windup; assert(!oldLight(render()), 'asset identity restoration cannot re-enable');
  scene(); assert(oldLight(render()));
  const oldImage = thrust.image; thrust.image = { ...oldImage }; assert(!oldLight(render())); thrust.image = oldImage;
  assert(!oldLight(render()), 'image identity restoration cannot re-enable');
  scene(); assert(oldLight(render())); const oldData = windup.data; windup.data = { ...oldData }; assert(!oldLight(render())); windup.data = oldData;
  assert(!oldLight(render()), 'metadata identity restoration cannot re-enable');

  scene(); assert(oldLight(render())); lookupMode = 'WINDUP'; assert.doesNotThrow(() => render()); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  lookupMode = ''; assert(!oldLight(render()), 'lookup recovery waits for a new scene');
  scene(); assert(oldLight(render())); lookupMode = 'THRUST'; assert.doesNotThrow(() => render()); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  lookupMode = ''; assert(!oldLight(render()));
  scene(); assert(oldLight(render())); drawFailure = true; render(); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  drawFailure = false; assert(!oldLight(render()), 'sprite draw recovery waits for a new scene');
  scene(); assert(oldLight(render())); throwDraw = true; assert.doesNotThrow(() => render()); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  throwDraw = false; assert(!oldLight(render()), 'thrown sprite draw uses Canvas fallback and stays latched off');

  scene(); assert(oldLight(render())); assert(game.endCombo(true)); game.finish(); assert.equal(game.state, H.STATES.RESULT);
  render(); assert.equal(ui.visual.warriorGlowGate, null, 'RESULT clears the visual gate');
  game.act(); assert.equal(game.state, H.STATES.AIM_ANGLE); render();
  game.angle = 40; game.act(); assert.equal(game.state, H.STATES.AIM_POWER); game.power = 0.8; game.act(); assert.equal(game.state, H.STATES.FLYING);
  game.launchCutin = null; game.specialCutin = null; game.debugUsed = true; scene(); assert(oldLight(render()), 'RETRY can use the next ready scene');
  game.combo.short = true; render(); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  game.combo.short = false; assert(!oldLight(render()));
  // The wind-up ray fade uses exactly the same live-scene latch.
  function rayScene() { scene(); game.combo.elapsed = G.comboSceneStart(false) + 0.72; }
  function rays() { render(); assert.equal(ui.ctx.strokes.length, 12, 'twelve wind-up rays'); return ui.ctx.strokes[0].alpha; }
  ready(windup, false); rayScene(); const legacy = rays(); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  ready(windup, true); assert(Math.abs(rays() - legacy) < 1e-8, 'late load does not introduce the ray fade');
  rayScene(); assert(rays() < legacy * 0.4, 'ready new scene uses the ray fade');
  S.castAssets.DASH.WINDUP = { ...windup }; assert(Math.abs(rays() - legacy) < 1e-8); S.castAssets.DASH.WINDUP = windup;
  assert(Math.abs(rays() - legacy) < 1e-8, 'restored identity stays latched off');
  rayScene(); assert(rays() < legacy * 0.4); lookupMode = 'WINDUP'; assert(Math.abs(rays() - legacy) < 1e-8);
  lookupMode = ''; assert(Math.abs(rays() - legacy) < 1e-8, 'lookup recovery stays latched off');
  rayScene(); assert(rays() < legacy * 0.4); drawFailure = true; assert(Math.abs(rays() - legacy) < 1e-8);
  drawFailure = false; assert(Math.abs(rays() - legacy) < 1e-8, 'draw recovery stays latched off');
  rayScene(); assert(rays() < legacy * 0.4); throwDraw = true; assert.doesNotThrow(() => rays()); assert.equal(ui.visual.warriorGlowGate.allowed, false);
  throwDraw = false; assert(Math.abs(rays() - legacy) < 1e-8, 'thrown draw recovery stays latched off');
  rayScene(); assert(rays() < legacy * 0.4); const rayData = windup.data; windup.data = { ...rayData }; assert(Math.abs(rays() - legacy) < 1e-8);
  windup.data = rayData; assert(Math.abs(rays() - legacy) < 1e-8, 'metadata restoration stays latched off');
  rayScene(); assert(rays() < legacy * 0.4); ui.visual.reducedMotion = true; assert(Math.abs(rays() - legacy) < 1e-8);
  ui.visual.reducedMotion = false; assert(Math.abs(rays() - legacy) < 1e-8, 'motion recovery stays latched off');
  rayScene(); assert(rays() < legacy * 0.4); game.combo.skipped = true; assert(Math.abs(rays() - legacy) < 1e-8);
  game.combo.skipped = false; assert(Math.abs(rays() - legacy) < 1e-8, 'skip reversal stays latched off');
  assert(game.endCombo(true)); game.finish(); render(); assert.equal(ui.visual.warriorGlowGate, null); game.act();
  game.angle = 40; game.act(); game.power = 0.8; game.act(); game.launchCutin = null; game.debugUsed = true;
  rayScene(); assert(rays() < legacy * 0.4, 'RETRY starts a fresh ray gate');
  console.log('DASH sword-light gate PASS: real scene/RESULT/RETRY, late load, identity/loss, lookup/draw errors, reduced/skip/short, wind-up rays and game purity.');
} finally { if (saved.slots) S.castAssets.DASH = saved.slots; else delete S.castAssets.DASH; S.drawCastScaled = saved.draw; S.castPoint = saved.point; G.grandGlow = saved.glow; G.spark = saved.spark; G.grandTrail = saved.trail; G.smooth = saved.smooth; }
