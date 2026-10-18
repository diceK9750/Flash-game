// Portrait phones, game first (2026-10-18 auto cycle 45, CSS only, static). Before, on portrait phones the title,
// version / SE / BEST, six readouts and the status row pushed the game stage 298-313 px down (CDP, 360x640 ... 412x915).
// Now, only under (orientation: portrait) and (max-width: 600px), main is a flex column: the stage is first at full width
// (16:9), the AERIAL / CONTACT / GUARD / DEBUG status row and the SPECIAL line follow directly under it (visible during
// play), then everything else in DOM order. Checks: one block, scoped to that query only (tablet / desktop / landscape
// untouched), placed after the phone + touch rules and before the cycle-43 landscape blocks, static (no animation /
// transition / transform), visual order only (no DOM change, so keyboard focus order SE -> DEBUG -> rules is unchanged),
// nothing hidden, the stage keeps 16:9 at full width, and the status row comes right after the stage.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const Q = '@media (orientation: portrait) and (max-width: 600px) {';
assert.equal(css.split(Q).length - 1, 1, 'exactly one portrait-phone block');
assert.equal((css.match(/orientation: portrait/g) || []).length, 1, 'no other portrait queries');
const i = css.indexOf(Q), blk = css.slice(i, css.indexOf('\n}\n', i) + 2);
assert(i > css.lastIndexOf('@media (max-width: 650px)') && i > css.indexOf('@media (pointer: coarse)') && i < css.indexOf('Landscape phones / short viewports'), 'placement (cascade)');
assert(!/animation|transition|transform|@keyframes/.test(blk), 'static');
assert(!/display: none|visibility: hidden|hidden|clip|opacity|height: 0|overflow/.test(blk.replace(/:not\(\[hidden\]\)|overflow-wrap: anywhere/g, '')), 'nothing hidden'); // cycle 48: the result summary is shown only while not [hidden]
assert(/main \{ display: flex; flex-direction: column; \}/.test(blk), 'flex column');
const order = sel => { const m = blk.match(new RegExp('\\n  ' + sel.replace(/[.>]/g, '\\$&') + ' \\{[^}]*order: (-?\\d+)')); assert(m, sel); return +m[1]; };
assert(order('.stage') < order('main > .aerial-status') && order('main > .aerial-status') < order('main > .special-state') && order('main > .special-state') < 0, 'stage, then status row, then SPECIAL line, then the rest (order 0, DOM order)');
assert(!/width|aspect-ratio|font-size/.test(blk.slice(Q.length)), 'stage keeps full width and 16:9; no font changes');
assert(/\.stage \{ position: relative; width: 100%; aspect-ratio: 16 \/ 9;/.test(css), 'base stage 16:9');
// DOM / focus order unchanged: header SE -> status-row DEBUG -> stage -> rules summaries
const pos = s => { const p = html.indexOf(s); assert(p > 0, s); return p; };
assert(pos('id="se-toggle"') < pos('id="debug-toggle"') && pos('id="debug-toggle"') < pos('id="stage"') && pos('id="stage"') < pos('<details class="rules"><summary>'), 'DOM order unchanged');
assert(!/tabindex/.test(html), 'no tabindex reordering');
for (const sel of ['main > header', 'main > .readouts', 'main > footer', 'main > .final-line', 'main > .history', 'main > .result-stats', 'main > .rules']) assert(!blk.includes(sel), sel + ' keeps DOM order');
console.log(JSON.stringify({ portraitGameFirst: 'PASS' }));
