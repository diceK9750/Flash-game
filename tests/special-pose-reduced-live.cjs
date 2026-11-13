// Live reduced-motion changes affect presentation-only pose blending in both SPECIAL families.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG;
const old = { cast: G.comboCast, comboBack: G.comboBack, grandBack: G.grandBack, grandFront: G.grandFront };
const sx = x => C.launchX + x, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const combo = extra => ({ type: 'BOOST', t: 0.17, heroWX: 1200, heroY: 30, source: { x: 1080 }, partner: { x: 1700 }, short: false, after: null, skipped: false, ...extra });
const grand = extra => ({ type: 'DASH', t: 0.77, end: 3, heroWX: 1100, heroY: 240, source: { x: 820 }, short: false, after: null, afterTotal: 0.6, skipped: false, grand: true, climax: C.grandClimax.DASH, ...extra });
const ctx = { save() {}, restore() {}, filter: 'none' };
try {
  G.comboCast = (out, id, actor, x, y, alpha = 1) => out.push({ pose: actor.pose, face: actor.face, alpha });
  function drawCombo(st, rm) { const out = [], before = JSON.stringify(st); G.comboCastBlend(out, 'BOOST', 'witch', st, G.comboActors(st).witch, sx, ground, 1, rm); assert.equal(JSON.stringify(st), before); return out; }
  function drawGrand(st, rm) { const out = [], before = JSON.stringify(st); out.save = ctx.save; out.restore = ctx.restore;
    G.grandCastBlend(out, 'DASH', st, G.grandActor(st, sx, sy, ground), sx, sy, ground, 1, rm); assert.equal(JSON.stringify(st), before); return Array.from(out); }
  for (const draw of [drawCombo, drawGrand]) { const st = draw === drawCombo ? combo() : grand();
    const normal = draw(st, false); assert(normal.length > 1, 'normal blend active');
    const reduced = draw(st, true); assert.equal(reduced.length, 1, 'live ON shows one current pose'); assert.deepEqual(reduced[0], normal[0]);
    assert.deepEqual(draw(st, false), normal, 'live OFF restores same blend at the same scene time');
    for (const flags of [{ short: true }, { skipped: true }, { after: 0 }]) for (const rm of [false, true]) assert.equal(draw({ ...st, ...flags }, rm).length, 1, 'short/skip/after stays unblended');
  }
  G.comboCast = old.cast;
  const game = launch(), ui = new H.UI(game, element('canvas')), seen = [];
  ui.ctx = new Proxy({ globalAlpha: 1 }, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  G.comboBack = function (...args) { seen.push(['combo', args[5]]); return old.comboBack.apply(this, args); };
  G.grandBack = function (...args) { seen.push(['grandBack', args[5]]); return old.grandBack.apply(this, args); };
  G.grandFront = function (...args) { seen.push(['grandFront', args[5]]); return old.grandFront.apply(this, args); };
  for (const [type, solo, t] of [['BOOST', false, 0.17], ['DASH', true, 0.77]]) {
    game.combo = { type, solo, elapsed: G.comboSceneStart(false) + t, short: false, heroX: 1200, heroY: 50, source: { x: 1230 }, partner: { x: 1700 }, skipped: false };
    for (const rm of [false, true, false]) { ui.visual.reducedMotion = rm; seen.length = 0; const before = JSON.stringify(game); ui.draw(); assert.equal(JSON.stringify(game), before);
      const required = solo ? ['grandBack', 'grandFront'] : ['combo']; for (const name of required) assert(seen.some(x => x[0] === name && x[1] === rm), `${name} receives live ${rm}`); }
  }
  console.log('SPECIAL pose live reduced-motion PASS: live ON/OFF, normal/short/skip/after, both render paths and game purity.');
} finally { Object.assign(G, { comboCast: old.cast, comboBack: old.comboBack, grandBack: old.grandBack, grandFront: old.grandFront }); }
