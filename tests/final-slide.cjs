// Final-slide feel (2026-10-16 auto cycle 14). Measured: the last ground roll is short in real time (p50 0.3 s,
// p90 0.65 s with the existing 3x tail fast-forward), so no extra fast-forward; but it had no feedback beyond the
// skid pose. Added (display only, hero area): skid dust trailing the rolling hero (fades with speed, none in reduced
// motion) and a soft SLIDE_STOP SE once when a slide ends the run (not for 僧侶 stops). Same seed -> identical game.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let arcs = 0;
const ctx2d = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'arc' ? () => { arcs++; } : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, width: 1280, height: 720, getBoundingClientRect: () => ({ width: 1280, height: 720 }), getContext: ctx2d }); return els.get(id); };
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, A = H.Audio, G = H.Graphics, rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
assert(A.fxRecipes.SLIDE_STOP?.length >= 2); assert(A.peakSum(A.fxRecipes.SLIDE_STOP) <= A.peakSum(A.fxRecipes.RANK_STAMP), 'quieter than the stamp');
// skidDust: 3 arcs, alpha follows skid, deterministic
{ const c = ctx2d(); arcs = 0; G.skidDust(c, 100, 500, 1.234, 0.5); assert.equal(arcs, 3); }
const played = []; A.play = k => { played.push(k); };
function play(s, draw, rm = false) {
  const g = new H.Game(rng(s)); g.tempoEnabled = true; g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new H.UI(g, element('canvas')); ui.visual.reducedMotion = rm; const pr = rng(s * 7919);
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  let cur = null, will = false, rollingArcs = 0, rollingFrames = 0; played.length = 0;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) {
    if (g.special && g.special !== cur) { cur = g.special; will = pr() < 0.9; } if (g.special && will) g.act();
    g.update(1 / 60); ui.update();
    if (draw) { const rolling = g.state === 'FLYING' && g.body.grounded && !g.body.stopped && g.body.vx > 12; const before = arcs; arcs = 0; const sk = G.skidDust; let skCalls = 0; G.skidDust = (...a) => { skCalls++; return sk.apply(G, a); }; ui.draw(); G.skidDust = sk; arcs = before; if (rolling && g.body.vx > 600 * 0.02) { rollingFrames++; if (skCalls) rollingArcs++; } if (!rolling) assert.equal(skCalls, 0, 'dust only while rolling'); if (rm) assert.equal(skCalls, 0, 'none in reduced motion'); }
  }
  for (let i = 0; i < 5; i++) { g.update(1 / 60); ui.update(); }
  return { g, played: played.slice(), rollingFrames, rollingArcs };
}
let slides = 0, stops = 0, dustFrames = 0;
for (let s = 1; s <= 60; s++) {
  const r = play(s, true), n = r.played.filter(k => k === 'SLIDE_STOP').length;
  if (r.g.endCause?.kind === 'slide') { slides++; assert.equal(n, 1, 'seed ' + s + ': SLIDE_STOP once'); } else { stops++; assert.equal(n, 0, 'seed ' + s + ': not for 僧侶'); }
  assert.equal(r.rollingArcs, r.rollingFrames, 'dust on every rolling frame'); dustFrames += r.rollingFrames;
  assert.equal(JSON.stringify(r.g), JSON.stringify(play(s, false).g), 'drawing never changes the game');
  if (s <= 10) play(s, true, true);
}
assert(slides > 20 && stops > 5 && dustFrames > 50, JSON.stringify({ slides, stops, dustFrames }));
console.log(JSON.stringify({ finalSlide: 'PASS', slides, stops, dustFrames }));
