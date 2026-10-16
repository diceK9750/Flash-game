// Accessibility colour-cue audit (2026-10-17 auto cycle 21). Colour-coded cues checked: SPECIAL READY targets (text
// label), 先見 hint (text 先見), JUST zone (JUST tag) / JUST! pop (text), GUARD HUD (text), rank stamps (letters),
// MISS / SUCCESS panel (text). Gap found: the hero guard ring told GUARD (purple) from 聖護結界 (gold) mainly by colour.
// Now shape + text too: GUARD = one solid ring + "GUARD" tag; 聖護結界 = + inner dashed ring + "聖護結界" tag. Display only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mk = () => { const calls = { text: [], dash: 0, arcs: 0 }; const o = { calls }; return new Proxy(o, { get: (t, k) => k in t ? t[k] : k === 'fillText' ? s => calls.text.push(s) : k === 'setLineDash' ? a => { if (a.length) calls.dash++; } : k === 'arc' ? () => calls.arcs++ : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => (t[k] = v, true) }); };
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, width: 1280, height: 720, getBoundingClientRect: () => ({ width: 1280, height: 720 }), getContext: mk }); return els.get(id); };
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const G = scope.Hop.Graphics;
{ const c = mk(); assert.equal(G.guardCue(c, 100, 100, false), 'GUARD'); assert.deepEqual(c.calls.text, ['GUARD']); assert.equal(c.calls.dash, 0); assert.equal(c.calls.arcs, 1); }
{ const c = mk(); assert.equal(G.guardCue(c, 100, 100, true), '聖護結界'); assert.deepEqual(c.calls.text, ['聖護結界']); assert.equal(c.calls.dash, 1, 'dashed inner ring'); assert.equal(c.calls.arcs, 2); }
// Drawn in play: a FLYING hero with normal GUARD / active 聖護結界 shows the matching tag through the real draw path.
const rng = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
let seenGuard = 0, seenSpecial = 0;
for (let s = 1; s <= 60 && !(seenGuard && seenSpecial); s++) {
  const g = new scope.Hop.Game(rng(s)); g.tempoEnabled = true; g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new scope.Hop.UI(g, element('canvas')); const pr = rng(s * 7919);
  g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act();
  let cur = null;
  for (let i = 0; i < 60 * 300 && g.state === 'FLYING'; i++) {
    if (g.special && g.special !== cur) { cur = g.special; if (pr() < 0.9) g.act(); }
    g.update(1 / 60); ui.update();
    if (i % 3) continue;
    const cue = G.guardCue; let got = null; G.guardCue = (...a) => (got = cue.apply(G, a)); ui.draw(); G.guardCue = cue;
    const want = g.state === 'FLYING' && (g.normalGuard || g.guardSpecial.active) ? (g.guardSpecial.active ? '聖護結界' : 'GUARD') : null;
    if (want && !g.launchCutin && !g.combo && !g.specialCutin) { assert.equal(got, want, 'seed ' + s); want === 'GUARD' ? seenGuard++ : seenSpecial++; }
  }
}
assert(seenGuard > 0 && seenSpecial > 0, JSON.stringify({ seenGuard, seenSpecial }));
console.log(JSON.stringify({ a11yGuardCue: 'PASS', seenGuard, seenSpecial }));
