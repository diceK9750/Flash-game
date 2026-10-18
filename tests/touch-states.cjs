// Touch pressed / focus states (2026-10-18 auto cycle 46, CSS only, static). Before, on touch screens the buttons and
// summaries had no pressed look of their own (only the browser's grey/blue tap flash) and DEBUG / close / summaries showed
// the thin default focus ring. Now, inside the cycle-44 @media (pointer: coarse) block only: an instant darker fill +
// inset edge on :active for SE / DEBUG / DEBUG-menu close + items / rules summaries (the tap flash is switched off for
// exactly those), and the SE button's 3px blue keyboard ring on :focus-visible for the others. Checks: rules live only
// in the coarse block (mouse / trackpad untouched), no motion (no transition / animation / transform), no size / hit-area
// properties, every target has both states, text contrast on each pressed fill >= 4.5:1, base rules unchanged.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const Q = '@media (pointer: coarse) {', i = css.indexOf(Q), blk = css.slice(i, css.indexOf('\n}\n', i) + 2);
const k = blk.indexOf('/* Pressed / focus states'); assert(k > 0, 'state rules in the coarse block');
const states = blk.slice(k);
assert(!/transition|animation|transform|@keyframes/.test(states), 'static');
assert(!/width|height|padding|margin|position|::?(before|after)/.test(states.replace(/outline: 3px solid #277ca5; outline-offset: 2px;/g, '')), 'no size / hit-area change');
const outside = css.slice(0, i) + css.slice(i + blk.length);
assert(!/:active|tap-highlight/.test(outside), 'no pressed styles outside the coarse block');
const T = ['#se-toggle', '.debug-toggle', '.debug-close', '.debug-item', '.rules summary'];
const tap = states.match(/\n  ([^{}\n]+) \{ -webkit-tap-highlight-color: transparent; \}/); assert(tap, 'tap flash rule');
assert.deepEqual(tap[1].split(', '), T, 'tap flash off for exactly the targets with a pressed style');
for (const t of T) assert(new RegExp('\\n  ' + t.replace(/[.#]/g, '\\$&') + ':active \\{ background: #[0-9a-f]{6};[^}]*box-shadow: inset').test(states), t + ' :active');
const fv = states.match(/\n  ([^{}\n]+) \{ outline: 3px solid #277ca5; outline-offset: 2px; \}/); assert(fv, 'focus ring rule');
assert.deepEqual(fv[1].split(', ').map(s => s.replace(':focus-visible', '')), T.slice(1), 'focus ring on the others');
assert(/#se-toggle:focus-visible \{ outline: 3px solid #277ca5; outline-offset: 2px; \}/.test(css), 'SE ring (base) unchanged');
// contrast of the text on each pressed fill (WCAG relative luminance)
const lum = h => { const c = [1, 3, 5].map(j => parseInt(h.slice(j, j + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const fill = sel => states.match(new RegExp(sel.replace(/[.#\[\]"=]/g, '\\$&') + ':active \\{ background: (#[0-9a-f]{6})'))[1];
const out = {};
for (const [sel, text] of [['#se-toggle', '#284c3d'], ['.debug-toggle', '#7a5a4c'], ['.debug-toggle[aria-expanded="true"]', '#ffffff'], ['.debug-close', '#284356'], ['.debug-item', '#284356'], ['.rules summary', '#284356']]) {
  const r = cr(fill(sel), text); out[sel] = +r.toFixed(2); assert(r >= 4.5, sel + ' pressed contrast ' + r.toFixed(2));
}
console.log(JSON.stringify({ touchStates: 'PASS', contrast: out }));
