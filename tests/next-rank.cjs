// Next rank goal in the flight HUD (2026-10-16 auto cycle 04): "次のランク X まで あと Nm" from the RESULT rank table
// (config.rankThresholds via Game.rank), "最高ランク SSS 到達！" at the top. Static text, flight only, display only.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { scope, element } = require('./phase2.cjs');
const { isolated } = require('./specials.cjs');
const { UI, Game, CONFIG: c } = scope.Hop;
const root = path.resolve(__dirname, '..');
assert(/<div id="next-rank" class="next-rank" hidden><\/div>/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
assert(/\.next-rank \{[^}]*position: absolute/.test(css)); assert(!/\.next-rank[^{]*\{[^}]*(animation|transition)/.test(css), 'static');
const cases = [[0, 'D', 'C', 1200], [1199.2, 'D', 'C', 1], [1200, 'C', 'B', 1800], [2999.5, 'C', 'B', 1], [3000, 'B', 'A', 2000], [5000, 'A', 'S', 5000],
  [9999.99, 'A', 'S', 1], [10000, 'S', 'SS', 5000], [15000, 'SS', 'SSS', 5000], [20000, 'SSS', null, 0], [99999, 'SSS', null, 0], [-3, 'D', 'C', 1200], [NaN, 'D', 'C', 1200]];
for (const [d, rank, next, rem] of cases) {
  const r = UI.nextRank(d); assert.equal(r.rank, rank, String(d)); assert.equal(r.next, next, String(d)); assert.equal(r.remaining, rem, String(d));
  assert.equal(r.rank, Game.rank(Math.max(0, Number.isFinite(d) ? d : 0)), 'same table as the RESULT stamp');
}
// DOM: flight only; text follows the distance; hidden before launch.
const g = isolated(), ui = new UI(g, element('game')), nr = element('next-rank');
g.body.x = 2500 * c.pixelsPerMeter; ui.update();
assert.equal(nr.hidden, false); assert.equal(nr.innerHTML, '次のランク <b>B</b> まで あと 500m');
g.body.x = 25000 * c.pixelsPerMeter; ui.update(); assert.equal(nr.innerHTML, '最高ランク <b>SSS</b> 到達！');
g.reset(); ui.update(); assert.equal(nr.hidden, true); assert.equal(nr.innerHTML, '');
console.log(JSON.stringify({ nextRank: 'PASS', cases: cases.length }));
