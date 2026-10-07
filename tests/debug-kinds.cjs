// Run with: node tests/debug-kinds.cjs — DEBUG kinds (menu / URL / per-check setups). Test-only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { scope, element, document, random } = require('./phase2.cjs');
const H = scope.Hop, c = H.CONFIG, { Game } = H;
let cases = 0;
function test(name, fn) { try { fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const SPECIALS = Object.keys(c.specials);
const MERCHANTS = Object.entries(c.merchantTypes).sort((a, b) => a[1].localeCompare(b[1]));
const IDS = ['all', 'aerial', ...SPECIALS.map(t => t.toLowerCase()), ...MERCHANTS.map(([, l]) => 'merchant-' + l.toLowerCase())];
function launchWith(game, angle = 40, power = 1) { game.act(); game.angle = angle; game.act(); game.power = power; game.act(); assert.equal(game.state, 'FLYING'); return game; }
// Step until a SPECIAL window opens (or the run ends); returns the elapsed game time.
function untilSpecial(game, limit = 4) { let t = 0; while (!game.special && game.state === 'FLYING' && t < limit) { game.update(c.physicsStep); t += c.physicsStep; } return t; }
const LAUNCHES = [[10, 0.3], [10, 1], [25, 0.65], [40, 0.3], [40, 1], [55, 0.5], [70, 0.3], [70, 0.65], [70, 1]];
function bind(game) { const ui = new H.UI(game, element('canvas')); H.bindInput(game, ui); return ui; }
const local = v => JSON.parse(JSON.stringify(v)); // vm-realm arrays → this realm (deepStrictEqual)
const key = code => document.listeners.keydown({ code, repeat: false, preventDefault() {} });

test('kind list: ids = ?debug values, one SPECIAL per config entry, merchants A-D, unique keys, Japanese labels from config', () => {
  assert.deepEqual(local(H.DEBUG_KINDS.map(k => k.id)).sort(), [...IDS].sort());
  assert.deepEqual(local(H.DEBUG_KINDS.filter(k => k.special).map(k => k.special)), SPECIALS);
  assert.deepEqual(local(H.DEBUG_KINDS.filter(k => k.merchant).map(k => [k.cast, k.merchant])), MERCHANTS);
  const keys = H.DEBUG_KINDS.map(k => k.key); assert.equal(new Set([...keys, '0']).size, keys.length + 1);
  for (const type of SPECIALS) {
    const label = Game.debugKindLabel(type.toLowerCase());
    assert.equal(label.title, c.specials[type].name); assert(label.detail.includes(H.CAST[type].name));
    if (c.specials[type].partner) assert(label.detail.includes(H.CAST[c.specials[type].partner].name) && label.detail.includes('合体'));
  }
  for (const [cast, letter] of MERCHANTS) { const label = Game.debugKindLabel('merchant-' + letter.toLowerCase()); assert.equal(label.title, `商人${letter} ${c.merchantNames[letter]}`); assert(label.detail.includes(H.CAST[cast].name)); }
  assert.equal(Game.debugKindLabel('all').title, '全キャラ順番'); assert.equal(Game.debugKindLabel('aerial').title, 'キャラなし'); assert.equal(Game.debugKindLabel(null).title, 'OFF');
  for (const id of [...IDS, null]) assert(/[ぁ-んァ-ヶ一-龠]/.test(Game.debugKindLabel(id).title + Game.debugKindLabel(id).detail), id);
  // 爆裂斜光 is the witch with the fighter adjacent to her right; 巨神昇天拳 the fighter with the witch.
  assert.equal(c.specials.BOOST.partner, 'BOUNCE'); assert.equal(c.specials.BOUNCE.partner, 'BOOST');
});

test('URL parameter: ?debug=<id>, bare ?debug / 1 / on → all, off / unknown / absent → normal', () => {
  for (const id of IDS) { assert.equal(Game.debugKindFromSearch('?debug=' + id), id); assert.equal(Game.debugKindFromSearch('?debug=' + id.toUpperCase()), id); }
  for (const s of ['?debug', '?debug=', '?debug=1', '?debug=on', '?debug=true', '?debug=ALL']) assert.equal(Game.debugKindFromSearch(s), 'all', s);
  for (const s of ['', null, undefined, '?', '?debug=off', '?debug=0', '?debug=nope', '?debugx=boost', '?xdebug=boost', '?debug=%E0%A4%A']) assert.equal(Game.debugKindFromSearch(s), null, String(s));
  assert.equal(Game.debugKindFromSearch('?lang=ja&debug=merchant-b#top'), 'merchant-b');
  assert.equal(Game.debugKindFromSearch('?debug=boost&x=1'), 'boost');
});

test('main.js applies ?debug= on load (badge, preconditions), and nothing without it', () => {
  function boot(search) {
    const els = new Map();
    const el = id => { if (!els.has(id)) els.set(id, { setAttribute(k, v) { this[k] = v; }, textContent: '', hidden: false, style: {}, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, getContext() { return new Proxy({}, { get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true) }); } }); return els.get(id); };
    const ctx = { document: { getElementById: el, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } }, requestAnimationFrame() {}, location: { search } }; ctx.window = ctx;
    vm.createContext(ctx);
    for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'input', 'main']) vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), ctx, { filename: name });
    return el;
  }
  let el = boot('?debug=boost');
  assert.equal(el('debug-status').hidden, false); assert.equal(el('debug-status').textContent, 'DEBUG: ' + c.specials.BOOST.name);
  el = boot('?debug=merchant-a');
  assert.equal(el('debug-status').textContent, `DEBUG: 商人A ${c.merchantNames.A}`); assert.equal(el('guard-status').textContent, 'GUARD × 1');
  el = boot('?debug=guard'); assert.equal(el('debug-status').textContent, 'DEBUG: ' + c.specials.GUARD.name);
  el = boot(''); assert.equal(el('debug-status').hidden, true); assert.equal(el('guard-status').textContent, 'GUARD × 0');
  el = boot('?debug=unknown'); assert.equal(el('debug-status').hidden, true);
});

