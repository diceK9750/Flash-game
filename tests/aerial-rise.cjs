// AERIAL UP rise feedback (2026-10-17 auto cycle 18). Measured (400 runs, UP tapped while falling): ~2.8 of the 3
// UPs used per run, each buys ~1.8 s (p50) more air before the next ground touch, yet it had no SE and only a thin
// line. Now (display/sound only, hero area): AERIAL_RISE SE once per UP + an air-ring kick-off burst under the hero
// for the first 60% of the effect (none in reduced motion). Same seed -> identical game.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let arcs = 0;
const ctx2d = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'arc' ? () => { arcs++; } : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, width: 1280, height: 720, getBoundingClientRect: () => ({ width: 1280, height: 720 }), getContext: ctx2d }); return els.get(id); };
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, A = H.Audio, G = H.Graphics, rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const c = H.CONFIG;
assert(A.fxRecipes.AERIAL_RISE?.length >= 2); assert(A.peakSum(A.fxRecipes.AERIAL_RISE) <= A.peakSum(A.fxRecipes.RANK_STAMP), 'quieter than the stamp');
{ const cx = ctx2d(); let n = 0; cx.stroke = () => n++; G.riseBurst(cx, 100, 100, 0.2); assert.equal(n, 7); n = 0; G.riseBurst(cx, 100, 100, 0.7); assert.equal(n, 0); }
const played = []; A.play = k => { played.push(k); };
let rises = 0, ups = 0, burstFrames = 0;
function play(s, draw, rm = false) {
  const g = new H.Game(rng(s)); g.tempoEnabled = true; g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new H.UI(g, element('canvas')); ui.visual.reducedMotion = rm; const pr = rng(s * 7919);
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  let cur = null;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) {
    if (g.special && g.special !== cur) { cur = g.special; if (pr() < 0.9) g.act(); }
    else if (!g.special && !g.combo && g.airborne() && g.body.vy < 0 && pr() < 0.03) g.act();
    const e0 = g.effect; played.length = 0; g.update(1 / 60);
    if (!draw) continue;
    const fresh = g.effect && g.effect !== e0 ? g.effect.label : null;
    ui.update(); const n = played.filter(k => k === 'AERIAL_RISE').length;
    // the act() effect is created before update; ui sees it as new this frame
    let calls = 0; const ds = G.riseBurst; G.riseBurst = (...a) => { calls++; return ds.apply(G, a); }; ui.draw(); G.riseBurst = ds;
    if (calls) { assert.equal(g.effect?.label, 'AERIAL UP', 'burst only during AERIAL UP'); burstFrames++; }
    if (rm) assert.equal(calls, 0, 'none in reduced motion');
    if (n) { assert.equal(n, 1); assert.equal(g.effect?.label, 'AERIAL UP'); rises++; }
  }
  return g;
}
// SE once per dive: count new AERIAL DOWN effects vs SE
const fp = g => JSON.stringify({ ...JSON.parse(JSON.stringify(g)), fxEvents: null, soundEvent: null }); // UI-consumed queues
for (let s = 1; s <= 40; s++) assert.equal(fp(play(s, true)), fp(play(s, false)), 'seed ' + s + ': feedback never changes the game');
for (let s = 1; s <= 5; s++) play(s, true, true);
assert(rises > 40 && burstFrames >= rises, JSON.stringify({ rises, burstFrames }));
console.log(JSON.stringify({ aerialRise: 'PASS', rises, burstFrames }));
