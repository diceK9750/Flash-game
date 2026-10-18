// 影すり抜け SLASH beside the hero (2026-10-18 auto cycle 39, display only). Before: the thief reappeared 150 px from the
// hero and the 75 px lunge ended 75 px from it, so the SLASH key pose was drawn half behind the hero sprite (hero box
// covered up to ~76%). Checks: she reappears GRAND_SLASH_BACK (195) px out on the usual side, the lunge (same 75 px)
// stops 120 px from the hero, the reappear / lunge stay inside the zoomed view for every hero position with room,
// the pose sequence, beats, facing and the backflip landing (205 px) are unchanged, other scenes untouched, deterministic.
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
  const sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY, start = G.comboSceneStart(false), CL = c.grandClimax.BRAKE;
  const mk = (heroWX, t) => ({ type: 'BRAKE', short: false, t, end: c.grandDurations.BRAKE - start, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX - 280 }, skipped: false, grand: true, climax: CL });
  const at = (heroWX, t) => G.grandActor(mk(heroWX, t), sx, sy, ground);
  assert.equal(G.GRAND_SLASH_BACK, 195);
  const z = Math.max(1, Math.min(c.comboZoomMax, c.width * c.comboZoomFill / 410, c.height * c.comboZoomFill / 305)) * 1.07, half = c.width / 2 / z;
  let n = 0;
  for (let hs = 0; hs <= c.width; hs += 20) {
    const heroWX = hs - c.launchX, bk = G.grandBack1(mk(heroWX, 0), sx);
    const re = at(heroWX, CL - 0.05), lunge = at(heroWX, CL + 0.3 - 1e-3), land = at(heroWX, CL + 0.9);
    assert.equal(re.beat, 'reappear'); assert.ok(Math.abs(re.x - (heroWX - bk * 195)) < 1e-6, 'reappears 195 px out');
    assert.equal(lunge.pose, 'SLASH'); assert.equal(lunge.beat, 'lunge'); assert.ok(Math.abs(Math.abs(lunge.x - heroWX) - 120) < 0.5, 'lunge stops 120 px from the hero (' + (lunge.x - heroWX).toFixed(1) + ')');
    assert.equal(Math.sign(heroWX - lunge.x), bk, 'still on the usual side, facing the hero');
    assert.ok(Math.abs(land.x - (heroWX - bk * 205)) < 1e-6, 'backflip lands where it did');
    const fx = Math.max(half, Math.min(c.width - half, hs)), inView = x => sx(x) >= fx - half + 40 && sx(x) <= fx + half - 40;
    assert.ok(inView(re.x) && inView(lunge.x), 'reappear / lunge in view at hs ' + hs); n++;
  }
  // pose sequence + facing unchanged (key pose SLASH faces the hero)
  for (const heroWX of [250, -85, 1000]) {
    const seq = []; for (let t = 0; t < c.grandDurations.BRAKE - start; t += 1 / 60) { const p = at(heroWX, t).pose; if (seq[seq.length - 1] !== p) seq.push(p); }
    assert.deepEqual(seq, ['IDLE', 'SHADOW', 'SLASH', 'IDLE']);
    const L = at(heroWX, CL + 0.15); assert.equal(L.face === 'right', L.x < heroWX, 'SLASH faces the hero');
  }
  assert.equal(JSON.stringify(at(250, CL + 0.2)), JSON.stringify(at(250, CL + 0.2)), 'deterministic');
  console.log(JSON.stringify({ brakeSlashClear: 'PASS', heroPositions: n, reappear: 195, lungeGap: 120 }));
})().catch(e => { console.error(e); process.exit(1); });
