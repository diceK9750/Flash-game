// No dependencies. --serve provides an optional localhost/subpath QA preview.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const hashes = {
  'config.js': 'edcf4465794d47bc18b4397a248b349655fe4f475f7fa4b0704e1f7c96724515',
  'game.js': '281a76050162d2a14f47a12f85f19bbbd95f81f778ea4406c1b3340377a87c07',
  'physics.js': 'a7d8e6ddd877faef7e02b75a3e5f4598e88a6ed49e2827d90959b806d5dee8b8',
  'input.js': 'ea171fc2472efeb7e0199f7a00f6010a2e0402c6e9df7bc56dedc6881569364d'
};
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!process.argv.includes('--serve')) {
  require('./phase3.cjs');
  const { scope, element, launch } = require('./phase2.cjs');
  for (const [file, expected] of Object.entries(hashes)) {
    // Exact baseline from before the presentation work, including line endings.
    const bytes = fs.readFileSync(path.join(root, 'js', file));
    const digest = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, expected, `${file}: intentional logic changes require a new reviewed baseline`);
  }
  assert.equal(scope.Hop.CONFIG.specialWindow, 1.0);
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
  console.log('Release PASS: original logic hashes, 1.0s window, 9 silhouettes, draw purity, states, relative paths.');
} else {
  const http = require('node:http');
  const allowed = new Set(['index.html', 'css/style.css', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)]);
  const qa = `<script>
  const game = new Hop.Game(); game.debug = true; game.debugUsed = true;
  const ui = new Hop.UI(game, document.getElementById('canvas')); Hop.bindInput(game, ui);
  const panel = document.createElement('section'); panel.style='padding:12px;display:flex;gap:8px;flex-wrap:wrap';
  document.querySelector('main').prepend(panel);
  for (const type of ['STOPPER','BOUNCE','DASH']) {
    const button = document.createElement('button'); button.textContent = 'QA ' + type;
    button.onclick = () => {
      game.reset(); game.debugUsed = true; game.state = Hop.STATES.FLYING;
      Object.assign(game.body,{x:2000,y:10,vx:type==='DASH'?300:800,vy:-100,grounded:false});
      game.objects=[{x:2000,type,used:false}]; game.nextObjectX=Infinity; game.cameraX=1750;
      game.contactObjects({x:1990,y:10,vx:game.body.vx,vy:game.body.vy}); ui.update(); ui.draw();
    }; panel.append(button);
  }
  const gallery = document.createElement('canvas'); gallery.width=1080; gallery.height=180; gallery.style='width:100%;background:#fff9e9'; panel.append(gallery);
  const ctx=gallery.getContext('2d');
  Object.entries(Hop.CAST).forEach(([id,role],i)=>{Hop.Graphics.character(ctx,id,60+i*120,120);ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillStyle='#284356';ctx.fillText(role.name,60+i*120,150);});
  let previous=null;
  function frame(time){game.update(previous===null?0:(time-previous)/1000);previous=time;ui.update();ui.draw();requestAnimationFrame(frame);} requestAnimationFrame(frame);
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
