// RESULT "what helped" line (2026-10-16 auto cycle 09). Audit found the counters truthful but the RESULT text
// incomplete: highlights keep 3 unique items without counts and JUST never appeared. #result-helped lists every
// success of the run with counts (JUST発射 · <name> SPECIAL×n · 商人 Type X→Y · GUARD BLOCK×n), checked here against
// the real resolveSpecial(true) calls over many seeded plays. Display only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } }); return els.get(id); };
const store = {}; const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, { Game, UI, STATES: S } = H;
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
assert(/<p id="result-helped"><\/p>/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
// unit
const fake = { justLaunch: true, history: [{ type: 'DASH', label: 'DASH SPECIAL' }, { type: 'BOOST', label: 'BOOST' }, { type: 'DASH', label: 'DASH SPECIAL' },
  { type: 'BOOST', label: 'BOOST SPECIAL' }, { type: 'GUARD', label: 'GUARD / MERCHANT TYPE B' }, { type: 'STOPPER', label: 'STOPPER (GUARDED)' }, { type: 'DASH', label: 'DASH / MERCHANT TYPE A' }] };
const order = Object.keys(H.CAST).filter(t => t === 'BOOST' || t === 'DASH'), spText = { BOOST: H.CAST.BOOST.name + ' SPECIAL×1', DASH: H.CAST.DASH.name + ' SPECIAL×2' };
assert.equal(UI.helped(fake).join(' · '), ['JUST発射', ...order.map(t => spText[t]), '商人 Type B→A', 'GUARD BLOCK×1'].join(' · '));
assert.deepEqual(JSON.parse(JSON.stringify(UI.helped({ justLaunch: false, history: [{ type: 'BRAKE', label: 'BRAKE' }] }))), []);
// real runs vs resolveSpecial truth
let plays = 0, withSpecial = 0, withJust = 0;
for (let s = 1; s <= 150; s++) {
  const pr = rng(s * 7919), g = new Game(rng(s)); g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new UI(g, element('canvas')), truth = {}; let merch = []; const orig = g.resolveSpecial.bind(g);
  g.resolveSpecial = ok => { const p = g.special, r = orig(ok); if (p && ok) { if (p.merchantType) merch.push(p.merchantType); else truth[p.type] = (truth[p.type] || 0) + 1; } return r; };
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  for (let i = 0; i < 60 * 400 && g.state === S.FLYING; i++) { if (g.special && pr() < 0.9) g.act(); g.update(1 / 60); }
  if (g.state !== S.RESULT) continue;
  ui.update(); plays++;
  const text = element('result-helped').textContent;
  const want = [g.justLaunch ? 'JUST発射' : null, ...Object.keys(H.CAST).filter(t => truth[t]).map(t => `${H.CAST[t].name} SPECIAL×${truth[t]}`), merch.length ? '商人 Type ' + merch.join('→') : null].filter(Boolean);
  assert(text.startsWith('効いたもの：'), text);
  for (const w of want) assert(text.includes(w), `seed ${s}: "${text}" lacks "${w}"`);
  assert.equal((text.match(/SPECIAL×/g) || []).length, Object.keys(truth).length, `seed ${s}: no extra SPECIAL`);
  assert.equal(text.includes('JUST'), !!g.justLaunch); assert.equal(text.includes('商人'), merch.length > 0);
  if (!want.length && !/GUARD BLOCK/.test(text)) assert.equal(text, '効いたもの：なし（通常接触のみ）');
  if (Object.keys(truth).length) withSpecial++; if (g.justLaunch) withJust++;
  g.act(); ui.update(); assert.equal(element('result-helped').textContent, '', 'cleared on retry');
}
assert(plays > 120 && withSpecial > 30 && withJust > 5, JSON.stringify({ plays, withSpecial, withJust }));
console.log(JSON.stringify({ resultHelped: 'PASS', plays, withSpecial, withJust }));
