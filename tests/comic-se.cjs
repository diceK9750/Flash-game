// Original synthesized slapstick batch: protect pitch gestures, tiering and short sync-safe tails.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const scope = { Hop: {}, window: { localStorage: { getItem: () => null } } };
vm.createContext(scope); vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8'), scope);
const A = scope.Hop.Audio, kinds = ['LAND_SOFT', 'LAND_HARD', 'AERIAL_DIVE', 'AERIAL_RISE', 'DOWN_READY', 'LAUNCH_IMPACT', 'LAUNCH_IMPACT_MAX'];
const recipes = Object.fromEntries(kinds.map(k => [k, A.fxRecipes[k] || A.launchRecipes[k]]));
const end = r => Math.max(...r.map(v => v[1] + v[2]));
const up = r => r.filter(v => v[0] === 'tone' && v[6] > v[5]);
const down = r => r.filter(v => v[0] === 'tone' && v[6] < v[5]);
const tails = { LAND_SOFT: 0.09, LAND_HARD: 0.20, AERIAL_DIVE: 0.22, AERIAL_RISE: 0.18, DOWN_READY: 0.17, LAUNCH_IMPACT: 0.69, LAUNCH_IMPACT_MAX: 0.82 };
assert.equal(A.specialPeakCap, 0.16, 'do not buy comedy by raising the shared cap');
for (const k of kinds) {
  const r = recipes[k]; assert.equal(Math.min(...r.map(v => v[1])), 0, k + ' stays on its original event beat');
  assert(Math.abs(end(r) - tails[k]) < 1e-9, k + ' bounded tail');
  for (const [type, t, d, peak, wave, f0, f1, attack] of r) {
    assert(['tone', 'noise'].includes(type) && t >= 0 && d > 0 && peak > 0 && peak <= 0.16);
    assert(f0 > 0 && f1 > 0);
    if (type === 'tone') assert(['sine', 'triangle', 'square'].includes(wave) && attack > 0 && attack < d);
  }
}
for (const k of ['LAND_SOFT', 'LAND_HARD']) {
  const rise = up(recipes[k]).find(v => v[4] === 'sine');
  const fall = down(recipes[k]).find(v => v[4] === 'sine');
  assert(rise && fall && rise[6] / rise[5] > 2, k + ' has an elastic pitch overshoot');
  assert.equal(rise[6], fall[5]); assert(Math.abs(rise[1] + rise[2] - fall[1]) < 1e-9, 'connected rebound bend');
}
assert(A.peakSum(recipes.LAND_SOFT) < A.peakSum(recipes.LAND_HARD));
for (const k of kinds.filter(k => !k.startsWith('LAUNCH'))) assert(A.peakSum(recipes[k]) < A.peakSum(A.fxRecipes.RANK_STAMP));
assert(down(recipes.AERIAL_DIVE).some(v => v[5] / v[6] >= 4 && v[6] >= 400), 'falling whistle, not an impact thump');
assert(up(recipes.AERIAL_RISE).some(v => v[6] / v[5] >= 4) && down(recipes.AERIAL_RISE).length > 0, 'rise then comic overshoot');
assert(up(recipes.DOWN_READY).length > 0 && down(recipes.DOWN_READY).length > 0);
assert(recipes.DOWN_READY[0][1] + recipes.DOWN_READY[0][2] < recipes.DOWN_READY[1][1], 'readiness has a deliberate little gap');
for (const k of ['LAUNCH_IMPACT', 'LAUNCH_IMPACT_MAX']) {
  assert(up(recipes[k]).some(v => v[6] / v[5] >= 4), k + ' rubber recoil');
  for (const v of recipes[k]) if (v[0] === 'tone') assert(Math.min(v[5], v[6]) >= 85, 'no trailer sub-bass'); else assert(v[2] <= 0.07, 'short comic crack, not a realistic crash wash');
}
assert(recipes.LAUNCH_IMPACT_MAX.length > recipes.LAUNCH_IMPACT.length);
console.log('comic-se PASS: seven original pitch gestures, tiering, event onsets, tails and unchanged cap');
