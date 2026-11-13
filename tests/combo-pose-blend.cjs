// Display-only combo pose transitions: the old still must fade away, never pop back in.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const G = scope.Hop.Graphics, C = scope.Hop.CONFIG;
const originalCast = G.comboCast, originalActors = G.comboActors, originalSakuga = G.comboSakuga;
const identity = x => x;
function state(type, t) {
  return { type, t, heroWX: 1200, heroY: 30, source: { x: type === 'BOOST' ? 1080 : 1200 },
    partner: { x: type === 'BOUNCE' ? 870 : 1700 }, short: false, after: null, skipped: false };
}
function draw(st, key = 'witch', alpha = 1) {
  const actor = G.comboActors(st)[key], out = [], before = JSON.stringify(st);
  G.comboCastBlend(out, key === 'witch' ? 'BOOST' : 'BOUNCE', key, st, actor, identity, 590, alpha);
  assert.equal(JSON.stringify(st), before, 'presentation must not mutate the scene');
  return out;
}
try {
  G.comboCast = (ctx, id, actor, sx, ground, alpha = 1) => ctx.push({ pose: actor.pose, alpha, scale: actor.scale });
  for (const [type, at, previous, current] of [
    ['BOOST', 0.15, 'IDLE', 'CAST'],
    ['BOOST', C.comboWitchTimes.liftEnd - 0.05, 'CAST', 'USED'],
    ['BOUNCE', C.comboFighterTimes.arrive, 'IDLE', 'CAST']
  ]) {
    const samples = [0.001, 0.02, 0.05, 0.08, 0.099, 0.101].map(dt => draw(state(type, at + dt)));
    assert(samples.slice(0, -1).every(list => list.length === 2), `${type} ${previous}->${current}: old pose shown`);
    assert(samples.every(list => list[0].pose === current && list[0].alpha === 1));
    assert(samples.slice(0, -1).every(list => list[1].pose === previous));
    assert.notEqual(samples[0][0].scale, 1, 'sakuga pulse must not discard a valid crossfade');
    const weights = samples.map(list => list[1]?.alpha ?? 0);
    assert(weights[0] > 0.85 && weights.at(-2) < 0.02 && weights.at(-1) === 0, 'fade covers the full interval');
    for (let i = 1; i < weights.length; i++) assert(weights[i] <= weights[i - 1], 'old pose alpha decreases');
    for (const fps of [30, 60, 120, 144]) {
      let last = Infinity;
      for (let dt = 0.0001; dt < G.POSE_FADE + 1 / fps; dt += 1 / fps) {
        const w = draw(state(type, at + dt))[1]?.alpha ?? 0;
        assert(w <= last + 1e-9, `${type}: fade remains monotonic at ${fps}Hz`); last = w;
      }
    }
  }
  const normal = state('BOOST', 0.151), partial = draw(normal, 'witch', 0.4);
  assert.equal(partial[0].alpha, 0.4);
  assert(partial[1].alpha > 0 && partial[1].alpha <= 0.36, 'scene opacity applies to both poses');
  for (const flags of [{ short: true }, { after: 0 }, { skipped: true }]) {
    assert.equal(draw(Object.assign(state('BOOST', 0.151), flags)).length, 1, 'short/after/skip stays unblended');
  }
  // True geometry jumps and real size changes must still suppress a ghost at the new position.
  G.comboSakuga = (st, key, actor) => actor;
  for (const old of [{ pose: 'IDLE', face: 'left', x: 200, scale: 1 },
                     { pose: 'IDLE', face: 'left', x: 100, scale: 2 }]) {
    G.comboActors = () => ({ witch: old });
    const out = [];
    G.comboCastBlend(out, 'BOOST', 'witch', state('BOOST', 1), { pose: 'CAST', face: 'left', x: 100, scale: 1 }, identity, 590);
    assert.equal(out.length, 1, 'teleport / size jump stays unblended');
  }
  console.log('Combo pose blend PASS: old pose fades out, pulse preserves blend, scene opacity, 30-144Hz, skips and geometry guards.');
} finally {
  G.comboCast = originalCast; G.comboActors = originalActors; G.comboSakuga = originalSakuga;
}