test('menu: D / DEBUG button open it, number keys / Q W E R / click select, Esc / D / backdrop close, badge names the kind', () => {
  const g = new Game(random(5)); const ui = bind(g); const menu = element('debug-menu');
  ui.closeDebugMenu(); assert(menu.hidden); assert(!g.debug);
  key('Digit2'); assert(!g.debug, 'digits do nothing while the menu is closed');
  document.listeners.keydown({ code: 'KeyD', repeat: false, ctrlKey: true }); assert(menu.hidden, 'Ctrl+D is left to the browser');
  key('KeyD'); assert(!menu.hidden); assert(ui.debugMenuOpen); assert.equal(element('debug-toggle')['aria-expanded'], 'true');
  for (const id of ['off', ...IDS]) assert(menu.innerHTML.includes(`data-debug-kind="${id}"`), id);
  for (const type of SPECIALS) assert(menu.innerHTML.includes(c.specials[type].name));
  for (const letter of 'ABCD') assert(menu.innerHTML.includes(c.merchantNames[letter]));
  key('Escape'); assert(menu.hidden); assert(!g.debug);
  key('KeyD'); key('KeyD'); assert(menu.hidden, 'a second D closes');
  const expect = { Digit1: 'all', Digit9: 'aerial', KeyQ: 'merchant-a', KeyW: 'merchant-b', KeyE: 'merchant-c', KeyR: 'merchant-d', Numpad4: SPECIALS[2].toLowerCase() };
  SPECIALS.forEach((type, i) => { expect['Digit' + (i + 2)] = type.toLowerCase(); });
  for (const [code, id] of Object.entries(expect)) {
    key('KeyD'); key(code); assert(menu.hidden, code); assert.equal(g.activeDebugKind(), id, code); assert(g.debugUsed);
    assert.equal(element('debug-status').hidden, false); assert.equal(element('debug-status').textContent, 'DEBUG: ' + Game.debugKindLabel(id).title);
  }
  key('KeyD'); assert(menu.innerHTML.includes(`data-debug-kind="${g.activeDebugKind()}" aria-pressed="true"`), 'active kind is marked');
  assert.equal((menu.innerHTML.match(/aria-pressed="true"/g) || []).length, 1); key('Digit0');
  assert.equal(g.debug, false); assert.equal(g.activeDebugKind(), null); assert(element('debug-status').hidden);
  // Touch / mouse: the DEBUG button toggles, an item click selects, the backdrop or 閉じる closes.
  element('debug-toggle').listeners.click(); assert(!menu.hidden);
  const target = id => ({ closest: sel => sel === '[data-debug-kind]' && id ? { dataset: { debugKind: id } } : sel === '[data-debug-close]' && id === null ? {} : null });
  menu.listeners.click({ target: target('boost') }); assert(menu.hidden); assert.equal(g.activeDebugKind(), 'boost');
  assert.equal(element('debug-status').textContent, 'DEBUG: ' + c.specials.BOOST.name);
  element('debug-toggle').listeners.click(); menu.listeners.click({ target: menu }); assert(menu.hidden); assert.equal(g.activeDebugKind(), 'boost');
  element('debug-toggle').listeners.click(); menu.listeners.click({ target: target(null) }); assert(menu.hidden);
  element('debug-toggle').listeners.click(); element('debug-toggle').listeners.click(); assert(menu.hidden);
  element('debug-toggle').listeners.click(); menu.listeners.click({ target: target('off') }); assert(!g.debug);
  // The stage still has its single pointer listener; the game state never advanced from the menu.
  assert.deepEqual(local(Object.keys(element('stage').listeners)), ['pointerdown']); assert.equal(g.state, 'READY');
});

