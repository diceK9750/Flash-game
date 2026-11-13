// ANGLE's rainbow follows the same path behind the jester; nearby smears remain readable.
const assert = require('node:assert/strict');
const { scope, launch } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG;
const original = { trail: G.grandTrail, cast: G.comboCast, blend: G.grandCastBlend, actor: G.grandActor, actorDraw: G.grandActorDraw };
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const scene = (t, flags = {}) => ({ type:'ANGLE', t, end:2.43, climax:C.grandClimax.ANGLE, grand:true, heroWX:1200, heroY:50,
  source:{x:1230}, after:null, afterTotal:.6, short:false, skipped:false, ...flags });
function ctx() {
  const stack = [], o = { globalAlpha: 1, save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
    fillRect() { if (String(this.fillStyle).startsWith('rgba(255,120,200,')) events.push({ kind:'tint' }); } };
  return new Proxy(o, { get: (v,k) => k in v ? v[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (v,k,x) => (v[k] = x, true) });
}
const events = [];
G.grandTrail = (c, st, tx, ty, floor, poses, n, dt, colors, width, alpha) => {
  events.push({ kind:'trail', poses:[...poses], n, dt, colors:[...colors], width, alpha }); return 16;
};
G.comboCast = (c, id, a, tx, floor, alpha = 1) => { events.push({ kind:'cast', id, x:a.x, y:a.dy, pose:a.pose, alpha }); return true; };
G.grandCastBlend = function (...args) { events.push({ kind:'main' }); return original.blend.apply(this, args); };
function draw(st, reduced = false) {
  events.length = 0; const c = ctx(), before = JSON.stringify(st);
  G.grandBack(c, st, sx, sy, ground, reduced);
  assert.equal(JSON.stringify(st), before, 'drawing does not change scene'); assert.equal(c.globalAlpha, 1, 'canvas alpha restored');
  return events.map(e => ({ ...e }));
}
const near = (a,b) => assert(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
try {
  // Capture actual grandBack -> actor -> grandPoseFx order, including live reduced-motion.
  const sides = new Set();
  for (const heroWX of [1200,1800]) {
    const st = scene(.9, { heroWX, source:{x:heroWX+30} }), normal = draw(st), reduced = draw(st, true);
    sides.add(G.grandBack1(st, sx));
    const trail = arr => arr.findIndex(e => e.kind === 'trail'), main = arr => arr.findIndex(e => e.kind === 'main');
    assert(trail(normal) >= 0 && trail(normal) < main(normal), 'trail behind actor in normal live scene');
    const tint = normal.findIndex(e => e.kind === 'tint');
    assert(tint >= 0 && tint < trail(normal), 'trail remains after the screen tint');
    assert(trail(reduced) >= 0 && trail(reduced) < main(reduced), 'live reduced-motion keeps trail behind actor');
    assert.deepEqual(normal[trail(normal)], reduced[trail(reduced)], 'trail shape, timing, colors and opacity unchanged');
    assert.deepEqual(normal[trail(normal)], { kind:'trail', poses:['HANDSTAND'], n:16, dt:.014,
      colors:['#ff4d6d','#ffb340','#ffe066','#5fd35f','#4dc3ff','#a46bff'], width:22, alpha:1 });
    for (const flags of [{ skipped:true }, { after:0 }]) {
      const v = draw(scene(.9, { heroWX, source:{x:heroWX+30}, ...flags }));
      assert(trail(v) >= 0 && trail(v) < main(v), 'skipped/after keep the trail behind actor');
    }
    const resumed = draw(st); assert(trail(resumed) < main(resumed), 'turning live reduced-motion off keeps the back trail');
  }
  assert.equal(sides.size, 2, 'both stage sides exercise opposite facing');
  // Short scenes never activate the full cartwheel trail, as before.
  assert(!draw(scene(.9, { short:true })).some(e => e.kind === 'trail'));
  // Exercise actual game scene transitions and live reduced-motion toggles.
  const game = launch(); game.grandSpecialEnabled = true; game.comboShort = false;
  game.startCombo({ type:'ANGLE', source:{x:0} }, true);
  game.combo.elapsed = G.comboSceneStart(false) + .9;
  for (const stage of ['live','skip','after','short','shortAfter','shortSkip']) {
    if (stage === 'skip') game.endCombo(true);
    else if (stage === 'after') { game.comboAfter = null; game.comboShort = false; game.startCombo({ type:'ANGLE', source:{x:0} }, true); game.endCombo(false); }
    else if (stage === 'short') { game.comboAfter = null; game.comboShort = true; game.startCombo({ type:'ANGLE', source:{x:0} }, true); }
    else if (stage === 'shortAfter') game.endCombo(false);
    else if (stage === 'shortSkip') { game.comboAfter = null; game.comboShort = true; game.startCombo({ type:'ANGLE', source:{x:0} }, true); game.endCombo(true); }
    const st = G.grandState(game), before = JSON.stringify(game);
    const variants = [draw(st), draw(st, true), draw(st)];
    const trails = variants.map(v => v.filter(e => e.kind === 'trail'));
    assert.deepEqual(trails[0], trails[1], `${stage}: reduced-motion leaves trail unchanged`);
    assert.deepEqual(trails[0], trails[2], `${stage}: returning to normal leaves trail unchanged`);
    if (stage === 'live') {
      assert.equal(trails[0].length, 1);
      for (const v of variants) assert(v.findIndex(e => e.kind === 'trail') < v.findIndex(e => e.kind === 'main'));
    } else assert.equal(trails[0].length, 0, `${stage}: no actual cartwheel trail`);
    assert.equal(JSON.stringify(game), before, `${stage}: rendering leaves game state unchanged`);
  }
  // Continuous proximity scaling affects only ANGLE's live smear, not the pose geometry.
  let distance = 0;
  G.grandActor = st => ({ x:st.t < 1.19 ? -distance : 0, dy:0, rotate:0, alpha:1, pose:'IDLE', face:'left', scale:1, ghosts:[], beat:'' });
  G.grandActorDraw = () => {};
  function smear(d, flags = {}, reduced = false) {
    distance = d; const out = draw(scene(1.2, flags), reduced).filter(e => e.kind === 'cast');
    assert.equal(out.length, d > 12 && !flags.short && flags.after == null ? 1 : 0); return out[0]?.alpha;
  }
  near(smear(50), .34*.45); near(smear(75), .34*.45); near(smear(97.5), .34*.725);
  near(smear(120), .34); near(smear(140), .34);
  near(smear(50, { skipped:true }), .34); near(smear(50, {}, true), .34*.45);
  assert.equal(smear(50, { short:true }), undefined); assert.equal(smear(50, { after:0 }), undefined);
  near(smear(50, { type:'DASH', climax:C.grandClimax.DASH }), .34);
  let prev = smear(75);
  for (let d=75.1; d<=120; d+=.1) { const value = smear(d); assert(value >= prev-1e-9 && value <= .34+1e-9); prev = value; }
  // Live reduced-motion toggles must not amplify an existing afterimage. Use the real
  // actor path, while isolating its smears from the separate main-pose crossfade.
  G.grandActor = original.actor; G.grandActorDraw = () => {};
  let realSmears = 0;
  for (const fps of [30,60,120,144]) for (let f=0; f<fps; f++) {
    const st = scene(.35+.75*f/fps);
    const normal = draw(st).filter(e => e.kind === 'cast');
    const reduced = draw(st, true).filter(e => e.kind === 'cast');
    assert.deepEqual(reduced, normal, `${fps}Hz: live reduced-motion does not strengthen the ANGLE smear`);
    realSmears += normal.length;
  }
  assert(realSmears > 0, 'the real actor path exercises afterimages');
  console.log('ANGLE cane clarity PASS: original trail geometry, rear layer, proximity fade, both sides, reduced/skip/after, 30–144Hz and draw purity.');
} finally { G.grandTrail=original.trail; G.comboCast=original.cast; G.grandCastBlend=original.blend; G.grandActor=original.actor; G.grandActorDraw=original.actorDraw; }
