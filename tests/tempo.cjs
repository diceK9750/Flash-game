// Tempo & feedback (2026-10-13): tail fast-forward / instant finish / hit-stop / repeat combos are display time
// only (identical physics steps), hit chain, milestones, rank thresholds, quick restart without state leaks.
// Run with: node tests/tempo.cjs
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    setAttribute(key, value) { this[key] = value; }, textContent: '', hidden: false, style: {}, dataset: {},
    classList: { toggle() {} }, addEventListener() {},
    getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); }
  });
  return elements.get(id);
}
const store = {};
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {},
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
scope.window = scope; vm.createContext(scope);
for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), scope, { filename: name });
}
const H = scope.Hop, { Game, CONFIG: c, STATES: S } = H;
let checks = 0;
const J = x => JSON.parse(JSON.stringify(x)); // arrays from the vm realm
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// One play with a deterministic bot: SPECIAL tapped 0.35 s of window time in, combos not skipped.
function play(game, { angle = 40, power = 0.95, tempo = false, finishTail = false, frame = 1 / 60 } = {}) {
  game.tempoEnabled = tempo; game.launchCutinEnabled = true;
  if (game.state === S.READY) game.act();
  game.angle = angle; game.act(); game.power = power; game.act();
  let frames = 0, scaled = 0, finished = false;
  while (game.state === S.FLYING && frames++ < 60 * 400) {
    if (game.special && game.special.remaining <= c.specialWindow - 0.35 + 1e-9) game.act();
    if (finishTail && !finished && game.body.grounded && game.tailActive()) { finished = true; game.act(); continue; }
    game.update(frame);
    if (game.timeScale > 1) scaled++;
  }
  assert.equal(game.state, S.RESULT);
  return { d: game.finalDistance, h: game.maxHeight, sp: game.maxSpeed, hist: JSON.stringify(game.history), counts: JSON.stringify(game.counts),
    bounces: game.body.bounces, chain: game.hype.bestChain, frames, scaled, finished, specials: game.specialSuccesses };
}
const strip = r => ({ ...r, frames: 0, scaled: 0, finished: false });

// 1) Fast-forward / hit-stop / repeat-combo rate never change the result (same fixed physics steps).
let anyScaled = 0, anyFinished = 0, saved = 0;
for (let seed = 1; seed <= 60; seed++) {
  const angle = 20 + (seed * 7) % 45, power = 0.5 + (seed % 6) * 0.1;
  const a = play(new Game(rng(seed)), { angle, power });
  const b = play(new Game(rng(seed)), { angle, power, tempo: true });
  const f = play(new Game(rng(seed)), { angle, power, tempo: true, finishTail: true });
  const j = play(new Game(rng(seed)), { angle, power, tempo: true, frame: 1 / 37 }); // other frame rate
  assert.deepEqual(strip(b), strip(a), 'fast-forward seed ' + seed);
  assert.deepEqual(strip(f), strip(a), 'instant finish seed ' + seed);
  assert.deepEqual(strip(j), strip(a), 'fast-forward @37fps seed ' + seed);
  anyScaled += b.scaled > 0; anyFinished += f.finished; saved += a.frames - b.frames;
}
assert(anyScaled >= 50, 'fast-forward used in most plays: ' + anyScaled); assert(anyFinished >= 30, 'instant finish used: ' + anyFinished);
assert(saved > 0, 'tempo saves wall time'); checks += 4;
// A repeat combo (second view of the same type) runs at comboRepeatRate and gives the same flight.
{
  // Play until the combo scene ends (DEBUG boost: the scene is certain); the body then must be identical.
  const run = tempo => { const g = new Game(rng(5)); g.tempoEnabled = tempo; g.comboViews.BOOST = 1; g.comboViews.BOUNCE = 1;
    g.setDebugKind('boost'); g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act();
    let frames = 0, seen = false;
    while (frames++ < 6000 && !(seen && !g.combo)) { if (g.special) g.act(); g.update(1 / 60); seen = seen || !!g.combo; }
    assert(seen); if (tempo) assert(g.comboAfter); return { body: JSON.stringify(g.body), frames, hist: JSON.stringify(g.history) }; };
  const off = run(false), on = run(true);
  assert.equal(on.body, off.body); assert.equal(on.hist, off.hist); assert(on.frames < off.frames - 30, `repeat combo shorter: ${on.frames} < ${off.frames}`);
  const g = new Game(rng(5)); g.tempoEnabled = true; g.setDebugKind('boost'); g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act();
  for (let i = 0; i < 600 && !g.combo; i++) { if (g.special) g.act(); g.update(1 / 60); }
  assert(g.combo && g.combo.rate === 1, 'first view full speed'); assert.equal(g.comboViews.BOOST, 1); g.skipCombo(); checks += 2;
}
// Tail activity: never during a SPECIAL window, cut-in, combo, merchant, or before the first bounce; time scale snaps to 1.
{
  const g = new Game(rng(3)); g.tempoEnabled = true; g.act(); g.act(); g.act();
  assert.equal(g.tailActive(), false, 'no tail before the first bounce');
  Object.assign(g.body, { bounces: 1, grounded: true, y: 0, vx: 300, vy: 0 }); g.launchCutin = null;
  assert.equal(g.tailActive(), true); assert.equal(g.tailScale(), c.tailFastForward);
  g.special = { remaining: 1 }; assert.equal(g.tailActive(), false); g.update(1 / 60); assert.equal(g.timeScale, 1); g.special = null;
  g.merchant = { type: 'D', remaining: 1 }; assert.equal(g.tailActive(), false); g.merchant = null;
  Object.assign(g.body, { grounded: false, y: 50, vx: 300 }); g.upRemaining = 2; assert.equal(g.tailScale(), c.tailAirFastForward);
  g.upRemaining = 0; assert.equal(g.tailScale(), c.tailFastForward);
  g.body.vx = c.tailSpeed + 1; assert.equal(g.tailActive(), false);
  // a tap while airborne in the tail is still an AERIAL (gameplay unchanged); instant finish only while rolling
  Object.assign(g.body, { vx: 300, vy: -200 }); g.upRemaining = 1; g.updateAerialMode(); g.act(); assert.equal(g.upRemaining, 0); assert.equal(g.tailFinished, false);
  checks += 3;
}

