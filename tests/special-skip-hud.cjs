// The existing flight HUD carries the scene skip instruction at CSS-readable size.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { scope, element, launch } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, c = H.CONFIG;
const text = () => element('aerial-hud-text').textContent;
const visualState = g => JSON.stringify({ body:g.body, objects:g.objects, score:g.finalDistance,
  up:g.upRemaining, down:g.downCharge, special:g.specialCount, success:g.specialSuccesses, merchant:g.merchant });

function start(short = false) {
  const g = launch(3); g.debugUsed = true; g.launchCutin = null; g.acquireMerchant('B');
  Object.assign(g.body, { x:1200, y:30, vx:600, vy:-50, grounded:false, stopped:false });
  g.objects = [{ x:1230, type:'BOOST', used:false }, { x:1700, type:'BOUNCE', used:false }];
  g.nextObjectX = g.nextBoundaryX = Infinity;
  const ui = new H.UI(g, element('canvas')); ui.visual.reducedMotion = short;
  g.contactObjects({ x:1100, y:30 }); assert(g.special && !g.combo);
  const before = visualState(g); ui.update(); assert.equal(visualState(g), before, 'special HUD does not affect game');
  assert.equal(text(), 'SPECIAL優先'); assert.equal(element('aerial-hud').className, 'subdued');
  g.act(); assert(g.combo, 'real special starts a scene'); ui.update();
  return { g, ui };
}
function checkScene(g, ui) {
  const before = visualState(g); ui.update(); ui.draw(); assert.equal(visualState(g), before, 'scene UI is display-only');
  assert.equal(text(), 'タップでスキップ ▶▶'); assert.equal(element('aerial-hud').className, '');
  assert.equal(element('aerial-hud-charge').hidden, true); assert.equal(element('merchant-hud').hidden, false);
}
for (const short of [false, true]) {
  const { g, ui } = start(short); checkScene(g, ui); assert.equal(!!g.combo.short, short);
  for (const reduced of [true, false, true]) { ui.visual.reducedMotion = reduced; checkScene(g, ui); }
  const before = { up:g.upRemaining, down:g.downCharge, x:g.body.x, vx:g.body.vx, vy:g.body.vy };
  g.launchCutin = null; g.act(); assert.equal(g.combo, null, 'one tap skips scene'); ui.update();
  assert.notEqual(text(), 'タップでスキップ ▶▶'); assert.equal(element('aerial-hud').className, '');
  assert.deepEqual({ up:g.upRemaining, down:g.downCharge, x:g.body.x, vx:g.body.vx, vy:g.body.vy }, before);
  g.finish(); ui.update(); assert.equal(element('flight-hud').hidden, true, 'RESULT hides flight HUD');
  g.act(); ui.update(); assert.equal(g.state, H.STATES.AIM_ANGLE); assert.equal(element('flight-hud').hidden, true, 'RETRY resets HUD');
}
{
  const { g, ui } = start(false); checkScene(g, ui); assert(g.endCombo(false)); ui.update();
  assert(g.comboAfter && !g.combo); assert.notEqual(text(), 'タップでスキップ ▶▶', 'natural finish restores AERIAL HUD');
}
// The hint item remains part of the overlay contract, but only labels/gauges paint on Canvas.
{
  const paints = [], stack = [], ctx = { globalAlpha:1, save(){stack.push(this.globalAlpha)}, restore(){this.globalAlpha=stack.pop()},
    fillRect(...v){paints.push(['rect',...v])}, fillText(...v){paints.push(['fillText',...v])},
    strokeText(...v){paints.push(['strokeText',...v])}, measureText(){return {width:40}} };
  G.comboOverlay(ctx, [{kind:'hint',text:'タップでスキップ ▶▶'}, {kind:'label',text:'TEST',x:300,y:100,size:20,color:'#fff',stroke:'#000'},
    {kind:'gauge',x:200,y:100,value:.5,alpha:1}], {w:0,z:1});
  assert.deepEqual(paints.filter(v => v[0] === 'fillText').map(v => v[1]), ['TEST']);
  assert.equal(paints.filter(v => v[0] === 'rect').length, 2, 'only gauge rectangles are drawn');
  assert.equal(stack.length, 0); assert.equal(ctx.globalAlpha, 1);
}
// Later, phone-scoped CSS permits only the merchant bar to wrap, without changing the desktop rule.
const css = fs.readFileSync(path.join(__dirname,'../css/style.css'),'utf8').replace(/\r\n/g,'\n');
const mobile = css.slice(css.indexOf('/* Must follow the base flight HUD rules'), css.indexOf('/* Touch tap targets'));
assert(mobile.includes('@media (max-width: 650px)'));
assert(/#merchant-hud\s*\{\s*flex-wrap:\s*wrap;\s*white-space:\s*normal;\s*gap:\s*0 5px;\s*\}/.test(mobile));
assert(/#merchant-hud-text\s*\{\s*white-space:\s*nowrap;\s*\}/.test(mobile));
assert(/#merchant-hud-charge\s*\{\s*flex:\s*none;\s*\}/.test(mobile));
assert.equal(c.specialWindow, 1.0);
console.log('SPECIAL skip HUD PASS: real normal/short scenes, reduced switches, priority, merchant, skip/end/RESULT/RETRY, no Canvas duplicate and scoped phone CSS.');
