// JUST afterglow (2026-10-17 auto cycle 16). Measured: skilled inputs hit JUST in 18% of plays (casual 0.3%), but the
// JUST! pop lives 0.9 s of a ~11.4 s (p50) JUST flight (~8%). Now (display only, hero trail): the trail glows JUST-cyan
// for justAfterglowTime real seconds from when the pop appears, fading out; none without JUST. Same seed -> identical game.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let arcs = 0;
const ctx2d = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'arc' ? () => { arcs++; } : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, width: 1280, height: 720, getBoundingClientRect: () => ({ width: 1280, height: 720 }), getContext: ctx2d }); return els.get(id); };
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, A = H.Audio, G = H.Graphics, rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const c = H.CONFIG; assert(c.justAfterglowTime > 0); assert.equal(c.justLaunchMultiplier, 1.15, 'JUST strength unchanged');
let circles = 0; const circ = G.circle; G.circle = function (cx, x, y, r, col) { if (col === '#22d8f5') circles++; return circ.apply(this, arguments); };
function play(s, just, draw) {
  const g = new H.Game(rng(s)); g.tempoEnabled = true; g.comboEnabled = false;
  const ui = new H.UI(g, element('canvas')); const pr = rng(s * 7919);
  g.act(); g.angle = just ? 42 : 30; g.act(); g.power = just ? 0.99 : 0.9; g.act();
  let cur = null, glowFrames = 0, firstGlow = null, lastGlow = null;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) {
    if (g.special && g.special !== cur) { cur = g.special; if (pr() < 0.9) g.act(); }
    g.update(1 / 60); if (!draw) continue; ui.update(); circles = 0; ui.draw();
    if (circles) { glowFrames++; if (firstGlow === null) firstGlow = g.realTime; lastGlow = g.realTime; }
    if (g.state !== 'FLYING') assert.equal(circles, 0, 'no glow outside FLYING');
  }
  return { g, ui, glowFrames, firstGlow, lastGlow };
}
const fp = g => JSON.stringify({ ...JSON.parse(JSON.stringify(g)), fxEvents: null, soundEvent: null }); // UI-consumed queues
let justRuns = 0, plainRuns = 0;
for (let s = 1; s <= 30; s++) {
  for (const just of [true, false]) {
    const r = play(s, just, true); assert.equal(r.g.justLaunch, just);
    if (just) { assert(r.glowFrames > 0, 'seed ' + s + ' glow after JUST'); const span = r.lastGlow - r.firstGlow; if (r.g.realTime - r.firstGlow > c.justAfterglowTime + 0.1) assert(span <= c.justAfterglowTime && span > c.justAfterglowTime - 0.2, 'glow lasts justAfterglowTime: ' + span); justRuns++; }
    else { assert.equal(r.glowFrames, 0, 'seed ' + s + ' no glow without JUST'); plainRuns++; }
    assert.equal(fp(r.g), fp(play(s, just, false).g), 'seed ' + s + ': glow never changes the game');
  }
}
// fading: strength 1 at the pop, 0 after T, 0 outside FLYING
{ const v = { justGlowAt: 10 }; assert.equal(G.justGlow(v, { state: 'FLYING', realTime: 10 }), 1); assert(G.justGlow(v, { state: 'FLYING', realTime: 11 }) < 1); assert.equal(G.justGlow(v, { state: 'FLYING', realTime: 10 + c.justAfterglowTime }), 0); assert.equal(G.justGlow(v, { state: 'RESULT', realTime: 10.1 }), 0); }
console.log(JSON.stringify({ justAfterglow: 'PASS', justRuns, plainRuns }));
