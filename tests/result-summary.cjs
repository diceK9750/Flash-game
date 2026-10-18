// Portrait RESULT summary (2026-10-18 auto cycle 48). After landing on portrait phones the result panel (NEW RECORD /
// BEST comparison) started at 682-765 px: 0-37% on screen without scrolling. Now a one-line mirror #result-summary
// ("<record-status> · DISTANCE 今回 X m / BEST Y m", the panel's own texts) sits under the status row, displayed by CSS
// only inside the cycle-45 portrait-phone block (display: none everywhere else, so desktop / tablet / landscape are
// unchanged). Checks: text = record-status + the first best-comparison line, shown only in RESULT, emptied + hidden in
// READY / AIM / FLYING and across RETRY (no stale text), DEBUG wording, aria-hidden (no duplicate for screen readers),
// static CSS, deterministic (same seed -> same text).
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
function play(tempo, seed) {
  const g = new Game(rng(seed)); g.tempoEnabled = tempo; g.launchCutinEnabled = false;
  const ui = new UI(g, element('canvas'));
  g.act(); ui.update(); g.angle = 40; g.act(); ui.update(); g.power = 0.9; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); }
  assert.equal(g.state, S.RESULT); return { g, ui };
}
const sum = element('result-summary'), rec = element('record-status'), cmp = element('best-comparison');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
assert(/<p id="special-state"[^>]*><\/p>\n    <p id="result-summary" class="result-summary" hidden aria-hidden="true"><\/p>/.test(html), 'markup after the SPECIAL line, aria-hidden');
assert(/\n\.result-summary \{ display: none; \}/.test(css), 'not displayed outside portrait phones');
const P = css.slice(css.indexOf('@media (orientation: portrait) and (max-width: 600px) {')); const pb = P.slice(0, P.indexOf('\n}\n'));
assert(/main > \.result-summary:not\(\[hidden\]\) \{ display: block; order: -1;/.test(pb), 'portrait block shows it under the status row');
assert.equal((css.match(/\.result-summary/g) || []).length, 2, 'no other rules');
assert(!/result-summary[^{]*\{[^}]*(animation|transition|transform)/.test(css), 'static');
const texts = [];
for (const [tempo, seed] of [[true, 4], [false, 9], [true, 6]]) {
  const { g, ui } = play(tempo, seed); ui.update();
  assert.equal(sum.hidden, false, 'shown in RESULT');
  assert.equal(sum.textContent, rec.textContent + ' · ' + cmp.textContent.split('\n')[0], 'same texts as the panel');
  assert(/^(NEW RECORD!|FLIGHT RECORD) · DISTANCE 今回 \d+\.\d m \/ BEST \d+\.\d m$/.test(sum.textContent), sum.textContent);
  texts.push(sum.textContent);
  // RETRY: hidden and empty through AIM / FLYING, fresh text at the next RESULT
  g.act(); ui.update(); assert.equal(g.state, S.AIM_ANGLE); assert.equal(sum.hidden, true); assert.equal(sum.textContent, '');
  g.angle = 40; g.act(); ui.update(); g.power = 0.7; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); if (g.state !== S.RESULT) { assert.equal(sum.hidden, true, 'never in flight'); assert.equal(sum.textContent, ''); } }
  assert.equal(g.state, S.RESULT); ui.update(); assert.equal(sum.hidden, false);
  assert.equal(sum.textContent, rec.textContent + ' · ' + cmp.textContent.split('\n')[0], 'updated at the second RESULT');
  assert(sum.textContent.includes(`今回 ${g.finalDistance.toFixed(1)} m`), 'second run distance');
}
{ // DEBUG play wording, same as the panel
  const g = new Game(rng(11)); g.launchCutinEnabled = false; const ui = new UI(g, element('canvas'));
  g.debugUsed = true; g.act(); ui.update(); g.angle = 40; g.act(); ui.update(); g.power = 0.8; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); }
  ui.update(); assert(sum.textContent.startsWith('DEBUG PLAY / 記録対象外 · DISTANCE 今回 '), sum.textContent);
}
{ // determinism: same seed -> same summary
  for (const k in store) delete store[k];
  const a = play(false, 9); a.ui.update(); const t1 = sum.textContent;
  for (const k in store) delete store[k];
  const b = play(false, 9); b.ui.update(); assert.equal(sum.textContent, t1, 'same seed, same text');
}
console.log(JSON.stringify({ resultSummary: 'PASS', examples: texts }));
