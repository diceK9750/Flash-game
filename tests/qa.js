// Served only by the optional local test server; never loaded by index.html.
(() => {
  const game = new Hop.Game(); game.debug = true; game.reset();
  const ui = new Hop.UI(game, document.getElementById('canvas')); Hop.bindInput(game, ui);
  const panel = document.createElement('section'); panel.style = 'padding:10px;background:#fff6d5;font-size:13px';
  panel.innerHTML = '<label>QAシナリオ <select id="qa-scenario" style="max-width:100%"></select></label> <button id="qa-load">準備</button> <button id="qa-play">再生</button> <button id="qa-stopper">次の通常STOPPER</button> <button id="qa-guard">次のGUARD</button> <p>検証専用・保存対象外。準備時は時間停止。ゲーム画面タップで成功、再生して無入力ならMISS。</p><p id="qa-info" style="overflow-wrap:anywhere"></p>';
  document.querySelector('main').prepend(panel);
  const select = document.getElementById('qa-scenario'), play = document.getElementById('qa-play');
  const scenarios = [
    ...Object.keys(Hop.CONFIG.objectWeights).map(t => '通常 ' + t),
    ...Object.keys(Hop.CONFIG.specials).map(t => 'SPECIAL ' + t),
    'HERO FLIGHT_LOOP', 'HERO 画像欠落', 'READY先読み', '商人ゾーン', 'HUD CHARGE', 'BRAKE READY', 'GUARD期限直前', 'GUARD二重防御', '通常GUARD防御', 'GUARD SPECIAL防御', 'C中タイマー停止',
    ...['A','B','C','D'].map(t => '商人 ' + t)
  ];
  for (const name of scenarios) { const option = document.createElement('option'); option.textContent = name; select.append(option); }
  let paused = true;
  let originalSprite;
  Hop.Sprites.ready.then(asset => { originalSprite = asset; });
  function contact(type, x = 500, partner = null) {
    Object.assign(game.body, { x: x - 20, y: 10, vx: 500, vy: -100, grounded: false, stopped: false });
    game.objects = [{ x, type, used: false }];
    if (partner) game.objects.push({ x: x + 300, type: partner, used: false });
    game.cameraX = x - 250; game.cameraY = 0;
    game.nextObjectX = x + 600; game.nextBoundaryX = 1600;
    game.contactObjects({ x: x - 70, y: 10 });
    if (game.body.stopped) game.update(Hop.CONFIG.physicsStep);
  }
  function prepare() {
    paused = true; play.textContent = '再生'; game.reset(); game.state = Hop.STATES.FLYING;
    game.random = () => 0.9;
    const name = select.value, type = name.split(' ')[1];
    if (originalSprite) Hop.Sprites.heroFlight = originalSprite;
    if (name === 'HERO 画像欠落') {
      Hop.Sprites.load({ ...Hop.Sprites.definitions.HERO.FLIGHT_LOOP, src: 'assets/sprites/hero/flight_loop/missing.png' }).then(asset => {
        if (select.value === name) Hop.Sprites.heroFlight = asset;
      });
    }
    if (name.startsWith('通常 ')) contact(type);
    else if (name.startsWith('SPECIAL ')) {
      const rule = Hop.CONFIG.specials[type];
      if (type === 'GUARD') game.normalGuard = 1;
      else if (type === 'ANGLE') game.random = () => 0;
      else if (type === 'BRAKE') {
        Object.assign(game.body, { y: 100, vy: 500, grounded: false }); game.act();
      } else if (!rule.partner) game.specialArmed[rule.trigger] = true;
      contact(type, 500, rule.partner);
    } else if (name.startsWith('商人 ')) {
      game.normalGuard = 1;
      contact({ A:'STOPPER', B:'DASH', C:'BOOST', D:'BOUNCE' }[type], 800);
    } else {
      Object.assign(game.body, { x: 480, y: 300, vx: 500, vy: 200, grounded: false }); game.cameraX = 250;
      if (name === 'BRAKE READY') game.act();
      if (name === 'READY先読み') { game.specialArmed = { dash: true, stopper: true, brake: true }; game.objects = [{x:600,type:'BOOST',used:false},{x:880,type:'BOUNCE',used:false},{x:1200,type:'DASH',used:false}]; }
      if (name === '商人ゾーン') { game.normalGuard = 1; game.body.x = 752; game.cameraX = 450; game.objects = [{x:800,type:'STOPPER',used:false}]; }
      if (name === 'HUD CHARGE') { game.acquireMerchant('B'); game.merchant.charge = 7; game.downCharge = .63; }

      if (name === 'GUARD期限直前') game.guardSpecial = { active: true, remaining: 0.3 };
      if (name === 'GUARD二重防御') { game.guardSpecial = { active: true, remaining: 7.4 }; contact('GUARD'); }
      if (name === '通常GUARD防御') { game.normalGuard = 1; contact('STOPPER'); }
      if (name === 'GUARD SPECIAL防御') { game.guardSpecial = { active: true, remaining: 7.4 }; contact('STOPPER'); }
      if (name === 'C中タイマー停止') { game.guardSpecial = { active: true, remaining: 7.4 }; game.acquireMerchant('C'); }
    }
    ui.update(); ui.draw();
  }
  document.getElementById('qa-load').onclick = prepare;
  play.onclick = () => { paused = !paused; play.textContent = paused ? '再生' : '一時停止'; };
  document.getElementById('qa-stopper').onclick = () => { game.specialArmed.stopper = false; contact('STOPPER'); ui.update(); };
  document.getElementById('qa-guard').onclick = () => { contact('GUARD'); ui.update(); };
  let previous = null;
  function frame(time) {
    game.update(paused || previous === null ? 0 : (time - previous) / 1000); previous = time;
    ui.update(); ui.draw();
    document.getElementById('qa-info').textContent = `vx ${game.body.vx.toFixed(2)} / vy ${game.body.vy.toFixed(2)} / 速さ ${Math.hypot(game.body.vx, game.body.vy).toFixed(2)} / GUARD ${game.normalGuard} / 専用防御 ${game.guardSpecial.remaining.toFixed(2)}s / HERO ${Hop.Sprites.heroFlight?.ready ? 'SPRITE' : 'CANVAS fallback'}`;
    requestAnimationFrame(frame);
  }
  ui.update(); ui.draw(); requestAnimationFrame(frame);
})();
