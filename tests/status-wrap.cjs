// Status row / readout fit (2026-10-18 auto cycle 47, CSS only, static). Measured before (CDP touch emulation, every
// status text combination + real play): on portrait phones the one-line status row cut CONTACT with … (e.g.
// "CONTACT / 魔法使い" at 320-430 px in 44-100% of combinations, and in real flights) and pushed DEBUG past the row (at
// 320 px 38 px off-screen, page wider than the screen); in the cycle-43 landscape side column the STATE value
// AIM_ANGLE / AIM_POWER ran 2-13 px past its cell. Now: portrait phones (cycle-45 query) wrap the row to two static lines
// with CONTACT alone on the second; the landscape side column gives STATE and DISTANCE a full readout row. Checks:
// scoped to those two existing blocks, static, nothing hidden, no text / DOM change, ellipsis rule untouched (it just
// never triggers), border lines consistent.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const block = q => { const i = css.indexOf(q); assert(i > 0, q); return css.slice(i, css.indexOf('\n}\n', i) + 2); };
const P = block('@media (orientation: portrait) and (max-width: 600px) {'), L = block('@media (orientation: landscape) and (max-height: 500px) and (min-aspect-ratio: 43 / 20) {');
assert(/main > \.aerial-status \{ order: -2; flex-wrap: wrap; row-gap: 2px; \}/.test(P), 'portrait status row wraps');
assert(/\.aerial-status #contact-status \{ order: 1; flex: 1 1 100%; \}/.test(P), 'CONTACT alone on the second line');
for (const b of [P, L]) assert(!/animation|transition|transform|@keyframes|display: none|visibility: hidden/.test(b), 'static, nothing hidden');
assert(/\.readouts div:nth-child\(1\), \.readouts div:nth-child\(4\) \{ grid-column: 1 \/ -1; border-right: 0; \}/.test(L), 'STATE + DISTANCE full row');
assert(/\.readouts div:nth-child\(2\), \.readouts div:nth-child\(5\) \{ border-right: 1px solid #e2e6d9; \}/.test(L) && /\.readouts div:nth-child\(3\) \{ border-right: 0; \}/.test(L), 'inner borders follow the new grid');
assert(L.indexOf('nth-child(1), .readouts div:nth-child(4)') > L.indexOf('.readouts div:nth-last-child(-n+2) { border-bottom: 0; }'), 'after the cycle-43 border rules (cascade)');
// the phone (≤650) one-line rules and the ellipsis stay as they were (desktop / tablet / 601-650 px untouched)
assert(css.includes('  #contact-status { flex: 1 1 auto; min-width: 72px; overflow: hidden; text-overflow: ellipsis; }'), 'phone CONTACT rule unchanged');
assert(css.includes('  .aerial-status { flex-wrap: nowrap; gap: 9px; font-size: 11px; line-height: 18px; margin: 0 0 8px; white-space: nowrap; }'), 'phone row rule unchanged');
// status texts themselves unchanged (no renaming / abbreviation)
const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
assert(ui.includes('set("contact-status", `CONTACT / ${') && ui.includes('set("up-status", `AERIAL ↑ ×${g.upRemaining}`);') && ui.includes('`GUARD × ${g.normalGuard}`'), 'texts unchanged');
console.log(JSON.stringify({ statusWrap: 'PASS' })); // geometry is measured with CDP (cycle 47 record: synth / play / layout)
