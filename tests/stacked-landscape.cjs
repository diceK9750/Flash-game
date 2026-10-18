// Stacked landscape phones (2026-10-18 auto cycle 50, CSS only, static). Below the side-column ratio (568x320 / 640x360 /
// 667x375) everything sits under the full-height stage. Measured before (CDP touch, READY / FLYING / RESULT): the status
// row (AERIAL / CONTACT / GUARD / DEBUG) needed 275-280 px of scrolling and the readouts 219-228 px, because title and
// readouts came first. Now the status row + SPECIAL line follow the stage (46 px), then the readouts in one row of six
// (120 px), then title / hint / final / history / results / rules. Checks: the block is last, scoped to the stacked
// ratio only (never overlaps the side-column query), visual order only, stage rules untouched, static, nothing hidden,
// no font below 10 px, tap targets untouched.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const Q = '@media (orientation: landscape) and (max-height: 500px) and (max-aspect-ratio: 2149 / 1000) {';
const i = css.indexOf(Q); assert(i > 0, 'stacked block');
const end = css.indexOf('\n}\n', i); const blk = css.slice(i + Q.length, end);
assert.equal(css.slice(end + 3).trim(), '', 'last block (cascade)');
assert(i > css.indexOf('@media (orientation: landscape) and (max-height: 500px) and (min-aspect-ratio: 43 / 20) {'), 'after the cycle-43 blocks');
assert(2149 / 1000 < 43 / 20, 'never overlaps the side-column query');
const order = sel => { const m = blk.match(new RegExp('\\n  ' + sel.replace(/[.>]/g, '\\$&') + '[^{]*\\{ order: (-?\\d+); \\}')); assert(m, sel); return +m[1]; };
const st = order('main > .aerial-status'), ro = order('main > .readouts'), hd = order('main > header'), ft = order('main > footer');
assert(-1 < st && st < ro && ro < hd && hd < ft, 'stage (order -1) -> status -> readouts -> header -> rest');
assert(/main > \.aerial-status, main > \.special-state \{ order: 0; \}/.test(blk), 'SPECIAL line stays with the status row');
assert(/main > footer, main > \.final-line, main > \.history, main > \.result-stats, main > \.rules \{ order: 3; \}/.test(blk), 'rest keeps DOM order');
assert(/\.readouts \{ grid-template-columns: repeat\(6, 1fr\);/.test(blk), 'readouts in one row');
assert(!/\.stage|width|height|aspect-ratio|grid-row|grid-column/.test(blk.replace(/border-[a-z-]+/g, '')), 'stage size / position untouched');
assert(!/animation|transition|transform|display: none|visibility: hidden|debug-toggle|se-toggle|summary/.test(blk), 'static, nothing hidden, tap targets untouched');
const fonts = [...blk.matchAll(/font-size: (\d+)px/g)].map(m => +m[1]); assert(fonts.length && Math.min(...fonts) >= 10, 'no font below 10px');
// ratio check: the three stacked targets use this block, the five side-column sizes do not
const stacked = (W, H) => W / H <= 2149 / 1000, side = (W, H) => W / H >= 43 / 20;
for (const [W, H] of [[568, 320], [640, 360], [667, 375]]) assert(stacked(W, H) && !side(W, H), W + 'x' + H);
for (const [W, H] of [[812, 375], [844, 390], [896, 414], [915, 412], [932, 430]]) assert(!stacked(W, H) && side(W, H), W + 'x' + H);
console.log(JSON.stringify({ stackedLandscape: 'PASS' }));
