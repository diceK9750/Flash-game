// Combo SPECIAL scenes (witch BOOST x fighter, fighter BOUNCE x witch). Display-only: the launch vector is
// applied at success as before and the game step is frozen while the scene plays, so results are unchanged.
const assert = require('node:assert/strict');
const { scope, element, launch, random } = require('./phase2.cjs');
const H = scope.Hop, c = H.CONFIG, G = H.Graphics, S = H.Sprites, A = H.Audio;
let cases = 0;
const near = (a, b, label, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);
const step = (g, seconds) => { for (let i = 0, n = Math.round(seconds / c.physicsStep); i < n; i++) g.update(c.physicsStep); };

// 0) Config (scene lengths incl. the cut-in part; short version for reducedMotion).
assert.equal(c.comboEnabled, true);
assert.deepEqual([c.comboWitchDuration, c.comboFighterDuration, c.comboReducedDuration, c.comboAfterglow], [3.1, 2.65, 0.8, 0.6]);
assert(c.comboWitchDuration >= 3.0 && c.comboWitchDuration <= 3.5 && c.comboFighterDuration >= 2.5 && c.comboFighterDuration <= 3.0);
assert(c.comboFighterScale >= 2.5 && c.comboFighterScale <= 3.0 && c.comboFighterSteps === 3);
assert(Object.isFrozen(c.comboWitchTimes) && Object.isFrozen(c.comboFighterTimes));
cases++;

