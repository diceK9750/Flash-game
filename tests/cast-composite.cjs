// Ground-character decorative layers are composed offscreen before touching the game canvas.
const assert = require('node:assert/strict');
const { scope } = require('./phase2.cjs');
const s = scope.Hop.Sprites, oldCreate = scope.document.createElement;
const oldAssets = s.castAssets.BOOST, oldBack = s.witchCapeBack, oldCache = s.castCompositeCache;
const normalize = (id, animation, frames, fps, loop) => s.normalizeCell({ id, animation, cellW: 288, cellH: 288, frames, fps, loop, pivot: { x: 144, y: 264 }, smoothing: true });
const base = { ready: true, image: { id: 'front', complete: true, naturalWidth: 288, naturalHeight: 288 }, data: normalize('BOOST', 'IDLE', 1, 1, false) };
const back = { ready: true, image: { id: 'back', complete: true, naturalWidth: 2304, naturalHeight: 288 }, data: normalize('BOOST', 'CAPE_BACK', 8, 5, true) };
let failFront = false, failBack = false, scratchDraws = [], made = 0;
scope.document.createElement = () => {
  made++;
  const scratch = { clearRect() {}, drawImage(image, sx) {
    scratchDraws.push([image.id, sx]);
    if (image === base.image && failFront || image === back.image && failBack) throw Error('offscreen draw failed');
  } };
  return { width: 0, height: 0, getContext() { return scratch; } };
};
function target({ failBase = false, failCanvas = false } = {}) {
  const images = [], stack = [];
  return { images, filter: 'none', save() { stack.push(true); }, restore() { stack.pop(); }, translate() {}, scale() {},
    drawImage(image) { images.push(image); if (image === base.image && failBase || image !== base.image && failCanvas) throw Error('on-screen draw failed'); } };
}
try {
  s.castAssets.BOOST = { IDLE: base }; s.witchCapeBack = back; s.castCompositeCache = null;
  let main = target(); assert(s.drawCast(main, 'BOOST', 300, 500, 0, 0.375));
  assert.deepEqual(scratchDraws, [['back', 288], ['front', 0]], 'background then original compose offscreen');
  assert.equal(main.images.length, 1, 'one atomic on-screen draw'); assert.notEqual(main.images[0], back.image); assert.notEqual(main.images[0], base.image);
  assert.equal(made, 1); main = target(); assert(s.drawCast(main, 'BOOST', 300, 500, 0, 0.39));
  assert.equal(scratchDraws.length, 2, 'same 5fps frame reuses composite'); assert.equal(made, 1);
  main = target(); assert(s.drawCast(main, 'BOOST', 300, 500, 0, 0.6));
  assert.equal(scratchDraws.length, 4, 'frame change recomposes once'); assert.equal(made, 1);
  failFront = true; main = target({ failBase: true });
  assert.equal(s.drawCast(main, 'BOOST', 300, 500, 0, 0.8), false, 'front failure allows Canvas fallback');
  assert.deepEqual(main.images, [base.image], 'failed composite never leaves back on game canvas');
  failFront = false; failBack = true; main = target();
  assert(s.drawCast(main, 'BOOST', 300, 500, 0, 1.0)); assert.deepEqual(main.images, [base.image], 'back failure uses original only');
  failBack = false; main = target({ failCanvas: true });
  assert(s.drawCast(main, 'BOOST', 300, 500, 0, 1.2));
  assert.equal(main.images.length, 2); assert.equal(main.images[1], base.image, 'on-screen composite failure retries original');
  scope.document.createElement = () => { throw Error('canvas unavailable'); };
  s.castCompositeCache = null; main = target();
  assert(s.drawCast(main, 'BOOST', 300, 500, 0, 0.4)); assert.deepEqual(main.images, [base.image], 'no canvas keeps original');
  console.log('Cast composite PASS: atomic layering, cached 5fps frame, front/back/canvas failures and original fallback.');
} finally {
  if (oldCreate === undefined) delete scope.document.createElement; else scope.document.createElement = oldCreate;
  s.castAssets.BOOST = oldAssets; s.witchCapeBack = oldBack; s.castCompositeCache = oldCache;
}
