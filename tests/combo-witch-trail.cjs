// The optional BOOST fireball trail is deterministic, bounded and fades at both ends.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG, originalTrail = G.comboWitchTrail;
function recorder() {
  const log = [], stack = [], o = { globalAlpha: 0.8, log,
    save() { stack.push({ globalAlpha: this.globalAlpha, lineCap: this.lineCap, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, fillStyle: this.fillStyle }); log.push(['save']); },
    restore() { Object.assign(this, stack.pop()); log.push(['restore']); },
    beginPath() { log.push(['begin']); }, moveTo(x, y) { log.push(['move', x, y]); }, lineTo(x, y) { log.push(['line', x, y]); },
    stroke() { log.push(['stroke', this.strokeStyle, this.lineWidth, this.globalAlpha]); },
    arc(x, y, r) { log.push(['arc', x, y, r]); }, fill() { log.push(['fill', this.fillStyle, this.globalAlpha]); }
  }; return o;
}
const st = (changes = {}) => ({ type: 'BOOST', t: 2.02, short: false, skipped: false, after: null, ...changes });
function frame(scene, u) {
  const ctx = recorder(), before = JSON.stringify(scene);
  const visible = G.comboWitchTrail(ctx, scene, u, 130, 200, 100, 240, 220, 180, 27);
  assert.equal(JSON.stringify(scene), before, 'must not mutate scene'); assert.equal(ctx.globalAlpha, 0.8, 'restore canvas alpha');
  return { visible, ops: ctx.log };
}
try {
  for (const u of [-1, 0, 1, 1.1, NaN]) assert.deepEqual(frame(st(), u), { visible: false, ops: [] }, 'outside arc does not draw');
  for (const changes of [{ short: true }, { skipped: true }, { after: 0 }, { type: 'BOUNCE' }]) {
    assert.deepEqual(frame(st(changes), 0.5), { visible: false, ops: [] }, 'no extra effect for short/skip/after/other');
  }
  for (const t of [C.comboWitchTimes.liftEnd - 0.001, C.comboWitchTimes.blast, NaN]) {
    assert.deepEqual(frame(st({ t }), 0.5), { visible: false, ops: [] }, 'no extra effect outside the fireball window');
  }
  for (const u of [0.00001, 0.99999]) {
    const f = frame(st(), u), alpha = f.ops.find(x => x[0] === 'stroke')[3];
    assert(alpha < 1e-8, 'fade is continuous at both endpoints');
  }
  const central = frame(st(), 0.5), strokes = central.ops.filter(x => x[0] === 'stroke'), arcs = central.ops.filter(x => x[0] === 'arc');
  assert(central.visible); assert.equal(strokes.length, 2); assert.equal(arcs.length, 2, 'only two motes');
  assert.deepEqual(strokes.map(x => x[1]), ['#ff9b38', '#fff3c3']);
  assert(strokes.every(x => x[3] <= 0.8 * 0.55 + 1e-9), 'bounded opacity');
  const move = central.ops.find(x => x[0] === 'move'), line = central.ops.find(x => x[0] === 'line');
  assert(Math.hypot(move[1] - line[1], move[2] - line[2]) < 50, 'short tail');
  assert.deepEqual(frame(st(), 0.5), central, 'same paused time and progress yield the same drawing');
  assert.notDeepEqual(frame(st({ t: 2.03 }), 0.5).ops.filter(x => x[0] === 'arc'), arcs, 'lights rotate over scene time');
  const vertical = recorder(); assert(G.comboWitchTrail(vertical, st(), 0.5, 100, 100, 100, 200, 100, 50, 27));
  const mv = vertical.log.find(x => x[0] === 'move'), ln = vertical.log.find(x => x[0] === 'line'); near(mv[1], ln[1]);
  function near(a, b) { assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`); }

  // Integration: the original fireball trajectory and exact staff origin are unchanged.
  const scene = { type: 'BOOST', t: (C.comboWitchTimes.liftEnd + C.comboWitchTimes.blast) / 2, heroWX: 1200, heroY: 50,
    source: { x: 1080 }, partner: { x: 1700 }, room: 400, short: false, after: null, afterTotal: 0.6, skipped: false };
  const sx = x => x - 120, sy = y => C.groundY - C.playerRadius - y, a = G.comboActors(scene), wx = sx(a.witch.x);
  const tip = G.comboWitchTip(scene, a.witch, sx, C.groundY, { x: wx + (a.witch.face === 'left' ? -30 : 30), y: C.groundY - 120 });
  const u = G.ease((scene.t - C.comboWitchTimes.liftEnd) / (C.comboWitchTimes.blast - C.comboWitchTimes.liftEnd));
  const targetX = sx(scene.heroWX) + a.hero.dx, targetY = sy(scene.heroY) + a.hero.dy;
  let got; G.comboWitchTrail = (ctx, st, p, x, y, x0, y0, tx, ty, r) => { got = { p, x, y, x0, y0, tx, ty, r }; };
  const ctx = new Proxy({ globalAlpha: 1 }, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const before = JSON.stringify(scene); G.comboFront(ctx, scene, sx, sy, C.groundY); assert.equal(JSON.stringify(scene), before);
  near(got.p, u); near(got.x0, tip.x); near(got.y0, tip.y);
  near(got.x, tip.x + (targetX - tip.x) * u); near(got.y, tip.y + (targetY - tip.y) * u - Math.sin(u * Math.PI) * 60);
  near(got.tx, targetX); near(got.ty, targetY); near(got.r, 18 + 18 * u);
  got = null; G.comboFront(ctx, scene, sx, sy, C.groundY, true);
  assert.equal(got, null, 'reduced motion toggled during a full scene suppresses the new trail');
  console.log('Combo witch trail PASS: bounds, endpoint fade, deterministic pause, tangent, short/skip/after, original trajectory and scene purity.');
} finally { G.comboWitchTrail = originalTrail; }
