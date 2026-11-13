// Magic in the two combo scenes starts at the actual drawn witch's staff jewel.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { scope } = require('./phase2.cjs');
const H = scope.Hop, G = H.Graphics, S = H.Sprites, c = H.CONFIG, root = path.resolve(__dirname, '..');
const oldSlots = S.castAssets.BOOST, oldCircle = G.circle, oldSpark = G.spark, oldBlend = G.comboCastBlend, oldCast = G.comboCast;
const sx = x => x - 120, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY;
const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
const scene = (type, t, opts = {}) => ({ type, t, heroWX: 1200, heroY: 50, source: { x: 1080 }, partner: { x: 870 },
  room: 400, short: false, after: null, afterTotal: 0.6, skipped: false, ...opts });
function asset(pose) {
  const def = S.definitions.CAST.BOOST[pose], raw = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
  const data = S.normalizeCell(raw);
  return { ready: true, data, image: { complete: true, naturalWidth: data.frameWidth, naturalHeight: data.frameHeight } };
}
function expected(st, actor) {
  const a = G.comboSakuga(st, 'witch', actor), def = S.definitions.CAST.BOOST[a.pose], d = S.castAssets.BOOST[a.pose].data;
  const scale = def.scale * (a.scale || 1) / d.unit, flip = a.face !== def.facing, angle = a.rotate || 0;
  const dx = (def.hotspot.x - d.pivot.x) * scale * (flip ? -1 : 1), dy = (def.hotspot.y - d.pivot.y) * scale;
  return { x: sx(a.x) + dx * Math.cos(angle) - dy * Math.sin(angle), y: ground + (a.dy || 0) + dx * Math.sin(angle) + dy * Math.cos(angle) };
}
const ctx = () => new Proxy({ globalAlpha: 1 }, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o, k, v) => (o[k] = v, true) });
try {
  assert.deepEqual({ ...S.definitions.CAST.BOOST.CAST.hotspot }, { x: 100, y: 30 });
  assert.deepEqual({ ...S.definitions.CAST.BOOST.USED.hotspot }, { x: 87, y: 38 });
  S.castAssets.BOOST = { CAST: asset('CAST'), USED: asset('USED') };
  const fallback = { x: -23, y: -41 };
  // Independent geometry check: both staff poses, both orientations, scale and rotation.
  for (const pose of ['CAST', 'USED']) for (const face of ['left', 'right']) for (const mul of [0.75, 1.4]) {
    const st = scene('BOOST', 0.7), actor = { x: 1100, dy: 8, pose, face, scale: mul, rotate: 0.32 };
    const actual = G.comboWitchTip(st, actor, sx, ground, fallback), want = expected(st, actor);
    near(actual.x, want.x, `${pose}/${face}/${mul} x`); near(actual.y, want.y, `${pose}/${face}/${mul} y`);
  }
  for (const opts of [{ short: true }, { skipped: true }, { after: 0.2 }]) {
    const st = scene('BOOST', 0.8, opts), actor = { x: 1100, pose: 'CAST', face: 'right', scale: 1, rotate: 0 };
    const actual = G.comboWitchTip(st, actor, sx, ground, fallback), want = expected(st, actor);
    near(actual.x, want.x, 'short/skip/after x'); near(actual.y, want.y, 'short/skip/after y');
  }
  const actor = { x: 1100, pose: 'CAST', face: 'right', scale: 1, rotate: 0 }, st = scene('BOOST', 0.8);
  S.castAssets.BOOST.CAST.image.complete = false;
  assert.strictEqual(G.comboWitchTip(st, actor, sx, ground, fallback), fallback, 'undecoded image uses previous position');
  delete S.castAssets.BOOST.CAST;
  assert.strictEqual(G.comboWitchTip(st, actor, sx, ground, fallback), fallback, 'missing requested pose uses previous position');
  S.castAssets.BOOST.CAST = asset('CAST');
  const oldPoint = S.castPoint; S.castPoint = () => { throw Error('optional sprite failed'); };
  assert.strictEqual(G.comboWitchTip(st, actor, sx, ground, fallback), fallback, 'optional lookup errors cannot stop the scene'); S.castPoint = oldPoint;

  // Render-path checks: changing the helper changes each effect's true start, without moving actors.
  G.comboCastBlend = () => {}; G.comboCast = () => {};
  {
    const k = scene('BOOST', 0.7), a = G.comboActors(k), tip = expected(k, a.witch), circles = [];
    G.circle = (ctx, x, y, r) => circles.push({ x, y, r });
    const before = JSON.stringify(k); G.comboBack(ctx(), k, sx, sy, ground); assert.equal(JSON.stringify(k), before);
    assert.equal(circles.length, 18); const d = (1 - (k.t * 1.3) % 1) * 150;
    near(circles[0].x, tip.x + d, 'BOOST motes x'); near(circles[0].y, tip.y, 'BOOST motes y');
  }
  {
    const k = scene('BOUNCE', 0.55), a = G.comboActors(k), tip = expected(k, a.witch), sparks = [];
    G.spark = (ctx, x, y) => sparks.push({ x, y }); G.comboBack(ctx(), k, sx, sy, ground);
    assert.equal(sparks.length, 10); const ph = (k.t * 2) % 1, fx = sx(a.fighter.x), mid = ground + (a.fighter.dy || 0) - 70 * a.fighter.scale;
    near(sparks[0].x, tip.x + (fx - tip.x) * ph, 'BOUNCE buff x');
    near(sparks[0].y, tip.y + (mid - tip.y) * ph - Math.sin(ph * Math.PI) * 50, 'BOUNCE buff y');
  }
  {
    const k = scene('BOOST', c.comboWitchTimes.liftEnd), a = G.comboActors(k), change = c.comboWitchTimes.liftEnd - 0.05;
    const oldScene = { ...k, t: change - 1e-7 }, prev = expected(oldScene, G.comboActors(oldScene).witch), next = expected(k, a.witch);
    const u = (k.t - change) / G.POSE_FADE, weight = u * u * (3 - 2 * u), tip = { x: prev.x + (next.x - prev.x) * weight, y: prev.y + (next.y - prev.y) * weight }, arcs = [], context = ctx();
    context.arc = (x, y, radius) => arcs.push({ x, y, radius }); G.comboFront(context, k, sx, sy, ground);
    assert.equal(arcs.length, 1); near(arcs[0].x, tip.x, 'BOOST fireball x'); near(arcs[0].y, tip.y, 'BOOST fireball y');
  }
  // If both optional poses are unavailable, each effect retains its own prior fixed origin.
  S.castAssets.BOOST = {};
  {
    const k = scene('BOOST', 0.7), a = G.comboActors(k), circles = [];
    G.circle = (ctx, x, y) => circles.push({ x, y }); G.comboBack(ctx(), k, sx, sy, ground);
    const oldX = sx(a.witch.x) + (a.witch.face === 'left' ? -28 : 28), d = (1 - (k.t * 1.3) % 1) * 150;
    near(circles[0].x, oldX + d, 'missing BOOST motes x'); near(circles[0].y, ground - 120, 'missing BOOST motes y');
  }
  {
    const k = scene('BOUNCE', 0.55), a = G.comboActors(k), sparks = [];
    G.spark = (ctx, x, y) => sparks.push({ x, y }); G.comboBack(ctx(), k, sx, sy, ground);
    const wx = sx(a.witch.x) + 40, wy = ground - 110, ph = (k.t * 2) % 1, fx = sx(a.fighter.x), mid = ground + (a.fighter.dy || 0) - 70 * a.fighter.scale;
    near(sparks[0].x, wx + (fx - wx) * ph, 'missing BOUNCE buff x'); near(sparks[0].y, wy + (mid - wy) * ph - Math.sin(ph * Math.PI) * 50, 'missing BOUNCE buff y');
  }
  {
    const k = scene('BOOST', c.comboWitchTimes.liftEnd), a = G.comboActors(k), arcs = [], context = ctx();
    context.arc = (x, y) => arcs.push({ x, y }); G.comboFront(context, k, sx, sy, ground);
    near(arcs[0].x, sx(a.witch.x) + (a.witch.face === 'left' ? -30 : 30), 'missing BOOST fireball x'); near(arcs[0].y, ground - 120, 'missing BOOST fireball y');
  }
  console.log('Combo witch staff PASS: sprite hotspot geometry, both faces and poses, scene pulse, all three effect origins, safe fallback and scene purity.');
} finally {
  S.castAssets.BOOST = oldSlots; G.circle = oldCircle; G.spark = oldSpark; G.comboCastBlend = oldBlend; G.comboCast = oldCast;
}
