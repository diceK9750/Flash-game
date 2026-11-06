// Portrait RESULT summary + NEW RECORD type labels (cycle 48 + cycle 72). After landing on portrait phones the
// result panel (NEW RECORD / BEST comparison) started at 682-765 px: 0-37% on screen without scrolling. Now a
// one-line mirror #result-summary ("<record-status> · DISTANCE 今回 X m / BEST Y m") sits under the status row
// (CSS only inside the cycle-45 portrait-phone block). Cycle 72: record-status names the updated keys in Japanese
// (飛距離 / 高さ / 速度), .overlay.new-record fires for any non-DEBUG record (not distance-only), and
// best-comparison marks ★更新 on the matching lines.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { setAttribute(k, v) { this[k] = v; }, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {},
    classList: { _set: new Set(), toggle(name, on) { if (on) this._set.add(name); else this._set.delete(name); }, contains(name) { return this._set.has(name); } },
    addEventListener() {},
    getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } });
  return elements.get(id);
}
const store = {};
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {},
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
scope.window = scope; vm.createContext(scope);
for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8').replace(/\r\n?/g, '\n'), scope, { filename: name });
const H = scope.Hop, { Game, UI, STATES: S } = H;
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function play(tempo, seed) {
  const g = new Game(rng(seed)); g.tempoEnabled = tempo; g.launchCutinEnabled = false;
  const ui = new UI(g, element('canvas'));
  g.act(); ui.update(); g.angle = 40; g.act(); ui.update(); g.power = 0.9; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); }
  assert.equal(g.state, S.RESULT); return { g, ui };
}
const sum = element('result-summary'), rec = element('record-status'), cmp = element('best-comparison'), ov = element('overlay');
// Cycle 74: portrait summary may append " · 🎒Type X · name" after a merchant meeting.
function summaryBase(g, recText) {
  return `${recText} · DISTANCE 今回 ${g.finalDistance.toFixed(1)} m / BEST ${g.best.distance.toFixed(1)} m`;
}
function expectedSummary(g, recText) {
  const base = summaryBase(g, recText);
  const met = g.debugUsed || g.merchantStats.attempts > 0 || g.merchantStats.successes > 0;
  return base + (met && g.merchantStats.lastType ? ` · 🎒${UI.merchantTypeLabel(g.merchantStats.lastType)}` : '');
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n?/g, '\n'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8').replace(/\r\n?/g, '\n');
assert(/<p id="special-state"[^>]*><\/p>\n    <p id="result-summary" class="result-summary" hidden aria-hidden="true"><\/p>/.test(html), 'markup after the SPECIAL line, aria-hidden');
assert(/\n\.result-summary \{ display: none; \}/.test(css), 'not displayed outside portrait phones');
const P = css.slice(css.indexOf('@media (orientation: portrait) and (max-width: 600px) {')); const pb = P.slice(0, P.indexOf('\n}\n'));
assert(/main > \.result-summary:not\(\[hidden\]\) \{ display: block; order: -1;/.test(pb), 'portrait block shows it under the status row');
assert.equal((css.match(/\.result-summary/g) || []).length, 2, 'no other rules');
assert(!/result-summary[^{]*\{[^}]*(animation|transition|transform)/.test(css), 'static');
const labelRe = '(?: · (?:飛距離|高さ|速度))+';
const recordHead = `^(?:NEW RECORD!${labelRe}|FLIGHT RECORD)`;
const texts = [];
for (const [tempo, seed] of [[true, 4], [false, 9], [true, 6]]) {
  const { g, ui } = play(tempo, seed); ui.update();
  assert.equal(sum.hidden, false, 'shown in RESULT');
  assert(sum.textContent.startsWith(rec.textContent + ' · ' + cmp.textContent.split('\n')[0].replace(/ ★更新$/, '')), 'same texts as the panel (summary keeps distance line without ★)');
  // Summary always mirrors record-status + DISTANCE line (without the ★更新 marker).
  assert.equal(sum.textContent, expectedSummary(g, rec.textContent));
  assert(new RegExp(recordHead + ' · DISTANCE 今回 \\d+\\.\\d m \\/ BEST \\d+\\.\\d m').test(sum.textContent), sum.textContent);
  if (g.newRecords.length) {
    assert(rec.textContent.startsWith('NEW RECORD! · '), rec.textContent);
    for (const k of g.newRecords) assert(rec.textContent.includes(UI.RECORD_LABELS[k]), rec.textContent + ' missing ' + k);
    assert(ov.classList.contains('new-record'), 'flourish for any record');
    for (const line of cmp.textContent.split('\n')) {
      const key = line.startsWith('DISTANCE') ? 'distance' : line.startsWith('HEIGHT') ? 'height' : 'speed';
      assert.equal(line.endsWith(' ★更新'), g.newRecords.includes(key), line);
    }
  } else {
    assert.equal(rec.textContent, 'FLIGHT RECORD');
    assert(!ov.classList.contains('new-record'));
    assert(!cmp.textContent.includes('★更新'));
  }
  texts.push(sum.textContent);
  // RETRY: hidden and empty through AIM / FLYING, fresh text at the next RESULT
  g.act(); ui.update(); assert.equal(g.state, S.AIM_ANGLE); assert.equal(sum.hidden, true); assert.equal(sum.textContent, '');
  assert(!ov.classList.contains('new-record'), 'flourish cleared outside RESULT');
  g.angle = 40; g.act(); ui.update(); g.power = 0.7; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); if (g.state !== S.RESULT) { assert.equal(sum.hidden, true, 'never in flight'); assert.equal(sum.textContent, ''); } }
  assert.equal(g.state, S.RESULT); ui.update(); assert.equal(sum.hidden, false);
  assert.equal(sum.textContent, expectedSummary(g, rec.textContent), 'updated at the second RESULT');
  assert(sum.textContent.includes(`今回 ${g.finalDistance.toFixed(1)} m`), 'second run distance');
}
{ // DEBUG play wording, same as the panel
  const g = new Game(rng(11)); g.launchCutinEnabled = false; const ui = new UI(g, element('canvas'));
  g.debugUsed = true; g.act(); ui.update(); g.angle = 40; g.act(); ui.update(); g.power = 0.8; g.act(); ui.update();
  for (let i = 0; i < 60 * 300 && g.state === S.FLYING; i++) { if (g.special) g.act(); g.update(1 / 60); ui.update(); }
  ui.update(); assert(sum.textContent.startsWith('DEBUG PLAY / 記録対象外 · DISTANCE 今回 '), sum.textContent);
  assert(!ov.classList.contains('new-record'), 'DEBUG never flourishes');
}
{ // determinism: same seed -> same summary
  for (const k in store) delete store[k];
  const a = play(false, 9); a.ui.update(); const t1 = sum.textContent;
  for (const k in store) delete store[k];
  const b = play(false, 9); b.ui.update(); assert.equal(sum.textContent, t1, 'same seed, same text');
}
// Cycle 72 unit cases: distance-only / height-only / speed-only / multi / none (no full flight).
function finishCase(best, score) {
  for (const k in store) delete store[k];
  store[H.CONFIG.storageKey] = JSON.stringify(best);
  const g = new Game(rng(1)); g.launchCutinEnabled = false; g.tempoEnabled = false;
  Object.assign(g.body, { x: score.distance * H.CONFIG.pixelsPerMeter, bounces: 0 });
  g.maxHeight = score.height * H.CONFIG.pixelsPerMeter; g.maxSpeed = score.speed * H.CONFIG.pixelsPerMeter;
  g.state = S.FLYING; g.finish();
  const ui = new UI(g, element('canvas')); ui.update();
  return { g, ui, rec: element('record-status'), cmp: element('best-comparison'), ov: element('overlay'), sum: element('result-summary') };
}
{
  const { g, rec, cmp, ov, sum } = finishCase({ distance: 10, height: 10, speed: 10 }, { distance: 50, height: 5, speed: 5 });
  assert.deepEqual([...g.newRecords], ['distance']);
  assert.equal(rec.textContent, 'NEW RECORD! · 飛距離');
  assert(ov.classList.contains('new-record'));
  assert(cmp.textContent.split('\n')[0].endsWith(' ★更新'));
  assert(!cmp.textContent.split('\n')[1].includes('★'));
  assert.equal(sum.textContent, 'NEW RECORD! · 飛距離 · DISTANCE 今回 50.0 m / BEST 50.0 m');
}
{
  const { g, rec, cmp, ov } = finishCase({ distance: 100, height: 10, speed: 10 }, { distance: 50, height: 40, speed: 5 });
  assert.deepEqual([...g.newRecords], ['height']);
  assert.equal(rec.textContent, 'NEW RECORD! · 高さ');
  assert(ov.classList.contains('new-record'), 'height-only also flourishes');
  assert(cmp.textContent.split('\n')[1].endsWith(' ★更新'));
  assert(!cmp.textContent.split('\n')[0].includes('★'));
}
{
  const { g, rec, ov, cmp } = finishCase({ distance: 100, height: 50, speed: 10 }, { distance: 50, height: 40, speed: 80 });
  assert.deepEqual([...g.newRecords], ['speed']);
  assert.equal(rec.textContent, 'NEW RECORD! · 速度');
  assert(ov.classList.contains('new-record'), 'speed-only also flourishes');
  assert(cmp.textContent.split('\n')[2].endsWith(' ★更新'));
}
{
  const { g, rec, cmp, ov } = finishCase({ distance: 10, height: 10, speed: 10 }, { distance: 50, height: 40, speed: 80 });
  assert.deepEqual([...g.newRecords], ['distance', 'height', 'speed']);
  assert.equal(rec.textContent, 'NEW RECORD! · 飛距離 · 高さ · 速度');
  assert(ov.classList.contains('new-record'));
  assert.equal(cmp.textContent.split('\n').filter(l => l.includes('★更新')).length, 3);
}
{
  const { g, rec, ov, cmp } = finishCase({ distance: 100, height: 50, speed: 80 }, { distance: 50, height: 40, speed: 70 });
  assert.deepEqual([...g.newRecords], []);
  assert.equal(rec.textContent, 'FLIGHT RECORD');
  assert(!ov.classList.contains('new-record'));
  assert(!cmp.textContent.includes('★更新'));
}
// Short-screen wrap budget: longest record line + big metres still fits 2 lines at 360px (c48 overflow-wrap).
{
  const long = 'NEW RECORD! · 飛距離 · 高さ · 速度 · DISTANCE 今回 20000.0 m / BEST 20000.0 m';
  assert(long.length <= 72, 'kept short enough for 2-line wrap at 12px/360px');
  assert(/overflow-wrap:\s*anywhere/.test(pb), 'portrait summary still wraps');
}
console.log(JSON.stringify({ resultSummary: 'PASS', examples: texts }));
