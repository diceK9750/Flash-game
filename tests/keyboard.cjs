// Keyboard path (2026-10-17 auto cycle 22). Audit: the game was pointer only (only D / debug keys were bound), so it
// could not be played without a pointer. Now Space / Enter = one tap (same handler path as the stage pointerdown);
// focused controls keep their own keys; repeat / modifier keys ignored; hints mention Space. Same seed -> same game.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('<p id="hint">画面をタップ / クリック / Space</p>') && html.includes('Space / Enterキー'), 'hints mention the keys');
function boot(seed) {
  const L = {}, els = new Map();
  const element = id => { if (!els.has(id)) els.set(id, { id, setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, addEventListener: (t, f) => { (L[id + ':' + t] ||= []).push(f); }, width: 1280, height: 720, getBoundingClientRect: () => ({ width: 1280, height: 720 }), getContext: () => new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) }) }); return els.get(id); };
  const scope = { document: { getElementById: element, addEventListener: (t, f) => { (L['doc:' + t] ||= []).push(f); } }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 1 };
  scope.window = scope; vm.createContext(scope);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
  const H = scope.Hop; let s = seed; const g = new H.Game(() => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)); g.tempoEnabled = true;
  const ui = new H.UI(g, element('canvas')); H.bindInput(g, ui);
  let prevented = 0;
  const key = (code, extra = {}) => L['doc:keydown'].forEach(f => f({ code, repeat: false, target: { tagName: 'BODY' }, preventDefault: () => prevented++, ...extra }));
  const tap = () => L['stage:pointerdown'].forEach(f => f({ button: 0, isPrimary: true, preventDefault() {} }));
  return { H, g, ui, key, tap, prevented: () => prevented };
}
{ const b = boot(1); assert.equal(b.g.state, 'READY');
  b.key('Space'); assert.equal(b.g.state, 'AIM_ANGLE', 'Space = tap'); assert.equal(b.prevented(), 1, 'no page scroll');
  b.key('Space', { repeat: true }); assert.equal(b.g.state, 'AIM_ANGLE', 'repeat ignored');
  b.key('Enter', { ctrlKey: true }); assert.equal(b.g.state, 'AIM_ANGLE', 'modifier ignored');
  b.key('Enter', { target: { tagName: 'BUTTON' } }); assert.equal(b.g.state, 'AIM_ANGLE', 'focused button keeps Enter');
  b.key('KeyA'); assert.equal(b.g.state, 'AIM_ANGLE', 'other keys ignored');
  b.key('Enter'); assert.equal(b.g.state, 'AIM_POWER', 'Enter = tap'); b.key('NumpadEnter'); assert.equal(b.g.state, 'FLYING');
  b.ui.openDebugMenu?.(); if (b.ui.debugMenuOpen) { const st = b.g.state; b.key('Space'); assert.equal(b.g.state, st, 'debug menu open: no tap'); }
}
assert.equal(boot(1).H.isTapKey({ code: 'Space', target: { tagName: 'DIV', isContentEditable: true } }), false);
// A full run played by keys equals the same run played by pointer taps (same seed, same tap frames).
for (const seed of [3, 8, 21]) {
  const runs = ['key', 'tap'].map(mode => { const b = boot(seed), press = () => mode === 'key' ? b.key('Space') : b.tap();
    press(); for (let i = 0; i < 40; i++) b.g.update(1 / 60); press(); for (let i = 0; i < 25; i++) b.g.update(1 / 60); press();
    for (let i = 0; i < 60 * 300 && b.g.state === 'FLYING'; i++) { if (i % 47 === 0 || b.g.special) press(); b.g.update(1 / 60); b.ui.update(); }
    return JSON.stringify({ ...JSON.parse(JSON.stringify(b.g)), fxEvents: null, soundEvent: null }); });
  assert.equal(runs[0], runs[1], 'seed ' + seed + ': keyboard run == pointer run');
}
console.log(JSON.stringify({ keyboard: 'PASS' }));
