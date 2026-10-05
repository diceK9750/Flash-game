// Display-only DPR-aware canvas backing store: CSS width x devicePixelRatio, clamped 1280..2560
// wide at 16:9, with a base transform so game coordinates stay 1280x720.
const assert = require('node:assert/strict');
const { scope, element, launch } = require('./phase2.cjs');
const { UI, CONFIG: c } = scope.Hop;
let cases = 0; function test(name, fn) { try { fn(); cases++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
function canvas(clientWidth) {
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (...args) => calls.push([k, ...args]), set: (o, k, v) => (o[k] = v, true) });
  return { clientWidth, width: 1280, height: 720, calls, getContext: () => ctx };
}
function withDpr(dpr, fn) { const old = scope.devicePixelRatio; scope.devicePixelRatio = dpr; try { return fn(); } finally { scope.devicePixelRatio = old; } }
test('backing size clamps to 1280..2560 and keeps 16:9', () => {
  const cases = [[1031, 1, 1280, 720], [1031, 2, 2062, 1160], [370, 3, 1280, 720], [370, 2, 1280, 720], [1116, 2, 2232, 1256], [1600, 2, 2560, 1440], [undefined, undefined, 1280, 720], [0, NaN, 1280, 720]];
  for (const [css, dpr, w, h] of cases) assert.equal(JSON.stringify(UI.backingSize(css, dpr)), JSON.stringify({ width: w, height: h }), css + '@' + dpr);
});
test('UI resizes the backing store and draws through the base transform', () => {
  for (const [css, dpr, w, h] of [[1031, 2, 2062, 1160], [1031, 1, 1280, 720], [370, 3, 1280, 720]]) withDpr(dpr, () => {
    const game = launch(3), cv = canvas(css), ui = new UI(game, cv);
    assert.equal(cv.width, w); assert.equal(cv.height, h);
    ui.update(); const afterUpdate = JSON.stringify(game);
    ui.draw();
    assert.equal(JSON.stringify(game), afterUpdate, 'draw does not change game state');
    assert.deepEqual(cv.calls[0], ['setTransform', w / c.width, 0, 0, h / c.height, 0, 0], 'base transform first');
  });
});
test('DPR change is picked up on the next draw; resize only reallocates when the size changes', () => {
  withDpr(1, () => {
    const game = launch(3), cv = canvas(1031), ui = new UI(game, cv);
    assert.equal(cv.width, 1280);
    scope.devicePixelRatio = 2; ui.draw(); assert.equal(cv.width, 2062); assert.equal(cv.height, 1160);
    assert.deepEqual(cv.calls[0], ['setTransform', 2062 / 1280, 0, 0, 1160 / 720, 0, 0]);
    let writes = 0; const real = { w: cv.width, h: cv.height };
    Object.defineProperty(cv, 'width', { get: () => real.w, set: v => { writes++; real.w = v; } });
    ui.resizeBacking(); ui.draw(); assert.equal(writes, 0, 'no reallocation when unchanged');
    cv.clientWidth = 370; ui.resizeBacking(); assert.equal(cv.width, 1280); assert.equal(writes, 1);
  });
});
test('game coordinates, CONFIG and input binding are unchanged', () => {
  assert.equal(c.width, 1280); assert.equal(c.height, 720); assert.equal(c.groundY, 594); assert.equal(c.playerRadius, 18);
  assert.deepEqual(Object.keys(element('stage').listeners), ['pointerdown']);
});
console.log(JSON.stringify({ canvasDpr: 'PASS', cases }));
