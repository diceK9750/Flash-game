// SPECIAL MISS clarity (2026-10-16 auto cycle 12). Audit: the window is 1.0 s real time (tempo never speeds it up),
// MISS only comes from the window running out, but the panel said only "SPECIAL MISS | <skill name>" - even when the
// miss stopped the run (僧侶). The detail now says why and what happened instead; conditions, rates, timing unchanged.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const els = new Map(); const element = id => { if (!els.has(id)) els.set(id, { setAttribute() {}, textContent: '', innerHTML: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } }); return els.get(id); };
const scope = { document: { getElementById: element, addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} } };
scope.window = scope; vm.createContext(scope);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'voice', 'input']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), scope, { filename: n });
const H = scope.Hop, { UI, CONFIG: c } = H, rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const why = `タップが間に合わず（受付 ${c.specialWindow}秒）`;
// unit
const msg = (outcome, type) => { const m = { label: 'SPECIAL MISS', detail: 'X', remaining: 1 }; Object.defineProperty(m, 'missOutcome', { value: outcome }); Object.defineProperty(m, 'missType', { value: type }); return m; };
assert.equal(UI.specialMessageDetail(msg('stop', 'STOPPER')), `X · ${why} → 僧侶の効果で停止`);
assert.equal(UI.specialMessageDetail(msg('guard', 'STOPPER')), `X · ${why} → GUARDで停止を防いだ`);
assert.equal(UI.specialMessageDetail(msg('guard', 'BOOST')), `X · ${why} → GUARDで打ち消し（効果なし）`);
assert.equal(UI.specialMessageDetail(msg('normal', 'DASH')), `X · ${why} → 通常の効果のみ`);
assert.equal(UI.specialMessageDetail({ label: 'SPECIAL SUCCESS', detail: 'Y' }), 'Y'); assert.equal(UI.specialMessageDetail(null), '');
// real plays, never tapping: every miss explains itself truthfully; tapping plays unchanged
let misses = 0, stops = 0, guards = 0;
for (let s = 1; s <= 200; s++) {
  const g = new H.Game(rng(s)); g.tempoEnabled = true; g.launchCutinEnabled = false; g.comboEnabled = false;
  const ui = new UI(g, element('canvas')), pr = rng(s * 31);
  g.act(); g.angle = 36 + pr() * 10; g.act(); g.power = 0.85 + pr() * 0.15; g.act();
  let open = null, frames = 0;
  for (let i = 0; i < 60 * 400 && g.state === 'FLYING'; i++) {
    if (g.special && !open) { open = g.special; frames = 0; }
    g.update(1 / 60); ui.update();
    if (!open) continue; frames++;
    if (g.special) continue;
    misses++; assert(frames >= 58 && frames <= 61, 'window ~1.0 s real time: ' + frames);
    const detail = element('special-detail').textContent;
    assert.equal(element('special-title').textContent, 'SPECIAL MISS'); assert(detail.includes(why), detail);
    if (g.body.stopped) { stops++; assert(detail.endsWith('僧侶の効果で停止'), detail); assert.equal(element('special-panel').hidden, false, 'shown on the RESULT that the miss caused'); }
    else if (open.entry.label.includes('GUARDED')) { guards++; assert(/GUARDで/.test(detail), detail); }
    else assert(detail.endsWith('通常の効果のみ'), detail);
    assert(!('missOutcome' in JSON.parse(JSON.stringify(g.specialMessage || {}))), 'non-enumerable');
    open = null;
  }
}
assert(misses > 150 && stops > 10 && guards > 5, JSON.stringify({ misses, stops, guards }));
console.log(JSON.stringify({ specialMiss: 'PASS', misses, stops, guards }));
