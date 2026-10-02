// HERO AERIAL UP / DOWN one-shot sprites: display-only checks (run via release.cjs).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const dirs = { UP: 'assets/sprites/hero/hero_aerial_up_v1_bundle/', DOWN: 'assets/sprites/hero/hero_aerial_down_v1_bundle/' };
const meta = {
  UP: JSON.parse(fs.readFileSync(path.join(root, dirs.UP, 'hero_aerial_up.json'))),
  DOWN: JSON.parse(fs.readFileSync(path.join(root, dirs.DOWN, 'hero_aerial_down.json'))),
  LOOP: JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/hero/flight_loop/hero_flight_loop.json')))
};
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok';
    class Image {
      constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 96; }
      set src(value) {
        if (mode === 'image-error') this.onerror(new Error('missing image'));
        else { if (mode === 'size') this.naturalHeight = 95; this.onload(); }
      }
    }
    const byUrl = url => url.includes('aerial_up') ? meta.UP : url.includes('aerial_down') ? meta.DOWN : meta.LOOP;
    const scope = { Hop: {}, Image, fetch: async url => {
      if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => {
        if (mode === 'json') throw new SyntaxError('invalid JSON');
        const data = byUrl(url);
        if (mode === 'swap') return url.includes('aerial_up') ? meta.DOWN : meta.UP;
        if (mode === 'loop') return { ...data, loop: true };
        if (mode === 'fps') return { ...data, fps: 8 };
        if (mode === 'pivot') return { ...data, pivot: { x: 48, y: 90 } };
        return data;
      } };
    } };
    vm.createContext(scope); vm.runInContext(code, scope);
    const s = scope.Hop.Sprites, d = s.definitions.HERO;
    const [up, down] = await s.aerialReady;
    assert.equal(up.ready, true); assert.equal(down.ready, true);
    assert.equal(s.heroAerialUp, up); assert.equal(s.heroAerialDown, down);
    assert.equal((await s.ready).ready, true, 'FLIGHT_LOOP still loads');
    for (mode of ['image-error', 'size', 'network', '404', 'json', 'swap', 'loop', 'fps', 'pivot']) {
      for (const key of ['AERIAL_UP', 'AERIAL_DOWN']) assert.equal((await s.load(d[key])).ready, false, key + ' ' + mode);
    }
    mode = 'ok';
    for (const key of ['AERIAL_UP', 'AERIAL_DOWN']) assert.equal((await s.load(d[key])).ready, true, key + ' recovery');
    console.log('Aerial loader PASS: UP/DOWN success, missing image, bad size, network/404, invalid JSON, swapped/loop/fps/pivot metadata, recovery.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, launch, element } = require('./phase2.cjs');
  const s = scope.Hop.Sprites, H = s.definitions.HERO, c = scope.Hop.CONFIG;
  // Assets: relative, present, RGBA 768x96 sheets, metadata matches the spec.
  for (const dir of ['UP', 'DOWN']) {
    const def = H['AERIAL_' + dir], m = meta[dir];
    for (const ref of [def.src, def.metadata]) {
      assert(!/^(?:\/|[a-z]+:)/i.test(ref), 'relative ' + ref);
      assert(new URL(ref, 'https://example.test/Flash-game/').pathname.startsWith('/Flash-game/assets/sprites/hero/'));
      assert(fs.existsSync(path.join(root, ref)), 'exists ' + ref);
    }
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 768); assert.equal(png.readUInt32BE(20), 96); assert.equal(png[25], 6, 'RGBA PNG');
    assert.deepEqual({ id: m.id, animation: m.animation, w: m.frameWidth, h: m.frameHeight, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot },
      { id: 'HERO', animation: 'AERIAL_' + dir, w: 96, h: 96, frames: 8, fps: 12, loop: false, pivot: { x: 48, y: 88 } });
    assert.equal(def.scale, 1.25); assert.equal(m.displayScale, def.scale);
    assert.equal(def.fps, 12); assert.equal(def.loop, false);
  }
  assert.equal(H.FLIGHT_LOOP.fps, 8); assert.equal(H.FLIGHT_LOOP.loop, true); assert.equal(H.FLIGHT_LOOP.scale, 1.25);
  assert.equal(c.playerRadius, 18, 'playerRadius untouched');

  const fake = data => ({ ready: true, image: { complete: true, naturalWidth: 768 }, data });
  const assets = { UP: fake(meta.UP), DOWN: fake(meta.DOWN), LOOP: fake(meta.LOOP) };
  const names = new Map([[assets.UP, 'AERIAL_UP'], [assets.DOWN, 'AERIAL_DOWN'], [assets.LOOP, 'FLIGHT_LOOP']]);
  // Recording context: checks nearest-neighbour inside save/restore and pivot placement.
  const stack = [], images = [];
  const ctx = { imageSmoothingEnabled: true,
    save() { stack.push(this.imageSmoothingEnabled); },
    restore() { this.imageSmoothingEnabled = stack.pop(); },
    drawImage(...args) { assert.equal(this.imageSmoothingEnabled, false, 'smoothing off while drawing'); images.push(args); } };
  // frameAt: one-shot holds the last frame, loop wraps.
  for (let i = 0; i < 40; i++) {
    const t = i / 24;
    assert.equal(s.frameAt(meta.UP, t), Math.min(7, Math.floor(t * 12)));
    assert.equal(s.frameAt(meta.LOOP, t), Math.floor(t * 8) % 8);
  }
  assert.equal(s.frameAt(meta.DOWN, -1), 0); assert.equal(s.frameAt(meta.DOWN, NaN), 0); assert.equal(s.frameAt(meta.DOWN, 99), 7);
  assert.equal(s.duration(meta.UP), 8 / 12);
  // Direct draw: pivot (48,88) at 1.25 => 120x120 cell offset (60,110).
  for (const dir of ['UP', 'DOWN']) {
    for (let f = 0; f < 8; f++) {
      assert(s.draw(ctx, assets[dir], (f + 0.5) / 12, 100, 200, 1.25));
      assert.deepEqual(images.at(-1).slice(1), [f * 96, 0, 96, 96, 100 - 60, 200 - 110, 120, 120]);
      assert.equal(ctx.imageSmoothingEnabled, true, 'smoothing restored');
    }
  }
  ctx.drawImage = () => { throw new Error('decode lost'); };
  assert.equal(s.draw(ctx, assets.UP, 0, 0, 0, 1.25), false); assert.equal(ctx.imageSmoothingEnabled, true);
  ctx.drawImage = function (...args) { assert.equal(this.imageSmoothingEnabled, false); images.push(args); };

  // Integration through the real Game/UI with recorded sprite draws.
  const graphics = scope.Hop.Graphics, originalCharacter = graphics.character, originalDraw = s.draw;
  const saved = { heroFlight: s.heroFlight, heroAerialUp: s.heroAerialUp, heroAerialDown: s.heroAerialDown };
  let canvasHero = 0, drawn = [];
  graphics.character = function (cx, id, ...rest) { if (id === 'HERO') canvasHero++; return originalCharacter.call(this, cx, id, ...rest); };
  s.draw = function (_ctx, asset, time, x, feet, scale) {
    const ok = originalDraw.call(this, ctx, asset, time, x, feet, scale);
    if (ok) drawn.push({ name: names.get(asset) || 'OTHER', frame: this.frameAt(asset.data, time), time, scale, x, feet });
    return ok;
  };
  const install = (up = assets.UP, down = assets.DOWN, loop = assets.LOOP) => { s.heroAerialUp = up; s.heroAerialDown = down; s.heroFlight = loop; };
  const frame = (game, ui) => { drawn = []; canvasHero = 0; const before = JSON.stringify(game), vis = JSON.stringify(ui.visual);
    ui.draw(); assert.equal(JSON.stringify(game), before, 'draw must not mutate game'); assert.equal(JSON.stringify(ui.visual), vis, 'draw must not mutate visual');
    return drawn.at(-1) || { name: canvasHero ? 'CANVAS' : 'NONE' }; };
  function airborne(seed = 3) {
    const game = launch(seed, 45, 1), ui = new scope.Hop.UI(game, element('canvas'));
    ui.lastState = 'AIM_POWER'; ui.update();
    for (let i = 0; i < 30; i++) { game.update(1 / 60); ui.update(); }
    assert(game.airborne() && game.state === 'FLYING');
    return { game, ui };
  }
  install();
  // Timing at each refresh rate: same frame for the same elapsed time; ends -> FLIGHT_LOOP.
  const results = {};
  for (const hz of [30, 60, 120, 144]) {
    for (const dir of ['UP', 'DOWN']) {
      const { game, ui } = airborne();
      game.downCharge = 1; game.upRemaining = 3;
      const startPhase = game.phaseTime;
      assert.equal(game.aerial(dir), true); ui.update();
      assert.equal(ui.visual.oneShot.animation, 'AERIAL_' + dir); assert.equal(ui.visual.oneShot.at, startPhase);
      const seen = new Set(); let endedAt = null;
      for (let i = 0; i <= hz; i++) {
        if (i) { game.update(1 / hz); ui.update(); }
        const elapsed = game.phaseTime - startPhase, out = frame(game, ui);
        if (elapsed < 8 / 12) {
          assert.equal(out.name, 'AERIAL_' + dir, `${hz}Hz ${dir} t=${elapsed}`);
          assert.equal(out.frame, Math.min(7, Math.floor(elapsed * 12)));
          assert.equal(out.scale, 1.25); assert.equal(out.feet, c.playerRadius); assert.equal(out.x, 0);
          seen.add(out.frame);
        } else {
          assert.equal(out.name, 'FLIGHT_LOOP', `${hz}Hz ${dir} returns to loop`);
          endedAt ??= elapsed;
        }
      }
      assert.equal(seen.size, 8, `${hz}Hz ${dir} shows all 8 frames`);
      assert(endedAt >= 8 / 12 && endedAt < 8 / 12 + 1 / hz + 1e-9, `${hz}Hz ends on time`);
      results[hz] = true;
    }
  }
  // Interrupt: a new AERIAL mid-animation restarts with the new one (also same direction).
  {
    const { game, ui } = airborne(); game.downCharge = 1;
    assert(game.aerial('UP')); ui.update();
    for (let i = 0; i < 18; i++) { game.update(1 / 60); ui.update(); }
    assert.equal(frame(game, ui).name, 'AERIAL_UP'); assert(frame(game, ui).frame >= 3);
    assert(game.aerial('DOWN')); ui.update();
    let out = frame(game, ui); assert.equal(out.name, 'AERIAL_DOWN'); assert.equal(out.frame, 0);
    for (let i = 0; i < 6; i++) { game.update(1 / 60); ui.update(); }
    assert(game.aerial('UP')); ui.update();
    out = frame(game, ui); assert.equal(out.name, 'AERIAL_UP'); assert.equal(out.frame, 0);
    for (let i = 0; i < 6; i++) { game.update(1 / 60); ui.update(); }
    assert(game.aerial('UP')); ui.update();
    out = frame(game, ui); assert.equal(out.name, 'AERIAL_UP'); assert.equal(out.frame, 0, 'same direction restarts');
    // Failed AERIAL (no UP left) does not start an animation.
    game.upRemaining = 0; for (let i = 0; i < 60; i++) { game.update(1 / 60); ui.update(); }
    assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    assert.equal(game.aerial('UP'), false); ui.update(); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    // Non-aerial effects (BOUND BOOST) do not start or cancel the one-shot.
    game.downCharge = 1; assert(game.aerial('DOWN')); ui.update();
    game.effect = { label: 'BOUND BOOST', remaining: 0.2 }; ui.update();
    assert.equal(frame(game, ui).name, 'AERIAL_DOWN');
  }
  // Real 1-tap path: act() during FLYING chooses the direction and starts the matching sprite.
  {
    const { game, ui } = airborne(); const mode = game.updateAerialMode();
    game.act(); ui.update();
    assert.equal(ui.visual.oneShot.animation, 'AERIAL_' + mode); assert.equal(frame(game, ui).name, 'AERIAL_' + mode);
  }
  // Fallbacks: missing aerial -> FLIGHT_LOOP; missing both -> Canvas HERO; draw failure -> next layer.
  {
    const { game, ui } = airborne(); game.downCharge = 1;
    install({ ready: false }, { ready: false }); assert(game.aerial('DOWN')); ui.update();
    assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    install({ ready: false }, null, { ready: false }); assert.equal(frame(game, ui).name, 'CANVAS');
    install(assets.UP, { ...assets.DOWN, data: null }); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    install(assets.UP, { ...assets.DOWN, image: { complete: true, naturalWidth: 0 } }); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    install(); assert.equal(frame(game, ui).name, 'AERIAL_DOWN');
    ui.visual.oneShot = { animation: 'SIDEWAYS', at: game.phaseTime }; assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
  }
  // reduced motion: hold the aerial first frame for its duration, then FLIGHT_LOOP first frame.
  {
    const { game, ui } = airborne(); game.downCharge = 1; ui.visual.reducedMotion = true;
    assert(game.aerial('UP')); ui.update();
    for (let i = 0; i < 30; i++) { const out = frame(game, ui); assert.equal(out.name, 'AERIAL_UP'); assert.equal(out.frame, 0); game.update(1 / 60); ui.update(); }
    for (let i = 0; i < 12; i++) { game.update(1 / 60); ui.update(); }
    const out = frame(game, ui); assert.equal(out.name, 'FLIGHT_LOOP'); assert.equal(out.time, 0);
  }
  // Only FLYING uses sprites; leaving FLYING clears the one-shot (RESULT, RETRY).
  {
    const { game, ui } = airborne(); game.downCharge = 1; assert(game.aerial('DOWN')); ui.update();
    for (const state of ['READY', 'AIM_ANGLE', 'AIM_POWER', 'RESULT']) {
      const keep = game.state; game.state = state; assert.equal(frame(game, ui).name, 'CANVAS', state); game.state = keep;
    }
    game.finish(); ui.update(); assert.equal(game.state, 'RESULT'); assert.equal(ui.visual.oneShot, null);
    assert.equal(frame(game, ui).name, 'CANVAS');
    game.act(); ui.update(); assert.equal(game.state, 'AIM_ANGLE'); assert.equal(ui.visual.oneShot, null);
  }
  // Rendering is display-only: identical physics with and without sprites/draw calls.
  {
    const run = draw => { const { game, ui } = airborne(7); game.downCharge = 1; game.aerial('DOWN'); ui.update();
      for (let i = 0; i < 240; i++) { game.update(1 / 60); ui.update(); if (draw) ui.draw(); if (i === 90) { game.act(); ui.update(); } }
      return JSON.stringify({ body: game.body, state: game.state, up: game.upRemaining, charge: game.downCharge, objects: game.objects }); };
    install(); const withSprites = run(true); install({ ready: false }, { ready: false }, { ready: false });
    assert.equal(run(true), withSprites); assert.equal(run(false), withSprites);
  }
  graphics.character = originalCharacter; s.draw = originalDraw; Object.assign(s, saved);
  console.log('Aerial sprites PASS: assets/spec, 12fps one-shot at ' + Object.keys(results).join('/') + 'Hz, end -> FLIGHT_LOOP, interrupt/restart, pivot 48,88 x1.25, smoothing off+restored, fallback chain, reduced motion, FLYING only/RESULT/RETRY reset, draw purity, physics unchanged.');
}
