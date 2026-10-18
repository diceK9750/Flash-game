// BOOST layout + DASH thrust at the left stage edge (2026-10-18 auto cycle 42, display only). Before, with the hero right
// after the launch (?debug=boost / dash): the witch stood at H - 120, i.e. past the stage edge the combo camera cannot look
// beyond (up to 81% of her off-screen through the chant, fireball and blast), the rush teleported the fighter to the
// hero's left half off-screen and the finisher hopped back to H - 170 (fully off); the DASH warrior's follow-through slid
// past the hero toward the edge with the sword ahead (~21% off). Now (st.room = hero screen x, set in draw()):
// room < COMBO_WITCH_FIT (190) -> witch at H + 200 facing the hero; room < COMBO_RUSH_FIT (135) -> every blow from the
// right, no teleport ghost; hop back to H - clamp(room - 60, 40, 170); DASH slide past the hero limited to
// room - GRAND_THRUST_REACH (85). With room to spare (room >= 230, or no room given) every placement is exactly as before.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sc = { document: { getElementById: () => ({}), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} } }; sc.window = sc; vm.createContext(sc);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
const H = sc.Hop, G = H.Graphics, c = H.CONFIG, S = G.comboSceneStart(false), W = c.comboWitchTimes;
const sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y, ground = c.groundY;
assert.equal(G.COMBO_WITCH_FIT, 190); assert.equal(G.COMBO_RUSH_FIT, 135); assert.equal(G.COMBO_HOP_EDGE, 60); assert.equal(G.GRAND_THRUST_REACH, 85);
const end = c.comboWitchDuration - S;
const mkB = (room, t, heroWX = 300) => ({ type: 'BOOST', short: false, t, end, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX + 56 }, partner: { x: heroWX + 476 }, skipped: false, ...(room === undefined ? {} : { room }) });
let checked = 0;
for (const room of [undefined, 230, 260, 420, 900]) for (let t = -0.2; t <= end; t += 1 / 120) // room to spare: identical to the old layout
  assert.equal(JSON.stringify(G.comboActors(mkB(room, t))), JSON.stringify(G.comboActors(mkB(undefined, t))), 'unchanged with room ' + room);
for (let room = 70; room < 400; room += 5) {
  const H0 = 300; let prevW = null, sides = new Set(), ghost = 0;
  for (let t = 0; t <= end; t += 1 / 120) {
    const A = G.comboActors(mkB(room, t, H0)), w = A.witch, f = A.fighter;
    if (prevW) assert.ok(Math.abs(w.x - prevW.x) < 25, 'witch path smooth');
    prevW = w;
    if (t >= W.dash) {
      assert.equal(w.x, room < 190 ? H0 + 200 : H0 - 120, 'witch spot'); assert.equal(w.face, room < 190 ? 'left' : 'right', 'witch faces the hero');
      if (room >= 90) assert.ok(room + (w.x - H0) >= 48 + 12, 'witch in view');
    }
    if (t >= W.dash && t < W.rushEnd) { sides.add(Math.sign(f.x - H0)); if (f.ghost) ghost++; if (room >= 90) assert.ok(room + (f.x - H0) >= 48 + 12, 'rush fighter in view at room ' + room); }
    if (t >= W.liftEnd + 0.2) assert.ok(Math.abs(f.x - (H0 - Math.max(40, Math.min(170, room - 60)))) < 1e-9, 'hop target');
    checked++;
  }
  if (room < 135) { assert.deepEqual([...sides], [1], 'all blows from the right'); assert.equal(ghost, 0, 'no ghost'); } else { assert.equal(sides.size, 2, 'teleport rush kept'); assert.ok(ghost > 0); }
}
// staff side follows the facing (motes / fireball start at the staff) — source check
const src = fs.readFileSync(path.join(root, 'js', 'graphics.js'), 'utf8');
assert.ok(src.includes('wx + (A.witch.face === "left" ? -28 : 28)') && src.includes('x0 = wx + (A.witch.face === "left" ? -30 : 30)'), 'staff offsets mirrored with the facing');
assert.ok(src.includes('if (combo) combo.room = sx(combo.heroWX);'), 'draw() gives the scene its room');
// DASH: slide past the hero limited by room - 85, unchanged with room
const z = Math.max(1, Math.min(c.comboZoomMax, c.width * c.comboZoomFill / 410, c.height * c.comboZoomFill / 305)) * 1.07, half = c.width / 2 / z;
let full = 0;
for (let hs = 20; hs <= c.width - 20; hs += 10) {
  const heroWX = hs - c.launchX, mk = t => ({ type: 'DASH', short: false, t, end: c.grandDurations.DASH - S, after: null, afterTotal: 0, heroWX, heroY: 240, source: { x: heroWX - 280 }, skipped: false, grand: true, climax: c.grandClimax.DASH });
  const bk = G.grandBack1(mk(0), sx), room = G.grandRoom(mk(0), sx, bk), dF = G.grandFinishGap(mk(0), sx, bk), dS = Math.max(-45, Math.min(dF, room - 85));
  let reach = -Infinity;
  for (let t = 0; t < c.grandDurations.DASH - S; t += 1 / 120) { const st = mk(t), a = G.grandActor(st, sx, sy, ground);
    if (a.beat === 'follow' || a.beat === 'pose') { assert.ok(bk * (a.x - heroWX) <= dS + 1e-6, 'slide limited at hs ' + hs); if (a.beat === 'follow') reach = Math.max(reach, bk * (a.x - heroWX)); } }
  assert.ok(Math.abs(reach - dS) < 1, 'slide reaches dS at hs ' + hs + ' (' + reach.toFixed(1) + ' vs ' + dS.toFixed(1) + ')');
  if (dS === dF) full++;
}
assert.ok(full > 80, 'normal positions keep the old slide');
console.log(JSON.stringify({ edgeBoostDash: 'PASS', boostSamples: checked, dashFullSlide: full }));
