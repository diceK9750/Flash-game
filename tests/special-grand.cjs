// Grand solo SPECIAL scenes (2026-10-17 auto cycle 34): 戦士 DASH / 僧侶 STOPPER / 盗賊 BRAKE / 遊び人 ANGLE / 賢者 GUARD successes
// get a frozen, skippable scene like the mage / monk combos (browser game: game.grandSpecialEnabled). Checks: scene record
// and duration, game step frozen, tap skips, reducedMotion short still, no scene for merchant / combo types / headless
// default, every frame draws (normal + reduced motion), SE tracks, and same-seed results identical with the scenes on.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ctx2d = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'measureText' ? () => ({ width: 10 }) : k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, value: 0, style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, width: 1280, height: 720, getBoundingClientRect: () => ({ width: 1280, height: 720 }), getContext: ctx2d }); return els.get(id); };
const sc = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 }; sc.window = sc; vm.createContext(sc);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
const H = sc.Hop, c = H.CONFIG, G = H.Graphics, A = H.Audio, SOLO = ['DASH', 'STOPPER', 'BRAKE', 'ANGLE', 'GUARD'];
let tracks = []; A.play = () => {}; A.playCombo = k => tracks.push(k); A.stopCombo = () => {}; A.resumeCombo = () => {}; let voices = []; H.Voice.play = id => voices.push(id);
assert.ok(fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8').includes('game.grandSpecialEnabled = true'), 'browser game enables the scenes');
assert.equal(new H.Game(() => 0.5).grandSpecialEnabled, false, 'headless default off');
for (const t of SOLO) { assert.ok(A.comboRecipes['GRAND_' + t]?.length >= 10, 'SE ' + t); assert.ok(c.grandDurations[t] >= c.comboWitchDuration, 'as long as the combo scenes ' + t); assert.ok(c.grandShakePx[t] >= c.comboShakePx || t !== 'DASH'); }
assert.ok(A.comboRecipes.GRAND_SHORT);
const rng = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>>  0) / 4294967296);
function untilWindow(g, ui, type) { for (let i = 0; i < 60 * 120 && g.state === 'FLYING'; i++) { if (g.special && !g.special.merchantType && (!type || g.special.type === type)) return true; g.update(1 / 60); ui?.update(); } return false; }
function launch(g) { g.act(); for (let i = 0; i < 30; i++) g.update(1 / 60); g.act(); for (let i = 0; i < 20; i++) g.update(1 / 60); g.act(); }
// 1) per type: scene record, freeze, duration, drawing, short version, skip
const canvas = element('canvas');
for (const T of SOLO) for (const mode of ['full', 'reduced', 'skip']) {
  const g = new H.Game(rng(11)); g.tempoEnabled = true; g.grandSpecialEnabled = true; g.setDebugKind(T.toLowerCase());
  const ui = new H.UI(g, canvas); ui.visual.reducedMotion = mode === 'reduced'; ui.update(); G.smooth = true;
  launch(g); assert.ok(untilWindow(g, ui, T), 'window ' + T); tracks = []; voices = [];
  g.act(); ui.update();
  assert.ok(g.combo?.solo && g.combo.type === T, 'scene ' + T); assert.equal(g.combo.short, mode === 'reduced');
  assert.equal(g.combo.total, mode === 'reduced' ? c.comboReducedDuration : c.grandDurations[T]);
  assert.equal(tracks.join(), mode === 'reduced' ? 'GRAND_SHORT' : 'GRAND_' + T); assert.ok(voices.every(id => !/^combo_/.test(id)), 'no combo voice for grand scenes ' + voices);
  const body = JSON.stringify(g.body); let frames = 0, sawCam = false;
  const trap = { scale(a, b) { if (a === b && a > 1.05) sawCam = true; } };
  while (g.combo && frames < 600) {
    if (mode === 'skip' && frames === 30) { g.act(); assert.equal(g.combo, null); assert.equal(g.comboAfter?.skipped, true); break; }
    g.update(1 / 60); ui.update(); if (g.combo) assert.equal(JSON.stringify(g.body), body, 'game frozen ' + T);
    const st = G.grandState(g); assert.ok(st || !g.combo);
    const cam = st && G.grandCamera(st, ui.visual.reducedMotion, x => x, y => y, 600, 300); if (cam?.w > 0) sawCam = true;
    ui.draw(); frames++;
  }
  if (mode === 'full') { assert.ok(Math.abs(frames / 60 - c.grandDurations[T]) < 0.15, T + ' ' + frames); assert.ok(sawCam, 'camera push ' + T); }
  if (mode === 'reduced') { assert.ok(frames / 60 <= c.comboReducedDuration + 0.15, 'short ' + frames); const st = { type: T, short: true, t: 0, after: null, climax: c.grandClimax[T] }; assert.equal(JSON.stringify(G.grandImpact(st, true)), '{"x":0,"y":0,"flash":0}'); }
  for (let i = 0; i < 50; i++) { g.update(1 / 60); ui.update(); ui.draw(); }
}
// climax shake / flash present in the full version
for (const T of SOLO) { const st = { type: T, short: false, t: c.grandClimax[T] + 0.01, after: null, climax: c.grandClimax[T] }; const im = G.grandImpact(st, false); assert.ok(im.flash > 0.5 && Math.hypot(im.x, im.y) >= 0, T); }
// 2) no grand scene for combo types / merchant (combos keep their own scenes)
{ const g = new H.Game(rng(5)); g.grandSpecialEnabled = true; g.setDebugKind('merchant-a'); launch(g);
  for (let i = 0; i < 60 * 60 && g.state === 'FLYING'; i++) { if (g.special?.merchantType) { g.act(); assert.ok(!g.combo, 'merchant: no scene'); break; } g.update(1 / 60); } }
// 3) same-seed results identical with the scenes on (taps keyed to game state; scene taps would only skip)
function play(seed, on, kind) {
  const g = new H.Game(rng(seed * 31 + 7)); g.grandSpecialEnabled = on; if (kind) g.setDebugKind(kind);
  g.act(); g.angle = 15 + (seed * 7) % 55; g.act(); g.power = 0.4 + (seed % 7) * 0.1; g.act();
  let f = 0, q = 0, scenes = 0, seen = null;
  while (g.state === 'FLYING' && f < 120 * 900) {
    if (g.combo) { if (g.combo !== seen) { seen = g.combo; if (g.combo.solo) scenes++; } }
    else if (g.special && (seed % 3 !== 0)) g.act();
    else if (!g.special && q % (97 + seed) === 0 && seed % 4 === 1) g.act();
    const frozen = !!g.combo; g.update(c.physicsStep); f++; if (!frozen) q++;
  }
  return { r: [g.finalDistance, g.maxHeight, g.maxSpeed, g.body.bounces, g.history.map(e => e.label).join(','), g.specialSuccesses, JSON.stringify(g.merchantStats)].join('|'), scenes };
}
let scenes = 0;
for (const [seed, kind] of [...Array.from({ length: 120 }, (_, i) => [i + 1, null]), ...SOLO.map((t, i) => [500 + i, t.toLowerCase()])]) {
  const a = play(seed, false, kind), b = play(seed, true, kind); assert.equal(b.r, a.r, 'same seed ' + seed); assert.equal(a.scenes, 0); scenes += b.scenes;
}
assert.ok(scenes >= 20, 'scenes ' + scenes);
console.log(`special-grand OK: 5 types x full/reduced/skip, ${scenes} scenes in the same-seed check (results identical)`);
