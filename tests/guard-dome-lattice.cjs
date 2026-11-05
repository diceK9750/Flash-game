// GUARD 聖護結界 barrier dome (2026-11-05 auto cycle 57, display only). The dome's hex lattice used to be 81 separate
// clipped strokes every climax frame (~6 ms/frame at a phone viewport, 4x CPU). Now the hexes that can reach the dome
// circle go out as ONE path / one stroke under the same clip, and hexes entirely outside the circle are skipped.
// Checks with a recording context: one lattice stroke per frame after a clip, same width / colour, every drawn hex is a
// closed 7-point ring of radius 20 around a lattice centre, and every skipped lattice hex lies wholly outside the dome.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function recCtx() {
  const st = { globalAlpha: 1, strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, globalCompositeOperation: 'source-over', filter: 'none' };
  const stack = [], log = []; let ops = [];
  const api = { log, canvas: { width: 1280, height: 720 },
    save() { stack.push({ ...st }); }, restore() { Object.assign(st, stack.pop() || {}); },
    beginPath() { ops = []; }, moveTo(x, y) { ops.push(['M', x, y]); }, lineTo(x, y) { ops.push(['L', x, y]); },
    arc(x, y, r) { ops.push(['A', x, y, r]); }, clip() { log.push({ op: 'clip', path: ops.slice() }); },
    stroke() { log.push({ op: 'stroke', path: ops.slice(), ...st }); }, fill() { log.push({ op: 'fill', path: ops.slice() }); },
    getLineDash: () => [], setLineDash() {}, measureText: () => ({ width: 10 }) };
  return new Proxy(api, { get: (o, p) => p in o ? o[p] : p in st ? st[p] : typeof p === 'string' && p.startsWith('create') ? () => ({ addColorStop() {} }) : () => {},
    set: (o, p, v) => { if (p in st) st[p] = v; else o[p] = v; return true; } });
}
const sc = { document: { getElementById: () => ({}), addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, fetch: () => Promise.reject(new Error('offline')), setTimeout, console, Promise };
sc.window = sc; vm.createContext(sc);
for (const n of ['config', 'physics', 'game', 'sprites', 'graphics']) vm.runInContext(fs.readFileSync(path.join(root, 'js', n + '.js'), 'utf8'), sc, { filename: n });
const H = sc.Hop, G = H.Graphics, c = H.CONFIG, sx = x => c.launchX + x, sy = y => c.groundY - c.playerRadius - y;
const LAT = 'rgba(220,250,255,0.85)';
let checked = 0;
for (const db of [0.05, 0.15, 0.3, 0.6, 1.0, 1.3]) {
  const climax = c.grandClimax.GUARD, end = c.grandDurations.GUARD - G.comboSceneStart(false);
  const st = { type: 'GUARD', short: false, t: climax + db, end, after: null, afterTotal: 0, heroWX: 420, heroY: 240, source: { x: 140 }, skipped: false, grand: true, climax };
  const ctx = recCtx(); G.grandFront(ctx, st, sx, sy, c.groundY);
  const lat = ctx.log.filter(e => e.op === 'stroke' && e.strokeStyle === LAT);
  const clips = ctx.log.filter(e => e.op === 'clip');
  if (!clips.length) { assert.equal(lat.length, 0); continue; }
  assert.equal(lat.length, 1, 'lattice is one stroke at b=' + db);
  assert.equal(lat[0].lineWidth, 2);
  assert.ok(ctx.log.indexOf(clips[0]) < ctx.log.indexOf(lat[0]), 'lattice drawn under the dome clip');
  const [, hx, hy, R] = clips[0].path.find(o => o[0] === 'A');
  const p = lat[0].path; assert.equal(p.length % 7, 0);
  const drawn = new Set();
  for (let i = 0; i < p.length; i += 7) {
    assert.equal(p[i][0], 'M');
    const cx = p.slice(i, i + 6).reduce((s, o) => s + o[1], 0) / 6, cy = p.slice(i, i + 6).reduce((s, o) => s + o[2], 0) / 6;
    for (let j = 0; j < 7; j++) assert.ok(Math.abs(Math.hypot(p[i + j][1] - cx, p[i + j][2] - cy) - 20) < 1e-6);
    const gy = Math.round((cy - hy) / 31), gx = Math.round((cx - hx - (gy % 2 ? 18 : 0)) / 36);
    assert.ok(Math.abs(cx - (hx + gx * 36 + (gy % 2 ? 18 : 0))) < 1e-6 && Math.abs(cy - (hy + gy * 31)) < 1e-6);
    drawn.add(gx + ',' + gy);
  }
  for (let gx = -4; gx <= 4; gx++) for (let gy = -4; gy <= 4; gy++) if (!drawn.has(gx + ',' + gy))
    assert.ok(Math.hypot(gx * 36 + (gy % 2 ? 18 : 0), gy * 31) - 21 > R, 'skipped hex is outside the dome');
  checked++;
}
assert.ok(checked >= 4, 'dome frames checked: ' + checked);
console.log('guard dome lattice: one stroke, only hexes reaching the dome (' + checked + ' frames)');
