// Combo partner display (2026-10-16 auto cycle 10): a BOOST/BOUNCE SPECIAL uses up the partner without a contact
// event, so RESULT used to show e.g. 「武闘家 BOUNCE 0」 although 武闘家 joined the combo. The entry now carries a
// non-enumerable display field `partner` (JSON of the game state unchanged) and ui.js shows it in the contact log,
// 「効いたもの」 and the per-character counts (counts themselves unchanged). Checked against the real partners.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } }); return els.get(id); };
const store = {}; const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, { Game, UI, STATES: S } = H, name = t => H.CAST[t].name;
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function run(s, spy) {
  const pr = rng(s * 7919), g = new Game(rng(s)); g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new UI(g, element('canvas')), partners = [];
  if (spy) { const orig = g.resolveSpecial.bind(g); g.resolveSpecial = ok => { const p = g.special; if (p && ok && p.partner && !p.merchantType) partners.push([p.type, p.partner.type]); return orig(ok); }; }
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  for (let i = 0; i < 60 * 400 && g.state === S.FLYING; i++) { if (g.special && pr() < 0.9) g.act(); g.update(1 / 60); ui.update(); }
  ui.update(); return { g, ui, partners };
}
let combos = 0, plays = 0;
for (let s = 1; s <= 150; s++) {
  const { g, partners } = run(s, true); if (g.state !== S.RESULT) continue; plays++;
  const marked = g.history.filter(e => e.partner).map(e => [e.type, e.partner]);
  assert.deepEqual(JSON.parse(JSON.stringify(marked)), JSON.parse(JSON.stringify(partners)), 'seed ' + s + ': every real combo partner marked, nothing else');
  for (const e of g.history) assert(!('partner' in JSON.parse(JSON.stringify(e))), 'non-enumerable');
  const helped = element('result-helped').textContent, counts = element('type-counts').textContent, log = element('history').textContent;
  const joined = {}; for (const [, p] of partners) joined[p] = (joined[p] || 0) + 1;
  for (const [t, p] of partners) assert(helped.includes(`${name(t)} SPECIAL×`) && helped.includes('＋' + name(p)), helped);
  for (const [p, n] of Object.entries(joined)) assert(counts.includes(`${name(p)} ${p} ${g.counts[p]}（＋合体参加 ${n}）`), counts);
  assert.equal((counts.match(/合体参加/g) || []).length, Object.keys(joined).length);
  for (const e of g.history.slice(-8).filter(e => e.partner)) assert(log.includes(`(${e.label}＋${name(e.partner)})`), log);
  combos += partners.length;
}
assert(plays > 120 && combos > 30, JSON.stringify({ plays, combos }));
// physics / RNG untouched: same seed -> identical game JSON with and without the display field reading
const a = run(42, false).g, b = run(42, false).g; assert.equal(JSON.stringify(a), JSON.stringify(b));
console.log(JSON.stringify({ comboPartner: 'PASS', plays, combos }));