// Hero touches `type` with the adjacent partner further right, then accepts (real contact + act()).
function scene(type, partnerType, { short = false, seed = 1 } = {}) {
  const g = launch(seed); g.comboShort = short;
  Object.assign(g.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
  const source = { x: 1230, type, used: false }, partner = { x: 1700, type: partnerType, used: false };
  g.objects = [source, partner]; g.nextObjectX = g.nextBoundaryX = Infinity;
  g.contactObjects({ x: 1100, y: 30 });
  assert(g.special && g.special.type === type && g.special.partner === partner, type + ' SPECIAL armed with the adjacent partner');
  g.act();
  return { g, source, partner };
}

// 1) Both SPECIALs start their scene with the right partner; launch vector applied at once (unchanged).
for (const [type, partnerType, total, speed, angle] of [['BOOST', 'BOUNCE', 3.1, c.specials.BOOST.speed, c.specials.BOOST.angle], ['BOUNCE', 'BOOST', 2.65]]) {
  const { g, source, partner } = scene(type, partnerType);
  assert(g.combo, type + ' combo started');
  assert.equal(g.combo.type, type); assert.equal(g.combo.source, source); assert.equal(g.combo.partner, partner);
  assert.equal(g.combo.partner.type, type === 'BOOST' ? 'BOUNCE' : 'BOOST', 'witch scene uses the fighter, fighter scene the witch');
  assert.equal(partner.used, true); near(g.combo.total, total, 'total');
  assert.equal(g.specialMessage.label, 'SPECIAL SUCCESS'); assert.equal(g.specialSuccesses, 1);
  if (speed) { near(Math.hypot(g.body.vx, g.body.vy), speed, 'speed', 1e-6); near(Math.atan2(g.body.vy, g.body.vx) * 180 / Math.PI, angle, 'angle', 1e-6); }
  // Same vector as with the scene disabled.
  const ref = launch(1); ref.comboEnabled = false;
  Object.assign(ref.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
  ref.objects = [{ x: 1230, type, used: false }, { x: 1700, type: partnerType, used: false }]; ref.nextObjectX = ref.nextBoundaryX = Infinity;
  ref.contactObjects({ x: 1100, y: 30 }); ref.act();
  assert.equal(ref.combo, null); assert.deepEqual([ref.body.vx, ref.body.vy], [g.body.vx, g.body.vy]);
  cases++;
}

// 2) Frozen while the scene plays: physics, play timers, generation and RNG; taps never AERIAL (they skip).
{
  const { g } = scene('BOOST', 'BOUNCE');
  let draws = 0; const rnd = g.random; g.random = () => { draws++; return rnd(); };
  const snap = () => JSON.stringify({ body: g.body, objects: g.objects, next: [g.nextObjectX, g.nextBoundaryX], msg: g.specialMessage, guard: g.guardSpecial, charge: g.downCharge, up: g.upRemaining, effect: g.effect, mode: g.aerialMode, history: g.history.length, maxH: g.maxHeight });
  const before = snap();
  step(g, 1.5);
  assert.equal(snap(), before, 'nothing moves during the scene'); assert.equal(draws, 0, 'no RNG draws');
  near(g.combo.elapsed, 1.5, 'scene clock', 1e-6);
  assert.equal(g.aerial('UP'), false); assert.equal(g.aerial('DOWN'), false); assert.equal(snap(), before, 'AERIAL blocked');
  g.act(); // tap = skip
  assert.equal(g.combo, null); assert.equal(g.comboAfter.skipped, true); assert.equal(snap(), before, 'skip: no AERIAL, same state');
  step(g, 0.2); assert(g.body.x > JSON.parse(before).body.x, 'flight resumes after the skip');
  cases++;
}

// 3) Natural end after total; afterglow is display-only.
{
  const { g } = scene('BOUNCE', 'BOOST'); const x0 = g.body.x;
  step(g, 2.6); assert(g.combo); assert.equal(g.body.x, x0);
  step(g, 0.06); assert.equal(g.combo, null); assert.equal(g.comboAfter.skipped, false);
  step(g, 0.1); assert(g.body.x > x0);
  step(g, 1); assert.equal(g.comboAfter, null, 'afterglow ends');
  g.reset(); assert.equal(g.combo, null); assert.equal(g.comboAfter, null);
  cases++;
}

// 4) reducedMotion: short version (0.8 s), no shake / flash.
{
  for (const [type, p] of [['BOOST', 'BOUNCE'], ['BOUNCE', 'BOOST']]) {
    const { g } = scene(type, p, { short: true });
    assert.equal(g.combo.short, true); near(g.combo.total, 0.8, 'short total');
    for (const t of [0.1, 0.4, 0.7]) {
      g.combo.elapsed = t; const st = G.comboState(g);
      const im = G.comboImpact(st, false); assert.deepEqual([im.x, im.y, im.flash], [0, 0, 0], 'short: no shake/flash');
    }
    step(g, 0.81); assert.equal(g.combo, null);
  }
  // Full version with the reducedMotion flag on also never shakes or flashes.
  const { g } = scene('BOOST', 'BOUNCE'); let maxShake = 0, maxFlash = 0;
  for (let t = 0; t < 3.1; t += 0.01) {
    g.combo.elapsed = t; const st = G.comboState(g);
    assert.deepEqual(Object.values(G.comboImpact(st, true)), [0, 0, 0]);
    const im = G.comboImpact(st, false); maxShake = Math.max(maxShake, Math.abs(im.x), Math.abs(im.y)); maxFlash = Math.max(maxFlash, im.flash);
  }
  assert(maxShake > 2 && maxShake <= c.comboShakePx + 1e-9 && maxFlash > 0.3 && maxFlash <= 1, 'normal: shake and flash at the blast');
  cases++;
}

// 5) Fixed-seed results identical with the scene off / on / skipped / short (auto-accept every SPECIAL).
function play(seed, mode) {
  const g = launch(seed, 30 + (seed % 5) * 6, 0.82 + (seed % 3) * 0.08);
  if (mode === 'off') g.comboEnabled = false;
  if (mode === 'short') g.comboShort = true;
  let combos = 0, seen = null;
  for (let i = 0; i < 120 * 400 && g.state === 'FLYING'; i++) {
    if (g.special) g.act();
    if (g.combo && g.combo !== seen) { seen = g.combo; combos++; }
    if (mode === 'skip' && g.combo && g.combo.elapsed > 0.35) g.act();
    g.update(c.physicsStep);
  }
  assert.equal(g.state, 'RESULT');
  return { d: g.finalDistance, combos, labels: g.history.map(h => h.label).join(',') };
}
{
  let totalCombos = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const off = play(seed, 'off'), on = play(seed, 'on'), skip = play(seed, 'skip'), short = play(seed, 'short');
    assert.equal(off.combos, 0);
    for (const r of [on, skip, short]) { assert.equal(r.d, off.d, 'seed ' + seed + ' distance'); assert.equal(r.labels, off.labels, 'seed ' + seed + ' contacts'); }
    assert.equal(on.combos, skip.combos); totalCombos += on.combos;
  }
  assert(totalCombos > 0, 'seeded plays include combo scenes');
  cases++;
}

// 6) Merchant success: no combo (as before). Other SPECIALs: no combo.
{
  const g = launch(); g.objects = []; g.nextObjectX = g.nextBoundaryX = Infinity;
  const partner = { x: g.body.x + 300, type: 'BOUNCE', used: false };
  g.special = { type: 'BOOST', merchantType: 'A', partner, remaining: c.specialWindow, entry: { type: 'BOOST', label: 'BOOST' }, guardAtContact: 0, velocity: { vx: g.body.vx, vy: g.body.vy } };
  g.resolveSpecial(true); assert.equal(g.combo, null, 'merchant: no combo');
  for (const type of ['DASH', 'ANGLE', 'BRAKE']) {
    const o = launch(); o.objects = []; o.nextObjectX = o.nextBoundaryX = Infinity;
    o.special = { type, merchantType: null, partner: null, remaining: c.specialWindow, entry: { type, label: type }, guardAtContact: 0, velocity: { vx: o.body.vx, vy: o.body.vy } };
    o.resolveSpecial(true); assert.equal(o.combo, null, type + ': no combo');
  }
  // BOOST / BOUNCE without a partner (e.g. armed in tests) keep the plain success.
  const n = launch(); n.special = { type: 'BOUNCE', merchantType: null, partner: null, remaining: 1, entry: { type: 'BOUNCE', label: 'BOUNCE' }, guardAtContact: 0, velocity: { vx: 1, vy: 1 } };
  n.resolveSpecial(true); assert.equal(n.combo, null);
  // MISS: no combo.
  const m = launch(); m.special = { type: 'BOOST', merchantType: null, partner: { x: 1, type: 'BOUNCE' }, remaining: 1, entry: { type: 'BOOST', label: 'BOOST' }, guardAtContact: 0, velocity: { vx: 1, vy: 1 } };
  m.resolveSpecial(false); assert.equal(m.combo, null);
  cases++;
}

// 7) Giant fighter: 3 steps up to comboFighterScale, uniform scale, feet fixed to the ground.
{
  const T = c.comboFighterTimes, max = c.comboFighterScale;
  assert.equal(G.comboFighterScale(0), 1); assert.equal(G.comboFighterScale(T.buffEnd - 0.01), 1);
  near(G.comboFighterScale(T.growEnd), max, 'max'); near(G.comboFighterScale(T.upper), max, 'held');
  const span = (T.growEnd - T.buffEnd) / 3;
  for (let k = 1; k <= 3; k++) near(G.comboFighterScale(T.buffEnd + k * span - 1e-6), 1 + (max - 1) * k / 3, 'step ' + k, 0.01);
  for (let k = 0; k < 3; k++) near(G.comboFighterScale(T.buffEnd + k * span + span * 0.75), 1 + (max - 1) * (k + 1) / 3, 'plateau ' + k, 0.01);
  // Uniform scale + feet anchor through the real Sprites.draw (mock asset, affine-tracking ctx).
  const data = { frameWidth: 288, frameHeight: 288, unit: 3, frames: 1, fps: 1, loop: false, pivot: { x: 144, y: 264 }, smooth: true };
  const savedLayer = S.castLayer; S.castLayer = () => ({ asset: { ready: true, data, image: { complete: true, naturalWidth: 288 } }, scale: 1.365, flip: false });
  const tracking = () => {
    let m = [1, 0, 0, 1, 0, 0]; const stack = [], out = [];
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const ap = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    return { out, globalAlpha: 1, save() { stack.push(m.slice()); }, restore() { m = stack.pop(); },
      translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); }, scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
      rotate(a) { m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
      drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { const p0 = ap(dx, dy), p1 = ap(dx + dw, dy + dh), feet = ap(dx + data.pivot.x * dw / sw, dy + data.pivot.y * dh / sh); out.push({ w: Math.abs(p1[0] - p0[0]), h: Math.abs(p1[1] - p0[1]), feet, sw, sh }); } };
  };
  let base = null;
  for (const m of [1, 1.6, 2.2, 2.8]) for (const flip of [false, true]) {
    const ctx = tracking(); const box = S.drawCastScaled(ctx, 'BOUNCE', 400, 600, 0, m, { flip });
    const d = ctx.out[0]; assert(box && d, 'drawn');
    near(d.w / d.h, d.sw / d.sh, 'uniform ratio'); near(d.feet[0], 400, 'feet x'); near(d.feet[1], 600, 'feet y (ground)');
    base ||= d.w; near(d.w, base * m, 'size x' + m, 1e-6);
    near(box.top + box.h * data.pivot.y / data.frameHeight, 600, 'box feet');
  }
  S.castLayer = savedLayer;
  // Scene placements: fighter / witch always drawn with feet on the ground, fighter scale from the steps.
  const { g } = scene('BOUNCE', 'BOOST'); const calls = [];
  const savedDraw = S.drawCastScaled; S.drawCastScaled = (ctx, id, x, feet, pose, mul, opts) => { calls.push({ id, feet, mul, rotate: opts.rotate || 0 }); return { w: 1, h: 1, left: 0, top: 0, scale: 1 }; };
  const nullCtx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const sx = x => x, sy = y => 600 - 18 - y;
  for (let t = 0; t < 2.65; t += 0.05) {
    g.combo.elapsed = G.comboSceneStart(false) + t; calls.length = 0; G.comboBack(nullCtx, G.comboState(g), sx, sy, 600);
    for (const call of calls) assert.equal(call.feet, 600, 'feet on ground');
    const f = calls.filter(k => k.id === 'BOUNCE').pop(); near(f.mul, G.comboActors(G.comboState(g)).fighter.scale, 'fighter scale');
  }
  S.drawCastScaled = savedDraw;
  cases++;
}