test('menu pauses game time while open (main loop passes 0)', () => {
  const src = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
  assert(/game\.update\(ui\.debugMenuOpen \? 0 : deltaTime\)/.test(src));
  const g = launchWith(new Game(random(2))); const x = g.body.x; g.update(0); assert.equal(g.body.x, x);
});

for (const type of SPECIALS) {
  test(`SPECIAL kind ${type.toLowerCase()} (${c.specials[type].name}) fires on the first contact right after launch`, () => {
    const rule = c.specials[type];
    for (const [angle, power] of LAUNCHES) {
      const where = `${angle}° ${power}`;
      const g = new Game(() => 0.99); // the ANGLE 10% draw / merchant draw would always miss
      assert(g.setDebugKind(type.toLowerCase())); assert(g.debugUsed);
      const first = g.objects[0]; assert.equal(first.type, type); assert.equal(first.x, c.debugSetupAhead);
      if (rule.trigger === 'adjacent') assert.deepEqual([g.objects[1].type, g.objects[1].x], [rule.partner, c.debugSetupAhead + c.debugPartnerGap]);
      launchWith(g, angle, power);
      const t = untilSpecial(g);
      assert(g.special, where); assert(t < 0.2, where + ' soon after launch: ' + t);
      assert.equal(g.special.type, type, where); assert.equal(g.special.merchantType, null, where);
      assert.equal(g.history.length, 1, where + ' first contact'); assert.equal(g.body.bounces, 0, where);
      if (rule.trigger === 'adjacent') assert.equal(g.special.partner.type, rule.partner);
      g.resolveSpecial(true);
      assert.equal(g.specialSuccesses, 1); assert.equal(g.history[0].label, `${type} SPECIAL`);
      assert.equal(g.specialCutin.name, rule.name); assert.equal(g.specialMessage.detail, rule.name);
      assert.equal(g.soundEvent, 'SPECIAL_' + type);
      if (rule.trigger === 'adjacent') { assert(g.combo, where + ' combo'); assert.equal(g.combo.partner.type, rule.partner); }
      if (type === 'GUARD') assert(g.guardSpecial.active);
      if (type === 'STOPPER') assert.equal(g.state, 'FLYING');
    }
  });
}

