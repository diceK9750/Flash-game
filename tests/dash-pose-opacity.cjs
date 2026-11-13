// The warrior's prior pose should suggest motion without obscuring the face and sword.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG;
const oldCast = G.comboCast, oldChange = G.grandPoseChange, oldDraw = S.drawCastScaled, oldCharacter = G.character;
const sx = x => C.launchX + x - 1000, sy = y => C.groundY - C.playerRadius - y, ground = C.groundY;
const near = (a, b, label, eps = 1e-8) => assert(Math.abs(a - b) < eps, `${label}: ${a} != ${b}`);
const st = (type, t, extra = {}) => ({ type, t, end: 2.4, climax: C.grandClimax[type], grand: true, heroWX: 1200, heroY: 50,
  source: { x: 1230 }, after: null, short: false, skipped: false, ...extra });
const ctx = () => new Proxy({ globalAlpha: 1, filter: 'none' }, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) });
try {
  const draws = [];
  G.comboCast = (c, id, a, x, y, alpha) => draws.push({ id, pose: a.pose, scale: a.scale, alpha });
  function sample(t, opts = {}, alpha = 1) {
    const state = st('DASH', t, opts), actor = G.grandActor(state, sx, sy, ground), before = JSON.stringify({ state, actor });
    draws.length = 0; const change = G.grandCastBlend(ctx(), 'DASH', state, actor, sx, sy, ground, alpha);
    assert.equal(JSON.stringify({ state, actor }), before, 'render does not mutate the scene or actor');
    return { actor, change, draws: draws.slice() };
  }
  const observed = sample(0.78);
  assert.equal(observed.actor.pose, 'THRUST'); assert.equal(observed.change.pose, 'WINDUP');
  assert.deepEqual(observed.draws.map(d => d.pose), ['THRUST', 'WINDUP', 'THRUST'], 'current, previous, existing smear');
  assert.equal(observed.draws[0].alpha, 1, 'main actor is not faded');
  assert(observed.draws[1].alpha > 0.16 && observed.draws[1].alpha < 0.19, 'old pose is visibly subordinate at QA t=.78');
  assert(observed.draws[2].alpha > 0 && observed.draws[2].alpha <= 0.6, 'existing smear preserved');
  const u = observed.change.back / G.POSE_FADE, fade = 1 - u * u * (3 - 2 * u);
  near(observed.draws[1].alpha, fade * 0.22, 'warrior alpha');
  assert(observed.draws.every(d => d.scale === observed.actor.scale), 'poses keep identical uniform scale');
  const partial = sample(0.78, {}, 0.4);
  near(partial.draws[0].alpha, 0.4, 'scene opacity preserved'); near(partial.draws[1].alpha, 0.4 * fade * 0.22, 'old pose respects scene opacity');
  let last = Infinity;
  for (const d of [0.00001, 0.01, 0.03, 0.06, 0.09, 0.09999, 0.10001]) {
    const frame = sample(0.75 + d), old = frame.draws.find(x => x.pose === 'WINDUP')?.alpha ?? 0;
    assert(old <= last + 1e-8 && old >= 0 && old <= 0.22, 'old pose alpha tapers monotonically'); last = old;
  }
  assert(last === 0 && sample(0.75 + 0.09999).draws.find(x => x.pose === 'WINDUP')?.alpha < 1e-5, 'fade approaches zero without a final pop');
  for (const flags of [{ short: true }, { skipped: true }, { after: 0 }]) {
    const frame = sample(0.78, flags); assert.equal(frame.change, null); assert.equal(frame.draws.length, 1, 'short/reduced, skip and after remain unblended');
  }
  // The other four solo SPECIALs retain their exact alpha and smear arithmetic.
  G.grandPoseChange = () => ({ back: 0.03, pose: 'OLD', face: 'left' });
  for (const type of ['STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) {
    draws.length = 0; const fake = st(type, 0.8), actor = { pose: 'NEW', face: 'left', x: 1, dy: 0, scale: 1 };
    G.grandCastBlend(ctx(), type, fake, actor, sx, sy, ground, 0.4);
    const q = 0.03 / G.POSE_FADE, k = q * q * (3 - 2 * q);
    near(draws[1].alpha, 0.4 * (1 - k) * 0.85, type + ' prior pose unchanged');
    near(draws[2].alpha, 0.4 * 0.6 * (1 - 0.03 / 0.05), type + ' smear unchanged');
  }
  G.grandPoseChange = oldChange; G.comboCast = oldCast;
  // Missing images retain the Canvas fallback, with no state mutation or exceptions.
  let fallback = 0; S.drawCastScaled = () => null; G.character = () => { fallback++; };
  const state = st('DASH', 0.78), actor = G.grandActor(state, sx, sy, ground), before = JSON.stringify({ state, actor });
  assert.doesNotThrow(() => G.grandCastBlend(ctx(), 'DASH', state, actor, sx, sy, ground, 1));
  assert(fallback >= 2, 'fallback draws poses'); assert.equal(JSON.stringify({ state, actor }), before);
  console.log('DASH pose opacity PASS: subtle warrior ghost, smooth fade, scene alpha, other characters unchanged, short/skip/after, fallback and purity.');
} finally { G.comboCast = oldCast; G.grandPoseChange = oldChange; S.drawCastScaled = oldDraw; G.character = oldCharacter; }
