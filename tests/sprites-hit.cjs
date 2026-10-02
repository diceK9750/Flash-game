// HERO HIT: truck-impact one-shot at launch (AIM_POWER -> FLYING), then FLIGHT_LOOP.
// Display-only; behaviour verified with test-only mock assets.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const dir = 'assets/sprites/hero/hero_hit_v1_bundle/';
const meta = (animation, extra) => ({ id: 'HERO', animation, frameWidth: 96, frameHeight: 96, frames: 8, fps: 12, loop: false, pivot: { x: 48, y: 88 }, ...extra });
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok'; const requested = [];
    class Image {
      constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 96; }
      set src(value) { requested.push(value); if (mode === 'image-error') this.onerror(new Error('missing')); else { if (mode === 'size') this.naturalWidth = 760; this.onload(); } }
    }
    const scope = { Hop: {}, Image, fetch: async url => {
      requested.push(url);
      if (!url.includes('hero_hit')) return { ok: false };
      if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => {
        if (mode === 'json') throw new SyntaxError('bad');
        if (mode === 'swap') return meta('AERIAL_UP');
        if (mode === 'loop') return meta('HIT', { loop: true });
        if (mode === 'pivot') return meta('HIT', { pivot: { x: 40, y: 88 } });
        return meta('HIT');
      } };
    } };
    vm.createContext(scope); vm.runInContext(code, scope);
    const s = scope.Hop.Sprites, def = s.definitions.HERO.HIT;
    const startup = await s.hitReady;
    assert.equal(s.heroHit, startup); assert.equal(startup.ready, def.enabled !== false);
    const n = requested.length; assert.equal((await s.load({ ...def, enabled: false })).ready, false); assert.equal(requested.length, n, 'disabled = never requested');
    const on = { ...def, enabled: true };
    for (mode of ['image-error', 'size', 'network', '404', 'json', 'swap', 'loop', 'pivot']) assert.equal((await s.load(on)).ready, false, mode);
    mode = 'ok'; assert.equal((await s.load(on)).ready, true, 'recovery');
    console.log('Hit loader PASS: disabled = no request, image/size/network/404/JSON/animation/loop/pivot errors, recovery.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, launch, element } = require('./phase2.cjs');
  const s = scope.Hop.Sprites, H = s.definitions.HERO, def = H.HIT, c = scope.Hop.CONFIG, ST = scope.Hop.STATES;
  for (const ref of [def.src, def.metadata]) { assert(!/^(?:\/|[a-z]+:)/i.test(ref)); assert(ref.startsWith(dir)); }
  assert.deepEqual([def.animation, def.fps, def.loop, def.scale], ['HIT', 12, false, 1.25]);
  const present = fs.existsSync(path.join(root, def.src)) && fs.existsSync(path.join(root, def.metadata));
  assert.equal(def.enabled !== false, present, 'HIT flag must match the bundle files');
  if (present) {
    const m = JSON.parse(fs.readFileSync(path.join(root, def.metadata)));
    assert.deepEqual({ id: m.id, animation: m.animation, w: m.frameWidth, h: m.frameHeight, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot },
      { id: 'HERO', animation: 'HIT', w: 96, h: 96, frames: 8, fps: 12, loop: false, pivot: { x: 48, y: 88 } });
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 768); assert.equal(png.readUInt32BE(20), 96); assert.equal(png[25], 6, 'RGBA PNG');
    // v2: jolt held for 2 steps, then every sheet frame once (0.75 s); reduced motion = stiff pose (sheet 4).
    assert.deepEqual([...m.sequence], [0, 0, 1, 2, 3, 4, 5, 6, 7]); assert.equal(s.duration(m), 9 / 12);
    assert.equal(s.frameAt(m, def.stillTime), 4);
    for (const hz of [30, 60, 120, 144]) for (let i = 0; i <= hz; i++) assert.equal(s.frameAt(m, i / hz), m.sequence[Math.min(8, Math.floor(i / hz * 12))]);
  }
  assert.equal(c.playerRadius, 18);
  const fake = data => ({ ready: true, image: { complete: true, naturalWidth: 768 }, data });
  const loopMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/hero/flight_loop/hero_flight_loop.json')));
  const A = { HIT: fake(meta('HIT')), LOOP: fake(loopMeta), UP: fake(meta('AERIAL_UP')), DOWN: fake(meta('AERIAL_DOWN')), GB: fake(meta('GROUND_BOUNCE')) };
  const names = new Map(Object.entries({ HIT: A.HIT, FLIGHT_LOOP: A.LOOP, AERIAL_UP: A.UP, AERIAL_DOWN: A.DOWN, GROUND_BOUNCE: A.GB }).map(([k, v]) => [v, k]));
  const graphics = scope.Hop.Graphics, originalCharacter = graphics.character, originalDraw = s.draw;
  const saved = Object.fromEntries(['heroHit', 'heroFlight', 'heroAerialUp', 'heroAerialDown', 'heroGroundBounce', 'heroStopResult'].map(k => [k, s[k]]));
  const stack = [], ctx = { imageSmoothingEnabled: true, save() { stack.push(this.imageSmoothingEnabled); }, restore() { this.imageSmoothingEnabled = stack.pop(); }, drawImage() { assert.equal(this.imageSmoothingEnabled, false); } };
  let canvasHero = 0, drawn = [], failHit = false;
  graphics.character = function (cx, id, ...rest) { if (id === 'HERO') canvasHero++; return originalCharacter.call(this, cx, id, ...rest); };
  s.draw = function (_ctx, asset, time, x, feet, scale) {
    if (failHit && asset === this.heroHit) return false;
    const ok = originalDraw.call(this, ctx, asset, time, x, feet, scale);
    if (ok) drawn.push({ name: names.get(asset) || 'OTHER', frame: this.frameAt(asset.data, time), feet, scale });
    return ok;
  };
  const install = (hit = A.HIT, extra = {}) => Object.assign(s, { heroHit: hit, heroFlight: A.LOOP, heroAerialUp: A.UP, heroAerialDown: A.DOWN, heroGroundBounce: { ready: false }, heroStopResult: { ready: false }, ...extra });
  const frame = (game, ui) => { drawn = []; canvasHero = 0; const g0 = JSON.stringify(game), v0 = JSON.stringify(ui.visual);
    ui.draw(); assert.equal(JSON.stringify(game), g0, 'draw must not mutate game'); assert.equal(JSON.stringify(ui.visual), v0, 'draw must not mutate visual');
    return drawn.at(-1) || { name: canvasHero ? 'CANVAS' : 'NONE' }; };
  // Real launch path: READY -> AIM_ANGLE -> AIM_POWER -> FLYING with ui.update after each act (as input.js does).
  function start(seed = 4, angle = 40, power = 0.8) {
    const game = new scope.Hop.Game(require('./phase2.cjs').random(seed)), ui = new scope.Hop.UI(game, element('canvas'));
    ui.update(); game.act(); ui.update(); game.angle = angle; game.act(); ui.update(); assert.equal(game.state, ST.AIM_POWER);
    assert.equal(ui.visual.oneShot, null); game.power = power; game.act(); ui.update(); assert.equal(game.state, ST.FLYING);
    game.objects = []; game.nextObjectX = 1e12; game.nextBoundaryX = 1e12;
    return { game, ui };
  }
  install();
  for (const hz of [30, 60, 120, 144]) {
    const { game, ui } = start();
    assert.equal(JSON.stringify(ui.visual.oneShot), JSON.stringify({ animation: 'HIT', at: game.phaseTime }), 'HIT starts on the launch update');
    assert.equal(ui.visual.launchAt, game.phaseTime);
    const at = game.phaseTime, seen = []; let ended = false;
    for (let i = 0; i < hz * 1.5; i++) {
      const t = game.phaseTime - at, out = frame(game, ui);
      if (t < 8 / 12) {
        assert.equal(out.name, 'HIT'); assert.equal(out.frame, Math.min(7, Math.floor(t * 12)), `${hz}Hz t=${t}`);
        assert.equal(out.feet, c.playerRadius); assert.equal(out.scale, 1.25);
        assert.equal(s.tiltWeight(ui.visual, game.phaseTime), 0, 'baked rotation: no vy tilt during HIT');
        if (seen.at(-1) !== out.frame) seen.push(out.frame);
      } else { assert.equal(out.name, 'FLIGHT_LOOP', 'hands back to FLIGHT_LOOP'); ended = true; }
      game.update(1 / hz); ui.update();
    }
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7], `${hz}Hz all frames once`); assert(ended);
    assert.equal(s.tiltWeight(ui.visual, game.phaseTime), 1, 'tilt restored after the ease');
  }
  // Tilt eases back over tiltEase after HIT.
  assert(Math.abs(s.tiltWeight({ oneShot: { animation: 'HIT', at: 0 } }, 8 / 12 + def.tiltEase / 2) - 0.5) < 1e-9);
  // Physics identical with or without the UI / HIT drawing.
  {
    const { game, ui } = start(); const ref = launch(4, 40, 0.8); ref.objects = []; ref.nextObjectX = 1e12; ref.nextBoundaryX = 1e12;
    ref.phaseTime = game.phaseTime;
    for (let i = 0; i < 240; i++) { game.update(1 / 120); ui.update(); frame(game, ui); ref.update(1 / 120); }
    assert.equal(JSON.stringify(game.body), JSON.stringify(ref.body), 'physics unchanged');
  }
  // Interrupts: newest wins. AERIAL during HIT -> AERIAL; a normal bounce during HIT -> GROUND_BOUNCE.
  {
    const { game, ui } = start(); for (let i = 0; i < 6; i++) { game.update(1 / 60); ui.update(); }
    assert.equal(frame(game, ui).name, 'HIT');
    assert(game.aerial('UP')); ui.update(); assert.equal(frame(game, ui).name, 'AERIAL_UP');
  }
  {
    install(A.HIT, { heroGroundBounce: A.GB });
    const { game, ui } = start(4, 15, 0.6); for (let i = 0; i < 3; i++) { game.update(1 / 60); ui.update(); }
    assert.equal(ui.visual.oneShot.animation, 'HIT');
    Object.assign(game.body, { y: 3, vy: -500 }); let guard = 0; const b0 = game.body.bounces;
    while (game.body.bounces === b0) { game.update(1 / 120); ui.update(); assert(++guard < 30); }
    assert.equal(ui.visual.oneShot.animation, 'GROUND_BOUNCE'); install();
  }
  // Reduced motion: one representative frame (sheet 3) for the HIT duration, then FLIGHT_LOOP (still).
  {
    const { game, ui } = start(); ui.visual.reducedMotion = true;
    for (let i = 0; i < 60; i++) { const t = game.phaseTime - ui.visual.oneShot.at, out = frame(game, ui);
      if (t < 8 / 12) { assert.equal(out.name, 'HIT'); assert.equal(out.frame, s.frameAt(A.HIT.data, def.stillTime)); assert.equal(out.frame, 5); } else assert.equal(out.name, 'FLIGHT_LOOP');
      game.update(1 / 60); ui.update(); }
  }
  // Missing asset: no HIT, FLIGHT_LOOP from the first frame (unchanged). Draw failure: FLIGHT_LOOP, then Canvas.
  {
    install({ ready: false }); const { game, ui } = start(); assert.equal(ui.visual.oneShot, null); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    install(); failHit = true; const r2 = start(); assert.equal(frame(r2.game, r2.ui).name, 'FLIGHT_LOOP');
    s.heroFlight = { ready: false }; assert.equal(frame(r2.game, r2.ui).name, 'CANVAS'); failHit = false; install();
  }
  // Only the launch triggers it: not READY/AIM, not RESULT, not RETRY until the next launch.
  {
    const { game, ui } = start(); while (game.state === ST.FLYING) { game.update(1 / 30); ui.update(); }
    assert.equal(ui.visual.oneShot, null);
    game.act(); ui.update(); assert.equal(game.state, ST.AIM_ANGLE); assert.equal(ui.visual.oneShot, null); assert.equal(frame(game, ui).name, 'CANVAS');
    game.act(); ui.update(); assert.equal(ui.visual.oneShot, null);
    game.act(); ui.update(); assert.equal(game.state, ST.FLYING); assert.equal(ui.visual.oneShot.animation, 'HIT', 'next launch plays it again');
  }
  graphics.character = originalCharacter; s.draw = originalDraw; Object.assign(s, saved);
  console.log('Hit PASS: flag/files/JSON, starts on the launch update, 12fps 8 frames at 30/60/120/144Hz then FLIGHT_LOOP, no vy tilt during HIT + ease back, physics unchanged, AERIAL/GROUND_BOUNCE interrupt (newest wins), reduced motion = stillTime frame (real v2: sheet 4), real JSON sequence at 30/60/120/144Hz, missing asset/draw failure fallback, launch-only trigger, draw purity.');
}
