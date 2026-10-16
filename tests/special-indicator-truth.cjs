// READY truth (2026-10-16 bug: 「GUARDがない状態でSpecial表示のキャラクターと接触してもSpecialが発動しない場合がある」).
// Every contact with a character that was marked SPECIAL on the last display frame before it (roadside READY label =
// Hop.UI.readyTargets, or the HUD's armed 戦士 / 僧侶 / 盗賊) must start a SPECIAL (its own or a merchant SPECIAL).
// Causes found (600 fixed-seed plays before the fix: 514 of 1271 READY contacts failed):
//  1) 498: the 2026-10-15 BOOST/BOUNCE 0.5 draw ran after the READY label (abolished; rate halved by placement instead);
//  2)  16: a ground touch in the same frame cleared the armed 僧侶 / 盗賊 just before the contact (armedGroundGraceSteps).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const adjacentGateOff = require('./fixtures/adjacent-gate-off.cjs');
const root = path.resolve(__dirname, '..');
function load(patch = s => s) {
  const el = () => ({ setAttribute() {}, textContent: '', hidden: false, style: {}, dataset: {}, classList: { toggle() {} }, addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) });
  const scope = { document: { getElementById: el, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope; vm.createContext(scope);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui']) { let src = fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'); if (n === 'config') src = patch(src); vm.runInContext(src, scope, { filename: n }); }
  return scope.Hop;
}
const rng = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const ARM = { DASH: 'dash', STOPPER: 'stopper', BRAKE: 'brake' };
function audit(H, plays) {
  const c = H.CONFIG, r = { shown: 0, fired: 0, mismatch: 0, byType: {} };
  for (let i = 1; i <= plays; i++) {
    const seed = i * 7919 + 11, g = new H.Game(rng(seed)), pr = rng(seed * 31 + 5);
    g.act(); g.angle = c.angleMin + (c.angleMax - c.angleMin) * pr(); g.act(); g.power = c.powerMin + (c.powerMax - c.powerMin) * pr(); g.act();
    let t = 0, seen = null, age = 0;
    while (g.state === 'FLYING' && t < 900) {
      const ready = new Set(H.UI.readyTargets(g).filter(x => x.label === 'SPECIAL').map(x => x.object));
      const show = !g.special && !g.specialMessage && g.merchant?.type !== 'C', armed = show ? { ...g.specialArmed } : {};
      const before = g.objects.filter(o => !o.used), had = g.special;
      g.update(1 / 60); t += 1 / 60;
      for (const o of before) {
        if (!o.used || !(ready.has(o) || (ARM[o.type] && armed[ARM[o.type]]))) continue;
        r.shown++;
        if (g.special && g.special !== had && g.special.source === o) r.fired++; else { r.mismatch++; r.byType[o.type] = (r.byType[o.type] || 0) + 1; }
      }
      if (g.special) { if (g.special !== seen) { seen = g.special; age = 0; } age += 1 / 60; if (age >= 0.25) { g.act(); age = -1e9; } continue; }
      if (g.airborne() && pr() < 0.02) g.act();
    }
  }
  return r;
}
const H = load(), c = H.CONFIG;
assert.equal(c.boostSpecialChance, undefined, 'BOOST/BOUNCE draw abolished'); assert.equal(c.armedGroundGraceSteps, 2);
const now = audit(H, 400);
assert(now.shown > 300, 'enough READY contacts ' + now.shown);
assert.equal(now.mismatch, 0, 'READY shown but no SPECIAL: ' + JSON.stringify(now.byType));
// The old ground-touch order really produced mismatches (proves the audit sees cause 2).
const old = audit(load(src => adjacentGateOff(src, 'config')), 400);
assert(old.mismatch > 0 && Object.keys(old.byType).every(t => t === 'STOPPER' || t === 'BRAKE'), JSON.stringify(old.byType));
// Unit: armed 僧侶 touched in the step right after a ground touch still fires; outside the grace it does not.
{
  const mk = () => { const g = new H.Game(() => 0.99); g.objects = []; g.nextObjectX = Infinity; g.nextBoundaryX = Infinity; g.act(); g.act(); g.act(); return g; };
  const g = mk(); g.specialArmed.stopper = true; g.groundImpact({ vx: 300, vy: -50 }); assert.equal(g.specialArmed.stopper, false); assert.equal(g.preImpactArmed?.stopper, true);
  g.objects = [{ x: g.body.x + 5, type: 'STOPPER', used: false }]; g.contactObjects({ x: g.body.x, y: g.body.y }); assert.equal(g.special?.type, 'STOPPER');
  const late = mk(); late.specialArmed.brake = true; late.groundImpact({ vx: 300, vy: -50 }); late.preImpactArmed = null;
  late.objects = [{ x: late.body.x + 5, type: 'BRAKE', used: false }]; late.contactObjects({ x: late.body.x, y: late.body.y }); assert.equal(late.special, null, 'grace over: ground touch disarms as before');
  const r = mk(); r.preImpactArmed = { stopper: true, steps: 2 }; r.reset(); assert.equal(r.preImpactArmed, null);
}
console.log(JSON.stringify({ indicatorTruth: 'PASS', plays: 400, ready: now.shown, fired: now.fired, mismatch: now.mismatch, oldMismatch: old.mismatch }));
