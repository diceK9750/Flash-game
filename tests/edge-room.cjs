// Stage-edge room for the grand scenes (2026-10-18 auto cycle 41, display only). Before, with the hero near the stage
// edge (?debug=dash / angle, first metres): the DASH knock-back (55 px toward the edge) pushed the hero up to ~46% out of
// the zoomed view, and the ANGLE cartwheel loop (130 px around the hero) took the jester ~40% out of it. Now both are
// limited by grandRoom (hero -> view edge, fixed scene zoom + punch-in): knock-back <= room - GRAND_KNOCK_EDGE, cartwheel
// excursion on the edge side soft-limited (tanh knee GRAND_WHEEL_SOFT) to room - GRAND_WHEEL_EDGE, C1-continuous. Unchanged with room to spare
// (55 px knock-back / full loop), roomy side untouched, poses / beats / timing unchanged, deterministic.
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
  const mk = (type, heroWX, t) => ({ type, short: false, t, end: c.grandDurations[type] - start, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX - 280 }, skipped: false, grand: true, climax: c.grandClimax[type] });
  assert.equal(G.GRAND_KNOCK, 55); assert.equal(G.GRAND_KNOCK_EDGE, 70); assert.equal(G.GRAND_WHEEL_EDGE, 70); assert.equal(G.GRAND_WHEEL_SOFT, 60);
  const z = Math.max(1, Math.min(c.comboZoomMax, c.width * c.comboZoomFill / 410, c.height * c.comboZoomFill / 305)) * 1.07, half = c.width / 2 / z;
  let n = 0, fullK = 0, fullW = 0;
  for (let hs = 20; hs <= c.width - 20; hs += 10) {
    const heroWX = hs - c.launchX, fx = Math.max(half, Math.min(c.width - half, hs)), L = fx - half, R = fx + half;
    const st0 = mk('DASH', heroWX, 0), bk = G.grandBack1(st0, sx), room = bk < 0 ? hs - L : R - hs;
    assert.ok(Math.abs(G.grandRoom(st0, sx, bk) - room) < 1e-9, 'grandRoom');
    // DASH knock-back
    let maxK = 0;
    for (let t = 0; t < c.grandDurations.DASH - start; t += 1 / 120) { const st = mk('DASH', heroWX, t), o = G.grandHeroOff(st, sx, sy, ground); if (G.grandT(st) < st.climax) { assert.ok(Math.abs(o.dx) <= 4.001, 'pre-climax wobble unchanged'); continue; } assert.ok(o.dx * bk >= -1e-9, 'knock-back toward bk only'); maxK = Math.max(maxK, o.dx * bk); }
    const want = Math.max(0, Math.min(55, room - 70));
    assert.ok(maxK <= want + 1e-6 && maxK >= want * 0.98, 'DASH knock-back ' + maxK.toFixed(1) + ' vs ' + want.toFixed(1) + ' at hs ' + hs);
    if (want === 55) fullK++;
    // ANGLE cartwheel: jester centre kept GRAND_WHEEL_EDGE-ish px inside the view on the edge side
    const k = room - 70 - 60 >= 172.4 ? 1 : 0; // 1 = loop untouched (knee beyond the widest excursion)
    let seq = [], maxE = 0;
    for (let t = 0; t < c.grandDurations.ANGLE - start; t += 1 / 120) {
      const a = G.grandActor(mk('ANGLE', heroWX, t), sx, sy, ground); if (seq[seq.length - 1] !== a.pose) seq.push(a.pose);
      if (a.beat !== 'cartwheel') continue;
      const ex = a.x - heroWX;
      if (ex * bk > 0) assert.ok(ex * bk <= Math.max(60, room - 70) + 1e-6, 'squeezed on the edge side ' + [hs, room, ex * bk, t]); maxE = Math.max(maxE, ex * bk);
      
      const scr = sx(a.x); if (room >= 130) assert.ok(scr >= L + 70 - 1e-6 && scr <= R - 70 + 1e-6, 'jester centre in view at hs ' + hs + ' (' + (scr - L).toFixed(0) + ')');
    }
    assert.deepEqual(seq, ['IDLE', 'HANDSTAND', 'TADA', 'IDLE'].filter((p, i, A) => seq.includes(p)), 'ANGLE poses');
    if (k === 1) { fullW++; assert.ok(maxE > 165, 'full loop reach ' + maxE.toFixed(1)); }
    n++;
  }
  assert.ok(fullK > 40 && fullW > 40, 'normal positions keep the full knock-back / loop');
  const a1 = G.grandActor(mk('ANGLE', -85, 1.0), sx, sy, ground), a2 = G.grandActor(mk('ANGLE', -85, 1.0), sx, sy, ground);
  assert.equal(JSON.stringify(a1), JSON.stringify(a2), 'deterministic');
  console.log(JSON.stringify({ edgeRoom: 'PASS', heroPositions: n, fullKnock: fullK, fullLoop: fullW }));
})().catch(e => { console.error(e); process.exit(1); });
