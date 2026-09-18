// No dependencies. --serve provides an optional localhost/subpath QA preview.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hashes = {
  'input.js': 'ea171fc2472efeb7e0199f7a00f6010a2e0402c6e9df7bc56dedc6881569364d'
};
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!process.argv.includes('--serve')) {
  require('./specials.cjs');
  const { scope, element, launch } = require('./phase2.cjs');
  for (const [file, expected] of Object.entries(hashes)) {
    // Input remains byte-for-byte unchanged. Formal SPECIAL intentionally changes
    // config/game and adds a return event to physics; check retained values below.
    const bytes = fs.readFileSync(path.join(root, 'js', file));
    const digest = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, expected, `${file}: intentional logic changes require a new reviewed baseline`);
  }
  assert.equal(scope.Hop.CONFIG.specialWindow, 1.0);
  const baseline = {
    launchSpeed: 1250, angleMin: 10, angleMax: 70, angleDefault: 40, anglePeriod: 2.4,
    powerMin: 0.3, powerMax: 1, powerPeriod: 1.7, gravity: 820, airDrag: 0.075,
    restitution: 0.67, bounceHorizontalRetention: 0.89, groundDeceleration: 155,
    settleBounceSpeed: 75, stopSpeed: 12, physicsStep: 1 / 120, maxFrameDelta: 0.1,
    aerialUpUses: 3, aerialUpVertical: 620, aerialUpHorizontal: 85,
    aerialDownVertical: 760, aerialDownHorizontal: 35, aerialDownCooldown: 1.5,
    maxHorizontalSpeed: 2000, maxVerticalSpeed: 1500,
    objectFirstMin: 400, objectFirstMax: 650, objectGapMin: 420, objectGapMax: 850,
    objectWidth: 54, objectHeight: 64, playerRadius: 18,
    boostHorizontal: 460, bounceHorizontal: 140, bounceVertical: 780, brakeRetention: 0.25,
    angleDegrees: 35, angleSpeedRetention: 1, dashHorizontal: 900, dashVertical: 90, stopperRetention: 0.06,
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
  console.log('Release PASS: retained physics/contact config, unchanged input hash, 1.0s, 9 silhouettes, merchant draw purity, states, relative paths.');
} else {
  const http = require('node:http');
  const allowed = new Set(['index.html', 'css/style.css', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)]);
  const qa = `<script>
  const game = new Hop.Game(); game.debug = true; game.debugUsed = true;
  const ui = new Hop.UI(game, document.getElementById('canvas')); Hop.bindInput(game, ui);
  const panel = document.createElement('section'); panel.style='padding:12px;display:flex;gap:8px;flex-wrap:wrap';
  document.querySelector('main').prepend(panel);
  let paused = false;
  const pause = document.createElement('button'); pause.textContent = 'QA 一時停止';
  pause.onclick = () => { paused = !paused; pause.textContent = paused ? 'QA 再生' : 'QA 一時停止'; }; panel.append(pause);
  for (const scenario of ['BOOST','BOUNCE','DASH','STOPPER','商人 A','商人 B','商人 C','商人 D']) {
    const button = document.createElement('button'); button.textContent = 'QA ' + scenario;
    button.onclick = () => {
      paused = true; pause.textContent = 'QA 再生';
      game.reset(); game.debugUsed = true; game.state = Hop.STATES.FLYING;
      const merchant = scenario.startsWith('商人'), target = scenario.slice(-1);
      const type = merchant ? {A:'STOPPER',B:'DASH',C:'BOOST',D:'BOUNCE'}[target] : scenario;
      const x = merchant ? 800 : 500;
      Object.assign(game.body,{x:x-20,y:10,vx:500,vy:-100,grounded:false});
      game.objects=[{x,type,used:false}]; game.nextObjectX=x+600; game.nextBoundaryX=1600; game.cameraX=x-250;
      const rule = Hop.CONFIG.specials[type];
      if (merchant) game.guard = 1;
      else if (rule.partner) game.objects.push({x:x+300,type:rule.partner,used:false});
      else game.specialArmed[rule.trigger] = true;
      game.contactObjects({x:x-70,y:10}); ui.update(); ui.draw();
    }; panel.append(button);
  }
  const result = document.createElement('button'); result.textContent='QA RESULT';
  result.onclick=()=>{game.special=null;game.finish();ui.update();ui.draw();};panel.append(result);
  const gallery = document.createElement('canvas'); gallery.width=1080; gallery.height=180; gallery.style='width:100%;background:#fff9e9'; panel.append(gallery);
  const ctx=gallery.getContext('2d');
  Object.entries(Hop.CAST).forEach(([id,role],i)=>{Hop.Graphics.character(ctx,id,60+i*120,120);ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillStyle='#284356';ctx.fillText(role.name,60+i*120,150);});
  let previous=null;
  function frame(time){game.update(paused||previous===null?0:(time-previous)/1000);previous=time;ui.update();ui.draw();requestAnimationFrame(frame);} requestAnimationFrame(frame);
  </script>`;
  http.createServer((req, res) => {
    const prefix = '/NANACACRASH/';
    if (!req.url.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const file = req.url.slice(prefix.length) || 'index.html';
    if (file === 'qa.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html.replace('<script defer src="js/main.js"></script>', '').replace('</body>', qa + '</body>').replaceAll(' defer ', ' ')); return; }
    if (!allowed.has(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    fs.createReadStream(path.join(root, file)).pipe(res);
  }).listen(8765, '127.0.0.1', () => console.log('Preview http://127.0.0.1:8765/NANACACRASH/ | QA: /NANACACRASH/qa.html'));
}
