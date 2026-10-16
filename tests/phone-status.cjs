// Phone status panel (2026-10-16 auto cycle 06): at <=650px AERIAL / CONTACT / GUARD / DEBUG sit on one static row,
// "AERIAL ↓ READY" is visually a ↓ before the charge bar but stays in the DOM for screen readers, CONTACT keeps >= 72px
// before an ellipsis, DEBUG stays reachable. No animation. The text itself (ui.js) is unchanged.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phone = [...css.matchAll(/@media \(max-width: 650px\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).find(b => b.includes('Phone status panel'));
assert(phone, 'phone status block');
assert(css.indexOf('Phone status panel') > css.indexOf('.aerial-status { display: flex'), 'after base rules');
const rule = sel => { const m = phone.match(new RegExp('\\n  ' + sel.replace(/[#.()-]/g, '\\$&') + ' \\{([^}]*)\\}')); assert(m, sel); return m[1]; };
assert(/flex-wrap: nowrap/.test(rule('.aerial-status')) && /white-space: nowrap/.test(rule('.aerial-status')), 'one row');
assert(/content: "↓"/.test(rule('.aerial-status .down-readout::before')), 'down marker');
const ds = rule('#down-status'); assert(/clip-path: inset\(50%\)/.test(ds) && !/display: none/.test(ds), 'visually hidden, still announced');
assert(/text-overflow: ellipsis/.test(rule('#contact-status')) && /min-width: 72px/.test(phone), 'CONTACT kept readable');
assert(/flex: none/.test(rule('.aerial-status .debug-tools')), 'DEBUG not squeezed');
assert(+rule('.aerial-status').match(/font-size: (\d+)px/)[1] >= 11, 'readable');
assert(!/animation|transition|transform/.test(phone.slice(phone.indexOf('Phone status panel'))), 'static');
for (const id of ['up-status', 'down-status', 'down-charge', 'contact-status', 'guard-status', 'debug-toggle']) assert(html.includes(`id="${id}"`), id);
console.log(JSON.stringify({ phoneStatus: 'PASS' }));
