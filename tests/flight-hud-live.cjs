// Cycle 78 (display only): FLYING readouts show live height/speed; idle/RESULT keep peaks.
// aria-live for merchant SUCCESS/MISS matches the on-screen MERCHANT titles (c74/c79 leftover).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    setAttribute(k, v) { this[k] = v; }, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {},
    classList: { _set: new Set(), toggle(name, on) { if (on) this._set.add(name); else this._set.delete(name); }, contains(name) { return this._set.has(name); } },
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
const H = scope.Hop, { Game, UI, CONFIG: c, STATES: S } = H;
let cases = 0;
function test(name, fn) { try { fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }

test('specialOutcomeLabel / specialPanelTitle mirror MERCHANT vs SPECIAL', () => {
  const mA = `商人 Type A / ${c.merchantNames.A}`;
  assert.equal(UI.specialOutcomeLabel({ label: 'SPECIAL SUCCESS', detail: mA }), 'MERCHANT SUCCESS');
  assert.equal(UI.specialOutcomeLabel({ label: 'SPECIAL SUCCESS', detail: '爆裂斜光' }), 'SPECIAL SUCCESS');
  assert.equal(UI.specialOutcomeLabel({ label: 'SPECIAL MISS', detail: mA }), 'MERCHANT MISS');
  assert.equal(UI.specialOutcomeLabel({ label: 'SPECIAL MISS', detail: 'x' }), 'SPECIAL MISS');
  assert.equal(UI.specialOutcomeLabel(null), '');
  assert.equal(UI.specialPanelTitle({ label: 'SPECIAL SUCCESS', detail: mA }), 'MERCHANT SUCCESS!');
  assert.equal(UI.specialPanelTitle({ label: 'SPECIAL SUCCESS', detail: '爆裂斜光' }), 'SPECIAL SUCCESS!');
  assert.equal(UI.specialPanelTitle({ label: 'SPECIAL MISS', detail: mA }), 'MERCHANT MISS');
  assert.equal(UI.specialPanelTitle({ label: 'SPECIAL MISS', detail: 'x' }), 'SPECIAL MISS');
  assert.equal(UI.specialPanelTitle(null), '');
});

test('FLYING shows live height/speed; labels switch; peaks restored off-flight', () => {
  const g = new Game(() => 0.99);
  g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new UI(g, element('canvas'));
  g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act();
  assert.equal(g.state, S.FLYING);
  g.body.y = 240; g.body.vx = 600; g.body.vy = 300;
  g.maxHeight = 900; g.maxSpeed = 2000;
  ui.update();
  const ppm = c.pixelsPerMeter;
  assert.equal(element('height').textContent, (240 / ppm).toFixed(1) + ' m');
  assert.equal(element('speed').textContent, (Math.hypot(600, 300) / ppm).toFixed(1) + ' m/s');
  assert.equal(element('height-label').textContent, 'HEIGHT / 現在高度');
  assert.equal(element('speed-label').textContent, 'SPEED / 現在速度');
  g.body.stopped = true; g.finish(); ui.update();
  assert.equal(g.state, S.RESULT);
  assert.equal(element('height').textContent, (900 / ppm).toFixed(1) + ' m');
  assert.equal(element('speed').textContent, (2000 / ppm).toFixed(1) + ' m/s');
  assert.equal(element('height-label').textContent, 'PEAK / 最高高度');
  assert.equal(element('speed-label').textContent, 'PEAK / 最高速度');
  assert.equal(element('result-height').textContent, (900 / ppm).toFixed(1) + ' m');
  assert.equal(element('result-speed').textContent, (2000 / ppm).toFixed(1) + ' m/s');
});

test('merchant SUCCESS announce uses MERCHANT SUCCESS', () => {
  const g = new Game(() => 0.99);
  g.launchCutinEnabled = false; g.comboEnabled = false;
  g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act();
  const ui = new UI(g, element('canvas')); ui.update();
  g.specialMessage = { label: 'SPECIAL SUCCESS', detail: `商人 Type B / ${c.merchantNames.B}`, remaining: c.specialMessageDuration };
  ui.notices = { special: null, message: null, charge: g.downCharge, guard: false, result: false };
  ui.updateQuality();
  const live = element('announcements').textContent;
  assert(live.includes('MERCHANT SUCCESS'), live);
  assert(live.includes(c.merchantNames.B), live);
  assert(!live.startsWith('SPECIAL SUCCESS'), live);
});

test('merchant MISS panel + announce use MERCHANT MISS', () => {
  const g = new Game(() => 0.99);
  g.launchCutinEnabled = false; g.comboEnabled = false;
  g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act();
  const ui = new UI(g, element('canvas')); ui.update();
  const detail = `商人 Type C / ${c.merchantNames.C}`;
  g.specialMessage = { label: 'SPECIAL MISS', detail, remaining: c.specialMessageDuration };
  Object.defineProperty(g.specialMessage, 'missOutcome', { value: 'normal' });
  Object.defineProperty(g.specialMessage, 'missType', { value: 'BOOST' });
  ui.notices = { special: null, message: null, charge: g.downCharge, guard: false, result: false };
  ui.update();
  assert.equal(element('special-title').textContent, 'MERCHANT MISS');
  assert(element('special-detail').textContent.includes(detail), element('special-detail').textContent);
  ui.notices = { special: null, message: null, charge: g.downCharge, guard: false, result: false };
  ui.updateQuality();
  const live = element('announcements').textContent;
  assert(live.includes('MERCHANT MISS'), live);
  assert(live.includes(c.merchantNames.C), live);
  assert(!live.startsWith('SPECIAL MISS'), live);
});

test('html pins height-label / speed-label; peak SPEED wording', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(html.includes('id="height-label"'));
  assert(html.includes('id="speed-label"'));
  assert(html.includes('PEAK / 最高速度'));
  assert(html.includes('PEAK / 最高高度'));
});

// Cycle 81: RESULT grid matches HUD peak wording (PEAK, not MAX).
test('RESULT peak height/speed labels use PEAK not MAX', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const block = html.match(/<section id="result-stats"[\s\S]*?<\/section>/)[0];
  assert(block.includes('PEAK HEIGHT / 最高高度'), block);
  assert(block.includes('PEAK SPEED / 最高速度'), block);
  assert(!block.includes('MAX HEIGHT'), block);
  assert(!block.includes('MAX SPEED'), block);
});

// Cycle 82: RESULT primary FINAL + AERIAL DOWN aria match the other HUD copies.
test('RESULT FINAL DISTANCE and AERIAL DOWN aria align', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const block = html.match(/<section id="result-stats"[\s\S]*?<\/section>/)[0];
  assert(block.includes('FINAL DISTANCE / 最終飛距離'), block);
  assert(!/FINAL DISTANCE \/ 飛距離</.test(block), block);
  assert(html.includes('FINAL / 最終飛距離'));
  const aerial = [...html.matchAll(/id="(?:down-charge|aerial-hud-charge)"[^>]*aria-label="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(aerial, ['AERIAL DOWN充電率', 'AERIAL DOWN充電率'], aerial);
  assert(!html.includes('aria-label="DOWN充電率"'));
});

console.log(JSON.stringify({ flightHudLive: 'PASS', cases }));
