// The BOOST witch's CAST -> USED magic origin follows the pose fade without a position jump.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, C = H.CONFIG, original = S.castAssets.BOOST;
const sx = x => x - 120, ground = C.groundY, fallback = { x: -23, y: -41 }, change = C.comboWitchTimes.liftEnd - 0.05;
const near = (a, b, eps = 1e-5) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
const scene = (t, room, flags = {}) => ({ type: 'BOOST', t, heroWX: 1200, heroY: 50, source: { x: 1080 }, partner: { x: 870 }, room,
  short: false, after: null, afterTotal: 0.6, skipped: false, ...flags });
function asset(pose) { const d = S.definitions.CAST.BOOST[pose], raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', d.metadata), 'utf8')), data = S.normalizeCell(raw);
  return { ready: true, data, image: { complete: true, naturalWidth: data.frameWidth, naturalHeight: data.frameHeight } }; }
function tip(st, rm = false) { const before = JSON.stringify(st), a = G.comboActors(st).witch, p = G.comboWitchTip(st, a, sx, ground, fallback, rm); assert.equal(JSON.stringify(st), before); return p; }
function raw(st) { const a = G.comboSakuga(st, 'witch', G.comboActors(st).witch); return S.castPoint('BOOST', sx(a.x), ground + (a.dy || 0), a.pose, a.scale || 1, { face: a.face, rotate: a.rotate }); }
try {
  S.castAssets.BOOST = { CAST: asset('CAST'), USED: asset('USED') };
  for (const room of [400, 100]) {
    const pre = scene(change - 1e-7, room), at = scene(change, room), prior = raw(pre), first = tip(at);
    near(first.x, prior.x); near(first.y, prior.y);
    for (const dt of [0.001, 0.025, 0.05, 0.075, 0.099]) {
      const st = scene(change + dt, room), p = tip(st), dest = raw(st), u = dt / G.POSE_FADE, k = u * u * (3 - 2 * u);
      near(p.x, prior.x + (dest.x - prior.x) * k); near(p.y, prior.y + (dest.y - prior.y) * k);
    }
    const end = scene(change + G.POSE_FADE, room), p = tip(end), dest = raw(end); near(p.x, dest.x); near(p.y, dest.y);
    const nearEndScene = scene(change + G.POSE_FADE - 1e-7, room), beforeEnd = tip(nearEndScene), rawBeforeEnd = raw(nearEndScene);
    near(beforeEnd.x, rawBeforeEnd.x, 0.001); near(beforeEnd.y, rawBeforeEnd.y, 0.001);
    for (const flags of [{ short: true }, { skipped: true }, { after: 0 }]) { const st = scene(change + 0.02, room, flags), got = tip(st), want = raw(st); near(got.x, want.x); near(got.y, want.y); }
    const st = scene(change + 0.02, room), got = tip(st, true), want = raw(st); near(got.x, want.x); near(got.y, want.y);
    assert.deepEqual(tip(st, false), tip(st, false), 'same time is deterministic');
  }
  S.castAssets.BOOST.CAST.image.complete = false;
  { const st = scene(change + 0.02, 400), got = tip(st), want = raw(st); near(got.x, want.x); near(got.y, want.y); }
  S.castAssets.BOOST.USED.image.complete = false;
  assert.strictEqual(tip(scene(change + 0.02, 400)), fallback, 'missing current image uses original safe fallback');
  console.log('Witch tip continuity PASS: both faces, transition boundaries, eased origin, live reduced/short/skip/after, missing sprites and scene purity.');
} finally { S.castAssets.BOOST = original; }
