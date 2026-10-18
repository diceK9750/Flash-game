// Landscape side column (2026-10-18 auto cycle 49, CSS only, static, cycle-43 side-column block only). Measured before
// (CDP touch, READY / FLYING / RESULT): at 812x375 the status row (AERIAL / CONTACT / GUARD / DEBUG) was 14% on screen
// (CONTACT + DEBUG fully below the fold), at 844x390 56% (DEBUG 23%); SPEED ran 2 px into its padding at 812x375. Now the
// play-time status row + SPECIAL line come right after the title (readouts after them), spacing is tighter and the brand
// 1 px smaller so it stays on one line at 812 px. Checks: the new grid-row order, tightened values present, no font below
// 9 px, static, nothing hidden, stage rules untouched, DEBUG keeps its 44 px touch box (min-height not overridden here).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const Q = '@media (orientation: landscape) and (max-height: 500px) and (min-aspect-ratio: 43 / 20) {';
const i = css.indexOf(Q); assert(i > 0); const L = css.slice(i, css.indexOf('\n}\n', i));
assert(/main > header \{ grid-row: 1; \} main > \.aerial-status \{ grid-row: 2; \} main > \.special-state \{ grid-row: 3; \} main > \.readouts \{ grid-row: 4; \}/.test(L), 'status row before readouts');
assert(/main > footer \{ grid-row: 5; \} main > \.final-line \{ grid-row: 6; \} main > \.history \{ grid-row: 7; \}/.test(L), 'rest unchanged');
assert(/\.stage \{ order: 0; grid-column: 1; grid-row: 1 \/ 8; width: 100%; margin: 0; \}/.test(L), 'stage spans the same rows');
for (const re of [/header \{ flex-direction: column; align-items: stretch; gap: 2px; margin-bottom: 4px; \}/, /\.brand \{ font-size: 14px;/, /\.readouts div \{ padding: 2px 4px;/,
  /\.readouts span \{ font-size: 9px; margin-bottom: 0; line-height: 10px; \}/, /\.readouts strong \{ font-size: 13px; line-height: 15px; \}/, /line-height: 14px; margin: 0 0 3px;/]) assert(re.test(L), String(re));
const sizes = [...L.matchAll(/font-size: (\d+)px/g)].map(m => +m[1]); assert(Math.min(...sizes) >= 9, 'no font below 9px');
assert(!/animation|transition|transform|display: none|visibility: hidden|min-height|debug-toggle/.test(L), 'static, nothing hidden, DEBUG box untouched');
console.log(JSON.stringify({ sideColumn: 'PASS' }));
