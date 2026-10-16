// Load order (2026-10-17 auto cycle 19). Measured on Pages: first load = 77 requests / 4.44 MB, of which the eight
// SPECIAL cut-in face plates are 2.28 MB (51%); at 250 KB/s the truck sprite (title screen) was ready only at
// ~16.3 s because the plates competed with it. Now the plates start after truck + hero IDLE are ready (~6.1 s for
// the truck at 250 KB/s); same files, same drawing, castReady still covers every slot. No game logic involved.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const log = [], held = [];
  const gate = url => /truck_comic_v1\/truck_idle|hero.*idle/i.test(url);
  const fetch = url => new Promise(res => {
    log.push(url);
    const respond = () => res({ ok: false, json: async () => ({}) }); // assets "missing": loader resolves not-ready
    if (gate(url)) held.push(respond); else respond();
  });
  const scope = { fetch, Image: class {}, console, setTimeout, Promise, Hop: {} };
  scope.window = scope; vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8'), scope, { filename: 'sprites.js' });
  const S = scope.Hop.Sprites, C = S.definitions.CAST;
  const faces = Object.values(C).map(s => s.CUTIN_FACE).filter(d => d && d.enabled !== false).map(d => d.metadata);
  assert.equal(faces.length, 8, 'eight cut-in plates');
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
  assert(held.length >= 2, 'truck + hero idle requested first: ' + held.length);
  assert.equal(faces.filter(f => log.includes(f)).length, 0, 'no cut-in plate requested while truck / hero idle are loading');
  const bodies = Object.values(C).flatMap(s => Object.entries(s)).filter(([n, d]) => n !== 'CUTIN_FACE' && d.enabled !== false).map(([, d]) => d.metadata);
  assert(bodies.every(b => log.includes(b)), 'cast body sprites (drawn in flight) are not deferred');
  held.splice(0).forEach(f => f());
  const all = await S.castReady;
  assert(faces.every(f => log.includes(f)), 'plates requested after the title-screen sprites');
  assert(log.indexOf(faces[0]) > log.findIndex(gate), 'plates after truck');
  for (const [id, slots] of Object.entries(C)) for (const name of Object.keys(slots)) assert(S.castAssets[id][name], id + '.' + name + ' in castAssets');
  assert.equal(all.length, Object.values(C).reduce((n, s) => n + Object.keys(s).length, 0), 'castReady covers every slot');
  assert.equal(S.cutinFaceLayer('BOOST'), null, 'not-ready plate -> null (cut-in falls back to the body layer)');
  console.log(JSON.stringify({ loadOrder: 'PASS', plates: faces.length, requests: log.length }));
})().catch(e => { console.error(e); process.exit(1); });
