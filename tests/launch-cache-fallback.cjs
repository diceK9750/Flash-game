// Launch cut-in outline allocation can fail without interrupting a real launch.
const assert = require('node:assert/strict');
const { scope, document, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, stage = element('stage');
const saved = { create:document.createElement, smooth:G.smooth, cache:G.lcOutlineCache,
  pointer:stage.listeners.pointerdown, key:document.listeners.keydown,
  sound:element('se-toggle').listeners.click, debug:element('debug-toggle').listeners.click, menu:element('debug-menu').listeners.click };
function context(ops = []) {
  const stack = [], gradient = () => ({ addColorStop() {} });
  const o = { globalAlpha:1, filter:'none', globalCompositeOperation:'source-over',
    save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop() ?? 1; },
    getTransform() { return { a:1,b:0,c:0,d:1,e:0,f:0 }; }, measureText() { return { width:100 }; },
    createLinearGradient:gradient, createRadialGradient:gradient,
    strokeText(...v) { ops.push(['stroke',...v]); }, fillText(...v) { ops.push(['fill',...v]); } };
  return new Proxy(o, { get:(v,k) => k in v ? v[k] : () => {}, set:(v,k,x) => (v[k] = x, true) });
}
function fail(mode) {
  document.createElement = () => {
    if (mode === 'create') throw Error('injected createElement failure');
    return { getContext() { if (mode === 'context') throw Error('injected getContext failure'); return null; } };
  };
}
try {
  G.smooth = true;
  for (const mode of ['null','create','context']) {
    // Confirm the exact existing vector fallback, no partial cached entry, and that
    // a later rendering/measurement error is not swallowed by the allocation guard.
    fail(mode); G.lcOutlineCache = null; const ops = [];
    G.lcText(context(ops),'試験',30,40,64,0,'#fff');
    assert.deepEqual(ops.map(v => v[0]),['stroke','stroke','fill']); assert.equal(G.lcOutlineCache.size,0);
    for (const reduced of [false,true]) for (const view of ['full','repeat']) for (const power of [.3,.7,1]) {
      G.lcOutlineCache = null; const g = new H.Game(() => .5); g.launchCutinEnabled = true; g.debugUsed = true;
      const ui = new H.UI(g,element('canvas')); ui.ctx = context(); ui.visual.reducedMotion = reduced;
      H.bindInput(g,ui); ui.update();
      const tap = () => stage.listeners.pointerdown({ button:0, isPrimary:true, preventDefault() {} });
      tap(); assert.equal(g.state,H.STATES.AIM_ANGLE); tap(); assert.equal(g.state,H.STATES.AIM_POWER);
      g.power = power; tap(); assert.equal(g.state,H.STATES.FLYING); assert(g.launchCutin);
      if (view === 'repeat') {
        tap(); assert(!g.launchCutin); g.finish(); tap(); assert.equal(g.state,H.STATES.AIM_ANGLE);
        tap(); assert.equal(g.state,H.STATES.AIM_POWER); g.power = power; tap(); assert.equal(g.state,H.STATES.FLYING);
      }
      assert.equal(g.launchCutin.mode,reduced ? 'reduced' : view);
      assert.equal(g.launchCutin.tier,H.Game.launchCutinIntensity(power).tier);
      let frames = 0; while (g.launchCutin && frames++ < 240) { g.update(1/60); ui.update(); ui.draw(); }
      assert(!g.launchCutin && frames < 240, `${mode}/${reduced}/${view}/${power} resumes flight`);
    }
  }
  G.lcOutlineCache = null;
  document.createElement = () => ({ getContext() { const c = context(); c.measureText = () => { throw Error('measure failure'); }; return c; } });
  assert.throws(() => G.lcTextOutline(context(),'試験',64,'#000',1),/measure failure/);
  console.log('Launch cache fallback PASS: live vector text, 36 real launch/RETRY flows, three power tiers, reduced motion and allocation boundary.');
} finally {
  document.createElement = saved.create; G.smooth = saved.smooth; G.lcOutlineCache = saved.cache;
  if (saved.pointer === undefined) delete stage.listeners.pointerdown; else stage.listeners.pointerdown = saved.pointer;
  if (saved.key === undefined) delete document.listeners.keydown; else document.listeners.keydown = saved.key;
  for (const [id,listener] of [['se-toggle',saved.sound],['debug-toggle',saved.debug],['debug-menu',saved.menu]]) {
    if (listener === undefined) delete element(id).listeners.click; else element(id).listeners.click = listener;
  }
}