for (const [cast, letter] of MERCHANTS) {
  test(`merchant kind merchant-${letter.toLowerCase()} yields Type ${letter} (${c.merchantNames[letter]}) at once, draw skipped`, () => {
    for (const [angle, power] of LAUNCHES) {
      let draws = 0; const g = new Game(() => { draws++; return 0.99; });
      g.setDebugKind('merchant-' + letter.toLowerCase());
      assert.equal(g.normalGuard, 1); assert.equal(g.objects[0].type, cast); assert(g.objects[0].debugBoundary);
      launchWith(g, angle, power); const before = draws;
      untilSpecial(g);
      assert(g.special, angle + ' ' + power); assert.equal(g.special.merchantType, letter); assert.equal(g.history.length, 1);
      assert.equal(draws, before, 'no merchant draw in DEBUG');
      g.resolveSpecial(true);
      assert.equal(g.merchantStats.lastType, letter); assert.equal(g.merchantStats.successes, 1);
      if (letter !== 'C' || g.merchant) assert.equal(g.merchant.type, letter);
      assert.equal(g.specialCutin.name, c.merchantNames[letter]); assert.equal(g.soundEvent, 'SPECIAL_MERCHANT');
    }
  });
}

test('merchant kinds show the DEBUG MERCHANT ZONE / label for their prepared boundary; normal play never does', () => {
  const g = new Game(random(4)); const ui = bind(g); g.setDebugKind('merchant-c'); launchWith(g);
  const zone = H.UI.zone(g); assert(zone); assert.equal(zone.boundary, c.debugSetupAhead / c.pixelsPerMeter);
  const targets = H.UI.readyTargets(g); assert.equal(targets[0].label, 'MERCHANT'); assert.equal(targets[0].object, g.objects[0]);
  assert.equal(targets.filter(t => t.label === 'MERCHANT').length, 1); ui.update(); assert(!element('merchant-zone').hidden);
  // Normal play: the same character / guard without DEBUG → no hint, and the boundary rule is the real 100m one.
  g.debug = false; ui.update(); assert(element('merchant-zone').hidden); assert.equal(H.UI.readyTargets(g).filter(t => t.label !== 'SPECIAL').length, 0); assert.equal(H.UI.zone(g), null, 'real 100m boundary is far away');
  ui.closeDebugMenu(); assert.equal(element('debug-menu').hidden, true);
  // The page itself never lists merchant names / probabilities (the menu is rendered only when opened).
  for (const name of Object.values(c.merchantNames)) assert(!html.includes(name), name);
  assert(!/merchantChance|20%/.test(html)); assert(/<div id="debug-menu"[^>]*hidden><\/div>/.test(html));
});

test('aerial kind: no characters at all; all kind = the original fixed-order DEBUG', () => {
  const g = new Game(random(8)); g.setDebugKind('aerial'); launchWith(g, 45, 1);
  for (let i = 0; i < 120 * 40 && g.state === 'FLYING'; i++) { if (i % 150 === 0) g.act(); g.update(c.physicsStep); assert.equal(g.objects.length, 0); }
  assert.equal(g.state, 'RESULT'); assert.equal(g.history.length, 0); assert(g.upRemaining < 3);
  const a = new Game(random(3)); a.setDebugKind('all'); const b = new Game(random(3)); b.toggleDebug();
  const seq = game => { game.body.x = 5000; game.generateObjects(); return game.objects.map(o => `${o.x}:${o.type}:${Object.keys(o).join()}`); };
  assert.deepEqual(local(seq(a)), local(seq(b)));
  const fresh = new Game(random(3)); fresh.debug = true; fresh.reset(); fresh.body.x = 5000; fresh.generateObjects();
  assert.deepEqual(local(seq(a)), local(fresh.objects.map(o => `${o.x}:${o.type}:${Object.keys(o).join()}`)));
  const order = Object.keys(c.castPickWeights);
  fresh.objects.forEach(o => { assert.equal((o.x - c.debugFirst) % c.debugGap, 0); assert.equal(o.type, order[((o.x - c.debugFirst) / c.debugGap) % order.length]); });
});