// 8) Drawing is display-only and works for every scene time (full, short, afterglow, reducedMotion).
{
  const ctx2 = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  for (const [type, p, total] of [['BOOST', 'BOUNCE', 3.1], ['BOUNCE', 'BOOST', 2.65]]) for (const short of [false, true]) {
    const { g } = scene(type, p, { short });
    const visual = { reducedMotion: short, launchAt: -Infinity, contactAt: -Infinity, readyTargets: [] };
    const snap = () => JSON.stringify({ body: g.body, combo: g.combo, msg: g.specialMessage, cut: g.specialCutin });
    for (let t = 0; t < (short ? 0.8 : total); t += 0.04) { g.combo.elapsed = t; const s0 = snap(); G.draw(ctx2, g, visual); assert.equal(snap(), s0); }
    step(g, 3.2);
    G.draw(ctx2, g, visual);
  }
  cases++;
}

// 9) UI: SE track start / stop on skip, reducedMotion -> short, SUCCESS panel after the scene.
{
  const calls = []; const saved = { play: A.playCombo, stop: A.stopCombo };
  A.playCombo = (kind, offset) => calls.push(['play', kind, offset]); A.stopCombo = () => calls.push(['stop']);
  const panel = element('special-panel');
  for (const [type, p, kind] of [['BOOST', 'BOUNCE', 'COMBO_WITCH'], ['BOUNCE', 'BOOST', 'COMBO_FIGHTER']]) {
    calls.length = 0;
    const g = launch(); const ui = new H.UI(g, element('canvas'));
    ui.visual.reducedMotion = false; ui.update();
    Object.assign(g.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
    g.objects = [{ x: 1230, type, used: false }, { x: 1700, type: p, used: false }]; g.nextObjectX = g.nextBoundaryX = Infinity;
    g.contactObjects({ x: 1100, y: 30 }); ui.update(); g.act(); ui.update();
    assert.deepEqual(calls[0], ['play', kind, 0]);
    assert(element('announcements').textContent.includes('SPECIAL SUCCESS · ' + c.specials[type].name), 'aria-live announces at once');
    for (let i = 0; i < 60; i++) { g.update(1 / 60); ui.update(); assert.equal(panel.hidden, true, 'panel waits for the scene'); }
    g.act(); ui.update(); // skip
    assert.deepEqual(calls.at(-1), ['stop'], 'skip stops the scene SE');
    g.update(1 / 60); ui.update(); assert.equal(panel.hidden, false, 'SUCCESS panel right after the scene');
    // Natural end: SE keeps its tail (no stop).
    calls.length = 0; g.reset(); ui.update(); g.act(); g.act(); g.act();
    Object.assign(g.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
    g.objects = [{ x: 1230, type, used: false }, { x: 1700, type: p, used: false }]; g.nextObjectX = g.nextBoundaryX = Infinity;
    ui.visual.reducedMotion = true; ui.update();
    g.contactObjects({ x: 1100, y: 30 }); g.act(); assert.equal(g.combo.short, true, 'reducedMotion -> short'); ui.update();
    assert.deepEqual(calls.filter(k => k[0] === 'play').at(-1), ['play', kind + '_SHORT', 0]);
    for (let i = 0; i < 60 && g.combo; i++) { g.update(1 / 60); ui.update(); }
    assert.equal(g.combo, null); assert(!calls.slice(1).some(k => k[0] === 'stop'), 'natural end keeps the SE tail');
  }
  A.playCombo = saved.play; A.stopCombo = saved.stop;
  cases++;
}

// 10) Audio: recipes capped, muted / no context / not running never throw, stop on skip.
{
  const savedCtx = A.context, savedMuted = A.muted;
  for (const kind of ['COMBO_WITCH', 'COMBO_FIGHTER', 'COMBO_WITCH_SHORT', 'COMBO_FIGHTER_SHORT']) assert(A.comboRecipes[kind]?.length >= 3, kind);
  assert(A.comboRecipes.COMBO_WITCH.filter(v => v[0] === 'noise' && v[4] === 'bandpass' && v[5] === 1500).length >= 14, '14 rush hits');
  A.muted = true; A.context = { get state() { throw Error('muted must not touch audio'); } };
  assert.equal(A.playCombo('COMBO_WITCH'), null); A.stopCombo();
  A.muted = false; A.context = null; assert.equal(A.playCombo('COMBO_FIGHTER'), null);
  A.context = { state: 'suspended' }; assert.equal(A.playCombo('COMBO_FIGHTER'), null);
  A.context = { state: 'running', currentTime: 0, createGain() { throw Error('boom'); } }; assert.equal(A.playCombo('COMBO_WITCH'), null);
  // Mock graph: master gain x worst-case peak <= cap; stopCombo stops every source.
  const stopped = [], made = [];
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { assert(v > 0); } });
  let master = null;
  const node = kind => ({ kind, connect() {}, disconnect() {} });
  A.context = { state: 'running', currentTime: 5, sampleRate: 8000, destination: {},
    createGain() { const n = node('gain'); n.gain = { ...param(), setValueAtTime(v) { if (master === null) master = v; } }; return n; },
    createOscillator() { const n = node('osc'); n.frequency = param(); n.start = () => {}; n.stop = t => { if (t === undefined) stopped.push(n); }; made.push(n); return n; },
    createBiquadFilter() { const n = node('filter'); n.frequency = param(); n.Q = param(); return n; },
    createBufferSource() { const n = node('noise'); n.start = () => {}; n.stop = t => { if (t === undefined) stopped.push(n); }; made.push(n); return n; },
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { length: len, sampleRate: rate, getChannelData: () => d }; } };
  A.noise = null;
  for (const kind of ['COMBO_WITCH', 'COMBO_FIGHTER', 'COMBO_WITCH_SHORT', 'COMBO_FIGHTER_SHORT']) {
    master = null; made.length = 0; stopped.length = 0;
    assert(A.playCombo(kind, 0.1)); assert(made.length >= A.comboRecipes[kind].length);
    assert(master * A.peakSum(A.comboRecipes[kind]) <= A.specialPeakCap + 1e-9, kind + ' peak cap');
    A.stopCombo(); assert.equal(stopped.length, made.length, kind + ' all sources stopped');
  }
  A.context = savedCtx; A.muted = savedMuted;
  cases++;
}

