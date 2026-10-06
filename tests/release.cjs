// No dependencies. --serve provides an optional localhost/subpath QA preview.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!process.argv.includes('--serve')) {
  // Run every suite once in this process, including their shared prerequisites.
  // Keep release checks last; never recursively require this entry point.
  const suites = fs.readdirSync(__dirname).filter(file => file.endsWith('.cjs') && file !== path.basename(__filename)).sort();
  for (const suite of suites) require(path.join(__dirname, suite));
  console.log('All suites loaded once: ' + suites.join(', '));
  const { scope, element, launch } = require('./phase2.cjs');
  assert.equal(scope.Hop.CONFIG.specialWindow, 1.0);
  const baseline = {
    launchSpeed: 1250, angleMin: 10, angleMax: 70, angleDefault: 40, anglePeriod: 2.4,
    powerMin: 0.3, powerMax: 1, powerPeriod: 1.7, gravity: 820, airDrag: 0.075,
    restitution: 0.67, bounceHorizontalRetention: 0.89, groundDeceleration: 155,
    settleBounceSpeed: 75, stopSpeed: 12, physicsStep: 1 / 120, maxFrameDelta: 0.1,
    aerialUpUses: 3, aerialUpVertical: 620, aerialUpHorizontal: 85,
    aerialDownVertical: 760, aerialDownHorizontal: 35, aerialDownRechargeTime: 1.5,
    maxHorizontalSpeed: 2000, maxVerticalSpeed: 1500,
    objectFirstMin: 400, objectFirstMax: 650, objectGapMin: 420, objectGapMax: 850,
    objectWidth: 54, objectHeight: 64, playerRadius: 18,
    storageKey: 'hop-distance-best-v1', debugGap: 600, debugFirst: 400
  };
  for (const [key, value] of Object.entries(baseline)) assert.equal(scope.Hop.CONFIG[key], value, key);
  assert.equal(JSON.stringify(scope.Hop.CONFIG.objectWeights), JSON.stringify({ BOOST: 0.28, BOUNCE: 0.22, BRAKE: 0.18, ANGLE: 0.12, DASH: 0.08, GUARD: 0.07, STOPPER: 0.05 }));
  assert.equal(Object.keys(scope.Hop.CONFIG.objectWeights).length, 7);
  assert.equal(scope.Hop.CAST.SPECIAL_ONLY.spawn, false);
  assert.equal(Object.keys(scope.Hop.CAST).length, 9);
  for (const [, file] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert(!/^(?:\/|[a-z]+:)/i.test(file)); assert(fs.existsSync(path.join(root, file)));
    assert(new URL(file, 'https://example.test/repo/').pathname.startsWith('/repo/'));
  }
  // Static publication contract: local assets must also work below a Pages subpath.
  const required = ['index.html', '.nojekyll', 'favicon.svg', 'css/style.css', ...['config','game','physics','input','ui','graphics','audio','main'].map(name => 'js/' + name + '.js')];
  for (const file of required) assert(fs.statSync(path.join(root, file)).isFile(), 'Missing required file: ' + file);
  function localAsset(ref, base = "") {
    assert(ref && !/^(?:[a-z][a-z0-9+.-]*:|[/\\])/i.test(ref), 'Asset must be relative: ' + ref);
    const url = new URL(ref, 'https://example.test/Flash-game/' + base);
    assert.equal(url.origin, 'https://example.test');
    assert(url.pathname.startsWith('/Flash-game/'), 'Asset escapes Pages subpath: ' + ref);
    const local = path.resolve(root, decodeURIComponent(url.pathname.slice('/Flash-game/'.length)));
    assert(local.startsWith(root + path.sep), 'Asset escapes project: ' + ref);
    assert(fs.statSync(local).isFile(), 'Missing asset: ' + ref);
  }
  for (const ref of ['https://cdn.example.test/game.js', '//cdn.example.test/game.js', '/js/main.js', '../js/main.js']) assert.throws(() => localAsset(ref), 'Reject remote or root-relative assets');
  assert.throws(() => localAsset('https://cdn.example.test/font.woff', 'css/'));
  for (const [, ref] of html.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)) localAsset(ref);
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  for (const [, ref] of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) localAsset(ref, 'css/');
  for (const [, ref] of css.matchAll(/@import\s+["']([^"']+)["']/gi)) localAsset(ref, 'css/');
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => Object.fromEntries([...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(([,key,value]) => [key,value])));
  for (const name of ['og:title','og:description','og:type','twitter:card','theme-color']) assert(meta.some(tag => (tag.property === name || tag.name === name) && tag.content?.trim()), 'Missing metadata: ' + name);
  assert.equal(meta.find(tag => tag.property === 'og:title').content, html.match(/<title>(.*?)<\/title>/)[1]);
  assert(/<link\b[^>]*rel="icon"[^>]*href="favicon.svg"/.test(html));
  const icon = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');
  assert(icon.includes('viewBox="0 0 64 64"'));assert(!/<(?:script|image)\b/i.test(icon));
  for (const key of ['specialWindow','boundaryMeters','merchantZoneMeters','aerialDownRechargeTime']) assert(Number.isFinite(scope.Hop.CONFIG[key]) && scope.Hop.CONFIG[key] > 0, key);
  assert.equal(typeof scope.Hop.CONFIG.storageKey, 'string');assert(scope.Hop.CONFIG.storageKey.length > 0);
  assert.notEqual(scope.Hop.CONFIG.storageKey, scope.Hop.Audio.storageKey);
  const game = launch(); const ui = new scope.Hop.UI(game, element('canvas'));
  const ctx = element('canvas').getContext('2d');
  for (const id of Object.keys(scope.Hop.CAST)) scope.Hop.Graphics.character(ctx, id, 100, 200);
  for (const type of Object.keys(scope.Hop.CONFIG.objectWeights)) {
    game.contact = { label: type, remaining: 1 }; ui.update();
    const before = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), before);
  }
  for (const state of ['READY', 'AIM_ANGLE', 'AIM_POWER', 'FLYING', 'RESULT']) {
    game.state = state; game.finalDistance = 123; ui.update(); ui.draw();
  }
  assert.equal(element('result-distance').textContent, '123.0 m');
  for (const type of ['A', 'B', 'C', 'D']) {
    game.acquireMerchant(type); game.merchantVisual = { type, remaining: 1 };
    ui.update(); const before = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), before);
  }
  console.log('Release PASS: retained physics/contact config, pointer-only input, 1.0s, 9 silhouettes, merchant draw purity, states, relative paths.');
} else {
  const http = require('node:http');
  const spriteDirs = ['assets/sprites/hero/flight_loop/', 'assets/sprites/hero/hero_flight_comic_v1/', 'assets/sprites/hero/hero_aerial_up_v1_bundle/', 'assets/sprites/hero/hero_aerial_up_comic_v1/', 'assets/sprites/hero/hero_aerial_down_v1_bundle/', 'assets/sprites/hero/hero_aerial_down_comic_v1/', 'assets/sprites/hero/hero_ground_bounce_v1_bundle/', 'assets/sprites/hero/hero_ground_bounce_comic_v1/', 'assets/sprites/hero/hero_stop_result_v1_bundle/', 'assets/sprites/hero/hero_stop_result_comic_v1/', 'assets/sprites/hero/hero_hit_hd_v1/', 'assets/sprites/hero/idle/', 'assets/sprites/hero/hero_idle_comic_v1/', 'assets/sprites/hero/hero_special_reaction_v1_bundle/', 'assets/sprites/hero/hero_special_reaction_comic_v1/',
    ...['boost_witch', 'boost_witch_comic_v1', 'bounce_fighter', 'bounce_fighter_comic_v1', 'brake_thief', 'brake_thief_comic_v1', 'angle_jester', 'angle_jester_comic_v1', 'dash_warrior', 'dash_warrior_comic_v1', 'guard_sage', 'guard_sage_comic_v1', 'stopper_cleric', 'stopper_cleric_comic_v1', 'merchant', 'merchant_comic_v1'].map(name => 'assets/sprites/cast/' + name + '/'), 'assets/sprites/truck/truck_comic_v1/'].filter(dir => fs.existsSync(path.join(root, dir)));
  const allowed = new Set(['index.html', 'favicon.svg', 'css/style.css', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f), ...spriteDirs.flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(f => /\.(png|json|gif)$/.test(f)).map(f => dir + f))]);
  const qa = '<script>' + fs.readFileSync(path.join(__dirname, 'qa.js'), 'utf8') + '</script>';
  http.createServer((req, res) => {
    const prefix = '/NANACACRASH/';
    if (!req.url.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const file = req.url.slice(prefix.length) || 'index.html';
    if (file === 'qa.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html.replace('<script defer src="js/main.js"></script>', '').replace('</body>', qa + '</body>').replaceAll(' defer ', ' ')); return; }
    if (!allowed.has(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.gif') ? 'image/gif' : file.endsWith('.json') ? 'application/json' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    fs.createReadStream(path.join(root, file)).pipe(res);
  }).listen(8765, '127.0.0.1', () => console.log('Preview http://127.0.0.1:8765/NANACACRASH/ | QA: /NANACACRASH/qa.html'));
}
