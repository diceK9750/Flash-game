// 戦陣突破 finishing pose clear of the hero (2026-10-18 auto cycle 37, display only). Before: the follow-through ended
// 30 px past the hero and the FINISH pose was drawn behind the hero sprite (hidden, ~46% of the hero box overlapped).
// Checks: with room in the zoomed view the warrior settles GRAND_FINISH_GAP (125 px) past the hero, on screen; without
// room (hero at the stage edge right after the launch, e.g. ?debug=dash) the old 30 px is kept and FINISH is drawn in
// front of the hero instead; the gap never puts her outside the view; other scenes / the short version are unchanged;
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
  // 2) no room (hero at the stage edge) -> old 30 px, FINISH drawn in front of the hero
  for (const heroWX of [-85, -120]) {
    const st = mk('DASH', heroWX, tEnd), A = G.grandActor(st, sx, sy, ground), bk = G.grandBack1(st, sx);
    assert.equal(G.grandFinishGap(st, sx, bk), 30); assert.ok(Math.abs(Math.abs(A.x - heroWX) - 30) < 1e-6); assert.equal(A.front, true, 'front at hero x ' + sx(heroWX));
    assert.ok(!G.grandActor(mk('DASH', heroWX, c.grandClimax.DASH + 0.3), sx, sy, ground).front, 'only the FINISH pose moves to the front');
  }
  // 3) any hero position: the gap never puts the settled warrior outside the zoomed view (centre inside by >= 50 px)
  let n = 0;
  for (let hs = 0; hs <= c.width; hs += 10) {
    const heroWX = hs - c.launchX, st = mk('DASH', heroWX, tEnd), bk = G.grandBack1(st, sx), d = G.grandFinishGap(st, sx, bk);
    assert.ok(d >= 30 && d <= 125);
    if (d > 30) { const half = c.width / 2 / (z * 1.07), fx = Math.max(half, Math.min(c.width - half, hs)), ax = hs + bk * d; assert.ok(ax >= fx - half + 50 && ax <= fx + half - 50, 'in view at hs ' + hs); n++; }
  }
  assert.ok(n > 80, 'most hero positions get a gap');
  // 4) layer: the actor is drawn once per frame, by grandBack (clear) or grandFront (no room)
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => (o[k] = v, true) });
  const blend = G.grandCastBlend; let calls = [];
  G.grandCastBlend = function (...a) { calls.push(this.__layer); };
  for (const [heroWX, front] of [[250, false], [-85, true]]) {
    calls = []; const st = mk('DASH', heroWX, tEnd);
    G.__layer = 'back'; G.grandBack(ctx, st, sx, sy, ground); G.__layer = 'front'; G.grandFront(ctx, st, sx, sy, ground);
    assert.deepEqual(calls, [front ? 'front' : 'back'], 'drawn once on the ' + (front ? 'front' : 'back') + ' layer');
  }
  G.grandCastBlend = blend; delete G.__layer;
  // 5) other scenes never use the front layer; short version unchanged; climax / pose order kept
  for (const T of ['STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) for (let t = 0; t < c.grandDurations[T] - start; t += 0.05) for (const heroWX of [-85, 250, 1100]) assert.ok(!G.grandActor(mk(T, heroWX, t), sx, sy, ground).front, T);
  const seq = []; for (let t = 0; t < tEnd; t += 1 / 60) { const p = G.grandActor(mk('DASH', 250, t), sx, sy, ground).pose; if (seq[seq.length - 1] !== p) seq.push(p); }
  assert.deepEqual(seq, ['IDLE', 'WINDUP', 'THRUST', 'FINISH']);
  const atCl = G.grandActor(mk('DASH', 250, c.grandClimax.DASH - 1e-3), sx, sy, ground), atCl2 = G.grandActor(mk('DASH', -85, c.grandClimax.DASH - 1e-3), sx, sy, ground);
  assert.ok(Math.abs((atCl.x - 250) - (atCl2.x + 85)) < 1e-9, 'the dash up to the climax is unchanged by the gap');
  assert.deepEqual(JSON.stringify(G.grandActor(mk('DASH', 250, 2.0), sx, sy, ground)), JSON.stringify(G.grandActor(mk('DASH', 250, 2.0), sx, sy, ground)), 'deterministic');
  console.log(JSON.stringify({ dashFinishClear: 'PASS', gapPositions: n, normalGap: 125, edgeGap: 30 }));
})().catch(e => { console.error(e); process.exit(1); });
