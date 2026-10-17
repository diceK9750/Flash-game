// SPECIAL scene sakuga (2026-10-17 auto cycle 35, display only): richer character motion in the 5 grand scenes and the
// mage / monk combos. Checks: >= 5 beats per grand scene, rotation + uniform scale pulses, continuous motion (no pops),
// hit-stop hold at the climax, hero reaction that rests before the scene ends, impact frames only in their window (none in
// the short / reduced-motion path), combo sakuga layer bounded and resting at the end, scene lengths <= 4.5 s.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sc = { document: { getElementById: () => ({}), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} } }; sc.window = sc; vm.createContext(sc);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
const H = sc.Hop, G = H.Graphics, c = H.CONFIG, S = G.comboSceneStart(false);
const sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY;
let calls = 0; const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (...a) => { calls++; return k === 'measureText' ? { width: 10 } : undefined; }, set: (o, k, v) => (o[k] = v, true) });
for (const T of ['DASH', 'STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) for (const heroWX of [300, 1100]) {
  assert.ok(c.grandDurations[T] <= 4.5);
  const end = c.grandDurations[T] - S, mk = t => ({ type: T, short: false, t, end, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX - 280 }, skipped: false, grand: true, climax: c.grandClimax[T] });
  const beats = new Set(); let prev = null, rotSeen = 0, scaleMin = 9, scaleMax = 0;
  for (let i = 0; i <= Math.round(end * 120); i++) {
    const st = mk(i / 120), a = G.grandActor(st, sx, sy, ground), h = G.grandHeroOff(st, sx, sy, ground);
    beats.add(a.beat); rotSeen = Math.max(rotSeen, Math.abs(a.rotate || 0)); scaleMin = Math.min(scaleMin, a.scale / c.grandActorScale); scaleMax = Math.max(scaleMax, a.scale / c.grandActorScale);
    if (prev && a.alpha > 0.05 && prev.a.alpha > 0.05) { // no pops: step-to-step velocity change stays small (except the deliberate hit-stop at the climax)
      const vx = a.x - prev.a.x, vy = a.dy - prev.a.dy, dv = prev.v ? Math.hypot(vx - prev.v[0], vy - prev.v[1]) : 0;
      if (process.env.DBG && dv > 6) console.log(T, heroWX, i / 120, a.beat, dv.toFixed(1)); assert.ok(dv < 14 || Math.abs(i / 120 - c.grandClimax[T] - 0.04) < 0.08, `${T} actor pop at ${i / 120} (${a.beat})`); a.v = [vx, vy]; }
    if (prev) assert.ok(Math.hypot(h.dx - prev.h.dx, h.dy - prev.h.dy) < 25, `${T} hero pop at ${i / 120}`);
    prev = { a, h, v: a.v };
  }
  assert.ok(beats.size >= 5, `${T} beats ${[...beats]}`); assert.ok(rotSeen > 0.25, T + ' rotation');
  assert.ok(scaleMin >= 0.5 && scaleMax <= 1.25 && scaleMax > 1.04, `${T} uniform scale pulses ${scaleMin}..${scaleMax}`);
  const hEnd = G.grandHeroOff(mk(end), sx, sy, ground); assert.ok(Math.abs(hEnd.dx) < 1 && Math.abs(hEnd.dy) < 1 && Math.abs(hEnd.rot) < 0.01, T + ' hero rests at the end');
  // hit-stop: the scene clock holds at the climax for GRAND_HITSTOP
  const cl = c.grandClimax[T]; assert.equal(G.grandT(mk(cl + 0.02)), cl); assert.equal(G.grandT(mk(cl + G.GRAND_HITSTOP - 0.001)), cl); assert.ok(G.grandT(mk(cl + 0.2)) > cl);
  // impact frames: only in [climax, climax + 0.07), never short / reduced / after
  assert.equal(G.sakugaImpactAge(mk(cl - 0.01)), null); assert.ok(G.sakugaImpactAge(mk(cl + 0.01)) !== null); assert.equal(G.sakugaImpactAge(mk(cl + 0.08)), null);
  assert.equal(G.sakugaImpactAge({ ...mk(cl + 0.01), short: true }), null);
  calls = 0; assert.equal(G.sakugaImpact(ctx, mk(cl + 0.01), sx, sy, ground, null, false), true); assert.ok(calls > 30);
  assert.equal(G.sakugaImpact(ctx, mk(cl + 0.01), sx, sy, ground, null, true), false, 'reduced motion: none');
  assert.equal(G.sakugaImpact(ctx, mk(cl + 0.04), sx, sy, ground, null, false), true, 'second (black on white) frame');
}
// combos: bounded lean / uniform pulse, comboActors untouched, hero spin rests at the end
for (const T of ['BOOST', 'BOUNCE']) {
  const end = (T === 'BOOST' ? c.comboWitchDuration : c.comboFighterDuration) - S;
  const mk = t => ({ type: T, short: false, t, end, after: null, afterTotal: 0, heroWX: 900, heroY: 240, source: { x: 600 }, partner: { x: 1500 }, skipped: false });
  let maxLean = 0, pulse = 0;
  for (let i = 0; i <= Math.round(end * 60); i++) {
    const st = mk(i / 60), A = G.comboActors(st), before = JSON.stringify(A);
    for (const k of ['witch', 'fighter']) { const a = A[k]; if (!a) continue; const s2 = G.comboSakuga(st, k, a);
      maxLean = Math.max(maxLean, Math.abs((s2.rotate || 0) - (a.rotate || 0))); pulse = Math.max(pulse, Math.abs(s2.scale / (a.scale || 1) - 1)); }
    assert.equal(JSON.stringify(A), before, 'comboActors unchanged');
  }
  assert.ok(maxLean > 0.02 && maxLean <= 0.29, T + ' lean ' + maxLean); assert.ok(pulse > 0.02 && pulse <= 0.071, T + ' pulse ' + pulse);
  assert.ok(Math.abs(G.comboHeroRot(mk(end))) < 0.01); assert.equal(G.comboHeroRot({ ...mk(1), short: true }), 0);
  const at = T === 'BOOST' ? c.comboWitchTimes.blast : c.comboFighterTimes.upper;
  assert.ok(G.sakugaImpactAge(mk(at + 0.01)) !== null); assert.equal(G.sakugaImpactAge(mk(at - 0.01)), null);
}
console.log('special-sakuga OK: 5 grand scenes x 2 sides + 2 combos');
