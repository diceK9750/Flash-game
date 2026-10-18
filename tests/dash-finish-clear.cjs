// 戦陣突破 finishing pose clear of the hero (2026-10-18 auto cycles 37-38, display only). Before: the follow-through ended
// 30 px past the hero and the FINISH pose was drawn behind the hero sprite (hidden, ~46% of the hero box overlapped).
// Checks: with room in the zoomed view the warrior settles GRAND_FINISH_GAP (125 px) past the hero, on screen; without
// room (hero at the stage edge right after the launch, e.g. ?debug=dash) she leaps back over the hero and finishes on the
// roomy side facing the hero (cycle 38; front-layer fallback only if neither side has room); the gap never puts her outside the view; other scenes / the short version are unchanged;
// the pose sequence and the climax timing are untouched; same input -> same output.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  class Image { set src(v) { const b = fs.readFileSync(path.join(root, v)); this.naturalWidth = b.readUInt32BE(16); this.naturalHeight = b.readUInt32BE(20); this.complete = true; setTimeout(() => this.onload(), 0); } }
  const fetch = async url => { const f = path.join(root, url); if (!fs.existsSync(f)) return { ok: false, json: async () => ({}) }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }; };
  const sc = { document: { getElementById: () => ({}), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, fetch, Image, setTimeout, console, Promise };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  const H = sc.Hop, S = H.Sprites, G = H.Graphics, c = H.CONFIG;
  await S.castReady;
  const sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY, start = G.comboSceneStart(false);
  const mk = (T, heroWX, t, o = {}) => ({ type: T, short: false, t, end: c.grandDurations[T] - start, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX - 280 }, skipped: false, grand: true, climax: c.grandClimax[T], ...o });
  const tEnd = c.grandDurations.DASH - start - 0.02, z = Math.max(1, Math.min(c.comboZoomMax, c.width * c.comboZoomFill / 410, c.height * c.comboZoomFill / 305));
  // 1) normal flight (hero near the camera anchor) -> 125 px past the hero, not in front
  for (const heroWX of [250, 400, 900]) {
    const st = mk('DASH', heroWX, tEnd), A = G.grandActor(st, sx, sy, ground), bk = G.grandBack1(st, sx);
    assert.equal(A.pose, 'FINISH'); assert.equal(G.grandFinishGap(st, sx, bk), 125, 'full gap at hero x ' + sx(heroWX));
    assert.ok(Math.abs(Math.abs(A.x - heroWX) - 125) < 1e-6, 'settles 125 px past the hero'); assert.equal(Math.sign(A.x - heroWX), bk, 'on the far side');
    assert.ok(!A.front, 'behind the hero layer when clear');
  }
  // 2) no room past the hero (hero at the stage edge, e.g. ?debug=dash) -> cycle 38: she leaps back over the hero
  // (backflip in the THRUST pose, no mirror) and strikes FINISH on the side with room, facing the hero, not in front
  const faceOf = (heroWX, t) => G.grandActor(mk('DASH', heroWX, t), sx, sy, ground).face;
  for (const heroWX of [-85, -120]) {
    const st = mk('DASH', heroWX, tEnd), A = G.grandActor(st, sx, sy, ground), bk = G.grandBack1(st, sx), dB = G.grandFinishGap(st, sx, -bk);
    assert.equal(G.grandFinishGap(st, sx, bk), 30); assert.ok(dB >= G.GRAND_FINISH_HOP, 'room on the other side');
    assert.equal(A.pose, 'FINISH'); assert.ok(Math.abs(A.x - (heroWX - bk * dB)) < 1e-6, 'finishes on the roomy side'); assert.ok(!A.front, 'clear, so not in front');
    assert.equal(A.face === 'left', A.x > heroWX, 'FINISH faces the hero');
    const thrust = faceOf(heroWX, c.grandClimax.DASH + 0.2), leap = G.grandActor(mk('DASH', heroWX, c.grandClimax.DASH + 0.54), sx, sy, ground);
    assert.equal(leap.pose, 'THRUST'); assert.equal(leap.beat, 'leap back'); assert.equal(leap.face, thrust, 'same facing through the leap (no mirror)'); assert.equal(A.face, thrust, 'FINISH keeps the scene parity');
    assert.ok(leap.dy < A.dy - 100, 'arcs over the hero');
    let prev = null, maxStep = 0; for (let t = c.grandClimax.DASH; t < tEnd; t += 1 / 60) { const p = G.grandActor(mk('DASH', heroWX, t), sx, sy, ground); if (prev) maxStep = Math.max(maxStep, Math.abs(p.x - prev.x)); prev = p; }
    assert.ok(maxStep < 25, 'continuous path (max ' + maxStep.toFixed(1) + ' px / frame)');
  }
  // neither side has room (cannot happen with the stage camera; forced here) -> cycle 37 fallback: FINISH in front
  { const gap = G.grandFinishGap; G.grandFinishGap = () => 30; const A = G.grandActor(mk('DASH', -85, tEnd), sx, sy, ground); G.grandFinishGap = gap; assert.equal(A.front, true); }
  // 3) any hero position: the gap never puts the settled warrior outside the zoomed view (centre inside by >= 50 px)
  let n = 0, hops = 0;
  for (let hs = 0; hs <= c.width; hs += 10) {
    const heroWX = hs - c.launchX, st = mk('DASH', heroWX, tEnd), bk = G.grandBack1(st, sx), d = G.grandFinishGap(st, sx, bk);
    assert.ok(d >= 30 && d <= 125);
    if (d < 125) { const dB = G.grandFinishGap(st, sx, -bk), A = G.grandActor(st, sx, sy, ground), half = c.width / 2 / (z * 1.07), fx = Math.max(half, Math.min(c.width - half, hs));
      if (dB >= G.GRAND_FINISH_HOP) { const ax = sx(A.x); assert.ok(ax >= fx - half + 50 && ax <= fx + half - 50 && Math.abs(A.x - heroWX) >= 100, 'leap-back finish in view, clear at hs ' + hs); hops++; } else assert.ok(A.front); }
    if (d > 30) { const half = c.width / 2 / (z * 1.07), fx = Math.max(half, Math.min(c.width - half, hs)), ax = hs + bk * d; assert.ok(ax >= fx - half + 50 && ax <= fx + half - 50, 'in view at hs ' + hs); n++; }
  }
  assert.ok(n > 80, 'most hero positions get a gap'); assert.ok(hops > 0, 'edge positions leap back');
  // 4) layer: the actor is drawn once per frame, by grandBack (clear) or grandFront (no room)
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => (o[k] = v, true) });
  const blend = G.grandCastBlend; let calls = [];
  G.grandCastBlend = function (...a) { calls.push(this.__layer); };
  for (const [heroWX, front] of [[250, false], [-85, false], [-85, true]]) {
    calls = []; const st = mk('DASH', heroWX, tEnd), gap = G.grandFinishGap; if (front) G.grandFinishGap = () => 30;
    G.__layer = 'back'; G.grandBack(ctx, st, sx, sy, ground); G.__layer = 'front'; G.grandFront(ctx, st, sx, sy, ground);
    G.grandFinishGap = gap; assert.deepEqual(calls, [front ? 'front' : 'back'], 'drawn once on the ' + (front ? 'front' : 'back') + ' layer');
  }
  G.grandCastBlend = blend; delete G.__layer;
  // 5) other scenes never use the front layer; short version unchanged; climax / pose order kept
  for (const T of ['STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) for (let t = 0; t < c.grandDurations[T] - start; t += 0.05) for (const heroWX of [-85, 250, 1100]) assert.ok(!G.grandActor(mk(T, heroWX, t), sx, sy, ground).front, T);
  const seq = []; for (let t = 0; t < tEnd; t += 1 / 60) { const p = G.grandActor(mk('DASH', 250, t), sx, sy, ground).pose; if (seq[seq.length - 1] !== p) seq.push(p); }
  assert.deepEqual(seq, ['IDLE', 'WINDUP', 'THRUST', 'FINISH']);
  const atCl = G.grandActor(mk('DASH', 250, c.grandClimax.DASH - 1e-3), sx, sy, ground), atCl2 = G.grandActor(mk('DASH', -85, c.grandClimax.DASH - 1e-3), sx, sy, ground);
  assert.ok(Math.abs((atCl.x - 250) - (atCl2.x + 85)) < 1e-9, 'the dash up to the climax is unchanged by the gap');
  assert.deepEqual(JSON.stringify(G.grandActor(mk('DASH', 250, 2.0), sx, sy, ground)), JSON.stringify(G.grandActor(mk('DASH', 250, 2.0), sx, sy, ground)), 'deterministic');
  console.log(JSON.stringify({ dashFinishClear: 'PASS', gapPositions: n, normalGap: 125, hopPositions: hops, edge: 'leap back to the roomy side' }));
})().catch(e => { console.error(e); process.exit(1); });
