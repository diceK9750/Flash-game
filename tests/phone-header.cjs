// Phone header (2026-10-16 auto cycle 07): at <=650px the version note, 音声・SE button and BEST badge stay on one
// static row (no wrap of the meta row; the version note wraps inside its own cell), SE keeps a 40px tap height.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const phone = [...css.matchAll(/@media \(max-width: 650px\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).find(b => b.includes('Phone header'));
assert(phone, 'phone header block');
assert(css.indexOf('Phone header (2026') > css.lastIndexOf('.header-meta { flex-wrap: wrap; }'), 'overrides the base wrap rule');
const rule = sel => { const m = phone.match(new RegExp('\\n  ' + sel.replace(/[#.()-]/g, '\\$&') + ' \\{([^}]*)\\}')); assert(m, sel); return m[1]; };
assert(/flex-wrap: nowrap/.test(rule('.header-meta')), 'one row');
assert(/min-width: 0/.test(rule('.edition')) && /flex: 1 1 auto/.test(rule('.edition')), 'version note yields space');
assert(/flex: none/.test(rule('#se-toggle')) && !/min-height/.test(rule('#se-toggle')), 'SE keeps base 40px tap height');
assert(/min-height: 40px/.test(css.match(/\n#se-toggle \{[^}]*\}/)[0]));
assert(/flex: none/.test(rule('#best-summary')) && +rule('#best-summary').match(/font-size: (\d+)px/)[1] >= 12, 'BEST readable, not squeezed');
assert(+rule('.edition').match(/font-size: (\d+)px/)[1] >= 10);
assert(!/animation|transition|transform/.test(phone.slice(phone.indexOf('Phone header'))), 'static');
console.log(JSON.stringify({ phoneHeader: 'PASS' }));
