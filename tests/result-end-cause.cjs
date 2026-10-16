// RESULT end-cause line (2026-10-16 auto cycle 13): 「終了理由：僧侶にぶつかって停止」 (+「（SPECIAL MISS：タップが間に合わず）」
// when the stop came from a missed 僧侶 SPECIAL) or 「終了理由：地面を滑って停止（勢いが尽きた）」. Game.endCause is set where the
// run actually stops (applyContact STOPPER / finish after physics stopSpeed), cleared by a TYPE B revive, non-enumerable.
// Checked against an independent spy on applyContact / resolveSpecial / revive over many seeded plays. Display only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } }); return els.get(id); };
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} } };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
assert(/<p id="result-end"><\/p>/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
const stopper = H.CAST.STOPPER.name;
const seen = { slide: 0, stopper: 0, miss: 0, revived: 0 };
for (let s = 1; s <= 200; s++) {
  const g = new H.Game(rng(s)); g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new H.UI(g, element('canvas')), pr = rng(s * 7919), tapP = s % 2 ? 0.9 : 0.4;
  let last = null, missing = false;
  const oc = g.applyContact.bind(g); g.applyContact = t => { const r = oc(t); if (t === 'STOPPER' && g.body.stopped) last = missing ? 'miss' : 'stopper'; return r; };
  const rs = g.resolveSpecial.bind(g); g.resolveSpecial = ok => { missing = !ok; const r = rs(ok); missing = false; return r; };
  const rv = g.revive.bind(g); g.revive = () => { const r = rv(); if (r) { last = null; seen.revived++; } return r; };
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  let cur = null, will = false;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) { if (g.special && g.special !== cur) { cur = g.special; will = pr() < tapP; } if (g.special && will) g.act(); g.update(1 / 60); ui.update(); }
  assert.equal(g.state, 'RESULT'); ui.update();
  const line = element('result-end').textContent, truth = last || 'slide'; seen[truth]++;
  if (truth === 'slide') assert.equal(line, '終了理由：地面を滑って停止（勢いが尽きた）');
  else assert.equal(line, `終了理由：${stopper}にぶつかって停止` + (truth === 'miss' ? '（SPECIAL MISS：タップが間に合わず）' : ''), `seed ${s}`);
  assert(!('endCause' in JSON.parse(JSON.stringify(g))), 'non-enumerable');
  g.act(); ui.update(); assert.equal(element('result-end').textContent, ''); assert.equal(g.endCause, null, 'reset clears');
}
assert(seen.slide > 50 && seen.stopper > 20 && seen.miss > 3, JSON.stringify(seen));
console.log(JSON.stringify({ resultEndCause: 'PASS', ...seen }));
