// Cache initialization failures must use the existing live SPECIAL drawings.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, S = H.Sprites, G = H.Graphics, C = H.CONFIG;
const saved = { assets:S.castAssets, witch:S.witchWindCache, witchPending:S.witchWindPending,
  fighter:S.fighterWindCache, fighterPending:S.fighterWindPending, create:scope.document.createElement,
  smooth:G.smooth, cutin:G.cutinBandLayer, glow:G.guardGlowLayer, dome:G.guardDomeLayer, character:G.character };
function context() {
  const stack = [], gradient = () => ({ addColorStop() {} });
  const o = { globalAlpha:1, globalCompositeOperation:'source-over', filter:'none',
    save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop() ?? 1; },
    getTransform() { return { a:1, b:0, c:0, d:1, e:0, f:0 }; },
    createLinearGradient:gradient, createRadialGradient:gradient, measureText() { return { width:100 }; } };
  return new Proxy(o, { get:(v,k) => k in v ? v[k] : () => {}, set:(v,k,x) => (v[k] = x, true) });
}
function makeSource(y) {
  return { ready:true, image:{ complete:true, naturalWidth:288, naturalHeight:288, src:'fixture', currentSrc:'fixture' },
    data:{ frameWidth:288, frameHeight:288, frames:1, pivot:{x:144,y}, unit:1, fps:1 } };
}
try {
  G.smooth = true;
  let fallbackDraws = 0;
  G.character = function(ctx,id,...args) { if (id !== 'HERO') fallbackDraws++; return saved.character.call(this,ctx,id,...args); };
  for (const failure of ['null','create','context']) for (const type of ['BOOST','BOUNCE','BRAKE','ANGLE','DASH','GUARD','STOPPER']) {
    for (const short of [false,true]) for (const skip of [false,true]) {
      S.witchWindCache = S.fighterWindCache = null; S.witchWindPending = S.fighterWindPending = null;
      G.cutinBandLayer = G.guardGlowLayer = G.guardDomeLayer = null;
      scope.document.createElement = () => {
        if (failure === 'create') throw Error('injected canvas creation failure');
        return { getContext() { if (failure === 'context') throw Error('injected context failure'); return null; } };
      };
      // Both optional sprite caches fail independently, then all cast images are unavailable.
      const witch = makeSource(278), fighter = makeSource(264);
      S.castAssets = { BOOST:{CAST:witch}, BOUNCE:{UPPER:fighter} };
      assert.doesNotThrow(() => S.scheduleWitchWindCache(witch));
      assert.doesNotThrow(() => S.scheduleFighterWindCache(fighter));
      assert(!S.witchWindCache && !S.fighterWindCache && !S.witchWindPending && !S.fighterWindPending);
      S.castAssets = {};
      const g = launch(); g.debugUsed = true; g.random = () => 0; g.grandSpecialEnabled = true; g.comboEnabled = true; g.launchCutin = null;
      Object.assign(g.body, { x:480, y:10, vx:500, vy:-100, grounded:false, stopped:false });
      const rule = C.specials[type], source = { x:500, type, used:false };
      g.objects = rule.partner ? [source, { x:900, type:rule.partner, used:false }] : [source];
      g.nextObjectX = g.nextBoundaryX = Infinity;
      if (rule.trigger === 'guard') g.normalGuard = 1;
      else if (!['adjacent','chance'].includes(rule.trigger)) g.specialArmed[rule.trigger] = true;
      const ui = new H.UI(g,element('canvas')); ui.ctx = context(); ui.visual.reducedMotion = short; ui.update();
      g.contactObjects({ x:430, y:10, vx:500, vy:-100 }); assert(g.special, type + ' SPECIAL starts'); ui.update(); ui.draw();
      g.act(); assert(!g.special && g.combo, type + ' SPECIAL succeeds'); ui.update();
      const before = fallbackDraws; let frames = 0;
      while (g.combo && frames++ < 240) { g.update(1/30); ui.update(); ui.draw(); if (skip && frames === 18) g.act(); }
      assert(!g.combo && frames < 240, type + ' scene ends'); assert(fallbackDraws > before, type + ' Canvas character fallback drawn');
      for (let i=0; i<6 && g.state===H.STATES.FLYING; i++) { g.update(1/30); ui.update(); ui.draw(); }
      if (g.state !== H.STATES.RESULT) g.finish(); ui.update(); ui.draw(); assert.equal(g.state,H.STATES.RESULT);
      g.act(); ui.update(); ui.draw(); assert.equal(g.state,H.STATES.AIM_ANGLE); assert(!g.special && !g.history.length);
    }
  }
  // First/second allocation failures never publish a partial layer; errors after
  // initialization still propagate instead of being mistaken for allocation failures.
  const methods = [
    ['specialCutinBandCached','cutinBandLayer',() => [context(),{castId:'BOOST'},'#123',1000,200,1],1],
    ['guardCircleGlow','guardGlowLayer',() => [context(),100,100,125,1,.5,'#fff',1],2],
    ['guardDomeCached','guardDomeLayer',() => [context(),100,100,108,1],1]
  ];
  for (const [name,field,args,count] of methods) {
    for (const failure of ['create','context','null']) for (let failAt=1; failAt<=count; failAt++) {
      let calls = 0; G[field] = null;
      scope.document.createElement = () => { const n = ++calls; if (n === failAt && failure === 'create') throw Error('create');
        return { width:0, height:0, getContext() { if (n === failAt && failure === 'context') throw Error('context'); if (n === failAt && failure === 'null') return null; return context(); } }; };
      assert.equal(G[name](...args()),false,name + ' initialization falls back'); assert(!G[field],name + ' publishes no partial layer');
    }
    G[field] = null;
    scope.document.createElement = () => ({ width:0, height:0, getContext() { const c = context(); c.setTransform = () => { throw Error('render failure'); }; return c; } });
    assert.throws(() => G[name](...args()),/render failure/,name + ' does not swallow later rendering errors');
  }
  console.log('SPECIAL cache fallback PASS: 84 real Game/UI flows, all cast slots missing, both optional caches failing, natural/skip/short/RETRY, allocation boundaries.');
} finally {
  S.castAssets = saved.assets; S.witchWindCache = saved.witch; S.witchWindPending = saved.witchPending;
  S.fighterWindCache = saved.fighter; S.fighterWindPending = saved.fighterPending; scope.document.createElement = saved.create;
  G.smooth = saved.smooth; G.cutinBandLayer = saved.cutin; G.guardGlowLayer = saved.glow; G.guardDomeLayer = saved.dome; G.character = saved.character;
}
