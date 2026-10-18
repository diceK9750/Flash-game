// Landscape phones / short viewports (2026-10-18 auto cycle 43, static layout only). Before, at 844x390 / 640x360 /
// 932x430 the title, readouts and status row pushed the stage ~270 px down: only 25-33% of the game was on screen
// without scrolling. Now, only under (orientation: landscape) and (max-height: 500px), the stage comes first and is sized
// to the viewport height (16:9, 6 px margin); with >= 2.15:1 the header / readouts / status / hint / final / history sit
// in a side column (readouts 2 x 3), otherwise below the stage. Checks: the two blocks are the last rules, scoped to
// those queries only (portrait / tablet / desktop untouched), static (no animation / transition / transform), every info
// element still in the DOM and reachable (none hidden), tap targets not shrunk, the AERIAL ↓ text kept for screen
// readers, and the geometry fits the target sizes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const Q1 = '@media (orientation: landscape) and (max-height: 500px) {', Q2 = '@media (orientation: landscape) and (max-height: 500px) and (min-aspect-ratio: 43 / 20) {';
const i1 = css.indexOf(Q1), i2 = css.indexOf(Q2); assert(i1 > 0 && i2 > i1, 'both blocks');
assert(css.indexOf('Landscape phones / short viewports') < i1 && css.indexOf('Landscape phones / short viewports') > css.lastIndexOf('@media (max-width: 650px)'), 'after every other rule (cascade)');
const tail = css.slice(css.indexOf('Landscape phones / short viewports'));
// cycle 50 adds a third, stacked-only block (tests/stacked-landscape.cjs) after these two
assert.equal((tail.match(/@media/g) || []).length, 3, 'only these two media blocks + the cycle-50 stacked block');
assert(tail.lastIndexOf('@media') === tail.indexOf('@media (orientation: landscape) and (max-height: 500px) and (max-aspect-ratio: 2149 / 1000) {'), 'third block is the stacked one');
assert(!/animation|transition|transform|@keyframes/.test(tail), 'static layout only');
assert(!/display: none|visibility: hidden/.test(tail), 'nothing hidden');
assert(/#down-status \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\)/.test(tail), 'AERIAL ↓ text visually hidden only');
assert(!/min-height: (\d|[1-3]\d)px/.test(tail) && !/#se-toggle \{[^}]*height/.test(tail), 'SE toggle keeps its 40px tap height');
assert(!/\.debug-toggle|\.rules summary/.test(tail), 'DEBUG / rules targets untouched');
assert(/\.stage \{ width: min\(100%, calc\(\(100svh - 12px\) \* 16 \/ 9\)\)/.test(tail) && /\.stage \{ order: -1;/.test(tail), 'stage first, fits the height');
assert(/grid-template-columns: calc\(\(100svh - 12px\) \* 16 \/ 9\) minmax\(0, 1fr\)/.test(tail), 'side column layout');
for (const id of ['state', 'angle', 'power', 'distance', 'height', 'speed', 'up-status', 'down-status', 'down-charge', 'contact-status', 'guard-status', 'debug-toggle', 'se-toggle', 'best-summary', 'hint', 'final', 'history', 'result-stats']) assert(html.includes(`id="${id}"`), id);
// geometry: stage fully on screen, side column >= 140 px where used
const fit = (W, H) => { const side = W / H >= 43 / 20; const sw = side ? (H - 12) * 16 / 9 : Math.min(W - 20, (H - 12) * 16 / 9); return { side, sw, sh: sw * 9 / 16, col: side ? W - 16 - 10 - sw : null }; };
const out = {};
for (const [W, H] of [[844, 390], [640, 360], [932, 430], [896, 414], [667, 375], [812, 375], [915, 412]]) {
  const f = fit(W, H); assert(f.sh + 12 <= H + 1e-9, 'height fits ' + W + 'x' + H); assert(f.sw <= W, 'width fits');
  if (f.side) assert(f.col >= 140, 'side column ' + f.col.toFixed(0) + ' at ' + W + 'x' + H);
  out[W + 'x' + H] = f.side ? 'side' : 'stacked';
}
console.log(JSON.stringify({ landscapeFit: 'PASS', layouts: out }));
