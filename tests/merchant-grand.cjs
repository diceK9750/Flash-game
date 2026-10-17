// Merchant SPECIAL "rarer but grander" (2026-10-16): merchantChance 0.20 -> 0.10 (trigger condition unchanged), type
// A-D effects raised (A 5 uses x2.5, B 900 + 160 / charge, C 150 objects, D 8 bounces x1.28) so the expected
// distance per play stays about the same (fixed-seed sim, /workspace/truckcrash/merchant_20261016), and a display-only
// flourish (gold coin burst + sparkles + big skill-name pop, longer than the cut-in) plus a richer SPECIAL_MERCHANT SE.
// Historical suites keep the old values through tests/fixtures/adjacent-gate-off.cjs (merchantOld).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const gate = require('./fixtures/adjacent-gate-off.cjs');
const root = path.resolve(__dirname, '..');
const arcs = [], texts = [];
const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'arc' ? (...a) => arcs.push(a) : k === 'fillText' ? t => texts.push(t) :
  k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 100 }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
function load(patch = s => s) {
  const el = id => ({ setAttribute() {}, textContent: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext: () => ctx });
  const scope = { document: { getElementById: el, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope; vm.createContext(scope);
  for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'audio']) {
    let src = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'); if (name === 'config') src = patch(src);
    vm.runInContext(src, scope, { filename: name });
  }
  return scope.Hop;
}
// 2026-10-17 A-D balance (cycle 33) retuned A-D again (tests/merchant-balance.cjs): this suite keeps checking the
// 2026-10-16 grand values by pinning them; the flourish / SE / draw parts are unchanged.
const GRAND16 = { typeAUses: '5', typeAMultiplier: '2.5', typeAKickSpeed: '0', typeBStartCharge: '0', typeBRevives: '1', typeBBaseSpeed: '900', typeBChargeBonus: '160', typeCCount: '150', typeDBounces: '8', typeDMultiplier: '1.28' };
const grand16 = src => { for (const [k, v] of Object.entries(GRAND16)) { const re = new RegExp('\\b' + k + ': [\\d.]+'); assert(re.test(src), k); src = src.replace(re, k + ': ' + v); } return src; };
const H = load(grand16), c = H.CONFIG, OLD = load(src => gate.merchantOld(src)).CONFIG;
// 1) Config: rarer draw, stronger effects, other SPECIAL / JUST knobs unchanged.
assert.equal(c.merchantChance, 0.10); assert.equal(OLD.merchantChance, 0.20);
assert.equal(c.typeAUses, 5); assert.equal(c.typeAMultiplier, 2.5); assert.equal(c.typeBBaseSpeed, 900); assert.equal(c.typeBChargeBonus, 160);
assert.equal(c.typeCCount, 150); assert.equal(c.typeDBounces, 8); assert.equal(c.typeDMultiplier, 1.28);
for (const k of ['typeAUses', 'typeAMultiplier', 'typeBBaseSpeed', 'typeBChargeBonus', 'typeCCount', 'typeDBounces', 'typeDMultiplier']) assert(c[k] > OLD[k], k + ' grander');
assert.equal(c.typeBMaxCharge, 10); assert.equal(c.typeCSpeed, 1600); assert.equal(c.typeDMinVertical, 450);
assert.equal(c.dashSpecialChance, 0.35); assert.equal(c.boostSpecialChance, undefined); assert.equal(c.angleSpecialChance, 0.10);
assert.equal(c.justLaunchMultiplier, 1.15); assert.equal(c.justLaunchEnabled, true);
assert.equal(JSON.stringify(c.merchantTypes), JSON.stringify({ STOPPER: 'A', DASH: 'B', BOOST: 'C', BOUNCE: 'D' }));
// 2) Draw: same candidate rule, one random() at the new chance (win < 0.10, lose at 0.10 -> normal rules).
function isolated(r) { const g = new H.Game(r); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.angle = 30; g.act(); g.power = 0.8; g.act(); return g; }
function hitBoundary(g, type) { const sp = c.boundaryMeters * c.pixelsPerMeter; g.body.x = sp - 5; g.objects = [{ x: sp, type, used: false }]; g.normalGuard = 1; g.contactObjects({ x: sp - 6, y: g.body.y }); }
{ let d = 0; const w = isolated(() => { d++; return 0.10 - 1e-9; }); d = 0; hitBoundary(w, 'DASH'); assert.equal(w.special?.merchantType, 'B'); assert.equal(d, 1);
  const l = isolated(() => 0.10); hitBoundary(l, 'DASH'); assert.equal(l.special?.merchantType ?? null, null); }
