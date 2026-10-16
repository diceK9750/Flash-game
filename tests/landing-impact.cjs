// Landing impact feel (2026-10-17 auto cycle 15). Measured over 400 runs: ~8 ground impacts per run, impact |vy|
// p10 108 / p50 418 / p90 964, but every landing looked/sounded alike (dust from post-bounce speed only, no SE).
// Now (display/sound only, hero area): dust + squash scale with impact speed, LAND_SOFT SE >= landImpactSoft,
// LAND_HARD SE + ground ring >= landImpactHard, nothing for tiny hops. Same seed -> identical game.
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
for (const k of ['LAND_SOFT', 'LAND_HARD']) { assert(A.fxRecipes[k]?.length >= 2, k); assert(A.peakSum(A.fxRecipes[k]) <= A.peakSum(A.fxRecipes.RANK_STAMP), k + ' quieter than the stamp'); }
assert(A.peakSum(A.fxRecipes.LAND_SOFT) < A.peakSum(A.fxRecipes.LAND_HARD));
assert.equal(G.landK(100), 0); assert.equal(G.landK(c.landImpactFull), 1); assert(G.landK(400) < G.landK(900));
{ const cx = ctx2d(); arcs = 0; G.dustPuffs(cx, { puff: {} }, 0, 500, 0.1, 0.5); const lo = arcs; assert(lo > 0); }
const played = []; A.play = k => { played.push(k); };
let soft = 0, hard = 0, quiet = 0, rings = 0, bigDust = 0, smallDust = 0;
function play(s, draw) {
  const g = new H.Game(rng(s)); g.tempoEnabled = true; g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new H.UI(g, element('canvas')); const pr = rng(s * 7919);
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  let cur = null, will = false;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) {
    if (g.special && g.special !== cur) { cur = g.special; will = pr() < 0.9; } if (g.special && will) g.act();
    const b0 = g.body.bounces; played.length = 0; g.update(1 / 60);
    if (!draw) continue;
    ui.update();
    const nb = g.body.bounces > b0 && g.state === 'FLYING', vy = g.lastImpactVy, se = played.filter(k => k.startsWith('LAND_'));
    if (nb) { const want = vy >= c.landImpactHard ? 'LAND_HARD' : vy >= c.landImpactSoft ? 'LAND_SOFT' : null; assert.deepEqual(se, want ? [want] : [], 'seed ' + s + ' vy ' + vy);
      want === 'LAND_HARD' ? hard++ : want ? soft++ : quiet++; }
    else assert.equal(se.length, 0, 'no landing SE without a new impact');
    const lr = G.landRing; let rc = 0; G.landRing = (...a) => { rc++; return lr.apply(G, a); }; ui.draw(); G.landRing = lr;
    if (nb) { const a = H.Anim.cache.get(ui.visual); if (vy >= c.landImpactHard) { assert(rc > 0, 'ring on hard landing'); rings++; } else assert.equal(rc, 0, 'no ring on soft');
      if (vy >= c.landImpactHard) { assert(a.landV > 1.2); bigDust++; } else if (vy < c.landImpactSoft) { assert(a.landV < 0.75); smallDust++; } }
  }
  return g;
}
const fp = g => JSON.stringify({ ...JSON.parse(JSON.stringify(g)), fxEvents: null, soundEvent: null }); // fxEvents / soundEvent are queues the UI consumes
for (let s = 1; s <= 50; s++) assert.equal(fp(play(s, true)), fp(play(s, false)), 'seed ' + s + ': feedback never changes the game');
assert(soft > 50 && hard > 20 && quiet > 10 && rings === hard, JSON.stringify({ soft, hard, quiet, rings }));
console.log(JSON.stringify({ landingImpact: 'PASS', soft, hard, quiet, rings, bigDust, smallDust }));
