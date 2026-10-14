// Fighter SPECIAL 巨神昇天拳 (2026-10-13 upper): witch buff -> crouch -> drop out of the bottom of the screen ->
// hidden rumble (ゴゴゴ…) -> erupts from below as a uniformly scaled giant, fist first -> uppercut -> launch.
// Display only: distances identical to the 0cb33fb baseline (tests/fixtures/fighter-upper-baseline-0cb33fb.json).
// Run with: node tests/fighter-upper.cjs   (regenerate the fixture: node tests/fighter-upper.cjs --baseline <old js dir>)
const adjacentGateOff = require('./fixtures/adjacent-gate-off.cjs');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'fighter-upper-baseline-0cb33fb.json');
function load(jsDir) {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { setAttribute(k, v) { this[k] = v; }, textContent: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {},
    getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } }); return elements.get(id); };
  const store = {};
  const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
  scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(adjacentGateOff(fs.readFileSync(path.join(jsDir, name + '.js'), 'utf8'), name), scope, { filename: name });
  scope.Hop.Graphics.smooth = false;
  return scope.Hop;
}
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// Deterministic bot over fixed seeds: DEBUG bounce (fighter combo certain) and normal plays; combos watched,
// skipped or short; tempo on (repeat views 1.6x) or off.
const CASES = [];
for (let seed = 1; seed <= 12; seed++) for (const kind of ['bounce', null]) CASES.push({ seed, kind, angle: 20 + (seed * 7) % 45, power: 0.5 + (seed % 6) * 0.1 });
function play(Hop, { seed, kind, angle, power }, mode = 'watch') {
  const c = Hop.CONFIG, g = new Hop.Game(rng(seed));
  if (kind) g.setDebugKind(kind);
  g.tempoEnabled = mode !== 'plain'; g.comboShort = mode === 'short'; if (mode === 'off') g.comboEnabled = false;
  g.act(); g.angle = angle; g.act(); g.power = power; g.act();
  let frames = 0, fighter = 0, seen = null;
  while (g.state === 'FLYING' && frames++ < 60 * 600) {
    if (g.special && g.special.remaining <= c.specialWindow - 0.3 + 1e-9) g.act();
    if (g.combo && g.combo !== seen) { seen = g.combo; if (g.combo.type === 'BOUNCE') fighter++; }
    if (mode === 'skip' && g.combo && g.combo.elapsed > 1.3) g.act();
    g.update(1 / 60);
  }
  assert.equal(g.state, 'RESULT');
  return { d: g.finalDistance, h: g.maxHeight, labels: g.history.map(x => x.label).join(','), specials: g.specialSuccesses, fighter };
}
if (process.argv[2] === '--baseline') {
  const Old = load(path.resolve(process.argv[3]));
  fs.writeFileSync(FIXTURE, JSON.stringify(CASES.map(k => ({ ...k, ...play(Old, k, 'plain') })), null, 1) + '\n');
  console.log('wrote', FIXTURE); process.exit(0);
}
const Hop = load(path.join(root, 'js')), c = Hop.CONFIG, G = Hop.Graphics, Sp = Hop.Sprites, A = Hop.Audio;
const F = c.comboFighterTimes, S0 = G.comboSceneStart(false), MAX = c.comboFighterScale;
let checks = 0;
const near = (a, b, label, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${label}: ${a} vs ${b}`);
function scene({ short = false, tempo = false, views = 0 } = {}) {
  const g = new Hop.Game(rng(3)); g.tempoEnabled = tempo; g.comboViews.BOUNCE = views; g.comboShort = short;
  g.act(); g.act(); g.act(); g.launchCutin = null;
  Object.assign(g.body, { x: 1200, y: 30, vx: 600, vy: -50, grounded: false, stopped: false });
  g.objects = [{ x: 1230, type: 'BOUNCE', used: false }, { x: 1700, type: 'BOOST', used: false }]; g.nextObjectX = g.nextBoundaryX = Infinity;
  g.contactObjects({ x: 1100, y: 30 }); assert(g.special?.type === 'BOUNCE'); g.act(); assert(g.combo?.type === 'BOUNCE');
  return g;
}
const at = (g, t) => { g.combo.elapsed = S0 + t; const st = G.comboState(g); return { st, A: G.comboActors(st) }; };
// Real ground line (cameraY >= 0 -> ground >= groundY) and the drawn UPPER / IDLE still heights (json pivot / scale).
const meta = n => JSON.parse(fs.readFileSync(path.join(root, Sp.definitions.CAST.BOUNCE[n].metadata), 'utf8'));
const topAbove = (n, mul) => { const m = meta(n), def = Sp.definitions.CAST.BOUNCE[n]; return m.pivot.y * def.scale / 3 * mul; }; // unit 3 (96 px base)

// 1) Config + beat order / timing.
assert.equal(c.comboFighterDuration, 3.2); assert(c.comboFighterDuration - S0 > F.upper + F.hitstop + 0.35, 'room after the uppercut');
const order = ['arrive', 'buffEnd', 'crouch', 'gone', 'rise', 'upper'];
for (let i = 1; i < order.length; i++) assert(F[order[i]] > F[order[i - 1]], order[i] + ' after ' + order[i - 1]);
assert(F.rise - F.gone >= 0.35, 'hidden beat (pause / anticipation) at least 0.35 s'); assert(Object.isFrozen(F));
{
  const g = scene(), beats = [];
  for (let t = 0; t < g.combo.total - S0; t += 1 / 120) { const b = at(g, t).A.fighter.beat; if (beats.at(-1) !== b) beats.push(b); }
  assert.deepEqual(beats, ['arrive', 'buff', 'crouch', 'drop', 'hidden', 'rise', 'upper'], 'beat order');
  const beatAt = t => at(g, t).A.fighter.beat;
  for (const [t, b] of [[F.arrive - 0.01, 'arrive'], [F.arrive + 0.01, 'buff'], [F.buffEnd + 0.01, 'crouch'], [F.crouch + 0.01, 'drop'], [F.gone + 0.01, 'hidden'], [F.rise + 0.01, 'rise'], [F.upper + 0.01, 'upper']]) assert.equal(beatAt(t), b, 't=' + t);
  // Witch: CAST (buff) from arrival until the fighter is gone, toward the fighter; first beat stays the witch's buff.
  for (let t = F.arrive + 0.01; t < F.gone; t += 0.05) { const { A: a } = at(g, t); assert.equal(a.witch.pose, 'CAST'); assert.equal(a.witch.face, 'right'); }
  // Poses: IDLE until the eruption, UPPER from the rise (fist leading), always facing the hero.
  for (let t = 0; t < F.rise; t += 0.05) assert.equal(at(g, t).A.fighter.pose, 'IDLE');
  for (let t = F.rise; t < g.combo.total - S0; t += 0.05) { const { A: a, st } = at(g, t); assert.equal(a.fighter.pose, 'UPPER'); assert.equal(a.fighter.face, a.fighter.x < st.heroWX ? 'right' : 'left'); }
  // Hero launched only after the hit-stop; held still during the hit-stop; sky-high afterwards.
  assert.equal(at(g, F.upper + F.hitstop * 0.5).A.hero.dy, at(g, F.upper).A.hero.dy, 'hit-stop holds the hero');
  near(at(g, F.upper + F.hitstop * 0.5).A.fighter.dy, at(g, F.upper).A.fighter.dy, 'hit-stop holds the fist');
  near(at(g, F.upper + F.hitstop + 0.3).A.hero.dy, -c.comboFighterLiftPx, 'hero launched');
  // UI voice threshold / SE track key times line up (impact SE at the uppercut).
  assert(A.comboRecipes.COMBO_FIGHTER.some(v => v[0] === 'tone' && Math.abs(v[1] - (S0 + F.upper)) < 1e-9 && v[3] >= 0.1), 'massive impact SE at the uppercut');
  assert(A.comboRecipes.COMBO_FIGHTER.some(v => v[0] === 'noise' && v[4] === 'lowpass' && Math.abs(v[1] - (S0 + F.gone)) < 1e-9 && v[2] >= F.rise - F.gone - 0.05), 'rumble SE over the hidden beat');
  assert(A.comboRecipes.COMBO_FIGHTER.some(v => v[0] === 'noise' && v[4] === 'bandpass' && v[1] > S0 + F.gone && v[1] <= S0 + F.rise && v[6] > v[5]), 'whoosh-up SE before the eruption');
  checks++;
}

// 2) Off-screen below during the hidden beat (whole sprite below the canvas bottom), visible again when it rises;
// the giant fist reaches the hero at the uppercut.
{
  const g = scene();
  for (let t = F.gone; t < F.rise; t += 0.01) {
    const f = at(g, t).A.fighter; assert.equal(f.beat, 'hidden');
    const top = c.groundY + f.dy - Math.max(topAbove('IDLE', f.scale), topAbove('UPPER', f.scale)); // highest pixel of either still
    assert(top > c.height, `hidden at ${t.toFixed(2)}: top ${top.toFixed(0)} > ${c.height}`);
  }
  // The drawing skips the fighter while hidden (no BOUNCE draw call at all).
  const calls = [], saved = Sp.drawCastScaled; Sp.drawCastScaled = (ctx, id, x, feet, pose, mul, opts) => { calls.push({ id, feet, mul, alpha: opts.alpha }); return { w: 1, h: 1 }; };
  const nullCtx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const sx = x => x, sy = y => c.groundY - c.playerRadius - y;
  for (let t = F.gone + 0.01; t < F.rise; t += 0.05) { g.combo.elapsed = S0 + t; calls.length = 0; G.comboBack(nullCtx, G.comboState(g), sx, sy, c.groundY); assert(!calls.some(k => k.id === 'BOUNCE'), 'not drawn while hidden'); }
  g.combo.elapsed = S0 + F.rise + 0.05; calls.length = 0; G.comboBack(nullCtx, G.comboState(g), sx, sy, c.groundY); assert(calls.some(k => k.id === 'BOUNCE' && k.mul === MAX), 'giant drawn when rising');
  Sp.drawCastScaled = saved;
  // Rising: enters from below (feet below the canvas bottom at the rise), fist on the hero at the uppercut.
  const r0 = at(g, F.rise + 0.001).A.fighter; assert(c.groundY + r0.dy > c.height, 'enters from below the screen');
  // UPPER sheet: first opaque row 33 of the 288 cell (fist tip), pivot y 264.
  const { A: hit, st } = at(g, F.upper); const fistTop = c.groundY + hit.fighter.dy - topAbove('UPPER', MAX) * (264 - 33) / 264, heroY = c.groundY - c.playerRadius - st.heroY;
  assert(Math.abs(fistTop - heroY) <= 40, `fist on the hero: ${fistTop.toFixed(0)} vs ${heroY.toFixed(0)}`);
  near(hit.fighter.x + G.comboFighterFistDx(MAX), st.heroWX, 'fist under the hero');
  assert(MAX >= 3 && topAbove('UPPER', MAX) > c.height - c.groundY + 150, 'giant: taller than the ground band + 150 px (cropped by the screen edge)');
  // Drop: leaves through the bottom (monotonic, accelerating), crouch sinks first.
  let prev = -1; for (let t = F.buffEnd; t < F.gone; t += 0.02) { const dy = at(g, t).A.fighter.dy; assert(dy >= prev - 1e-9); prev = dy; }
  assert(at(g, F.crouch).A.fighter.dy > 0 && at(g, F.crouch).A.fighter.dy < 20, 'crouch dip');
  checks++;
}

// 3) Uniform scale only: one factor per draw, scale x == scale y on the real Sprites.draw transform at every frame.
{
  const data = { frameWidth: 288, frameHeight: 288, unit: 3, frames: 1, fps: 1, loop: false, pivot: { x: 144, y: 264 }, smooth: true };
  const savedAssets = Sp.castAssets.BOUNCE, savedWitch = Sp.castAssets.BOOST;
  const mk = () => ({ ready: true, data, image: { complete: true, naturalWidth: 288 } });
  Sp.castAssets.BOUNCE = { IDLE: mk(), KICK: mk(), PUNCH: mk(), UPPER: mk() };
  let m = [1, 0, 0, 1, 0, 0]; const stack = [], draws = [];
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const ctx = new Proxy({ globalAlpha: 1, save() { stack.push(m.slice()); }, restore() { m = stack.pop(); }, translate(x, y) { m = mul(m, [1, 0, 0, 1, x, y]); }, scale(x, y) { m = mul(m, [x, 0, 0, y, 0, 0]); },
    rotate(a) { m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); }, setTransform() {},
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { draws.push({ kx: Math.hypot(m[0], m[1]) * dw / sw, ky: Math.hypot(m[2], m[3]) * dh / sh }); } },
    { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const savedDraw = Sp.drawCastScaled; const muls = [];
  Sp.drawCastScaled = function (c2, id, x, feet, pose, mu, opts) { if (id === 'BOUNCE') muls.push(mu); const n = draws.length; const r = savedDraw.call(this, c2, id, x, feet, pose, mu, opts); if (id !== 'BOUNCE') draws.length = n; return r; };
  for (const short of [false, true]) {
    const g = scene({ short }), end = g.combo.total;
    for (let e = 0; e < end; e += 1 / 60) { g.combo.elapsed = e; G.comboBack(ctx, G.comboState(g), x => x, y => 576 - y, 594); }
  }
  assert(draws.length > 100 && muls.some(v => v >= MAX) && muls.some(v => v === 1), 'fighter drawn at normal and giant size');
  for (const d of draws) near(d.kx, d.ky, 'scale x == scale y', 1e-9);
  Sp.drawCastScaled = savedDraw; Sp.castAssets.BOUNCE = savedAssets; Sp.castAssets.BOOST = savedWitch;
  // Scale is one number (comboActors has no separate x / y / head factors).
  const g = scene(); for (let t = 0; t < 2.4; t += 0.05) { const f = at(g, t).A.fighter; assert(typeof f.scale === 'number' && !('scaleX' in f) && !('scaleY' in f) && !('headScale' in f)); assert(f.scale === 1 || f.scale === MAX); }
  checks++;
}

// 4) Skip (tap) at every beat: scene ends at once, nothing moved; afterglow carries skipped (normal camera).
{
  for (const t of [0.2, F.buffEnd + 0.05, F.crouch + 0.1, F.gone + 0.2, F.rise + 0.05, F.upper + 0.05]) {
    const g = scene(); const before = JSON.stringify(g.body); g.combo.elapsed = S0 + t;
    g.act(); assert.equal(g.combo, null, 'skip at ' + t); assert.equal(g.comboAfter.skipped, true); assert.equal(JSON.stringify(g.body), before);
    const st = G.comboState(g); assert.equal(G.comboCamera(st, false, x => x, y => y, 594, 0, 0).w, 0, 'skip -> normal camera');
  }
  checks++;
}

// 5) Repeat view: 1.6x faster (tempo), first view full speed; same beats.
{
  const first = scene({ tempo: true }); assert.equal(first.combo.rate, 1);
  const rep = scene({ tempo: true, views: 1 }); assert.equal(rep.combo.rate, c.comboRepeatRate); assert.equal(c.comboRepeatRate, 1.6);
  const frames = g => { let n = 0; while (g.combo && n < 1000) { g.update(1 / 60); n++; } return n; };
  const a = frames(first), b = frames(rep); assert(Math.abs(a / b - 1.6) < 0.1, `repeat 1.6x faster: ${a} vs ${b} frames`); assert(b < c.comboFighterDuration * 60 / 1.6 + 8);
  checks++;
}

// 6) Reduced motion: short calm still (0.8 s), no shake / flash / zoom, no drop / rumble beats.
{
  const g = scene({ short: true }); assert.equal(g.combo.total, c.comboReducedDuration);
  for (let e = 0; e < g.combo.total; e += 0.02) {
    g.combo.elapsed = e; const st = G.comboState(g), a = G.comboActors(st);
    assert.deepEqual(Object.values(G.comboImpact(st, false)), [0, 0, 0]); assert.equal(G.comboCamera(st, false, x => x, y => y, 594, 0, 0).w, 0);
    assert(!['crouch', 'drop', 'hidden', 'rise'].includes(a.fighter.beat)); assert.equal(a.hero.dx, 0);
  }
  // Full scene with the reducedMotion flag: never shakes or flashes; without: rumble builds, impact shakes + flashes.
  const f = scene(); let rumble0 = 0, rumble1 = 0, flash = 0, shake = 0;
  for (let t = 0; t < 2.4; t += 0.01) { f.combo.elapsed = S0 + t; const st = G.comboState(f); assert.deepEqual(Object.values(G.comboImpact(st, true)), [0, 0, 0]);
    const im = G.comboImpact(st, false); if (t >= F.gone && t < F.gone + 0.1) rumble0 = Math.max(rumble0, Math.abs(im.x)); if (t > F.rise - 0.1 && t < F.rise) rumble1 = Math.max(rumble1, Math.abs(im.x));
    flash = Math.max(flash, im.flash); shake = Math.max(shake, Math.abs(im.x), Math.abs(im.y)); }
  assert(rumble1 > rumble0, 'rumble builds'); assert(flash > 0.4 && flash <= 1 && shake > c.comboShakePx && shake <= c.comboShakePx * 1.4 + 1e-9);
  checks++;
}

// 7) Texts: ゴゴゴ… while hidden, the big 巨神昇天拳！！ title at the uppercut; camera follows the launched hero up.
{
  const g = scene(); const sx = x => c.launchX + x - g.cameraX, sy = y => c.groundY - c.playerRadius - y;
  const nullCtx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const texts = t => { g.combo.elapsed = S0 + t; return G.comboFront(nullCtx, G.comboState(g), sx, sy, c.groundY).filter(i => i.kind === 'label'); };
  assert(texts(F.gone + 0.3).some(i => i.text === 'ゴゴゴ…')); assert(!texts(F.buffEnd - 0.1).some(i => i.text === 'ゴゴゴ…'));
  const title = texts(F.upper + 0.05).find(i => i.text === '巨神昇天拳！！'); assert(title && title.size >= 64, 'big title');
  const cam = t => { g.combo.elapsed = S0 + t; return G.comboCamera(G.comboState(g), false, sx, sy, c.groundY, 0, 0); };
  assert(cam(F.upper + F.hitstop + 0.25).fy < cam(F.upper).fy - 20, 'camera tilts up with the launched hero');
  checks++;
}

// 8) Identical distances / contacts to the 0cb33fb baseline over fixed seeds (watch, skip, short, off, tempo).
{
  const base = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')); let fighter = 0;
  assert.equal(base.length, CASES.length);
  for (const [i, k] of CASES.entries()) {
    const b = base[i]; assert.deepEqual([b.seed, b.kind, b.angle, b.power], [k.seed, k.kind, k.angle, k.power]);
    for (const mode of ['watch', 'plain', 'skip', 'short', 'off']) {
      const r = play(Hop, k, mode);
      assert.equal(r.d, b.d, `seed ${k.seed} ${k.kind} ${mode} distance`); assert.equal(r.h, b.h); assert.equal(r.labels, b.labels); assert.equal(r.specials, b.specials);
      if (mode === 'watch') fighter += r.fighter;
    }
  }
  assert(fighter >= 10, 'fighter combos in the seeded plays: ' + fighter);
  checks++;
}
console.log(JSON.stringify({ fighterUpper: 'PASS', checks }));
