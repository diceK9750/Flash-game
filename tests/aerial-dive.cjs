// AERIAL DOWN dive feedback (2026-10-17 auto cycle 17). Measured (400 runs, DOWN tapped when charged): ~4.2 dives
// per run, 69% reach the ground first (p50 0.18 s later, landing |vy| p50 646 vs 450 overall, so cycle 15's landing
// scaling already makes it heavier), 31% hit a character first. The dive itself had no SE and only a thin line.
// Now (display/sound only, hero area): AERIAL_DIVE SE once per dive + white dive streaks along the velocity for the
// effect time (none in reduced motion). Same seed -> identical game.
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
assert(A.fxRecipes.AERIAL_DIVE?.length >= 2); assert(A.peakSum(A.fxRecipes.AERIAL_DIVE) <= A.peakSum(A.fxRecipes.RANK_STAMP), 'quieter than the stamp');
{ const cx = ctx2d(); let n = 0; cx.stroke = () => n++; G.diveStreaks(cx, 100, 100, 300, -300, 0.2); assert.equal(n, 8); n = 0; G.diveStreaks(cx, 100, 100, 300, -300, 1); assert.equal(n, 0); }
const played = []; A.play = k => { played.push(k); };
let dives = 0, ups = 0, streakFrames = 0;
function play(s, draw, rm = false) {
  const g = new H.Game(rng(s)); g.tempoEnabled = true; g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new H.UI(g, element('canvas')); ui.visual.reducedMotion = rm; const pr = rng(s * 7919);
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  let cur = null;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) {
    if (g.special && g.special !== cur) { cur = g.special; if (pr() < 0.9) g.act(); }
    else if (!g.special && !g.combo && g.airborne() && pr() < 0.02) g.act();
    const e0 = g.effect; played.length = 0; g.update(1 / 60);
    if (!draw) continue;
    const fresh = g.effect && g.effect !== e0 ? g.effect.label : null;
    ui.update(); const n = played.filter(k => k === 'AERIAL_DIVE').length;
    // the act() effect is created before update; ui sees it as new this frame
    let calls = 0; const ds = G.diveStreaks; G.diveStreaks = (...a) => { calls++; return ds.apply(G, a); }; ui.draw(); G.diveStreaks = ds;
    if (calls) { assert.equal(g.effect?.label, 'AERIAL DOWN', 'streaks only during a dive'); streakFrames++; }
    if (rm) assert.equal(calls, 0, 'none in reduced motion');
    if (n) { assert.equal(n, 1); assert.equal(g.effect?.label, 'AERIAL DOWN'); dives++; }
  }
  return g;
}
// SE once per dive: count new AERIAL DOWN effects vs SE
const fp = g => JSON.stringify({ ...JSON.parse(JSON.stringify(g)), fxEvents: null, soundEvent: null }); // UI-consumed queues
for (let s = 1; s <= 40; s++) assert.equal(fp(play(s, true)), fp(play(s, false)), 'seed ' + s + ': feedback never changes the game');
for (let s = 1; s <= 5; s++) play(s, true, true);
assert(dives > 40 && streakFrames > dives, JSON.stringify({ dives, streakFrames }));
console.log(JSON.stringify({ aerialDive: 'PASS', dives, streakFrames }));
