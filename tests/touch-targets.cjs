// Touch tap targets (2026-10-18 auto cycle 44, CSS only, static). Before, on a phone the SE button was 40 px tall,
// DEBUG ~56x20-24, the rules / DEBUG-help summaries 28 px and the DEBUG menu close button ~108x30 (CDP touch emulation,
// elementFromPoint hit boxes). Now, only under @media (pointer: coarse), each is a real >= 44 x 44 px box. Checks: one
// block, scoped to the coarse pointer only (mouse / trackpad layout untouched), placed after the phone rules and before
// the cycle-43 landscape blocks (cascade), static (no animation / transition / transform), no pseudo-element or negative
// margin hit-area tricks that could overlap the stage, every interactive selector gets min-height 44px, and the base
// (fine pointer) rules are byte-for-byte what they were.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const Q = '@media (pointer: coarse) {';
assert.equal(css.split(Q).length - 1, 1, 'exactly one coarse-pointer block');
assert(!/pointer:\s*fine|hover:\s*(hover|none)|any-pointer/.test(css), 'no other pointer queries');
const i = css.indexOf(Q), end = css.indexOf('\n}\n', i), blk = css.slice(i, end + 2);
assert(i > css.lastIndexOf('@media (max-width: 650px)') && i < css.indexOf('Landscape phones / short viewports'), 'after phone rules, before landscape blocks');
assert(!/animation|transition|transform|@keyframes/.test(blk), 'static');
assert(!/::?(before|after)|margin|position|inset|outline/.test(blk), 'real box only, no hit-area overlap tricks');
const rule = sel => { const m = blk.match(new RegExp('\\n  ' + sel.replace(/[.#]/g, '\\$&') + ' \\{([^}]*)\\}')); assert(m, sel); return m[1]; };
for (const sel of ['#se-toggle', '.debug-toggle', '.rules summary', '.debug-close', '.debug-item']) assert(/min-height: 44px/.test(rule(sel)), sel + ' >= 44 tall');
for (const sel of ['.debug-toggle', '.debug-close']) assert(/min-width: 44px/.test(rule(sel)), sel + ' >= 44 wide');
assert(/padding: 10px 0; box-sizing: border-box/.test(rule('.rules summary')), 'summary padded (28 -> 48)');
// fine-pointer base rules unchanged
assert(css.includes('.debug-toggle { font: inherit; font-size: 10px; letter-spacing: 1px; color: #7a5a4c; background: #fffaf0; border: 1px solid #d9c4b3; border-radius: 6px; padding: 2px 7px; cursor: pointer; }'), 'DEBUG base');
assert(css.includes('.debug-close { font: inherit; font-size: 13px; border: 1px solid #c9b5a6; background: #fff; border-radius: 6px; padding: 4px 10px; cursor: pointer; }'), 'close base');
assert(css.includes('.rules summary { cursor: pointer; font-weight: 700; }'), 'summary base');
assert(css.includes('#se-toggle { min-width: 64px; min-height: 40px;'), 'SE base');
// every interactive element in the page is covered
const tags = html.match(/<(button|summary|a|input|select|textarea)\b[^>]*>/g) || [];
assert.deepEqual(tags.map(t => t.match(/^<(\w+)/)[1]).sort(), ['button', 'button', 'summary', 'summary'], 'page targets: SE, DEBUG, 2 summaries');
const ui = fs.readFileSync(path.join(root, 'js', 'ui.js'), 'utf8');
for (const c of ['debug-item', 'debug-close']) assert(ui.includes(c), 'menu ' + c);
console.log(JSON.stringify({ touchTargets: 'PASS', selectors: 5 }));
