// JUST! window on the aim gauge (2026-10-16 auto cycle 01): the JUST launch window (config justAngle* / justPowerMin)
// was invisible, so players could not aim for it. The aim gauge now shows a static band at the window (same scale as
// aim-fill) and turns cyan while a tap would be JUST. Display only; truthful = inside matches Game.isJust exactly.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(patch = s => s) {
  const els = new Map();
  const el = id => { if (!els.has(id)) { const cls = new Set(); els.set(id, { id, setAttribute() {}, textContent: '', hidden: false, style: {}, dataset: {}, cls, classList: { toggle(k, on) { on ? cls.add(k) : cls.delete(k); } }, addEventListener() {}, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }); } return els.get(id); };
  const scope = { document: { getElementById: el, addEventListener() {} }, requestAnimationFrame() {} }; scope.window = scope; vm.createContext(scope);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui']) { let src = fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'); if (n === 'config') src = patch(src); vm.runInContext(src, scope, { filename: n }); }
  return { H: scope.Hop, el };
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(/<div class="aim-track"><div id="aim-fill"><\/div><div id="aim-just" class="aim-just" hidden><\/div><\/div>/.test(html));
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
assert(/\.aim-just \{[^}]*position: absolute/.test(css)); assert(!/\.aim-just[^{]*\{[^}]*animation/.test(css), 'static band, no motion');
const { H, el } = load(), c = H.CONFIG, S = H.STATES, U = H.UI;
const g = new H.Game(() => 0.5);
assert.equal(U.justZone(g), null, 'READY: none');
g.act(); assert.equal(g.state, S.AIM_ANGLE);
let z = U.justZone(g);
assert(Math.abs(z.left - (39 - 10) / 60 * 100) < 1e-9 && Math.abs(z.width - 6 / 60 * 100) < 1e-9, JSON.stringify(z));
// Truthful: inside == the angle half of Game.isJust for a sweep of angles, and == the power half for powers.
for (let a = c.angleMin; a <= c.angleMax; a += 0.25) { g.angle = a; assert.equal(U.justZone(g).inside, H.Game.isJust(a, 1), 'angle ' + a); }
g.act(); assert.equal(g.state, S.AIM_POWER);
z = U.justZone(g); assert(Math.abs(z.left - 97) < 1e-9 && Math.abs(z.width - 3) < 1e-9);
for (let p = c.powerMin; p <= c.powerMax + 1e-12; p += 0.005) { g.power = p; assert.equal(U.justZone(g).inside, H.Game.isJust(c.justAngleCenter, p), 'power ' + p); }
// DOM: band placed + in-just class follows the needle (UI.updateHud path).
const ui = new U(g, el('game'));
g.power = 0.99; ui.update?.(); const band = el('aim-just');
assert.equal(band.hidden, false); assert.equal(band.style.left, '97%'); assert(el('aim-display').cls.has('in-just'));
g.power = 0.5; ui.update?.(); assert(!el('aim-display').cls.has('in-just'));
g.act(); assert.equal(g.state, S.FLYING); assert.equal(U.justZone(g), null);
// Disabled feature: no band.
const off = load(s => s.replace(/justLaunchEnabled: true,/, 'justLaunchEnabled: false,'));
const g2 = new off.H.Game(() => 0.5); g2.act(); assert.equal(off.H.UI.justZone(g2), null);
console.log(JSON.stringify({ aimJustZone: 'PASS', angleBand: [39, 45], powerBand: [97, 100] }));
