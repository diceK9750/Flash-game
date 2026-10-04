// Phase C: CAST (roadside characters + merchant overlay) still sprites. Display-only checks with
// test-only mock assets; no art is created. Shipping state: every slot enabled:false (no asset).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const IDS = ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER', 'SPECIAL_ONLY'];
const still = (id, animation, extra) => ({ id, animation, frameWidth: 96, frameHeight: 96, frames: 1, fps: 1, loop: false, pivot: { x: 48, y: 88 }, ...extra });
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok', width = 96; const requested = [];
    class Image {
      constructor() { this.complete = true; this.naturalHeight = 96; }
      set src(value) { requested.push(value); this.naturalWidth = width; if (mode === 'image-error') this.onerror(new Error('missing')); else this.onload(); }
    }
    let meta = null;
    const scope = { Hop: {}, Image, fetch: async url => { requested.push(url); if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => { if (mode === 'json') throw new SyntaxError('bad'); return meta(url); } }; } };
    // Hero URLs answer valid 8-frame hero metadata so the startup loads behave as in the game.
    meta = url => url.includes('/cast/') ? still('BOOST', 'IDLE') : { id: 'HERO', animation: url.includes('aerial_up') ? 'AERIAL_UP' : url.includes('aerial_down') ? 'AERIAL_DOWN' : url.includes('hit') ? 'HIT' : url.includes('ground_bounce') ? 'GROUND_BOUNCE' : url.includes('stop_result') ? 'STOP_RESULT' : url.includes('special') ? 'SPECIAL_REACTION' : 'FLIGHT_LOOP',
      frameWidth: 96, frameHeight: 96, frames: 8, fps: url.includes('flight_loop') ? 8 : 12, loop: url.includes('flight_loop'), pivot: { x: 48, y: 88 } };
    width = 768;
    vm.createContext(scope); vm.runInContext(code, scope);
    const s = scope.Hop.Sprites, C = s.definitions.CAST;
    await s.castReady;
    for (const id of IDS) for (const [name, def] of Object.entries(C[id])) {
      assert.equal(s.castAssets[id][name].ready, false, id + name);
      if (def.enabled === false) assert(!requested.includes(def.metadata) && !requested.includes(def.src), 'disabled = never requested (no 404)');
    }
    const def = { ...C.BOOST.IDLE, enabled: true };
    width = 96; mode = 'ok';
    assert.equal((await s.load(def)).ready, true, '1-frame still accepted for CAST');
    const n = requested.length; assert.equal((await s.load({ ...def, enabled: false })).ready, false); assert.equal(requested.length, n);
    for (mode of ['image-error', 'network', '404', 'json']) assert.equal((await s.load(def)).ready, false, mode);
    mode = 'ok';
    const bad = [['wrong id', still('BOUNCE', 'IDLE')], ['wrong animation', still('BOOST', 'KICK')], ['8 frames', still('BOOST', 'IDLE', { frames: 8 })],
      ['fps', still('BOOST', 'IDLE', { fps: 12 })], ['loop', still('BOOST', 'IDLE', { loop: true })], ['pivot', still('BOOST', 'IDLE', { pivot: { x: 48, y: 80 } })],
      ['size', still('BOOST', 'IDLE', { frameWidth: 64 })]];
    for (const [label, m] of bad) { meta = () => m; assert.equal((await s.load(def)).ready, false, label); }
    meta = () => still('BOOST', 'IDLE'); width = 768; assert.equal((await s.load(def)).ready, false, 'sheet width must be 96 x 1');
    width = 96; assert.equal((await s.load(def)).ready, true, 'recovery');
    // HERO keeps its 8-frame requirement: a 1-frame HERO sheet is rejected.
    meta = () => ({ ...still('HERO', 'FLIGHT_LOOP'), fps: 8, loop: true }); width = 96;
    assert.equal((await s.load(s.definitions.HERO.FLIGHT_LOOP)).ready, false, 'HERO still needs 8 frames');
    meta = () => ({ ...still('HERO', 'FLIGHT_LOOP'), frames: 8, fps: 8, loop: true }); width = 768;
    assert.equal((await s.load(s.definitions.HERO.FLIGHT_LOOP)).ready, true);
    console.log('Cast loader PASS: disabled = no request, 1-frame CAST stills, id/animation/frames/fps/loop/pivot/size/network/404/JSON errors, recovery, HERO stays 8 frames.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, element, launch } = require('./phase2.cjs');
  const H = scope.Hop, s = H.Sprites, C = s.definitions.CAST, c = H.CONFIG;
  // Manifest: relative paths under the Pages subpath, 1-frame stills, flag == files present.
  assert.deepEqual(Object.keys(C), IDS);
  for (const id of IDS) {
    assert(H.CAST[id], id + ' is a CAST id');
    assert.deepEqual(Object.keys(C[id]), id === 'BOUNCE' ? ['IDLE', 'KICK'] : ['IDLE']);
    for (const [name, def] of Object.entries(C[id])) {
      assert.deepEqual([def.id, def.animation, def.frames, def.fps, def.loop, def.flip], [id, name, 1, 1, false, (id === 'BOUNCE' && name === 'KICK') || id === 'ANGLE' || id === 'DASH']); // mirrored: the kick (kicks right like the Canvas pose), the jester (ball on the viewer's right) and the warrior (sword right, shield left), like the Canvas figures
      assert.equal(def.scale, id === 'SPECIAL_ONLY' ? 1.25 * 1.25 / 1.365 : 1.25);
      for (const ref of [def.src, def.metadata]) {
        assert(!/^(?:\/|[a-z]+:)/i.test(ref) && ref.startsWith('assets/sprites/cast/'));
        assert(new URL(ref, 'https://example.test/Flash-game/').pathname.startsWith('/Flash-game/assets/sprites/cast/'));
      }
      const present = fs.existsSync(path.join(root, def.src)) && fs.existsSync(path.join(root, def.metadata));
      assert.equal(def.enabled !== false, present, `${id}.${name}: ` + (present ? 'bundle found: set enabled: true' : 'enabled but bundle missing'));
      if (present) {
        const m = JSON.parse(fs.readFileSync(path.join(root, def.metadata)));
        assert.deepEqual({ id: m.id, animation: m.animation, w: m.frameWidth, h: m.frameHeight, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot },
          { id, animation: name, w: 96, h: 96, frames: 1, fps: 1, loop: false, pivot: { x: 48, y: 88 } });
        const png = fs.readFileSync(path.join(root, def.src));
        assert.equal(png.readUInt32BE(16), 96); assert.equal(png.readUInt32BE(20), 96); assert.equal(png[25], 6, 'RGBA PNG');
      }
    }
  }
  // Rendering: recording context. drawImage records the sprite, character() records Canvas figures.
  const fake = (id, animation) => ({ ready: true, image: { complete: true, naturalWidth: 96, id, animation }, data: still(id, animation) });
  const graphics = H.Graphics, origChar = graphics.character;
  let log = [];
  graphics.character = function (ctx, id, x, feet, scale, pose) { log.push({ kind: 'canvas', id, x, feet, scale, pose, alpha: ctx.globalAlpha }); return origChar.apply(this, arguments); };
  const ctx = () => {
    const stack = []; let state = { globalAlpha: 1, tx: 0, sx: 1 };
    const o = { save() { stack.push({ ...state }); }, restore() { state = stack.pop() || state; },
      translate(x) { state.tx += x * state.sx; }, scale(x) { state.sx *= x; }, rotate() {},
      drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { if (img.id) log.push({ kind: 'sprite', id: img.id, animation: img.animation, dx: state.tx + dx * state.sx, dy, dw: dw * state.sx, dh, alpha: state.globalAlpha, smoothing: o.imageSmoothingEnabled }); },
      measureText: () => ({ width: 0 }), fillText(t) { log.push({ kind: 'text', t }); } };
    const dummy = new Proxy(function () {}, { get: () => dummy, apply: () => dummy });
    return new Proxy(o, { get: (t, k) => k === 'globalAlpha' ? state.globalAlpha : k in t ? t[k] : () => dummy, set: (t, k, v) => { if (k === 'globalAlpha') state.globalAlpha = v; else t[k] = v; return true; } });
  };
  const install = assets => { for (const id of IDS) s.castAssets[id] = { IDLE: { ready: false }, ...(id === 'BOUNCE' ? { KICK: { ready: false } } : {}), ...(assets?.[id] || {}) }; };
  const scene = () => {
    const game = launch(3), ui = new H.UI(game, element('canvas'));
    game.objects = IDS.slice(0, 7).map((type, i) => ({ x: game.body.x + 150 + i * 120, type, used: i % 2 === 1 }));
    game.nextObjectX = 1e12; game.nextBoundaryX = 1e12;
    return { game, ui };
  };
  const render = (game, ui) => { log = []; const before = JSON.stringify(game); graphics.draw(ctx(), game, ui.visual); assert.equal(JSON.stringify(game), before, 'drawing never mutates game state'); return log; };
  const ground = c.groundY, sxOf = (game, o) => c.launchX + o.x - game.cameraX;
  // 1) All disabled (shipping): exactly today's Canvas calls (same id, position, scale, pose, alpha).
  install();
  {
    const { game, ui } = scene(); const out = render(game, ui).filter(e => e.kind === 'canvas' && e.id !== 'HERO');
    assert.deepEqual(out.map(e => [e.id, e.x, e.feet, e.scale, e.pose, e.alpha]), game.objects.map(o => [o.type, sxOf(game, o), ground, 1.365, o.used ? 1 : 0, o.used ? 0.35 : 1]));
    assert.equal(log.filter(e => e.kind === 'sprite').length, 0);
  }
  // 2) All loaded: sprites replace the Canvas figures at the same feet point; labels and alpha kept.
  const all = Object.fromEntries(IDS.map(id => [id, { IDLE: fake(id, 'IDLE'), ...(id === 'BOUNCE' ? { KICK: fake(id, 'KICK') } : {}) }]));
  install(all);
  {
    const { game, ui } = scene(); const out = render(game, ui);
    assert.equal(out.filter(e => e.kind === 'canvas' && e.id !== 'HERO').length, 0, 'no Canvas figure when the still is loaded');
    const sprites = out.filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), game.objects.map(o => o.type));
    for (const [i, o] of game.objects.entries()) {
      const e = sprites[i];
      // BOUNCE KICK and the ANGLE and DASH IDLE stills are mirrored (flip:true; the redesigned BRAKE already has the hook on the viewer's right): the 96px cell is centred on the pivot x, so the feet point stays at ox.
      const flip = (o.type === 'BOUNCE' && o.used) || o.type === 'ANGLE' || o.type === 'DASH';
      assert.equal(!!C[o.type][o.type === 'BOUNCE' && o.used ? 'KICK' : 'IDLE'].flip, flip, 'manifest flip as expected');
      assert.equal(e.dx, sxOf(game, o) + (flip ? 48 : -48) * 1.25); assert.equal(e.dy, ground - 88 * 1.25); assert.equal(e.dw, (flip ? -96 : 96) * 1.25);
      assert.equal(e.dx + e.dw / 2, sxOf(game, o), 'feet x unchanged (mirrored or not)');
      assert.equal(e.alpha, o.used ? 0.35 : 1, 'used opacity kept'); assert.equal(e.smoothing, false);
      assert.equal(e.animation, o.type === 'BOUNCE' && o.used ? 'KICK' : 'IDLE', 'fighter kicks after contact');
      assert(out.some(t => t.kind === 'text' && t.t === H.CAST[o.type].name), 'name label kept');
    }
  }
  // 3) Fighter: KICK missing -> IDLE after contact; IDLE missing -> Canvas (with its kick pose).
  install({ BOUNCE: { IDLE: fake('BOUNCE', 'IDLE') } });
  assert.equal(s.castLayer('BOUNCE', 1).name, 'IDLE'); assert.equal(s.castLayer('BOUNCE', 0).name, 'IDLE');
  install({ BOUNCE: { KICK: fake('BOUNCE', 'KICK') } });
  assert.equal(s.castLayer('BOUNCE', 1).name, 'KICK'); assert.equal(s.castLayer('BOUNCE', 0), null, 'unused fighter without IDLE -> Canvas');
  // 4) Mixed / failure: one loaded, others Canvas; a throwing drawImage falls back to Canvas.
  install({ BOOST: { IDLE: fake('BOOST', 'IDLE') } });
  {
    const { game, ui } = scene(); const out = render(game, ui);
    assert.deepEqual(out.filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST']);
    assert.deepEqual(out.filter(e => e.kind === 'canvas' && e.id !== 'HERO').map(e => e.id), IDS.slice(1, 7));
    let threw = 0;
    const failCtx = new Proxy({}, { get: (o, k) => k === 'drawImage' ? () => { threw++; throw new Error('decode lost'); } : () => {}, set: () => true });
    assert.equal(s.drawCast(failCtx, 'BOOST', 100, 500, 0), false); assert.equal(threw, 1);
    s.castAssets.BOOST.IDLE.image = { complete: false, naturalWidth: 96 }; assert.equal(s.drawCast(failCtx, 'BOOST', 100, 500, 0), false, 'not decoded yet');
    assert.equal(s.drawCast(failCtx, 'NOPE', 100, 500, 0), false);
  }
  // 5) flip mirrors around the feet x.
  install(all); assert.equal(C.BRAKE.IDLE.flip, false, 'redesigned thief: hook already on the viewer\'s right, not mirrored');
  assert.equal(C.ANGLE.IDLE.flip, true, 'jester still is mirrored (ball on the viewer\'s right like the Canvas jester)');
  { log = []; s.drawCast(ctx(), 'ANGLE', 300, 500, 0); const e = log[0]; assert.equal(e.dx, 300 + 48 * 1.25); assert.equal(e.dw, -96 * 1.25); }
  C.ANGLE.IDLE.flip = false;
  { log = []; s.drawCast(ctx(), 'ANGLE', 300, 500, 0); const e = log[0]; assert.equal(e.dx, 300 - 48 * 1.25); assert.equal(e.dw, 96 * 1.25); }
  C.ANGLE.IDLE.flip = true;
  // 6) Merchant overlay: SPECIAL_ONLY still at the overlay point and its smaller scale; Canvas when missing.
  for (const loaded of [true, false]) {
    install(loaded ? all : undefined);
    const { game, ui } = scene(); game.objects = []; game.merchantVisual = { type: 'A', remaining: 1 };
    const out = render(game, ui);
    const hx = c.launchX + game.body.x - game.cameraX, hy = ground - c.playerRadius - game.body.y;
    const mx = Math.max(90, Math.min(c.width - 100, hx + 105));
    if (loaded) { const e = out.find(x => x.kind === 'sprite' && x.id === 'SPECIAL_ONLY'); assert(e); assert(Math.abs(e.dx - (mx - 48 * C.SPECIAL_ONLY.IDLE.scale)) < 1e-9); assert(Math.abs(e.dy - (hy + 20 - 88 * C.SPECIAL_ONLY.IDLE.scale)) < 1e-9); assert(!out.some(x => x.kind === 'canvas' && x.id === 'SPECIAL_ONLY')); }
    else assert.deepEqual(out.filter(x => x.kind === 'canvas' && x.id === 'SPECIAL_ONLY').map(x => [x.x, x.feet, x.scale]), [[mx, hy + 20, 1.25]]);
  }
  // 7) Reduced motion does not change CAST drawing (stills); physics identical with and without sprites.
  install(all);
  {
    const a = scene(), b = scene(); b.ui.visual.reducedMotion = true;
    const strip = l => l.filter(e => e.kind === 'sprite' && e.id !== 'HERO').map(e => [e.id, e.dx, e.dy, e.alpha, e.animation]);
    assert.deepEqual(strip(render(b.game, b.ui)), strip(render(a.game, a.ui)));
    const run = assets => { install(assets); const { game, ui } = scene(); for (let i = 0; i < 400; i++) { game.update(1 / 60); ui.update(); render(game, ui); } return JSON.stringify({ body: game.body, objects: game.objects, state: game.state, history: game.history }); };
    assert.equal(run(all), run(undefined), 'physics / contacts unchanged by CAST sprites');
  }
  install(); graphics.character = origChar;
  console.log('Cast sprites PASS: manifest (8 ids, BOUNCE KICK), flag == files, disabled = identical Canvas calls, sprite at the same feet point / 1.25, labels + 35% used opacity, fighter KICK -> IDLE fallback, merchant overlay, flip, draw failure -> Canvas, reduced motion, physics unchanged.');
}