// 11) Combo camera (display only): zoom in during the scene, actors framed, back to normal after; skip /
// short / reducedMotion -> normal camera at once.
{
  assert.equal(c.comboZoomMax, 2.4); assert(c.comboZoomIn >= 0.2 && c.comboZoomIn <= 0.4 && c.comboZoomOut >= 0.4 && c.comboZoomOut <= 0.6);
  const camOf = (g, reduced = false) => {
    const ground = c.groundY + g.cameraY, sx = x => c.launchX + x - g.cameraX, sy = y => ground - c.playerRadius - y;
    return { cam: G.comboCamera(G.comboState(g), reduced, sx, sy, ground, sx(g.body.x), sy(g.body.y)), sx, sy, ground };
  };
  const inView = (cam, x, y) => { const X = cam.ax + cam.z * (x - cam.fx), Y = cam.ay + cam.z * (y - cam.fy); return X >= -1 && X <= c.width + 1 && Y >= -1 && Y <= c.height + 1; };
  for (const [type, p] of [['BOOST', 'BOUNCE'], ['BOUNCE', 'BOOST']]) {
    const { g } = scene(type, p); g.cameraX = Math.max(0, c.launchX + g.body.x - c.cameraAnchorX);
    const S0 = G.comboSceneStart(false), end = g.combo.total;
    g.combo.elapsed = S0 - 0.1; assert.equal(camOf(g).cam.w, 0, 'normal camera while the cut-in covers');
    g.combo.elapsed = S0 + c.comboZoomIn * 0.4; const mid = camOf(g).cam; assert(mid.w > 0 && mid.w < 1 && mid.z > 1, 'zooming in');
    let minZ = 9, maxZ = 0;
    for (let e = S0 + c.comboZoomIn; e < end; e += 0.02) {
      g.combo.elapsed = e; const { cam, sx, sy, ground } = camOf(g);
      assert(Math.abs(cam.w - 1) < 1e-9 && cam.z > 1.3 && cam.z <= c.comboZoomMax + 1e-9, type + ' zoomed at ' + e.toFixed(2));
      // The whole normal-camera view rectangle stays inside the drawn canvas (no blank edges).
      const L = cam.fx + (0 - cam.ax) / cam.z, R = cam.fx + (c.width - cam.ax) / cam.z, T = cam.fy + (0 - cam.ay) / cam.z, B = cam.fy + (c.height - cam.ay) / cam.z;
      assert(L >= -1e-6 && R <= c.width + 1e-6 && T >= -1e-6 && B <= c.height + 1e-6, 'view inside canvas');
      // Actors (hero, witch, fighter feet / head) are inside the zoomed view.
      const st = G.comboState(g), A = G.comboActors(st);
      assert(inView(cam, sx(st.heroWX) + A.hero.dx, sy(st.heroY) + A.hero.dy), 'hero in view');
      assert(inView(cam, sx(A.witch.x), ground) && inView(cam, sx(A.witch.x), ground - 110), 'witch in view');
      if (type === 'BOUNCE') assert(inView(cam, sx(A.fighter.x), ground - 110 * A.fighter.scale), 'giant fighter head in view');
      minZ = Math.min(minZ, cam.z); maxZ = Math.max(maxZ, cam.z);
    }
    if (type === 'BOUNCE') {
      const T = c.comboFighterTimes; g.combo.elapsed = S0 + T.arrive + 0.1; const zBuff = camOf(g).cam.z; g.combo.elapsed = S0 + T.growEnd + 0.05; const zGiant = camOf(g).cam.z;
      assert(zGiant < zBuff - 0.3, `camera pulls back for the giant (${zBuff.toFixed(2)} -> ${zGiant.toFixed(2)})`);
    } else {
      const W = c.comboWitchTimes; g.combo.elapsed = S0 + (W.dash + W.rushEnd) / 2; assert(camOf(g).cam.z >= 2, 'rush close-up (>= 2x)');
      // Launch: the camera follows the hero up.
      g.combo.elapsed = S0 + W.rushEnd - 0.05; const fy0 = camOf(g).cam.fy; g.combo.elapsed = S0 + W.liftEnd; assert(camOf(g).cam.fy < fy0 - 20, 'follows the launched hero');
    }
    // Natural end: afterglow zooms back, normal camera after comboZoomOut.
    step(g, (end - g.combo.elapsed) + 0.01); assert.equal(g.combo, null);
    const a0 = camOf(g).cam; assert(a0.w > 0.8 && a0.z > 1, 'still zoomed right after the launch');
    step(g, c.comboZoomOut * 0.5); const a1 = camOf(g).cam; assert(a1.w > 0 && a1.w < a0.w, 'zooming back');
    step(g, c.comboZoomOut * 0.5 + 0.02); assert.equal(camOf(g).cam.w, 0, 'normal camera after the zoom-out'); assert.equal(camOf(g).cam.z, 1);
    // Skip: normal camera at once.
    const s = scene(type, p).g; s.combo.elapsed = S0 + 0.8; assert(camOf(s).cam.w === 1); s.act();
    assert.equal(s.combo, null); const sc = camOf(s).cam; assert.deepEqual([sc.w, sc.z], [0, 1], 'skip -> normal camera');
    // Short version / reducedMotion: no zoom.
    const r = scene(type, p, { short: true }).g; for (let e = 0; e < 0.8; e += 0.05) { r.combo.elapsed = e; assert.equal(camOf(r).cam.w, 0); }
    const q = scene(type, p).g; q.combo.elapsed = S0 + 1; assert.equal(camOf(q, true).cam.w, 0, 'reducedMotion: no zoom');
  }
  // Texts are screen-space overlay items with readable sizes (grow at most ~25% with the zoom).
  const { g } = scene('BOOST', 'BOUNCE'); g.combo.elapsed = G.comboSceneStart(false) + 1.0;
  const ground = c.groundY + g.cameraY, sx = x => c.launchX + x - g.cameraX, sy = y => ground - c.playerRadius - y;
  const nullCtx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const items = G.comboFront(nullCtx, G.comboState(g), sx, sy, ground);
  assert(items.some(i => i.kind === 'label' && /HIT/.test(i.text)) && items.some(i => i.kind === 'gauge') && items.some(i => i.kind === 'hint'));
  const fonts = []; const rec = new Proxy({}, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { if (k === 'font') fonts.push(v); o[k] = v; return true; } });
  G.comboOverlay(rec, items, { w: 1, z: 2.4, fx: 600, fy: 500, ax: 640, ay: 360 });
  const sizes = fonts.map(f => +/(\d+)px/.exec(f)[1]);
  assert(Math.max(...sizes) <= Math.round(40 * 1.26) && Math.min(...sizes) >= 20, 'readable text sizes ' + sizes);
  cases++;
}

