// HERO GROUND_BOUNCE one-shot: ships disabled until the real asset exists; behaviour is
// verified with test-only mock assets (no art is created). Display-only checks.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const dir = 'assets/sprites/hero/hero_ground_bounce_comic_v1/';
const mockMeta = { id: 'HERO', animation: 'GROUND_BOUNCE', frameWidth: 96, frameHeight: 96, frames: 8, fps: 12, loop: false, pivot: { x: 48, y: 88 }, displayScale: 1.25, nextAnimation: 'FLIGHT_LOOP' };
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok'; const requested = [];
    class Image {
      constructor() { this.complete = true; this.naturalWidth = 768; this.naturalHeight = 96; }
      set src(value) { requested.push(value); if (mode === 'image-error') this.onerror(new Error('missing')); else { if (mode === 'size') this.naturalWidth = 760; this.onload(); } }
    }
    const scope = { Hop: {}, Image, fetch: async url => {
      requested.push(url);
      if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => {
        if (mode === 'json') throw new SyntaxError('bad');
        if (!url.includes('ground_bounce')) return { ...mockMeta, animation: url.includes('aerial_up') ? 'AERIAL_UP' : url.includes('aerial_down') ? 'AERIAL_DOWN' : 'FLIGHT_LOOP', fps: url.includes('flight_loop') ? 8 : 12, loop: url.includes('flight_loop') };
        if (mode === 'swap') return { ...mockMeta, animation: 'AERIAL_UP' };
        if (mode === 'loop') return { ...mockMeta, loop: true };
        if (mode === 'fps') return { ...mockMeta, fps: 8 };
        if (mode === 'pivot') return { ...mockMeta, pivot: { x: 40, y: 88 } };
        if (mode === 'frame') return { ...mockMeta, frameWidth: 64 };
        if (mode === 'seq-range') return { ...mockMeta, sequence: [4, 8] };
        if (mode === 'seq-empty') return { ...mockMeta, sequence: [] };
        if (mode === 'seq-type') return { ...mockMeta, sequence: '4,5' };
        if (mode === 'seq-float') return { ...mockMeta, sequence: [4.5] };
        if (mode === 'seq-ok') return { ...mockMeta, sequence: [4, 4, 5, 5, 6, 6, 7, 7] };
        return mockMeta;
      } };
    } };
    vm.createContext(scope); vm.runInContext(code, scope);
    const s = scope.Hop.Sprites, def = s.definitions.HERO.GROUND_BOUNCE;
    const startup = await s.groundBounceReady;
    if (def.enabled === false) {
      assert.equal(startup.ready, false);
      assert(!requested.some(u => u.includes('ground_bounce')), 'disabled asset is never requested (no 404 in console)');
      assert.equal((await s.load(def)).ready, false);
      assert(!requested.some(u => u.includes('ground_bounce')));
    }
    assert.equal(s.heroGroundBounce, startup);
    assert.equal((await s.ready).ready, true); assert.equal((await s.aerialReady).every(a => a.ready), true, 'other sprites unaffected');
    const on = { ...def, enabled: true };
    assert.equal((await s.load(on)).ready, true, 'mock success once enabled');
    for (mode of ['image-error', 'size', 'network', '404', 'json', 'swap', 'loop', 'fps', 'pivot', 'frame', 'seq-range', 'seq-empty', 'seq-type', 'seq-float']) assert.equal((await s.load(on)).ready, false, mode);
    mode = 'seq-ok'; const seqAsset = await s.load(on); assert.equal(seqAsset.ready, true); assert.equal(s.duration(seqAsset.data), 8 / 12);
    mode = 'ok'; assert.equal((await s.load(on)).ready, true, 'recovery');
    console.log('Ground bounce loader PASS: disabled = no request, mock success, image/size/network/404/JSON/animation/loop/fps/pivot/frame/sequence errors, valid sequence, recovery.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, launch, element } = require('./phase2.cjs');
  const s = scope.Hop.Sprites, H = s.definitions.HERO, def = H.GROUND_BOUNCE, c = scope.Hop.CONFIG;
  // Planned asset contract: relative paths below the Pages subpath; flag must match the files.
  for (const ref of [def.src, def.metadata]) {
    assert(!/^(?:\/|[a-z]+:)/i.test(ref)); assert(ref.startsWith(dir));
    assert(new URL(ref, 'https://example.test/Flash-game/').pathname.startsWith('/Flash-game/' + dir));
  }
  assert.equal(def.src, dir + 'hero_ground_bounce_sheet_288x288.png'); assert.equal(def.metadata, dir + 'hero_ground_bounce.json');
  assert.deepEqual([def.animation, def.fps, def.loop, def.scale], ['GROUND_BOUNCE', 12, false, 1.25]);
  const present = fs.existsSync(path.join(root, def.src)) && fs.existsSync(path.join(root, def.metadata));
  assert.equal(def.enabled !== false, present, present
    ? 'GROUND_BOUNCE bundle found: set enabled: true in js/sprites.js'
    : 'GROUND_BOUNCE enabled but bundle missing: add the files or set enabled: false');
  if (present) {
    const m = JSON.parse(fs.readFileSync(path.join(root, def.metadata)));
    // HD comic sheet: 8 identical 288 cells, pivot (cell/2, cell*88/96), v1 timing/sequence kept.
    assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: { x: m.pivot?.x, y: m.pivot?.y }, next: m.nextAnimation, smoothing: m.smoothing },
      { id: 'HERO', animation: 'GROUND_BOUNCE', w: 288, h: 288, frames: 8, fps: 12, loop: false, pivot: { x: 144, y: 264 }, next: 'FLIGHT_LOOP', smoothing: true });
    assert.deepEqual(m.sequence, [4, 4, 5, 5, 6, 6, 7, 7]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
  }
  assert.equal(c.playerRadius, 18);

  const fake = data => ({ ready: true, image: { complete: true, naturalWidth: 768 }, data });
  const loopMeta = JSON.parse(fs.readFileSync(path.join(root, 'assets/sprites/hero/flight_loop/hero_flight_loop.json')));
  const upMeta = { ...mockMeta, animation: 'AERIAL_UP' }, downMeta = { ...mockMeta, animation: 'AERIAL_DOWN' };
  const A = { GB: fake(mockMeta), LOOP: fake(loopMeta), UP: fake(upMeta), DOWN: fake(downMeta) };
  const names = new Map([[A.GB, 'GROUND_BOUNCE'], [A.LOOP, 'FLIGHT_LOOP'], [A.UP, 'AERIAL_UP'], [A.DOWN, 'AERIAL_DOWN']]);
  const stack = [], images = [];
  const ctx = { imageSmoothingEnabled: true, save() { stack.push(this.imageSmoothingEnabled); }, restore() { this.imageSmoothingEnabled = stack.pop(); },
    drawImage(...args) { assert.equal(this.imageSmoothingEnabled, false); images.push(args); } };
  for (let f = 0; f < 8; f++) {
    assert(s.draw(ctx, A.GB, (f + 0.25) / 12, 100, 200, def.scale));
    assert.deepEqual(images.at(-1).slice(1), [f * 96, 0, 96, 96, 40, 90, 120, 120]); assert.equal(ctx.imageSmoothingEnabled, true);
  }
  assert.equal(s.frameAt(mockMeta, 5), 7, 'non-loop holds last frame');

  const graphics = scope.Hop.Graphics, originalCharacter = graphics.character, originalDraw = s.draw;
  const saved = { heroFlight: s.heroFlight, heroAerialUp: s.heroAerialUp, heroAerialDown: s.heroAerialDown, heroGroundBounce: s.heroGroundBounce };
  let canvasHero = 0, drawn = [];
  graphics.character = function (cx, id, ...rest) { if (id === 'HERO') canvasHero++; return originalCharacter.call(this, cx, id, ...rest); };
  s.draw = function (_ctx, asset, time, x, feet, scale) {
    const ok = originalDraw.call(this, ctx, asset, time, x, feet, scale);
    if (ok) drawn.push({ name: names.get(asset) || 'OTHER', frame: this.frameAt(asset.data, time), time, scale, feet });
    return ok;
  };
  const install = (gb = A.GB, loop = A.LOOP, up = A.UP, down = A.DOWN) => Object.assign(s, { heroGroundBounce: gb, heroFlight: loop, heroAerialUp: up, heroAerialDown: down });
  const frame = (game, ui) => { drawn = []; canvasHero = 0; const g0 = JSON.stringify(game), v0 = JSON.stringify(ui.visual);
    ui.draw(); assert.equal(JSON.stringify(game), g0, 'draw must not mutate game'); assert.equal(JSON.stringify(ui.visual), v0, 'draw must not mutate visual');
    return drawn.at(-1) || { name: canvasHero ? 'CANVAS' : 'NONE' }; };
  function flight(seed = 5) {
    const game = launch(seed, 45, 1), ui = new scope.Hop.UI(game, element('canvas'));
    game.objects = []; game.nextObjectX = 1e12; game.nextBoundaryX = 1e12; // no contacts: pure bounce physics
    ui.lastState = 'AIM_POWER'; ui.update();
    return { game, ui };
  }
  const step = (game, ui, dt) => { const b = game.body.bounces; game.update(dt); ui.update(); return game.body.bounces > b; };
  install();
  // Timing at each refresh rate: starts on the bounce frame, 12fps, all 8 frames, then FLIGHT_LOOP.
  const rates = [];
  for (const hz of [30, 60, 120, 144]) {
    const { game, ui } = flight();
    let guard = 0; while (!step(game, ui, 1 / hz)) assert(++guard < hz * 20, 'first bounce');
    assert(!game.body.grounded, 'first impact is a real bounce');
    const start = game.phaseTime; assert.equal(ui.visual.oneShot.animation, 'GROUND_BOUNCE'); assert.equal(ui.visual.oneShot.at, start);
    const seen = new Set(); let ended = null;
    for (let i = 0; i <= hz; i++) {
      if (i && step(game, ui, 1 / hz)) break; // another bounce would legitimately restart
      const t = game.phaseTime - start, out = frame(game, ui);
      if (t < 8 / 12) { assert.equal(out.name, 'GROUND_BOUNCE', `${hz}Hz t=${t}`); assert.equal(out.frame, Math.min(7, Math.floor(t * 12))); assert.equal(out.scale, 1.25); assert.equal(out.feet, c.playerRadius); seen.add(out.frame); }
      else { assert.equal(out.name, 'FLIGHT_LOOP'); ended ??= t; }
    }
    assert.equal(seen.size, 8, hz + 'Hz all frames'); assert(ended >= 8 / 12 && ended < 8 / 12 + 1 / hz + 1e-9, hz + 'Hz ends on time');
    rates.push(hz);
  }
  // Airborne normal bounces trigger unless gated (tiny hop / restart interval); settling never does.
  {
    const { game, ui } = flight(); let bounces = 0, triggered = 0, gated = 0, settled = false;
    for (let i = 0; i < 60 * 60 && game.state === 'FLYING'; i++) {
      const before = ui.visual.oneShot;
      if (step(game, ui, 1 / 60)) {
        bounces++;
        const hop = 2 * game.body.vy / c.gravity, sinceGB = before?.animation === 'GROUND_BOUNCE' ? game.phaseTime - before.at : Infinity;
        if (game.body.grounded) { assert.equal(ui.visual.oneShot, before, 'settle does not trigger'); settled = true; }
        else if (hop < def.minHopTime || sinceGB < def.minRestartInterval) { assert.equal(ui.visual.oneShot, before, 'gated bounce keeps the current one-shot'); gated++; }
        else { assert.equal(ui.visual.oneShot.animation, 'GROUND_BOUNCE'); assert.equal(ui.visual.oneShot.at, game.phaseTime); triggered++; }
      }
    }
    assert(bounces >= 3 && triggered >= 2 && settled, `bounces ${bounces} triggered ${triggered} gated ${gated} settled ${settled}`);
  }
  // Merchant Type D (BOUND BOOST) bounces never trigger; normal bounces after it ends do.
  {
    const { game, ui } = flight(9); game.acquireMerchant('D'); ui.update();
    let typeD = 0, normalAfter = 0;
    for (let i = 0; i < 60 * 90 && game.state === 'FLYING' && normalAfter < 1; i++) {
      const wasD = game.merchant?.type === 'D', before = ui.visual.oneShot;
      if (step(game, ui, 1 / 60)) {
        if (wasD) { typeD++; assert.equal(game.effect?.label, 'BOUND BOOST'); assert.equal(ui.visual.oneShot, before, 'Type D bounce must not trigger GROUND_BOUNCE'); }
        else if (!game.body.grounded) { assert.equal(ui.visual.oneShot.animation, 'GROUND_BOUNCE'); normalAfter++; }
      }
    }
    assert.equal(typeD, c.typeDBounces, 'all Type D bounces observed'); assert.equal(normalAfter, 1, 'normal bounce after Type D ends triggers');
  }
  // Interrupts: AERIAL during GROUND_BOUNCE restarts as AERIAL; a bounce during AERIAL restarts as GROUND_BOUNCE.
  {
    const { game, ui } = flight();
    while (!step(game, ui, 1 / 60));
    for (let i = 0; i < 10; i++) step(game, ui, 1 / 60);
    assert.equal(frame(game, ui).name, 'GROUND_BOUNCE'); assert(frame(game, ui).frame >= 1);
    game.downCharge = 1; const mode = game.updateAerialMode(); game.act(); ui.update();
    let out = frame(game, ui); assert.equal(out.name, 'AERIAL_' + mode); assert.equal(out.frame, 0);
    // Phase B: same-priority events wait minShow (1/12 s): an immediate second AERIAL keeps the first sprite.
    game.downCharge = 1; game.aerialMode = mode === 'UP' ? 'DOWN' : 'UP';
    for (let i = 0; i < 6; i++) step(game, ui, 1 / 60);
    Object.assign(game.body, { y: 150, vy: -400 }); game.downCharge = 1; assert(game.aerial('DOWN')); ui.update();
    assert.equal(frame(game, ui).name, 'AERIAL_DOWN');
    let guard = 0; while (!step(game, ui, 1 / 60)) assert(++guard < 60);
    assert(game.phaseTime - ui.visual.oneShot.at < 0.2);
    assert(!game.body.grounded); out = frame(game, ui); assert.equal(out.name, 'GROUND_BOUNCE'); assert.equal(out.frame, 0);
    // A bounce within minShow of a new AERIAL does not flash the AERIAL for 1-3 frames: AERIAL keeps playing.
    Object.assign(game.body, { y: 30, vy: -400 }); for (let i = 0; i < 25; i++) step(game, ui, 1 / 60);
    game.downCharge = 1; Object.assign(game.body, { y: 6, vy: -300 }); assert(game.aerial('DOWN')); ui.update();
    const aerialAt = ui.visual.oneShot.at; guard = 0; while (!step(game, ui, 1 / 120)) assert(++guard < 30);
    assert(game.phaseTime - aerialAt < 1 / 12); assert.equal(frame(game, ui).name, 'AERIAL_DOWN'); assert.equal(ui.visual.oneShot.at, aerialAt);
  }
  // Asset absent (current shipping state): bounces change nothing, an AERIAL keeps playing.
  for (const missing of [undefined, { ready: false }]) {
    install(); s.heroGroundBounce = missing; const { game, ui } = flight();
    while (!step(game, ui, 1 / 60)); assert.equal(ui.visual.oneShot, null); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    Object.assign(game.body, { y: 25, vy: -400 }); game.downCharge = 1; assert(game.aerial('DOWN')); ui.update(); const at = ui.visual.oneShot.at;
    while (!step(game, ui, 1 / 60)); assert.equal(ui.visual.oneShot.animation, 'AERIAL_DOWN'); assert.equal(ui.visual.oneShot.at, at);
    assert.equal(frame(game, ui).name, 'AERIAL_DOWN');
  }
  // Fallback chain once triggered: broken GROUND_BOUNCE -> FLIGHT_LOOP -> Canvas HERO, no throw.
  {
    install(); const { game, ui } = flight(); while (!step(game, ui, 1 / 60));
    assert.equal(frame(game, ui).name, 'GROUND_BOUNCE');
    install({ ...A.GB, data: null }); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    install({ ...A.GB, image: { complete: false, naturalWidth: 0 } }); assert.equal(frame(game, ui).name, 'FLIGHT_LOOP');
    install({ ready: false }, { ready: false }); assert.equal(frame(game, ui).name, 'CANVAS');
    install(); const throwing = s.draw; let thrown = 0;
    s.draw = function (cx, asset, ...rest) { if (asset === A.GB) { thrown++; return originalDraw.call(this, { save() {}, restore() {}, drawImage() { throw new Error('decode lost'); } }, asset, ...rest); } return throwing.call(this, cx, asset, ...rest); };
    assert.equal(frame(game, ui).name, 'FLIGHT_LOOP'); assert.equal(thrown, 1); s.draw = throwing;
  }
  // Reduced motion: hold frame 0 for the one-shot duration, then FLIGHT_LOOP frame 0 (same as AERIAL).
  {
    install(); const { game, ui } = flight(); ui.visual.reducedMotion = true;
    while (!step(game, ui, 1 / 60)); const start = game.phaseTime;
    while (game.phaseTime - start < 8 / 12) { const out = frame(game, ui); assert.equal(out.name, 'GROUND_BOUNCE'); assert.equal(out.frame, 0); assert.equal(out.time, 0); if (step(game, ui, 1 / 60)) break; }
    const out = frame(game, ui); assert.equal(out.name, 'FLIGHT_LOOP'); assert.equal(out.time, 0);
  }
  // Only FLYING; RESULT and RETRY clear it (RESULT without STOP_RESULT: frozen FLIGHT_LOOP, Phase B).
  {
    install(); const { game, ui } = flight(); while (!step(game, ui, 1 / 60));
    for (const state of ['READY', 'AIM_ANGLE', 'AIM_POWER', 'RESULT']) { const keep = game.state; game.state = state; assert.equal(frame(game, ui).name, state === 'RESULT' ? 'FLIGHT_LOOP' : 'CANVAS'); game.state = keep; }
    game.finish(); ui.update(); assert.equal(ui.visual.oneShot, null); game.act(); ui.update(); assert.equal(game.state, 'AIM_ANGLE'); assert.equal(ui.visual.oneShot, null);
    assert.equal(ui.visual.lastBounces, game.body.bounces);
  }
  // Display-only: identical physics/game outcome with the mock asset, without it, and without drawing.
  {
    const run = (draw, gb) => { install(gb); const { game, ui } = flight(11); game.acquireMerchant('D');
      for (let i = 0; i < 60 * 40 && game.state === 'FLYING'; i++) { game.update(1 / 60); ui.update(); if (draw) ui.draw(); if (i % 97 === 50) { game.act(); ui.update(); } }
      return JSON.stringify({ body: game.body, state: game.state, final: game.finalDistance, up: game.upRemaining, merchant: game.merchant, stats: game.merchantStats }); };
    const ref = run(true, A.GB); assert.equal(run(true, { ready: false }), ref); assert.equal(run(false, A.GB), ref);
  }
  // ---- Display tuning: (a) sequence, (b) tilt suppression, (c) restart gating ----
  const seqMeta = { ...mockMeta, sequence: [4, 4, 5, 5, 6, 6, 7, 7] }, SEQ = fake(seqMeta); names.set(SEQ, 'GROUND_BOUNCE');
  if (present) {
    const real = JSON.parse(fs.readFileSync(path.join(root, def.metadata)));
    assert.deepEqual([...real.sequence], [4, 4, 5, 5, 6, 6, 7, 7], 'real asset starts at the deepest squash (sheet 4) and ends upright (sheet 7)');
    assert.equal(s.duration(real), 8 / 12);
  }
  // (a) frame order follows the sequence, time-based at every refresh rate; duration = length / fps.
  for (const hz of [30, 60, 120, 144]) for (let i = 0; i <= hz; i++) assert.equal(s.frameAt(seqMeta, i / hz), seqMeta.sequence[Math.min(7, Math.floor(i / hz * 12))]);
  assert.equal(s.frameAt({ ...seqMeta, loop: true }, 9 / 12), 4, 'looping sequence wraps');
  {
    install(SEQ); const { game, ui } = flight(); while (!step(game, ui, 1 / 60));
    const seen = []; const start = game.phaseTime;
    for (let i = 0; i < 50; i++) { const out = frame(game, ui); if (game.phaseTime - start < 8 / 12) { assert.equal(out.name, 'GROUND_BOUNCE'); seen.push(out.frame); } else assert.equal(out.name, 'FLIGHT_LOOP'); if (step(game, ui, 1 / 60)) break; }
    assert.equal(seen[0], 4, 'first frame on detection is the deepest squash');
    assert.deepEqual([...new Set(seen)], [4, 5, 6, 7], 'squash -> rebound -> upright, landing frames 0-3 skipped');
  }
  // (b) no vy tilt while GROUND_BOUNCE plays; eases back over tiltEase; unchanged otherwise.
  {
    const rotations = [];
    const rec = new Proxy({}, { get: (o, k) => k === 'rotate' ? (a => rotations.push(a)) : (o[k] || (() => {})), set: (o, k, v) => (o[k] = v, true) });
    install(SEQ); const { game, ui } = flight(); ui.ctx = rec;
    const tiltOf = () => { rotations.length = 0; ui.draw(); return rotations.length ? rotations[0] : 0; };
    const full = () => Math.max(-0.7, Math.min(0.7, -game.body.vy / 1200));
    assert.equal(tiltOf(), full(), 'normal FLIGHT_LOOP tilt unchanged');
    while (!step(game, ui, 1 / 60)); const start = game.phaseTime;
    assert(Math.abs(full()) > 0.05, 'test needs a visible tilt');
    while (game.phaseTime - start < 8 / 12) { assert.equal(tiltOf(), 0, 'upright during GROUND_BOUNCE'); assert.equal(s.tiltWeight(ui.visual, game.phaseTime), 0); if (step(game, ui, 1 / 120)) break; }
    let last = 0, eased = false;
    for (let i = 0; i < 40; i++) { const w = s.tiltWeight(ui.visual, game.phaseTime); assert(w >= last - 1e-12 && w <= 1); if (w > 0 && w < 1) eased = true; assert(Math.abs(tiltOf() - full() * w) < 1e-12); last = w; step(game, ui, 1 / 120); }
    assert(eased && last === 1, 'eases back to the full tilt');
    assert.equal(s.tiltWeight({ oneShot: { animation: 'GROUND_BOUNCE', at: 0 } }, 0.2), 0);
    assert(Math.abs(s.tiltWeight({ oneShot: { animation: 'GROUND_BOUNCE', at: 0 } }, 8 / 12 + def.tiltEase / 2) - 0.5) < 1e-9);
    assert.equal(s.tiltWeight({ oneShot: { animation: 'AERIAL_UP', at: 0 } }, 0.2), 1, 'AERIAL keeps the tilt');
    install({ ready: false }); assert.equal(s.tiltWeight({ oneShot: { animation: 'GROUND_BOUNCE', at: 0 } }, 0.2), 1, 'no asset: tilt unchanged');
    install(SEQ); ui.visual.reducedMotion = true; assert.equal(tiltOf(), 0, 'reduced motion still never rotates');
  }
  // (c) restart gating: within minRestartInterval a new bounce is ignored; tiny hops never start it; AERIAL unchanged.
  {
    assert.equal(def.minRestartInterval, 0.3); assert.equal(def.minHopTime, 0.25);
    install(SEQ); const { game, ui } = flight(); while (!step(game, ui, 1 / 60));
    const first = ui.visual.oneShot.at;
    for (let i = 0; i < 6; i++) step(game, ui, 1 / 60);            // 0.1 s into the bounce
    Object.assign(game.body, { y: 4, vy: -600 }); let guard = 0; while (!step(game, ui, 1 / 120)) assert(++guard < 30);
    assert(!game.body.grounded && 2 * game.body.vy / c.gravity >= def.minHopTime);
    assert(game.phaseTime - first < def.minRestartInterval); assert.equal(ui.visual.oneShot.at, first, 'early re-bounce ignored');
    while (game.phaseTime - first < def.minRestartInterval) step(game, ui, 1 / 120);
    Object.assign(game.body, { y: 4, vy: -600 }); guard = 0; while (!step(game, ui, 1 / 120)) assert(++guard < 30);
    assert.equal(ui.visual.oneShot.animation, 'GROUND_BOUNCE'); assert.equal(ui.visual.oneShot.at, game.phaseTime, 'restart allowed after the interval');
    assert.equal(frame(game, ui).frame, 4);
    // AERIAL interrupts once the bounce has been shown for minShow (Phase B), well before minRestartInterval.
    const gbAt = ui.visual.oneShot.at; while (game.phaseTime - gbAt < s.minShow) step(game, ui, 1 / 120);
    assert(game.phaseTime - gbAt < def.minRestartInterval);
    Object.assign(game.body, { y: 60, vy: -100 }); game.downCharge = 1; assert(game.aerial('DOWN')); ui.update();
    assert.equal(ui.visual.oneShot.animation, 'AERIAL_DOWN');
    // A bounce during AERIAL (after minShow) restarts GROUND_BOUNCE (interval applies only to GROUND_BOUNCE itself).
    const adAt = ui.visual.oneShot.at; while (game.phaseTime - adAt < s.minShow) step(game, ui, 1 / 120);
    Object.assign(game.body, { y: 4, vy: -600 }); guard = 0; while (!step(game, ui, 1 / 120)) assert(++guard < 30);
    assert.equal(ui.visual.oneShot.animation, 'GROUND_BOUNCE');
    // Tiny hop: rebound airtime below minHopTime never starts it.
    for (let i = 0; i < 120; i++) step(game, ui, 1 / 120);
    const keep = ui.visual.oneShot;
    Object.assign(game.body, { y: 1, vy: -140 }); guard = 0; while (!step(game, ui, 1 / 120)) assert(++guard < 30);
    assert(!game.body.grounded, 'still an airborne bounce'); assert(2 * game.body.vy / c.gravity < def.minHopTime);
    assert.equal(ui.visual.oneShot, keep, 'tiny hop ignored');
    // Pure gate checks.
    assert.equal(s.groundBounceAllowed({ oneShot: null }, 1, 500), true);
    assert.equal(s.groundBounceAllowed({ oneShot: null }, 1, 50), false);
    assert.equal(s.groundBounceAllowed({ oneShot: { animation: 'GROUND_BOUNCE', at: 0.9 } }, 1, 500), false);
    assert.equal(s.groundBounceAllowed({ oneShot: { animation: 'AERIAL_UP', at: 0.9 } }, 1, 500), true);
    install({ ready: false }); assert.equal(s.groundBounceAllowed({ oneShot: null }, 1, 500), false);
  }
  graphics.character = originalCharacter; s.draw = originalDraw; Object.assign(s, saved);
  console.log('Ground bounce tuning PASS: (a) JSON sequence 4,4,5,5,6,6,7,7 at 30/60/120/144Hz, validation, squash->rebound order; (b) no tilt during GROUND_BOUNCE, eased return, AERIAL/no-asset/reduced-motion unchanged; (c) 0.3 s restart interval, 0.25 s tiny-hop gate, AERIAL interrupts unchanged.');
  console.log('Ground bounce PASS: planned paths/flag, 12fps one-shot at ' + rates.join('/') + 'Hz, end -> FLIGHT_LOOP, settle excluded, Type D excluded, AERIAL<->BOUNCE interrupts, absent asset = no change, fallback chain, reduced motion, FLYING only/RESULT/RETRY, draw purity, physics unchanged.');
}
