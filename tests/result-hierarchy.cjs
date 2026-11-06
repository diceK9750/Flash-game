// Cycle 77: RESULT panel visual hierarchy (display/CSS/UI only).
// Scan order: record banner → primary FINAL → merchant → comparison → muted narrative.
// Physics / SPECIAL balance / merchantChance / record rules must stay untouched.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    setAttribute(k, v) { this[k] = v; }, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, className: '',
    classList: { _set: new Set(), toggle(name, on) { if (on) this._set.add(name); else this._set.delete(name); this._sync(); }, contains(name) { return this._set.has(name); },
      _sync() { /* className is written directly by ui.js for record-status */ } },
    addEventListener() {},
    getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); }
  });
  return elements.get(id);
}
const store = {};
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {},
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
scope.window = scope; vm.createContext(scope);
for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input'])
  vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8').replace(/\r\n?/g, '\n'), scope, { filename: name });
const H = scope.Hop, { Game, UI, CONFIG: c } = H;
let cases = 0;
function test(name, fn) { try { fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
function flying() {
  const g = new Game(() => 0.99);
  g.launchCutinEnabled = false; g.comboEnabled = false;
  g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act();
  return g;
}

test('DOM scan order: record → grid(primary) → merchant → comparison → narrative', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const block = html.match(/<section id="result-stats"[\s\S]*?<\/section>/)[0];
  const ids = [...block.matchAll(/id="([^"]+)"/g)].map(m => m[1]).filter(id => id !== 'result-stats');
  assert.deepEqual(ids.slice(0, 7), [
    'record-status', 'result-distance', 'result-best', 'result-height', 'result-speed',
    'merchant-totals', 'best-comparison'
  ]);
  assert(ids.indexOf('merchant-totals') < ids.indexOf('result-highlights'));
  assert(ids.indexOf('best-comparison') < ids.indexOf('result-highlights'));
  assert(ids.indexOf('best-comparison') < ids.indexOf('contact-totals'));
  assert(/class="result-primary"/.test(block));
  assert(block.includes('PEAK HEIGHT / 最高高度'));
  assert(block.includes('PEAK SPEED / 最高速度'));
  assert(!block.includes('MAX HEIGHT'));
  assert(!block.includes('MAX SPEED'));
  // Cycle 82: primary FINAL matches overlay / side final-line (最終飛距離).
  assert(block.includes('FINAL DISTANCE / 最終飛距離'));
  assert(!/FINAL DISTANCE \/ 飛距離</.test(block));
});

test('CSS hierarchy rules + merchant pin preserved', () => {
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert(css.includes('.result-grid .result-primary'));
  assert(css.includes('#record-status.is-new-record'));
  assert(css.includes('#merchant-totals { color: #a16207; font-weight: 700; }'));
  assert(css.includes('#merchant-totals:not([hidden])'));
  assert(css.includes('#best-comparison { font-size: 13px; color: #5b6b58;'));
  assert(css.includes('#contact-totals, #type-counts, #storage-status'));
});

test('record-status classes: NEW RECORD / FLIGHT / DEBUG', () => {
  const g = flying();
  const ui = new UI(g, element('canvas'));
  const rec = element('record-status');
  g.body.x = 5000; g.maxHeight = 400; g.maxSpeed = 900; g.best = { distance: 10, height: 1, speed: 1 };
  g.finish(); ui.update();
  assert.equal(rec.className, 'is-new-record');
  assert(rec.textContent.startsWith('NEW RECORD!'));

  g.act(); ui.update();
  g.best = { distance: 99999, height: 99999, speed: 99999 };
  g.debugUsed = false;
  Object.assign(g.body, { x: 50, y: 0, grounded: true });
  g.maxHeight = 5; g.maxSpeed = 5;
  g.finish(); ui.update();
  assert.equal(rec.textContent, 'FLIGHT RECORD');
  assert.equal(rec.className, 'is-flight-record');

  g.act(); ui.update();
  g.debugUsed = true;
  Object.assign(g.body, { x: 50, y: 0, grounded: true });
  g.maxHeight = 5; g.maxSpeed = 5;
  g.finish(); ui.update();
  assert(rec.textContent.includes('記録対象外'), rec.textContent);
  assert.equal(rec.className, 'is-debug-record');
});

test('balance pins untouched (merchantChance / Type A-D)', () => {
  assert.equal(c.merchantChance, 0.10);
  assert.equal(c.typeAUses, 12);
  assert.equal(c.typeAMultiplier, 3.2);
  assert.equal(c.typeBBaseSpeed, 1400);
  assert.equal(c.typeBChargeBonus, 200);
  assert.equal(c.typeCCount, 72);
  assert.equal(c.typeDBounces, 17);
  assert.equal(c.typeDMultiplier, 1.38);
});

console.log(JSON.stringify({ resultHierarchy: 'PASS', cases }));