// 12) Dedicated combo poses: the right slot in each beat, always facing the hero (mirrored about the feet).
{
  const S0 = G.comboSceneStart(false);
  const at = (g, t) => { g.combo.elapsed = S0 + t; const st = G.comboState(g); return { st, A: G.comboActors(st) }; };
  const towardHero = (a, st) => a.face === (a.x < st.heroWX ? 'right' : 'left');
  // Witch SPECIAL: witch CAST while chanting, USED when the spell flies; fighter PUNCH rush (KICK every third
  // blow) from both sides, UPPER finisher.
  { const { g } = scene('BOOST', 'BOUNCE'), W = c.comboWitchTimes, seen = new Set();
    assert.equal(at(g, 0.05).A.witch.pose, 'IDLE');
    for (let t = 0.2; t < W.liftEnd - 0.06; t += 0.05) { const { A, st } = at(g, t); assert.equal(A.witch.pose, 'CAST', 'chanting at ' + t.toFixed(2)); assert(towardHero(A.witch, st)); }
    for (let t = W.dash; t < W.rushEnd; t += 0.01) {
      const { A, st } = at(g, t); seen.add(A.fighter.pose + ':' + A.fighter.face);
      assert(['PUNCH', 'KICK'].includes(A.fighter.pose)); assert(towardHero(A.fighter, st), 'rush faces the hero');
      assert.equal(A.fighter.pose, (A.hits - 1) % 3 === 2 ? 'KICK' : 'PUNCH');
    }
    assert(seen.has('PUNCH:left') && seen.has('PUNCH:right') && (seen.has('KICK:left') || seen.has('KICK:right')), 'punches from both sides, kicks mixed in: ' + [...seen]);
    for (let t = W.rushEnd; t < W.liftEnd + 0.15; t += 0.02) { const { A, st } = at(g, t); assert.equal(A.fighter.pose, 'UPPER'); assert(towardHero(A.fighter, st)); }
    for (let t = W.liftEnd; t < g.combo.total - S0; t += 0.05) assert.equal(at(g, t).A.witch.pose, 'USED');
  }
  // Fighter SPECIAL: witch walks in facing left, then CAST toward the fighter; giant UPPER (uniform scale).
  { const { g } = scene('BOUNCE', 'BOOST'), F = c.comboFighterTimes;
    assert.equal(at(g, 0.1).A.witch.face, 'left'); assert.equal(at(g, 0.1).A.witch.pose, 'IDLE');
    for (let t = F.arrive + 0.01; t < F.growEnd - 0.01; t += 0.05) { const { A } = at(g, t); assert.equal(A.witch.pose, 'CAST'); assert.equal(A.witch.face, 'right'); assert(A.witch.x < A.fighter.x, 'witch casts at the fighter'); }
    for (let t = 0; t < F.upper - 0.05; t += 0.05) { const { A, st } = at(g, t); assert.equal(A.fighter.pose, 'IDLE'); assert(towardHero(A.fighter, st)); }
    for (let t = F.upper; t < g.combo.total - S0; t += 0.05) { const { A, st } = at(g, t); assert.equal(A.fighter.pose, 'UPPER'); assert(towardHero(A.fighter, st)); near(A.fighter.scale, c.comboFighterScale, 'giant'); }
  }
  // Short versions use the poses too.
  { const a = scene('BOOST', 'BOUNCE', { short: true }).g; a.combo.elapsed = 0.5; const A = G.comboActors(G.comboState(a)); assert.deepEqual([A.witch.pose, A.fighter.pose], ['CAST', 'UPPER']);
    const b = scene('BOUNCE', 'BOOST', { short: true }).g; b.combo.elapsed = 0.5; const B = G.comboActors(G.comboState(b)); assert.deepEqual([B.witch.pose, B.fighter.pose], ['CAST', 'UPPER']); }
  // The drawing passes slot + facing to Sprites.drawCastScaled.
  { const { g } = scene('BOOST', 'BOUNCE'); const calls = [], saved = S.drawCastScaled;
    S.drawCastScaled = (ctx, id, x, feet, pose, mul, opts) => { calls.push({ id, pose, face: opts.face }); return { w: 1, h: 1 }; };
    const nullCtx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
    const ground = 600, sx = x => x, sy = y => ground - 18 - y;
    g.combo.elapsed = S0 + 1.0; G.comboBack(nullCtx, G.comboState(g), sx, sy, ground);
    assert(calls.some(k => k.id === 'BOOST' && k.pose === 'CAST' && k.face === 'right') && calls.some(k => k.id === 'BOUNCE' && ['PUNCH', 'KICK'].includes(k.pose)));
    S.drawCastScaled = saved; }
  // Facing: a slot is mirrored only when its stored facing differs, about the feet (feet x unchanged).
  { const data = { frameWidth: 384, frameHeight: 288, unit: 3, frames: 1, fps: 1, loop: false, pivot: { x: 192, y: 264 }, smooth: true };
    const savedAssets = S.castAssets.BOUNCE;
    S.castAssets.BOUNCE = { IDLE: { ready: true, data: { ...data, frameWidth: 288, pivot: { x: 144, y: 264 } }, image: { complete: true, naturalWidth: 288 } }, KICK: { ready: true, data, image: { complete: true, naturalWidth: 384 } },
      PUNCH: { ready: true, data, image: { complete: true, naturalWidth: 384 } }, UPPER: { ready: false } };
    const rec = () => { let sxs = 1, tx = 0; const stack = []; const out = {}; return { out, globalAlpha: 1, save() { stack.push([sxs, tx]); }, restore() { [sxs, tx] = stack.pop(); }, translate(x) { tx += x * sxs; }, scale(x) { sxs *= x; }, rotate() {},
      drawImage(img, a, b, sw, sh, dx, dy, dw) { out.mirrored = sxs < 0; out.feetX = tx + sxs * (dx + data.pivot.x * dw / sw * (sw === 288 ? 144 / 192 : 1)); } }; };
    for (const [face, mirrored] of [['right', false], ['left', true]]) {
      const r = rec(); const box = S.drawCastScaled(r, 'BOUNCE', 500, 600, 'PUNCH', 1.5, { face });
      assert.equal(box.name, 'PUNCH'); assert.equal(box.flipped, mirrored); assert.equal(r.out.mirrored, mirrored); near(r.out.feetX, 500, 'feet x kept (' + face + ')');
    }
    const r2 = rec(); assert.equal(S.drawCastScaled(r2, 'BOUNCE', 500, 600, 'IDLE', 1, { face: 'left' }).flipped, false, 'IDLE stored facing left');
    // Missing combo slot -> the pose-1 still (KICK), then IDLE.
    assert.equal(S.comboLayer('BOUNCE', 'UPPER').name, 'KICK');
    S.castAssets.BOUNCE.KICK = { ready: false }; assert.equal(S.comboLayer('BOUNCE', 'UPPER').name, 'IDLE');
    S.castAssets.BOUNCE = savedAssets; }
  // Roadside stills unchanged: castLayer never returns a combo slot.
  for (const [id, name] of [['BOOST', 'CAST'], ['BOUNCE', 'PUNCH'], ['BOUNCE', 'UPPER']]) {
    assert.equal(S.definitions.CAST[id][name].comboPose, true); assert.equal(S.definitions.CAST[id][name].pose, undefined);
  }
  cases++;
}

console.log(JSON.stringify({ comboSpecial: 'PASS', cases }));
