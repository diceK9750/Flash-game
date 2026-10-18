// Key-pose readout over the climax burst (2026-10-18 auto cycle 40, display only). Before: for ~0.25 s after each SPECIAL
// climax the screen flash + front bursts (slashes / rings / spark) washed the SPECIAL character's key pose out (up to 97 %
// of her box in DASH, 93 % in BRAKE). Now she is drawn once more, same placement / pose, at partial alpha above the flash.
// Checks: weight 0 before the climax, READOUT_MAX (0.85) for READOUT_HOLD (0.18 s), eased to 0 by +0.43 s, 0 in the short
// version / reduced motion / skipped / outro, for all 5 grand scenes + both combos; the redraw is exactly the actor's own
// draw (same args, alpha scaled); never on the black / white impact frames (guarded by sakugaImpactAge in draw(), after
// the screen flash); scene state untouched; deterministic.
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
  assert.equal(G.READOUT_MAX, 0.85); assert.equal(G.READOUT_HOLD, 0.18); assert.equal(G.READOUT_FADE, 0.25);
  const calls = []; const orig = S.drawCastScaled; S.drawCastScaled = (ctx, ...a) => { calls.push(JSON.stringify(a)); return true; };
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
  const grands = ['DASH', 'STOPPER', 'BRAKE', 'ANGLE', 'GUARD'];
  const mkG = (type, t, o = {}) => ({ type, short: false, t, end: c.grandDurations[type] - start, after: null, afterTotal: 0, heroWX: 250, heroY: 240, source: { x: -30 }, skipped: false, grand: true, climax: c.grandClimax[type], ...o });
  const mkC = (type, t, o = {}) => ({ type, short: false, t, end: 6, after: null, afterTotal: 0, heroWX: 250, heroY: 240, source: { x: -30 }, skipped: false, solo: false, ...o });
  const T0 = { BOOST: c.comboWitchTimes.blast, BOUNCE: c.comboFighterTimes.upper };
  const scenes = [...grands, 'BOOST', 'BOUNCE'];
  let checked = 0;
  for (const k of scenes) {
    const bOf = st => st.grand ? G.grandT(st) - st.climax : st.t - T0[k];
    // sample the scene clock densely; weight is a pure function of the scene time since the climax
    for (let t = 0; t < 6; t += 1 / 120) {
      const st = k in T0 ? mkC(k, t) : mkG(k, t), b = bOf(st), w = G.readoutWeight(st, false);
      if (b < 0 || b >= G.READOUT_HOLD + G.READOUT_FADE) assert.equal(w, 0, k + ' weight 0 outside the window (b ' + b.toFixed(3) + ')');
      else if (b <= G.READOUT_HOLD) assert.ok(Math.abs(w - 0.85) < 1e-9, k + ' held at 0.85');
      else assert.ok(w > 0 && w < 0.85, k + ' easing out');
      for (const o of [{ short: true }, { skipped: true }, { after: 0.1, afterTotal: 0.5 }]) assert.equal(G.readoutWeight({ ...st, ...o }, false), 0, k + ' off ' + JSON.stringify(o));
      assert.equal(G.readoutWeight(st, true), 0, k + ' off in reduced motion');
      if (w > 0) {
        const snap = JSON.stringify(st);
        calls.length = 0; G.readoutDraw(ctx, st, sx, sy, ground, w); const got = calls.slice();
        calls.length = 0;
        if (st.grand) { const A = G.grandActor(st, sx, sy, ground); if (A.alpha > 0.01) G.grandCastBlend(ctx, k, st, A, sx, sy, ground, w * A.alpha); }
        else { const A = G.comboActors(st); if (A.witch && (A.witch.alpha ?? 1) > 0.05) G.comboCastBlend(ctx, 'BOOST', 'witch', st, A.witch, sx, ground, w);
          if (A.fighter && A.fighter.beat !== 'hidden' && (A.fighter.alpha ?? 1) > 0.05) G.comboCastBlend(ctx, 'BOUNCE', 'fighter', st, A.fighter, sx, ground, w); }
        assert.deepEqual(got, calls, k + ' readout = the actor\'s own draw');
        assert.ok(got.length >= 1, k + ' something drawn');
        assert.equal(JSON.stringify(st), snap, 'scene state untouched'); checked++;
      }
    }
  }
  S.drawCastScaled = orig;
  // draw(): readout after the screen flash, only when no impact frame is showing (black / white frames intact)
  const src = fs.readFileSync(path.join(root, 'js', 'graphics.js'), 'utf8');
  const iFlash = src.indexOf('if (impact.flash > 0 && !(sakA !== null && sakA < 0.035))'), iRead = src.indexOf('if (camM && sakA === null) { const w = this.readoutWeight(scene, !!visual?.reducedMotion);');
  assert.ok(iFlash > 0 && iRead > iFlash && iRead - iFlash < 800, 'readout right after the screen flash, guarded by sakA === null');
  assert.ok(src.indexOf('const camM = scene ? ctx.getTransform?.() : null;') < src.indexOf('ctx.restore(); // combo camera'), 'camera transform captured inside the combo camera');
  console.log(JSON.stringify({ keyPoseReadout: 'PASS', scenes: scenes.length, redrawsChecked: checked }));
})().catch(e => { console.error(e); process.exit(1); });
