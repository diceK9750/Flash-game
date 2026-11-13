// Continuous pose fades are presentation-only; scene timing and game state stay unchanged.
const assert = require('node:assert/strict');
const { scope, launch, element } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, C = H.CONFIG;
const original = { cast: G.comboCast, actors: G.comboActors, sakuga: G.comboSakuga, grand: G.grandActor };
const sx = x => C.launchX + x, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const blend = u => 0.9 * (1 - u * u * (3 - 2 * u));
const combo = (t, overrides = {}) => ({ type: 'BOOST', t, heroWX: 1200, heroY: 30,
  source: { x: 1080 }, partner: { x: 1700 }, short: false, after: null, skipped: false, ...overrides });
const grand = (t, overrides = {}) => ({ type: 'DASH', t, end: 3, heroWX: 1100, heroY: 240,
  source: { x: 820 }, short: false, after: null, afterTotal: 0, skipped: false, grand: true,
  climax: C.grandClimax.DASH, ...overrides });
try {
  G.comboCast = (out, id, a, x, y, alpha = 1) => out.push({ pose: a.pose, face: a.face, alpha });
  function comboDraw(st) {
    const before = JSON.stringify(st), a = G.comboActors(st).witch, out = [];
    G.comboCastBlend(out, 'BOOST', 'witch', st, a, sx, ground);
    assert.equal(JSON.stringify(st), before, 'pose draw leaves the scene state untouched');
    return out;
  }
  // Actual witch IDLE -> CAST transition, including irregular samples within one old 1/120 s step.
  const at = 0.15;
  assert.equal(comboDraw(combo(at - 0.0001)).length, 1);
  const weights = [];
  for (const dt of [0.001, 0.002, 0.004, 0.006, 0.008, 0.010, 0.012, 0.014, 0.016, 0.018, 0.020]) {
    const list = comboDraw(combo(at + dt)); assert.deepEqual(list.map(x => x.pose), ['CAST', 'IDLE']);
    assert(Math.abs(list[1].alpha - blend(dt / G.POSE_FADE)) < 0.0015, 'continuous witch fade at ' + dt);
    weights.push(list[1].alpha);
  }
  assert(new Set(weights.map(n => n.toFixed(5))).size > 8, 'fade no longer stalls on 1/120 s plateaus');
  for (const fps of [30, 60, 120, 144]) for (let dt = 0.001; dt < G.POSE_FADE; dt += 1 / fps) {
    const list = comboDraw(combo(at + dt));
    assert.equal(list[0].pose, 'CAST');
    assert(Math.abs((list[1]?.alpha ?? 0) - blend(dt / G.POSE_FADE)) < 0.0015, `${fps}Hz witch fade at ${dt}`);
  }
  assert.equal(comboDraw(combo(at + G.POSE_FADE + 0.001)).length, 1, 'old pose ends');
  for (const flag of [{ short: true }, { skipped: true }, { after: 0 }])
    assert.equal(comboDraw(combo(at + 0.02, flag)).length, 1, 'short / skip / after stay unblended');

  // A facing-only change of the same pose is still detected; real displacement jumps remain excluded.
  G.comboSakuga = (st, key, a) => a;
  G.comboActors = st => ({ witch: { pose: 'CAST', face: st.t < 1 ? 'left' : 'right', x: 100, scale: 1 } });
  const facing = comboDraw(combo(1.027));
  assert.deepEqual(facing.map(x => x.face), ['right', 'left']);
  assert(Math.abs(facing[1].alpha - blend(0.27)) < 0.0015, 'facing-only fade is continuous');
  G.comboActors = st => ({ witch: { pose: st.t < 1 ? 'IDLE' : 'CAST', face: 'left', x: st.t < 1 ? 200 : 100, scale: 1 } });
  assert.equal(comboDraw(combo(1.02)).length, 1, 'teleport does not leave an old-pose ghost');
  G.comboActors = original.actors; G.comboSakuga = original.sakuga;

  // Actual warrior WINDUP -> THRUST: boundary estimate is sub-millisecond and continuous.
  const change = 0.75, error = 1 / (120 * 128) + 1e-9;
  assert.equal(G.grandPoseChange(grand(change - 0.0001), G.grandActor(grand(change - 0.0001), sx, sy, ground), sx, sy, ground), null);
  for (const fps of [30, 60, 120, 144]) for (let dt = 0.001; dt < G.POSE_FADE; dt += 1 / fps) {
    const st = grand(change + dt), before = JSON.stringify(st), a = G.grandActor(st, sx, sy, ground);
    const ch = G.grandPoseChange(st, a, sx, sy, ground);
    assert(ch && ch.pose === 'WINDUP' && a.pose === 'THRUST');
    assert(Math.abs(ch.back - dt) <= error, `${fps}Hz grand transition age at ${dt}`);
    assert.equal(JSON.stringify(st), before, 'grand pose draw leaves scene state untouched');
  }
  const end = grand(change + G.POSE_FADE + 0.001);
  assert.equal(G.grandPoseChange(end, G.grandActor(end, sx, sy, ground), sx, sy, ground), null);
  for (const flag of [{ short: true }, { skipped: true }, { after: 0 }]) {
    const st = grand(change + 0.02, flag);
    assert.equal(G.grandPoseChange(st, G.grandActor(st, sx, sy, ground), sx, sy, ground), null);
  }
  G.grandActor = st => ({ pose: st.t < 1 ? 'OLD' : 'NEW', face: 'left', x: st.t < 1 ? 200 : 100, dy: 0 });
  const jump = grand(1.02);
  assert.equal(G.grandPoseChange(jump, G.grandActor(jump), sx, sy, ground), null, 'grand teleport stays unblended');
  G.grandActor = original.grand;

  let steps = 0;
  const estimate = G.poseTransitionAge(1 / 120, 1 / 120, back => { steps++; return back < 0.003; });
  assert.equal(steps, 6, 'refinement has a fixed small work bound');
  assert(Math.abs(estimate - 0.003) <= error);
  const game = launch(), ui = new H.UI(game, element('canvas')), before = JSON.stringify(game);
  ui.update(); ui.draw(); assert.equal(JSON.stringify(game), before, 'drawing does not change game state');
  console.log('SPECIAL pose continuity PASS: continuous 30–144Hz fades, boundaries, facing, geometry guards, pause-safe scene purity.');
} finally {
  G.comboCast = original.cast; G.comboActors = original.actors; G.comboSakuga = original.sakuga; G.grandActor = original.grand;
}
