// Phone flight HUD stacking (2026-10-16 auto cycle 05): at <=650px the AERIAL / merchant boxes are one compact row,
// SPECIAL READY sits just below them and the next-rank line in the bottom corner. Static layout only (no motion).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const blocks = [...css.matchAll(/@media \(max-width: 650px\) \{([\s\S]*?)\n\}/g)];
const phone = blocks.map(m => m[1]).find(b => b.includes('#merchant-hud'));
assert(phone, 'phone flight HUD block exists');
const at = s => css.indexOf(s);
assert(css.lastIndexOf('@media (max-width: 650px)') > at('.ready-targets { position: absolute') && css.lastIndexOf('@media (max-width: 650px)') > at('.next-rank { position: absolute'), 'phone block follows base rules (cascade)');
const rule = sel => { const m = phone.match(new RegExp(sel.replace(/[#.()-]/g, '\\$&') + ' \\{([^}]*)\\}')); assert(m, sel); return m[1]; };
const px = (r, k) => +(r.match(new RegExp('(?:^|[ ;])' + k + ': (\\d+)px')) || [])[1];
const hud = rule('.flight-hud'), box = rule('#aerial-hud, #merchant-hud'), ready = rule('.ready-targets');
assert(/flex-wrap: nowrap/.test(box) && /white-space: nowrap/.test(box), 'one row per box');
const boxBottom = px(hud, 'top') + px(box, 'line-height') + 2 * 2; // padding 2px top/bottom
assert(/padding: 2px 6px/.test(box)); assert(px(ready, 'top') >= boxBottom + 4, `READY (${px(ready, 'top')}) clears the HUD row (${boxBottom})`);
assert(px(hud, 'font-size') >= 10 && px(ready, 'font-size') >= 10 && px(rule('.next-rank'), 'font-size') >= 10, 'readable >= 10px');
assert(!/animation|transition|transform/.test(phone.slice(phone.indexOf('Phone flight HUD'))), 'static');
console.log(JSON.stringify({ mobileHud: 'PASS', hudRowBottom: boxBottom, readyTop: px(ready, 'top') }));
