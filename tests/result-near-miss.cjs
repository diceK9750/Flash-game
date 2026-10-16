// RESULT near-miss line (2026-10-16 auto cycle 08): "ランク A · あと 312m で S" / "最高ランク SSS 到達！" under the RESULT
// detail line, from the same table as the stamp (UI.nextRank -> Game.rank). Tempo mode reveals it together with the
// stamp (no spoiler before the stamp SE); otherwise shown at once. Static text, display only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { setAttribute(k, v) { this[k] = v; }, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {},
    classList: { toggle() {} }, addEventListener() {},
    getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } });
  return elements.get(id);
}
const store = {};
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {},
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
scope.window = scope; vm.createContext(scope);
for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), scope, { filename: name });
const H = scope.Hop, { Game, UI, STATES: S } = H;
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// text
assert.equal(UI.nearMissHtml(UI.nextRank(9688.4)), 'ランク A · あと <b>312m</b> で S');
assert.equal(UI.nearMissHtml(UI.nextRank(0)), 'ランク D · あと <b>1200m</b> で C');
assert.equal(UI.nearMissHtml(UI.nextRank(20000)), '最高ランク <b>SSS</b> 到達！');
assert.equal(UI.nearMissHtml(null), '');
assert(/id="overlay-next" class="overlay-next" hidden/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
assert(!/\.overlay-next[^{]*\{[^}]*(animation|transition)/.test(fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8')), 'static');
function play(tempo, seed) {
  const g = new Game(rng(seed)); g.tempoEnabled = tempo; g.launchCutinEnabled = false;
  const ui = new UI(g, element('canvas'));
  g.act(); ui.update(); g.angle = 40; g.act(); ui.update(); g.power = 0.9; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); }
  assert.equal(g.state, S.RESULT); return { g, ui };
}
const next = element('overlay-next'), stamp = element('result-rank');
{ // tempo: hidden until the stamp shows, then the truthful text
  const { g, ui } = play(true, 4); ui.update();
  const want = UI.nearMissHtml(UI.nextRank(g.finalDistance));
  assert.equal(next.innerHTML, want); assert.equal(next.hidden, stamp.hidden, 'revealed with the stamp');
  for (let i = 0; i < 60; i++) { g.update(1 / 60); ui.update(); assert.equal(next.hidden, stamp.hidden, 'never before the stamp'); }
  assert.equal(stamp.hidden, false); assert.equal(next.hidden, false);
  assert(want.startsWith('ランク ' + stamp.textContent + ' ') || want.includes('<b>' + stamp.textContent + '</b>'), 'same rank as the stamp');
  g.act(); ui.update(); assert.equal(g.state, S.AIM_ANGLE); assert.equal(next.hidden, true); assert.equal(next.innerHTML, '');
}
{ // overlay still fading in (stamp pending): the line stays hidden, then appears with the stamp
  const T = UI.tempoOverlayAlpha; UI.tempoOverlayAlpha = () => 0.4;
  const { g, ui } = play(true, 6); ui.update();
  assert.equal(stamp.hidden, true); assert.equal(next.hidden, true, 'hidden while the stamp is pending');
  UI.tempoOverlayAlpha = T; for (let i = 0; i < 5; i++) { g.update(1 / 60); ui.update(); }
  assert.equal(stamp.hidden, false); assert.equal(next.hidden, false);
}
{ // no tempo (no stamp): shown at once
  const { g, ui } = play(false, 9); ui.update();
  assert.equal(next.hidden, false); assert.equal(next.innerHTML, UI.nearMissHtml(UI.nextRank(g.finalDistance)));
}
console.log(JSON.stringify({ resultNearMiss: 'PASS' }));
