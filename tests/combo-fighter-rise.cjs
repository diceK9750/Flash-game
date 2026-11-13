// BOUNCE uppercut afterimages follow earlier actor positions without changing the punch itself.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG, F = C.comboFighterTimes;
const oldDraw = S.drawCastScaled, oldCharacter = G.character, oldCast = G.comboCast, oldBlend = G.comboCastBlend;
const near = (a, b, label) => assert(Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
const scene = (t, more = {}) => ({ type: 'BOUNCE', t, heroWX: 1200, heroY: 30, source: { x: 1230 }, partner: { x: 1700 },
  short: false, skipped: false, after: null, afterTotal: 0.6, ...more });
const ctx = () => new Proxy({ globalAlpha: 1 }, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
try {
  const span = F.upper - F.rise, middle = scene(F.rise + span * 0.58), actor = G.comboActors(middle).fighter;
  const before = JSON.stringify(middle), ghosts = G.comboFighterRiseGhosts(middle, actor);
  assert.equal(JSON.stringify(middle), before, 'scene remains unchanged');
  assert.equal(ghosts.length, 3); assert(ghosts.every(g => g.actor.pose === 'UPPER' && g.actor.face === actor.face && g.actor.scale === actor.scale));
  assert(ghosts.every(g => g.alpha > 0 && g.alpha <= 0.48));
  ghosts.forEach((g, index) => { const k = 3 - index, old = G.comboActors({ ...middle, t: middle.t - k * 0.025 }).fighter;
    near(g.actor.x, old.x, 'earlier actor x'); near(g.actor.dy, old.dy, 'earlier actor y'); assert(g.actor.dy > actor.dy, 'afterimage remains behind the rising fist'); });
  assert.deepEqual(JSON.parse(JSON.stringify(G.comboFighterRiseGhosts(middle, actor))), JSON.parse(JSON.stringify(ghosts)), 'same paused time is deterministic');
  for (const changes of [{ short: true }, { skipped: true }, { after: 0 }, { type: 'BOOST' }]) assert.equal(G.comboFighterRiseGhosts({ ...middle, ...changes }, actor).length, 0);
  assert.equal(G.comboFighterRiseGhosts(middle, actor, true).length, 0, 'live reduced-motion has no afterimages');
  for (const t of [F.rise - 0.001, F.rise, F.upper, F.upper + 0.001]) {
    const st = scene(t); assert.equal(G.comboFighterRiseGhosts(st, G.comboActors(st).fighter).length, 0, 'outside rise no ghosts');
  }
  for (const t of [F.rise + 1e-6, F.upper - 1e-6]) {
    const st = scene(t), a = G.comboActors(st).fighter, total = G.comboFighterRiseGhosts(st, a).reduce((sum, g) => sum + g.alpha, 0);
    assert(total < 1e-6, 'fade continuous at both boundaries');
  }
  for (const fps of [30, 60, 120, 144]) {
    let seen = false; for (let t = F.rise; t < F.upper; t += 1 / fps) {
      const st = scene(t), a = G.comboActors(st).fighter, list = G.comboFighterRiseGhosts(st, a);
      assert(list.length <= 3); if (list.length) seen = true;
      list.forEach(g => assert(Number.isFinite(g.actor.dy) && Number.isFinite(g.alpha)));
    }
    assert(seen, `ghosts visible at ${fps}Hz`);
  }
  // Actor path, fist x, uppercut contact and hit stop are the original display formulas.
  const hidden = G.comboFighterHiddenDy(C.comboFighterScale), contact = G.comboFighterContactDy(middle, C.comboFighterScale);
  for (let t = F.rise; t < F.upper; t += 0.013) {
    const st = scene(t), a = G.comboActors(st).fighter, u = (t - F.rise) / span;
    near(a.dy, hidden + (contact - hidden) * G.ease(u), 'original rise path');
    near(a.x + G.comboFighterFistDx(C.comboFighterScale), st.heroWX, 'fist under hero');
  }
  near(G.comboActors(scene(F.upper)).fighter.dy, contact, 'fist arrives at same contact');
  near(G.comboActors(scene(F.upper + F.hitstop / 2)).fighter.dy, contact, 'hit stop unchanged');

  // Live rendering uses sampled positions, and toggling reduced motion removes only these ghosts.
  const calls = []; G.comboCast = (c, id, a, sx, ground, alpha = 1) => calls.push({ id, a, alpha }); G.comboCastBlend = () => {};
  G.comboBack(ctx(), middle, x => x, y => y, C.groundY, false);
  const samples = calls.filter(x => x.id === 'BOUNCE' && x.a.scale === actor.scale && x.a.dy > actor.dy);
  assert.equal(samples.length, ghosts.length, 'draws exactly sampled ghosts');
  calls.length = 0; G.comboBack(ctx(), middle, x => x, y => y, C.groundY, true);
  assert.equal(calls.filter(x => x.id === 'BOUNCE' && x.a.scale === actor.scale && x.a.dy > actor.dy).length, 0, 'live reduced motion suppresses new ghosts');
  G.comboCast = oldCast; G.comboCastBlend = oldBlend;
  // Missing sprite must still render the scene through the existing Canvas fallback.
  let fallback = 0; S.drawCastScaled = () => null; G.character = () => { fallback++; };
  const snapshot = JSON.stringify(middle); assert.doesNotThrow(() => G.comboBack(ctx(), middle, x => x, y => y, C.groundY));
  assert(fallback > 0, 'missing images use Canvas'); assert.equal(JSON.stringify(middle), snapshot);
  console.log('Combo fighter rise PASS: sampled afterimages, bounded fade, pause, reduced/skip/after, unchanged fist path and missing-image fallback.');
} finally { S.drawCastScaled = oldDraw; G.character = oldCharacter; G.comboCast = oldCast; G.comboCastBlend = oldBlend; }
