// HERO STOP_RESULT: plays once at the full stop on the ground, holds the last frame through
// RESULT, cleared by RETRY. Display-only; behaviour verified with test-only mock assets.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const dir = 'assets/sprites/hero/hero_stop_result_comic_v1/';
const SEQ = [0, 0, 1, 2, 3, 3, 4, 5, 6, 7];
const mockMeta = { id: 'HERO', animation: 'STOP_RESULT', frameWidth: 96, frameHeight: 96, frames: 8, fps: 12, loop: false, sequence: SEQ, pivot: { x: 48, y: 88 }, displayScale: 1.25 };
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok'; const requested = [];
    class Image {
      constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 96; }
      set src(value) { requested.push(value); if (mode === 'image-error') this.onerror(new Error('missing')); else { if (mode === 'size') this.naturalWidth = 760; this.onload(); } }
    }
    const scope = { Hop: {}, Image, fetch: async url => {
      requested.push(url);
      if (!url.includes('stop_result')) return { ok: false };
      if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => {
        if (mode === 'json') throw new SyntaxError('bad');
        if (mode === 'swap') return { ...mockMeta, animation: 'GROUND_BOUNCE' };
        if (mode === 'loop') return { ...mockMeta, loop: true };
        if (mode === 'pivot') return { ...mockMeta, pivot: { x: 48, y: 80 } };
        if (mode === 'seq') return { ...mockMeta, sequence: [0, 9] };
        return mockMeta;
      } };
    } };
    vm.createContext(scope); vm.runInContext(code, scope);
    const s = scope.Hop.Sprites, def = s.definitions.HERO.STOP_RESULT;
    const startup = await s.stopResultReady;
    assert.equal(s.heroStopResult, startup); assert.equal(startup.ready, def.enabled !== false);
    const off = await s.load({ ...def, enabled: false }); assert.equal(off.ready, false);
    const n = requested.length; await s.load({ ...def, enabled: false }); assert.equal(requested.length, n, 'disabled = never requested');
    const on = { ...def, enabled: true };
    for (mode of ['image-error', 'size', 'network', '404', 'json', 'swap', 'loop', 'pivot', 'seq']) assert.equal((await s.load(on)).ready, false, mode);
    mode = 'ok'; const a = await s.load(on); assert.equal(a.ready, true, 'recovery'); assert.equal(s.duration(a.data), 10 / 12);
    console.log('Stop result loader PASS: disabled = no request, image/size/network/404/JSON/animation/loop/pivot/sequence errors, recovery.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, launch, element } = require('./phase2.cjs');
  const s = scope.Hop.Sprites, H = s.definitions.HERO, def = H.STOP_RESULT, c = scope.Hop.CONFIG, ST = scope.Hop.STATES;
  // Asset contract: relative paths, flag == files present, real JSON/sheet shape and sequence.
  for (const ref of [def.src, def.metadata]) { assert(!/^(?:\/|[a-z]+:)/i.test(ref)); assert(ref.startsWith(dir)); }
  assert.deepEqual([def.animation, def.fps, def.loop, def.scale], ['STOP_RESULT', 12, false, 1.25]);
  const present = fs.existsSync(path.join(root, def.src)) && fs.existsSync(path.join(root, def.metadata));
  assert.equal(def.enabled !== false, present, 'STOP_RESULT flag must match the bundle files');
  if (present) {
    const m = JSON.parse(fs.readFileSync(path.join(root, def.metadata)));
    // HD comic sheet: 8 identical 384 cells; pivot y 372 (not the default 352) leaves headroom for
    // the raised sword. v1 sequence/fps/hold kept.
    assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot, sequence: m.sequence, next: m.nextAnimation, smoothing: m.smoothing },
      { id: 'HERO', animation: 'STOP_RESULT', w: 384, h: 384, frames: 8, fps: 12, loop: false, pivot: { x: 192, y: 372 }, sequence: SEQ, next: 'HOLD_LAST_FRAME', smoothing: true });
    assert.equal(def.src, dir + 'hero_stop_result_sheet_384x384.png'); assert(s.normalizeCell({ ...m }), 'HD cell contract');
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 384 * 8); assert.equal(png.readUInt32BE(20), 384); assert.equal(png[25], 6, 'RGBA PNG');
  }
  const fake = data => ({ ready: true, image: { complete: true, naturalWidth: 768 }, data });
  const loopMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/hero/flight_loop/hero_flight_loop.json')));
  const A = { SR: fake(mockMeta), LOOP: fake(loopMeta) };
  const names = new Map([[A.SR, 'STOP_RESULT'], [A.LOOP, 'FLIGHT_LOOP']]);
  const graphics = scope.Hop.Graphics, originalCharacter = graphics.character, originalDraw = s.draw;
  const saved = { heroFlight: s.heroFlight, heroStopResult: s.heroStopResult, heroGroundBounce: s.heroGroundBounce, heroAerialUp: s.heroAerialUp, heroAerialDown: s.heroAerialDown };
  const stack = [], ctx = { imageSmoothingEnabled: true, save() { stack.push(this.imageSmoothingEnabled); }, restore() { this.imageSmoothingEnabled = stack.pop(); },
    drawImage() { assert.equal(this.imageSmoothingEnabled, false); } };
  let canvasHero = 0, drawn = [], failSR = false;
  graphics.character = function (cx, id, ...rest) { if (id === 'HERO') canvasHero++; return originalCharacter.call(this, cx, id, ...rest); };
  s.draw = function (_ctx, asset, time, x, feet, scale) {
    if (failSR && asset === this.heroStopResult) return false;
    const ok = originalDraw.call(this, ctx, asset, time, x, feet, scale);
    if (ok) drawn.push({ name: names.get(asset) || 'OTHER', frame: this.frameAt(asset.data, time), feet, scale });
    return ok;
  };
  const install = (sr = A.SR) => Object.assign(s, { heroStopResult: sr, heroFlight: A.LOOP, heroGroundBounce: { ready: false }, heroAerialUp: { ready: false }, heroAerialDown: { ready: false } });
  const frame = (game, ui) => { drawn = []; canvasHero = 0; const g0 = JSON.stringify(game), v0 = JSON.stringify(ui.visual);
    ui.draw(); assert.equal(JSON.stringify(game), g0, 'draw must not mutate game'); assert.equal(JSON.stringify(ui.visual), v0, 'draw must not mutate visual');
    return drawn.at(-1) || { name: canvasHero ? 'CANVAS' : 'NONE' }; };
  function run(seed = 3) {
    const game = launch(seed, 30, 0.35), ui = new scope.Hop.UI(game, element('canvas'));
    game.objects = []; game.nextObjectX = 1e12; game.nextBoundaryX = 1e12; // no contacts: pure physics
    ui.lastState = 'AIM_POWER'; ui.update(); return { game, ui };
  }
  // Physics reference without any UI: identical stop time/position with the UI attached.
  const ref = run().game; while (ref.state === ST.FLYING) ref.update(1 / 120);
  install();
  for (const hz of [30, 60, 120, 144]) {
    const { game, ui } = run(); let guard = 0;
    while (game.state === ST.FLYING) {
      game.update(1 / hz); ui.update(); assert(++guard < hz * 120);
      const out = frame(game, ui);
      if (game.state === ST.FLYING) { assert.equal(ui.visual.stopAt, null); assert.equal(out.name, 'FLIGHT_LOOP', 'FLYING before the stop is unchanged'); }
    }
    assert.equal(game.state, ST.RESULT); assert.equal(game.body.stopped, true); assert.equal(game.body.y, 0);
    assert.equal(game.body.x, ref.body.x, 'physics unchanged'); assert.equal(game.finalDistance, ref.finalDistance);
    const start = ui.visual.stopAt; assert.equal(start, game.phaseTime, 'starts on the stop frame');
    const seen = [];
    for (let i = 0; i < hz * 3; i++) {
      const t = game.phaseTime - start, out = frame(game, ui);
      assert.equal(out.name, 'STOP_RESULT'); assert.equal(out.feet, c.playerRadius); assert.equal(out.scale, 1.25);
      assert.equal(out.frame, SEQ[Math.min(SEQ.length - 1, Math.floor(t * 12))], `${hz}Hz t=${t}`);
      if (seen.at(-1) !== out.frame) seen.push(out.frame);
      game.update(1 / hz); ui.update(); assert.equal(game.state, ST.RESULT);
    }
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7], `${hz}Hz plays every frame once then holds`);
    assert.equal(frame(game, ui).frame, 7, 'holds the last frame while RESULT is shown');
    // RETRY: back to the Canvas HERO in AIM_ANGLE (as before), clock cleared.
    game.act(); ui.update(); assert.equal(game.state, ST.AIM_ANGLE); assert.equal(ui.visual.stopAt, null);
    assert.equal(frame(game, ui).name, 'CANVAS');
  }
  // Reduced motion: final hold frame immediately.
  {
    const { game, ui } = run(); while (game.state === ST.FLYING) { game.update(1 / 60); ui.update(); }
    ui.visual.reducedMotion = true; assert.equal(frame(game, ui).frame, 7);
  }
  // Fallbacks: missing asset or a failing draw -> previous drawing (frozen FLIGHT_LOOP in RESULT since Phase B, FLIGHT_LOOP while FLYING).
  for (const broken of [{ ready: false }, null, fake(mockMeta)]) {
    install(broken); failSR = broken?.ready === true;
    const { game, ui } = run(); while (game.state === ST.FLYING) { game.update(1 / 60); ui.update(); }
    assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    assert.deepEqual(s.stopLayers(ui.visual, game.phaseTime).length, failSR ? 1 : 0);
    failSR = false;
  }
  install();
  // Stopped while a SPECIAL is pending (still FLYING): STOP_RESULT already plays; still FLYING.
  {
    const { game, ui } = run(); while (!game.body.stopped) { game.update(1 / 120); ui.update(); }
    assert.equal(ui.visual.stopAt, game.phaseTime);
    const fakeGame = { state: ST.FLYING, body: { ...game.body } };
    assert.equal(s.stopResultEligible(fakeGame), true);
    // Mid-air stop (STOPPER contact above the ground) keeps the previous drawing.
    assert.equal(s.stopResultEligible({ state: ST.FLYING, body: { ...game.body, y: 40 } }), false);
    assert.equal(s.stopResultEligible({ state: ST.FLYING, body: { ...game.body, stopped: false } }), false);
    assert.equal(s.stopResultEligible({ state: ST.AIM_ANGLE, body: { ...game.body } }), false);
    // Revive (Type B): moving again clears the clock; the next stop restarts the animation.
    game.body.stopped = false; game.body.vx = 200; game.state = ST.FLYING; ui.update(); assert.equal(ui.visual.stopAt, null);
  }
  // A real STOPPER contact on the ground in a seeded run: RESULT with the sprite, physics untouched by drawing.
  {
    const { game, ui } = run(); for (let i = 0; i < 30; i++) { game.update(1 / 60); ui.update(); }
    game.body.y = 0; game.body.vy = 0; game.applyContact('STOPPER'); ui.update();
    assert.equal(game.body.stopped, true); assert(Number.isFinite(ui.visual.stopAt));
    assert.equal(frame(game, ui).name, 'STOP_RESULT');
  }
  graphics.character = originalCharacter; s.draw = originalDraw; Object.assign(s, saved);
  console.log('Stop result PASS: flag/files/JSON, 12fps sequence 0,0,1,2,3,3,4,5,6,7 at 30/60/120/144Hz, hold last frame in RESULT, RETRY -> Canvas HERO, reduced motion = final frame, fallback (missing/draw failure), SPECIAL-pending stop, mid-air stop excluded, revive clears, draw purity, physics unchanged.');
}