test('after the prepared check the fixed-order DEBUG placement continues; RETRY prepares the check again', () => {
  const g = new Game(random(6)); g.setDebugKind('boost');
  g.generateObjects();
  const after = g.objects.filter(o => !o.debugSetup);
  assert(after.length > 0); assert.equal(after[0].x, c.debugSetupAhead + c.debugPartnerGap + c.debugGap); assert.equal(after[0].type, Object.keys(c.castPickWeights)[0]);
  g.body.x = 0; g.reset(); g.finish(); g.act(); // RESULT → RETRY
  assert.equal(g.activeDebugKind(), 'boost'); assert(g.debugUsed);
  assert.deepEqual(local(g.objects.slice(0, 2).map(o => [o.type, o.x])), [['BOOST', c.debugSetupAhead], ['BOUNCE', c.debugSetupAhead + c.debugPartnerGap]]);
  // Chosen in flight: the check is placed debugFirst ahead of the hero with its precondition.
  const f = launchWith(new Game(random(7))); for (let i = 0; i < 30; i++) f.update(c.physicsStep);
  assert(!f.debugUsed); f.setDebugKind('dash'); assert(f.debugUsed); assert(f.specialArmed.dash);
  assert.equal(f.objects[0].type, 'DASH'); assert.equal(f.objects[0].x, f.body.x + c.debugFirst);
  // Choosing another kind before launch drops the previous kind's preconditions.
  const p = new Game(random(9)); p.setDebugKind('merchant-a'); assert.equal(p.normalGuard, 1); p.setDebugKind('dash');
  assert.equal(p.normalGuard, 0); assert(p.specialArmed.dash); p.setDebugKind('stopper'); assert(!p.specialArmed.dash); assert(p.specialArmed.stopper);
  assert.equal(p.setDebugKind('nope'), false); assert.equal(p.activeDebugKind(), 'stopper');
});

test('any DEBUG kind makes the play 記録対象外 (no best / storage write, RESULT says so)', () => {
  let writes = 0; const store = scope.localStorage; scope.localStorage = { getItem: () => null, setItem() { writes++; } };
  try {
    for (const id of IDS) {
      const g = new Game(random(11)); const ui = bind(g); g.setDebugKind(id); assert(g.debugUsed, id);
      launchWith(g, 30, 0.8); let f = 0;
      while (g.state === 'FLYING' && f++ < 120 * 300) { if ((g.special && g.history.length === 1) || g.combo) g.act(); g.update(c.physicsStep); }
      assert.equal(g.state, 'RESULT', id); assert.equal(g.newRecords.length, 0); assert.equal(g.best.distance, 0);
      ui.update(); assert(element('record-status').textContent.includes('記録対象外'), id);
      g.act(); assert(g.debugUsed, id + ' RETRY stays DEBUG');
    }
    assert.equal(writes, 0);
    // Selecting a kind at RESULT keeps that finished run as it was and prepares the next one.
    const r = new Game(random(12)); launchWith(r); r.objects = []; r.nextObjectX = Infinity; r.nextBoundaryX = Infinity;
    while (r.state === 'FLYING') r.update(c.physicsStep);
    assert.equal(writes, 1); assert(!r.debugUsed); r.setDebugKind('guard'); assert(!r.debugUsed); r.act(); assert(r.debugUsed); assert.equal(r.normalGuard, 1);
  } finally { scope.localStorage = store; }
});

test('OFF restores normal spawning (boundaries, weighted random, no DEBUG flags) and RETRY is recorded again', () => {
  const g = new Game(random(13)); const ui = bind(g);
  g.setDebugKind('angle'); g.setDebugKind(null); assert.equal(g.debug, false); assert.equal(g.debugKind, null); assert(g.debugUsed);
  assert.equal(g.setDebugKind(null), false, 'OFF twice is a no-op');
  key('KeyD'); key('Digit7'); assert.equal(g.activeDebugKind(), 'angle'); key('KeyD'); key('Digit0'); assert.equal(g.debug, false);
  launchWith(g); let f = 0; while (g.state === 'FLYING' && f++ < 120 * 120) g.update(c.physicsStep);
  g.act(); assert.equal(g.debugUsed, false); assert.equal(g.normalGuard, 0); assert.deepEqual(local(g.specialArmed), { dash: false, stopper: false, brake: false });
  const seen = [];
  for (let x = 0; x < 40000; x += 400) { g.body.x = x; g.generateObjects(); for (const o of g.objects) if (!seen.includes(o)) seen.push(o); }
  assert(seen.every(o => !o.debugSetup && !o.debugForce && !o.debugBoundary));
  assert(seen.some(o => o.boundary), 'extra 100m boundary spawns are back');
  const gaps = seen.filter(o => !o.boundary).map((o, i, a) => i ? o.x - a[i - 1].x : null).slice(1);
  assert(gaps.some(d => d !== c.debugGap) && gaps.every(d => d >= c.objectGapMin - 1e-9));
  ui.update(); assert(element('debug-status').hidden);
});

