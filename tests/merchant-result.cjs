// Cycle 74 (display only): merchant RESULT / SUCCESS polish — Type·name labels, MERCHANT SUCCESS!,
// merchant-met overlay, portrait summary suffix. Does not touch merchantChance / Type A–D balance.
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
function flying() {
  const g = new Game(() => 0.99); // high RNG → merchant draw miss unless DEBUG
  g.launchCutinEnabled = false; g.comboEnabled = false;
  g.act(); g.angle = 40; g.act(); g.power = 0.9; g.act();
  return g;
}

test('merchantTypeLabel / FromDetail / Helped / Totals helpers', () => {
  for (const t of 'ABCD') {
    assert.equal(UI.merchantTypeLabel(t), `Type ${t} · ${c.merchantNames[t]}`);
    assert.equal(UI.merchantTypeFromDetail(`商人 Type ${t} / ${c.merchantNames[t]}`), t);
  }
  assert.equal(UI.merchantTypeFromDetail('聖護結界'), null);
  assert.equal(UI.merchantTypeFromDetail(''), null);
  assert.equal(UI.merchantHelpedText(['B', 'A']), `商人 Type B→A · ${c.merchantNames.B}→${c.merchantNames.A}`);
  const g = { merchantStats: { attempts: 1, successes: 1, lastType: 'C', revives: 0 } };
  assert.equal(UI.merchantTotalsText(g), `商人SPECIAL発生 1 / 成功 1 / 最終 Type C · ${c.merchantNames.C} / 復活 0`);
});

test('highlights include Type · item name', () => {
  const h = UI.highlights({ history: [{ type: 'DASH', label: 'DASH / MERCHANT TYPE B' }] });
  assert.equal(h[0], `🎒 商人 Type B · ${c.merchantNames.B}`);
});

test('MERCHANT SUCCESS! title on resolve', () => {
  const g = flying(); const ui = new UI(g, element('canvas')); ui.update();
  g.special = {
    type: 'BOUNCE', merchantType: 'A', partner: null, remaining: c.specialWindow,
    entry: { type: 'BOUNCE', label: 'BOUNCE' }, guardAtContact: 0, velocity: { vx: g.body.vx, vy: g.body.vy }
  };
  g.act(); ui.update();
  assert.equal(element('special-title').textContent, 'MERCHANT SUCCESS!');
  assert.equal(element('special-detail').textContent, `商人 Type A / ${c.merchantNames.A}`);
});

test('RESULT merchant-totals + merchant-met + summary backpack', () => {
  const g = flying(); const ui = new UI(g, element('canvas')); ui.update();
  g.merchantStats = { attempts: 1, successes: 1, lastType: 'D', revives: 2 };
  g.history = [{ type: 'BOUNCE', label: 'BOUNCE / MERCHANT TYPE D' }];
  g.debugUsed = false; g.body.stopped = true; g.finish(); ui.update();
  assert.equal(g.state, S.RESULT);
  assert.equal(element('merchant-totals').hidden, false);
  assert.equal(element('merchant-totals').textContent, UI.merchantTotalsText(g));
  assert(element('overlay').classList.contains('merchant-met'), 'merchant-met class');
  assert(element('result-summary').textContent.includes(`🎒Type D · ${c.merchantNames.D}`), element('result-summary').textContent);
  assert(element('result-highlights').textContent.includes(`商人 Type D · ${c.merchantNames.D}`));
  assert(element('result-helped').textContent.includes(`商人 Type D · ${c.merchantNames.D}`));
});

test('DEBUG RESULT: totals shown, merchant-met flourish off', () => {
  const g = flying(); const ui = new UI(g, element('canvas')); ui.update();
  g.debugUsed = true; g.merchantStats = { attempts: 1, successes: 1, lastType: 'A', revives: 0 };
  g.body.stopped = true; g.finish(); ui.update();
  assert.equal(element('merchant-totals').hidden, false);
  assert(!element('overlay').classList.contains('merchant-met'), 'no flourish on DEBUG');
});

test('no merchant: totals hidden, no merchant-met, no summary backpack', () => {
  const g = flying(); const ui = new UI(g, element('canvas')); ui.update();
  g.body.stopped = true; g.finish(); ui.update();
  assert.equal(element('merchant-totals').hidden, true);
  assert.equal(element('merchant-totals').textContent, '');
  assert(!element('overlay').classList.contains('merchant-met'));
  assert(!element('result-summary').textContent.includes('🎒'), element('result-summary').textContent);
});

test('css has merchant-met / merchant-totals polish; config numbers untouched', () => {
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert(css.includes('.overlay.merchant-met:not(.new-record)'));
  assert(css.includes('#merchant-totals { color: #a16207; font-weight: 700; }'));
  // Pinned to shipped cycle-33+ merchant balance (display polish must not drift these).
  assert.equal(c.merchantChance, 0.10);
  assert.equal(c.typeAUses, 12);
  assert.equal(c.typeAMultiplier, 3.2);
  assert.equal(c.typeBBaseSpeed, 1400);
  assert.equal(c.typeBChargeBonus, 200);
  assert.equal(c.typeCCount, 72);
  assert.equal(c.typeDBounces, 17);
  assert.equal(c.typeDMultiplier, 1.38);
  assert.equal(c.merchantFlourishDuration, 1.9);
  assert.equal(c.merchantCoinCount, 26);
});

console.log(JSON.stringify({ merchantResult: 'PASS', cases }));
