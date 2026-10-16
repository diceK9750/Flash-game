// SPECIAL READY HUD (2026-10-16 auto cycle 03): an armed 戦士 / 僧侶 / 盗賊 with no READY copy on screen reads
// "次の〇〇→" instead of a bare name (which looked like a character in view); on-screen READY characters keep their
// name. Display only; same conditions as the roadside READY labels (truthful).
const assert = require('node:assert/strict');
const { scope, element } = require('./phase2.cjs');
const { isolated } = require('./specials.cjs');
const { UI, CAST, CONFIG: c } = scope.Hop;
const ui = new UI(isolated(), element('game'));
const hud = () => element('ready-targets');
function fresh() { const g = isolated(); ui.game = g; return g; }
const obj = (type, dx) => ({ x: ui.game.body.x + dx, type, used: false });
let cases = 0;
for (const [key, type] of [['dash', 'DASH'], ['stopper', 'STOPPER'], ['brake', 'BRAKE']]) {
  // Armed, none on screen -> "次の〇〇→".
  let g = fresh(); g.specialArmed[key] = true; g.objects = [];
  assert.deepEqual([...UI.readyHudTargets(g)], ['次の' + CAST[type].name + '→']); ui.update();
  assert.equal(hud().hidden, false); assert.equal(hud().textContent, 'SPECIAL READY · 対象：次の' + CAST[type].name + '→');
  // Armed and on screen -> plain name (that character wears the READY label).
  g = fresh(); g.specialArmed[key] = true; g.objects = [obj(type, 700)];
  assert.deepEqual([...UI.readyHudTargets(g)], [CAST[type].name]);
  // Far ahead (off screen) -> "次の…→" again.
  g = fresh(); g.specialArmed[key] = true; g.objects = [obj(type, c.width * 3)];
  assert.deepEqual([...UI.readyHudTargets(g)], ['次の' + CAST[type].name + '→']);
  cases++;
}
// On-screen adjacency READY (魔法使い before 武闘家) by name; nothing armed + nothing ready -> hidden.
{ const g = fresh(); g.objects = [obj('BOOST', 600), obj('BOUNCE', 1000)];
  assert.deepEqual([...UI.readyHudTargets(g)], [CAST.BOOST.name]); ui.update(); assert.equal(hud().textContent, 'SPECIAL READY · 対象：' + CAST.BOOST.name);
  const h = fresh(); h.objects = []; ui.update(); assert.equal(hud().hidden, true); assert.equal(hud().textContent, ''); cases++; }
// Mixed: on-screen 魔法使い + armed 戦士 off screen; SPECIAL window open -> no armed suffix entries (as before).
{ const g = fresh(); g.specialArmed.dash = true; g.objects = [obj('BOOST', 600), obj('BOUNCE', 1000)];
  assert.deepEqual([...UI.readyHudTargets(g)], [CAST.BOOST.name, '次の' + CAST.DASH.name + '→']);
  g.special = { type: 'BOOST' }; assert.deepEqual([...UI.readyHudTargets(g)], []); cases++; }
console.log(JSON.stringify({ readyHud: 'PASS', cases }));