// 2) Hit chain: consecutive character contacts without touching the ground; a ground impact resets it.
{
  const g = new Game(rng(1)); g.act(); g.act(); g.act(); g.launchCutin = null;
  g.objects = [{ x: 500, type: 'BRAKE', used: false }, { x: 900, type: 'BRAKE', used: false }, { x: 1300, type: 'ANGLE', used: false }];
  g.random = () => 0.99; // no ANGLE special draw
  Object.assign(g.body, { x: 600, y: 10, vx: 500, vy: -100, grounded: false }); g.contactObjects({ x: 400, y: 10 });
  assert.equal(g.hype.chain, 1); assert.equal(g.fxEvents.filter(e => e.kind === 'CHAIN').length, 0);
  Object.assign(g.body, { x: 1000, y: 10, vx: 500, vy: -100 }); g.contactObjects({ x: 800, y: 10 });
  assert.equal(g.hype.chain, 2); assert.deepEqual(J(g.fxEvents.filter(e => e.kind === 'CHAIN').map(e => e.n)), [2]);
  g.groundImpact({ vx: 100, vy: -100 }); assert.equal(g.hype.chain, 0);
  Object.assign(g.body, { x: 1400, y: 10, vx: 500, vy: -100 }); g.contactObjects({ x: 1200, y: 10 });
  assert.equal(g.hype.chain, 1); assert.equal(g.hype.bestChain, 2);
  // a contact while rolling starts a new chain at 1
  g.hype.chain = 4; g.objects.push({ x: 1800, type: 'BRAKE', used: false });
  Object.assign(g.body, { x: 1850, y: 0, vx: 300, vy: 0, grounded: true }); g.contactObjects({ x: 1700, y: 0 });
  assert.equal(g.hype.chain, 1);
  // chain SE pitch rises then caps
  const p = [2, 3, 4, 12, 30].map(n => H.Audio.chainPitch(n));
  assert.equal(p[0], 1); assert(p[1] > p[0] && p[2] > p[1]); assert.equal(p[3], p[4]);
  // hit-stop only in tempo mode, scaled by the impact and bounded
  g.hitStop = 0; g.noteImpact(5000); assert.equal(g.hitStop, 0);
  g.tempoEnabled = true; g.noteImpact(0); assert(Math.abs(g.hitStop - c.hitStopMin) < 1e-12);
  g.hitStop = 0; g.noteImpact(1e9); assert(Math.abs(g.hitStop - c.hitStopMax) < 1e-12);
  checks += 4;
}

