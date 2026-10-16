// DEBUG runs end (2026-10-16 auto cycle 11 fix). The old DEBUG filler (objectWeights order, BOOST then BOUNCE)
// resonated with the BOOST SPECIAL arc and chained BOOST SPECIALs forever (e.g. ?debug=boost 40°/80% never reached
// RESULT). config.debugFillOrder keeps partners apart. Every DEBUG kind over an angle/power grid must reach RESULT,
// each kind's prepared check still fires first, and normal play is byte-identical whatever debugFillOrder is.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(patch) {
  const scope = { document: { getElementById: () => ({}), addEventListener() {} }, requestAnimationFrame() {}, localStorage: { getItem: () => null, setItem() {} } };
  scope.window = scope; vm.createContext(scope);
  for (const n of ['config', 'physics', 'game']) {
    let src = fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8');
    if (n === 'config' && patch) src = src.replace(/debugFillOrder: Object\.freeze\(\[[^\]]*\]\),/, 'debugFillOrder: null,');
    vm.runInContext(src, scope, { filename: n });
  }
  return scope.Hop;
}
const H = load(false), OLD = load(true);
assert.equal(OLD.CONFIG.debugFillOrder, null);
const order = H.CONFIG.debugFillOrder, partnerOf = { BOOST: 'BOUNCE', BOUNCE: 'BOOST' };
assert.deepEqual([...order].sort(), Object.keys(H.CONFIG.objectWeights).sort(), 'every cast once');
order.forEach((t, i) => assert.notEqual(order[(i + 1) % order.length], partnerOf[t], 'partners never adjacent (with wrap)'));
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
function play(Hop, kind, angle, power, seed = 7) {
  const g = new Hop.Game(rng(seed)); g.launchCutinEnabled = false; g.comboEnabled = false; if (kind) g.setDebugKind(kind);
  g.act(); g.angle = angle; g.act(); g.power = power; g.act();
  let t = 0; for (; t < 60 * 180 && g.state === 'FLYING'; t++) { if (g.special) g.act(); g.update(1 / 60); }
  return { g, t };
}
let runs = 0, oldEndless = 0;
for (const kind of H.DEBUG_KINDS.map(k => k.id)) for (const angle of [30, 36, 40, 44]) for (const power of [0.6, 0.8, 1]) {
  const { g } = play(H, kind, angle, power); runs++;
  assert.equal(g.state, 'RESULT', `${kind} ${angle}° ${power}: reaches RESULT`);
  const k = H.Game.debugKind(kind), first = g.history[0]?.label || '';
  if (k.special) assert.equal(first, k.special + ' SPECIAL', `${kind}: the prepared check fires first`);
  if (k.merchant) assert(first.endsWith('MERCHANT TYPE ' + k.merchant), `${kind}: merchant first (${first})`);
  if (play(OLD, kind, angle, power).g.state !== 'RESULT') oldEndless++;
}
assert(oldEndless > 0, 'the old filler reproduces the endless chain');
for (let s = 1; s <= 30; s++) assert.equal(JSON.stringify(play(H, null, 38, 0.9, s).g), JSON.stringify(play(OLD, null, 38, 0.9, s).g), 'normal play unchanged');
console.log(JSON.stringify({ debugEnds: 'PASS', runs, oldEndless }));
