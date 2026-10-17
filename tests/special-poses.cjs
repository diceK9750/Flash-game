// Grand-scene poses (2026-10-18 auto cycle 36, display only): the adopted pose stills for 戦陣突破 / 聖光反転 / 影すり抜け /
// 水平曲芸 / 聖護結界. Checks: the scene-only slots load from the real files (JSON contract, per-image cell / pivot, deferred
// group) and are never picked roadside; each scene plays idle -> pose 1 -> pose 2 [-> pose 3] on the expected beats;
// one mirror parity per scene (weapon / staff hand kept) with the key pose facing the hero; pose changes cross-fade with
// a smear frame (none in the short version / after a skip); effect hotspots follow the drawn sprite; scale stays uniform.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const EXPECT = { DASH: ['IDLE', 'WINDUP', 'THRUST', 'FINISH'], STOPPER: ['IDLE', 'PRAY', 'RELEASE', 'IDLE'], BRAKE: ['IDLE', 'SHADOW', 'SLASH', 'IDLE'], ANGLE: ['IDLE', 'HANDSTAND', 'TADA', 'IDLE'], GUARD: ['IDLE', 'CHANT', 'BARRIER', 'IDLE'] };
const BEAT = { DASH: { windup: 'WINDUP', dash: 'THRUST' }, STOPPER: { channel: 'PRAY' }, BRAKE: { reappear: 'SHADOW', lunge: 'SLASH' }, ANGLE: { cartwheel: 'HANDSTAND', 'ta-da': 'TADA' }, GUARD: { seal: 'BARRIER' } };
const KEY = { DASH: 'THRUST', STOPPER: 'PRAY', BRAKE: 'SLASH', ANGLE: 'HANDSTAND', GUARD: 'CHANT' };
(async () => {
  const requested = [];
  class Image { set src(v) { requested.push(v); const b = fs.readFileSync(path.join(root, v)); this.naturalWidth = b.readUInt32BE(16); this.naturalHeight = b.readUInt32BE(20); this.complete = true; setTimeout(() => this.onload(), 0); } }
  const fetch = async url => { requested.push(url); const f = path.join(root, url); if (!fs.existsSync(f)) return { ok: false, json: async () => ({}) }; return { ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }; };
  const sc = { document: { getElementById: () => ({}), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, fetch, Image, setTimeout, console, Promise };
  sc.window = sc; vm.createContext(sc);
  for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
  const H = sc.Hop, S = H.Sprites, G = H.Graphics, c = H.CONFIG, C = S.definitions.CAST;
  await S.castReady;
  // 1) slots load (real JSON + PNG size) and are scene-only
  let slots = 0;
  for (const [id, poses] of Object.entries(G.GRAND_POSES)) {
    for (const pose of poses.slice(1)) {
      const def = C[id][pose], asset = S.castAssets[id][pose]; slots++;
      assert.ok(def.grandPose && def.comboPose && def.pose === undefined, id + pose + ' scene-only');
      assert.equal(asset.ready, true, id + '.' + pose + ' loaded'); assert.equal(asset.data.unit, asset.data.frameHeight / 96);
      assert.equal(S.comboLayer(id, pose).name, pose); assert.equal(S.comboLayer(id, pose).facing, def.facing);
      assert.ok(S.castDeferred(pose, def), 'deferred group');
    }
    assert.equal(S.castLayer(id, 0).name, 'IDLE'); const used = S.castLayer(id, 1).name; assert.ok(!C[id][used].grandPose, id + ' roadside never draws a grand pose');
    assert.ok(G.GRAND_POSES[id].includes(G.GRAND_KEY_POSE[id]));
  }
  assert.equal(slots, 11);
  const fin = S.castAssets.DASH.FINISH.data; assert.deepEqual([fin.frameWidth, fin.frameHeight, fin.pivot.x, fin.pivot.y], [384, 384, 192, 380], 'per-image cell + pivot');
  // 2) per-beat pose selection, parity, key pose facing the hero
  const sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY, start = G.comboSceneStart(false);
  const opp = f => f === 'left' ? 'right' : 'left', canon = (id, p) => S.grandFace(id, p);
  let samples = 0;
  for (const T of Object.keys(EXPECT)) for (const heroWX of [300, 1100]) {
    const end = c.grandDurations[T] - start, mk = (t, o = {}) => ({ type: T, short: false, t, end, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX - 280 }, skipped: false, grand: true, climax: c.grandClimax[T], ...o });
    const seq = [], parities = new Set(), bk = G.grandBack1(mk(0), sx), fr = bk > 0 ? 'right' : 'left'; let changeAt = null;
    for (let i = 0; i <= Math.round(end * 120); i++) {
      const a = G.grandActor(mk(i / 120), sx, sy, ground); samples++;
      assert.equal(typeof a.scale, 'number'); assert.ok(G.GRAND_POSES[T].includes(a.pose), T + ' pose ' + a.pose);
      if (seq[seq.length - 1] !== a.pose) { seq.push(a.pose); if (seq.length === 3 && changeAt === null) changeAt = i / 120; }
      if (BEAT[T][a.beat]) assert.equal(a.pose, BEAT[T][a.beat], `${T} ${a.beat} -> ${BEAT[T][a.beat]}`);
      const mirrored = a.face !== (C[T][a.pose].facing || 'left'); parities.add(mirrored !== !!C[T][a.pose].flip);
      if (a.pose === KEY[T]) assert.equal(a.face, fr, T + ' key pose faces the hero');
      for (const g of a.ghosts) if (g.clone) assert.equal(g.pose, 'SHADOW'); else assert.equal(g.face, a.face);
    }
    assert.deepEqual(seq, EXPECT[T], `${T} sequence ${seq}`); assert.equal(parities.size, 1, T + ' one mirror parity (weapon hand kept)');
    assert.equal(canon(T, 'IDLE'), C[T].IDLE.flip ? 'right' : 'left');
    // short version: the post-climax pose still, no blend
    const sh = G.grandActor(mk(0.3, { short: true }), sx, sy, ground); assert.ok(G.GRAND_POSES[T].includes(sh.pose) && sh.pose !== 'IDLE', T + ' short still shows the action pose ' + sh.pose);
    assert.equal(G.grandPoseChange(mk(1, { short: true }), sh, sx, sy, ground), null);
    // 3) cross-fade + smear right after the pose change (second change: pose 1 -> pose 2), none later / when skipped
    const tc = changeAt + 0.02, A = G.grandActor(mk(tc), sx, sy, ground), ch = G.grandPoseChange(mk(tc), A, sx, sy, ground);
    assert.ok(ch && ch.pose === EXPECT[T][1] && A.pose === EXPECT[T][2] && ch.back <= G.POSE_FADE, T + ' blend ' + JSON.stringify(ch));
    assert.equal(G.grandPoseChange(mk(changeAt + 0.25), G.grandActor(mk(changeAt + 0.25), sx, sy, ground), sx, sy, ground), null);
    assert.equal(G.grandPoseChange(mk(tc, { skipped: true }), A, sx, sy, ground), null);
    const drawn = [], filters = []; const orig = S.drawCastScaled;
    S.drawCastScaled = function (ctx, id, x, feet, pose, mul, opts) { drawn.push([pose, mul, opts.face]); return orig.apply(this, arguments); };
    const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : k.startsWith('create') ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}, set: (o, k, v) => { if (k === 'filter') filters.push(v); o[k] = v; return true; } });
    G.grandCastBlend(ctx, T, mk(tc), A, sx, sy, ground, 1); S.drawCastScaled = orig;
    assert.deepEqual(drawn.map(d => d[0]), [A.pose, ch.pose, A.pose], T + ' new pose, fading previous pose, smear'); assert.ok(drawn.every(d => d[1] === A.scale), 'uniform scale');
    assert.ok(filters.includes('brightness(0) invert(1)') && filters[filters.length - 1] === 'none', 'smear frame');
    // full scene draw never throws (effects for every pose)
    for (let i = 0; i <= Math.round(end * 30); i++) { G.grandBack(ctx, mk(i / 30), sx, sy, ground); G.grandFront(ctx, mk(i / 30), sx, sy, ground); }
    // 4) hotspot follows the drawn sprite (same placement as drawCastScaled)
    for (const pose of G.GRAND_POSES[T].slice(1)) for (const face of ['left', 'right']) {
      const rec = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage() {}, set imageSmoothingEnabled(v) {} };
      const box = S.drawCastScaled(rec, T, 500, 600, pose, 1.15, { face }), p = S.castPoint(T, 500, 600, pose, 1.15, { face }), hs = C[T][pose].hotspot;
      const ex = box.flipped ? box.left + (box.w / box.scale - hs.x) * box.scale : box.left + hs.x * box.scale;
      assert.ok(Math.abs(p.x - ex) < 1e-6 && Math.abs(p.y - (box.top + hs.y * box.scale)) < 1e-6, `${T}.${pose} hotspot ${face}`);
      const r = S.castPoint(T, 500, 600, pose, 1.15, { face, rotate: Math.PI }); assert.ok(Math.abs(r.x - (1000 - p.x)) < 1e-6 && Math.abs(r.y - (1200 - p.y)) < 1e-6, 'rotation about the feet');
    }
    const t0 = G.grandTip(mk(0), G.grandActor(mk(0), sx, sy, ground), sx, ground); assert.ok(Number.isFinite(t0.x) && Number.isFinite(t0.y), 'body estimate when no hotspot');
  }
  // 5) fallback: a grand pose not loaded yet draws the IDLE / USED still (no blank actor)
  const saved = S.castAssets.GUARD.CHANT; S.castAssets.GUARD.CHANT = { ready: false };
  assert.equal(S.comboLayer('GUARD', 'CHANT').name, 'IDLE'); assert.equal(S.castPoint('GUARD', 0, 0, 'CHANT', 1, {}), null); S.castAssets.GUARD.CHANT = saved;
  // pure: same input -> same placement
  const st = { type: 'DASH', short: false, t: 1.3, end: 3, after: null, heroWX: 500, heroY: 200, source: { x: 200 }, skipped: false, grand: true, climax: c.grandClimax.DASH };
  assert.equal(JSON.stringify(G.grandActor(st, sx, sy, ground)), JSON.stringify(G.grandActor(st, sx, sy, ground)));
  console.log(`special-poses OK: ${slots} grand pose slots loaded (deferred, scene-only), 5 scenes x 2 sides, ${samples} samples (sequence, beats, parity, key pose facing), blend + smear, hotspots`);
})().catch(e => { console.error(e); process.exit(1); });