// 3) Milestones every 100 m (big every 500 m), each once; the record pass fires once and never in DEBUG.
{
  const g = new Game(rng(1)); g.best.distance = 250;
  for (let m = 0; m <= 1050; m += 7) { g.body.x = m * c.pixelsPerMeter; g.noteDistance(); }
  const ms = g.fxEvents.filter(e => e.kind.startsWith('MILESTONE'));
  assert.deepEqual(J(ms.map(e => e.meters)), [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  assert.deepEqual(J(ms.filter(e => e.kind === 'MILESTONE_BIG').map(e => e.meters)), [500, 1000]);
  assert.equal(g.fxEvents.filter(e => e.kind === 'NEW_RECORD').length, 1);
  // a single long step crossing several milestones reports each one
  const h = new Game(rng(1)); h.body.x = 320 * c.pixelsPerMeter; h.noteDistance();
  assert.deepEqual(J(h.fxEvents.filter(e => e.kind.startsWith('MILESTONE')).map(e => e.meters)), [100, 200, 300]);
  const d = new Game(rng(1)); d.best.distance = 10; d.setDebugKind('all'); d.body.x = 50 * c.pixelsPerMeter; d.noteDistance();
  assert.equal(d.fxEvents.filter(e => e.kind === 'NEW_RECORD').length, 0, 'no record pop in DEBUG');
  const z = new Game(rng(1)); z.best.distance = 0; z.body.x = 50 * c.pixelsPerMeter; z.noteDistance();
  assert.equal(z.fxEvents.filter(e => e.kind === 'NEW_RECORD').length, 0, 'no record pop on the very first play');
  assert.equal(Game.milestoneKind(500), 'MILESTONE_BIG'); assert.equal(Game.milestoneKind(300), 'MILESTONE');
  checks += 4;
}

// 4) Rank thresholds.
{
  // 2026-10-15 stricter table: S = 10000 m, plus SS / SSS above it, D at the bottom.
  const cases = [[0, 'D'], [-5, 'D'], [NaN, 'D'], [1199.9, 'D'], [1200, 'C'], [2999.9, 'C'], [3000, 'B'], [4999.9, 'B'], [5000, 'A'], [9999.9, 'A'],
    [10000, 'S'], [14999.9, 'S'], [15000, 'SS'], [19999.9, 'SS'], [20000, 'SSS'], [1e6, 'SSS']];
  for (const [d, r] of cases) assert.equal(Game.rank(d), r, String(d));
  assert.deepEqual(JSON.parse(JSON.stringify(c.rankThresholds)), [['SSS', 20000], ['SS', 15000], ['S', 10000], ['A', 5000], ['B', 3000], ['C', 1200], ['D', 0]]);
  for (const [r, se] of [['D', 'RANK_STAMP'], ['C', 'RANK_STAMP'], ['B', 'RANK_STAMP'], ['A', 'RANK_STAMP'], ['S', 'RANK_STAMP_S'], ['SS', 'RANK_STAMP_SS'], ['SSS', 'RANK_STAMP_SS']]) assert.equal(Game.rankStampSe(r), se, r);
  checks++;
}

// 5) Quick restart (tap on RESULT -> straight to aiming) leaks no state: the second run equals a fresh run.
for (const seed of [2, 9, 21, 33]) {
  const g = new Game(rng(seed)); const first = play(g, { tempo: true, angle: 35, power: 0.9 });
  assert.equal(g.state, S.RESULT);
  g.random = rng(seed + 500); g.act(); assert.equal(g.state, S.AIM_ANGLE, 'RESULT tap goes straight to aiming');
  assert.equal(g.timeScale, 1); assert.equal(g.hitStop, 0); assert.equal(g.fxEvents.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(g.hype)), { chain: 0, bestChain: 0, milestone: 0, recordPassed: false });
  assert.equal(g.tailFinished, false);
  const best = { ...g.best };
  const second = play(g, { tempo: true, angle: 50, power: 0.85 });
  const fresh = new Game(rng(seed + 500)); fresh.best = best; fresh.comboViews = { BOOST: 9, BOUNCE: 9 }; fresh.launchCutinViews = 1;
  const ref = play(fresh, { tempo: true, angle: 50, power: 0.85 });
  assert.deepEqual(strip(second), strip(ref), 'quick restart seed ' + seed);
  const plain = play(new Game(rng(seed + 500)), { angle: 50, power: 0.85 });
  assert.deepEqual(strip(second), strip(plain), 'quick restart equals a fresh non-tempo run ' + seed);
  assert(first.d > 0); checks++;
}

// 6) UI: tempo overlay timing, rank stamp, fast-forward hint, fx events consumed (SE + pops); draw never mutates the game.
{
  const g = new Game(rng(4)); g.tempoEnabled = true; g.launchCutinEnabled = true;
  const ui = new H.UI(g, element('canvas'));
  g.act(); ui.update(); g.angle = 40; g.act(); ui.update(); g.power = 0.95; g.act(); ui.update();
  let sawHint = false, sawFx = false;
  for (let i = 0; i < 60 * 200 && g.state === S.FLYING; i++) {
    if (g.special) g.act();
    g.update(1 / 60); ui.update();
    if (/スキップ/.test(element('hint').textContent)) sawHint = true;
    if ((ui.visual.fx || []).length) sawFx = true;
    if (i % 7 === 0) { const before = JSON.stringify(g); ui.draw(); assert.equal(JSON.stringify(g), before); }
  }
  assert.equal(g.state, S.RESULT); assert(sawHint, 'スキップ hint shown'); assert(sawFx, 'feedback pops'); assert.equal(g.fxEvents.length, 0);
  ui.update();
  const rank = element('result-rank');
  assert.equal(rank.textContent, Game.rank(g.finalDistance));
  // overlay timing: without the victory sprite (headless) the overlay is shown at once and the stamp follows
  for (let i = 0; i < 40; i++) { g.update(1 / 60); ui.update(); }
  assert.equal(rank.hidden, false);
  assert(rank.className.includes("rank-len" + rank.textContent.length), rank.className);
  const T = H.UI.tempoOverlayAlpha, rd = H.Sprites.heroStopResult; H.Sprites.heroStopResult = { ready: true };
  assert.equal(T({ stopAt: 1 }, 1 + c.resultOverlayLead - 0.01, S.RESULT), 0);
  assert(Math.abs(T({ stopAt: 1 }, 1 + c.resultOverlayLead + c.resultOverlayFade / 2, S.RESULT) - 0.5) < 1e-9);
  assert.equal(T({ stopAt: 1 }, 1 + c.resultOverlayLead + c.resultOverlayFade, S.RESULT), 1);
  assert.equal(T({ stopAt: 1, reducedMotion: true }, 1, S.RESULT), 1);
  H.Sprites.heroStopResult = rd;
  assert(c.resultOverlayLead + c.resultOverlayFade < 10 / 12 + 0.2, 'RESULT appears sooner than the full victory pose');
  // reduced motion: no shake
  assert.deepEqual(J(H.Graphics.tempoShake({ tempoEnabled: true, state: 'FLYING', realTime: 1, body: { vx: 2000, vy: 0 } }, { reducedMotion: true, kick: { at: 1, k: 1 } })), { x: 0, y: 0 });
  const sh = H.Graphics.tempoShake({ tempoEnabled: true, state: 'FLYING', realTime: 1.05, body: { vx: 2000, vy: 1500 } }, { kick: { at: 1, k: 1 } });
  assert(Math.hypot(sh.x, sh.y) <= c.shakeMaxPx * Math.SQRT2 + 1e-9, 'shake capped');
  // tap on RESULT -> AIM_ANGLE, pops cleared
  g.act(); ui.update(); assert.equal(g.state, S.AIM_ANGLE); assert.equal((ui.visual.fx || []).length, 0); assert.equal(rank.hidden, true);
  checks += 3;
}

// 7) SE recipes: every tempo SE exists, stays under the shared peak cap, and the recipe helpers accept pitch / rate.
{
  const A = H.Audio;
  for (const kind of ['CHAIN', 'MILESTONE', 'MILESTONE_BIG', 'NEW_RECORD', 'RANK_STAMP', 'RANK_STAMP_S', 'RANK_STAMP_SS']) {
    assert(A.fxRecipes[kind]?.length >= 2, kind); assert(A.peakSum(A.fxRecipes[kind]) > 0);
  }
  const made = [];
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { assert(Number.isFinite(v) && v > 0); } });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(), start(t) { made.push(t); }, stop() {} });
  const ctx = { currentTime: 0, sampleRate: 8000, state: 'running', destination: {}, createGain: node, createOscillator: node, createBiquadFilter: node,
    createBufferSource: node, createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }) };
  assert(A.render(ctx, 'CHAIN', 0, { pitch: A.chainPitch(5) }));
  made.length = 0; A.render(ctx, 'COMBO_WITCH', 0, { rate: 1.6 });
  assert(Math.max(...made) < Math.max(...A.comboRecipes.COMBO_WITCH.map(v => v[1])) / 1.5, 'repeat combo SE follows the faster scene');
  checks++;
}
// 8) Rules kept: config pins, merchant 20%, warrior / sage rules, voice gate untouched by the tempo work.
assert.equal(c.merchantChance, 0.2); assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.sageCondition, 'foresight'); assert.equal(c.sageForesightRange, 460);
assert.equal(c.launchCutinDuration, 1.5); assert.equal(c.launchCutinRepeatDuration, 0.8); assert.equal(c.physicsStep, 1 / 120);
checks++;
console.log(`tempo PASS (${checks} check groups): fast-forward / instant finish / hit-stop / repeat combo keep identical results over 60 seeds (saved ${(saved / 60 / 60).toFixed(2)} s per play at 60 fps); chain, milestones, ranks, quick restart, UI, SE.`);