test('normal play is unchanged: fixed-seed fingerprint recorded from the pre-DEBUG-kinds code (4c3aec7)', () => {
  // 160 seeded plays with mixed SPECIAL taps / skips / AERIAL; finals, contacts, SPECIAL / merchant counts and the
  // number of random() draws must match the fingerprint taken from main 4c3aec7 before this change.
  function play(seed) {
    let draws = 0; const base = random(seed * 31 + 7);
    const g = new Game(() => { draws++; return base(); });
    g.act(); g.angle = 15 + (seed * 7) % 55; g.act(); g.power = 0.4 + (seed % 7) * 0.1; g.act();
    let f = 0;
    while (g.state === 'FLYING' && f < 120 * 300) {
      if (g.special && (seed % 3 !== 0)) g.act();
      else if (g.combo && seed % 2) g.act();
      else if (!g.special && !g.combo && f % (97 + seed) === 0 && seed % 4 === 1) g.act();
      g.update(c.physicsStep); f++;
    }
    assert(g.objects.every(o => !o.debugSetup && !o.debugForce && !o.debugBoundary)); assert.equal(g.debugKind, null);
    return [g.state, g.finalDistance.toFixed(3), g.maxHeight.toFixed(3), g.maxSpeed.toFixed(3), g.body.bounces, g.history.map(e => e.label).join(','), g.specialCount, g.specialSuccesses, JSON.stringify(g.merchantStats), draws, f].join('|');
  }
  const lines = []; for (let seed = 1; seed <= 160; seed++) lines.push(play(seed));
  assert.equal(lines.filter(l => /MERCHANT/.test(l)).length, 3); assert.equal(lines.filter(l => /SPECIAL/.test(l)).length, 56);
  assert.equal(lines[0], 'RESULT|1344.914|1268.683|2074.332|9|ANGLE,DASH,ANGLE,ANGLE,BOUNCE SPECIAL,BRAKE,GUARD,STOPPER (GUARDED)|1|1|{"attempts":0,"successes":0,"lastType":null,"revives":0}|51|2153');
  assert.equal(crypto.createHash('sha256').update(lines.join('\n')).digest('hex'), '8cfecc1beadfd41906ebe1bf22f525fcf4911817a97b7a78ef8a1b00e212d12a');
});

test('reducedMotion still respected in DEBUG kinds (combo short version)', () => {
  const g = new Game(() => 0.5); const ui = bind(g); ui.visual.reducedMotion = true; g.setDebugKind('bounce'); launchWith(g);
  untilSpecial(g); ui.update(); g.act(); assert(g.combo); assert(g.combo.short); assert.equal(g.combo.total, c.comboReducedDuration);
  ui.visual.reducedMotion = false;
});

test('help (index.html) and README list the kinds and URL parameters', () => {
  for (const id of IDS.filter(id => !id.startsWith('merchant-'))) assert(html.includes(id === 'all' || id === 'aerial' || id === 'boost' ? `?debug=${id}` : `<code>${id}</code>`), id);
  assert(html.includes('?debug=merchant-a') && html.includes('merchant-d')); assert(html.includes('DEBUGボタン'));
  for (const id of IDS) assert(readme.includes(`?debug=${id}`), 'README ' + id);
  assert(readme.includes('https://dicek9750.github.io/Flash-game/?debug=boost'));
});

console.log(JSON.stringify({ debugKinds: 'PASS', cases, kinds: IDS }));