// 3) Effects with the new strengths.
{ const g = isolated(() => 0.99); g.acquireMerchant('A'); assert.equal(g.merchant.remaining, 5);
  g.body.vx = 500; g.body.vy = 0; g.applyContact('BOOST'); const ang = c.boostAngle * Math.PI / 180;
  assert(Math.abs(g.body.vx - (500 + c.boostImpulse * Math.cos(ang) * 2.5)) < 1e-6, 'A x2.5 on the gain ' + g.body.vx);
  assert.equal(g.merchant.remaining, 4);
  const b = isolated(() => 0.99); b.acquireMerchant('B'); b.merchant.charge = 3; assert(b.revive());
  assert(Math.abs(Math.hypot(b.body.vx, b.body.vy) - (900 + 3 * 160)) < 1e-6, 'B revive 900 + 160 x charge');
  const cc = isolated(() => 0.99); cc.acquireMerchant('C'); assert.equal(cc.merchant.remaining, 150);
  const d = isolated(() => 0.99); d.acquireMerchant('D'); assert.equal(d.merchant.remaining, 8);
  d.groundImpact({ vx: 300, vy: -400 }); assert(Math.abs(d.body.vx - 300 * 1.28) < 1e-6); assert.equal(d.body.vy, Math.max(450, 400 * 1.28)); assert.equal(d.merchant.remaining, 7); }
// 4) Flourish: display only, starts with a merchant cut-in, outlives it, coins + big name; reduced motion = still name.
{
  assert(c.merchantFlourishDuration > c.specialCutinDuration, 'longer than the cut-in'); assert(c.merchantCoinCount >= 16); assert(c.merchantNamePop >= 1);
  const G = H.Graphics, g = isolated(() => 0.99); g.realTime = 10;
  g.specialCutin = { type: 'MERCHANT', castId: 'SPECIAL_ONLY', name: c.merchantNames.C, merchantType: 'C', remaining: c.specialCutinDuration, total: c.specialCutinDuration };
  const v = {}; const before = JSON.stringify({ b: g.body, m: g.merchant, s: g.specialCutin });
  arcs.length = 0; texts.length = 0; G.merchantFlourish(ctx, g, v); assert.equal(v.merchantFx?.type, 'C');
  g.realTime = 10.6; arcs.length = 0; texts.length = 0; G.merchantFlourish(ctx, g, v);
  assert(arcs.length >= c.merchantCoinCount, 'coin burst'); assert(texts.some(t => t.includes(c.merchantNames.C)), 'big name');
  g.specialCutin = null; g.realTime = 10 + c.specialCutinDuration + 0.3; arcs.length = 0; G.merchantFlourish(ctx, g, v); assert(arcs.length > 0, 'still playing after the cut-in');
  g.realTime = 10 + c.merchantFlourishDuration + 0.01; arcs.length = 0; texts.length = 0; G.merchantFlourish(ctx, g, v); assert.equal(v.merchantFx, null); assert.equal(arcs.length + texts.length, 0);
  assert.equal(JSON.stringify({ b: g.body, m: g.merchant, s: null }), JSON.stringify({ ...JSON.parse(before), s: null }), 'game untouched');
  const rm = { reducedMotion: true }; g.realTime = 20; g.specialCutin = { merchantType: 'A', name: c.merchantNames.A, remaining: 1, total: 1 };
  arcs.length = 0; texts.length = 0; G.merchantFlourish(ctx, g, rm); assert.equal(arcs.length, 0, 'no coins in reduced motion'); assert(texts.some(t => t.includes(c.merchantNames.A)));
  // Normal SPECIAL cut-ins get no flourish.
  const n = {}; g.specialCutin = { type: 'DASH', name: 'x', merchantType: null, remaining: 1, total: 1 }; G.merchantFlourish(ctx, g, n); assert.equal(n.merchantFx, undefined);
}
// 5) Richer SE, same format, under the cap (render scales the summed peak to specialPeakCap).
{
  const A = H.Audio, r = A.specialRecipes.SPECIAL_MERCHANT;
  assert(r.length >= 15, 'richer'); assert(Math.max(...r.map(v => v[1] + v[2])) >= 1.4, 'longer tail');
  for (const v of r) assert(['tone', 'noise'].includes(v[0]) && v.length === 8 && v.slice(1).every(x => typeof x === 'string' || Number.isFinite(x)));
  const gains = []; const param = () => ({ setValueAtTime(x) { gains.push(x); }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(), start() {}, stop() {} });
  const actx = { currentTime: 0, sampleRate: 8000, destination: {}, createGain: node, createOscillator: node, createBiquadFilter: node, createBufferSource: node, createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }) };
  A.render(actx, 'SPECIAL_MERCHANT', 0); assert(Math.abs(gains[0] * A.peakSum(r) - Math.min(A.peakSum(r), A.specialPeakCap)) < 1e-9, 'master gain caps the peak');
}
console.log(JSON.stringify({ merchantGrand: 'PASS', chance: [OLD.merchantChance, c.merchantChance], flourish: c.merchantFlourishDuration }));
