// C111 normal stamp contract retained; C112 changes S opening only, keeping its ring and SS unchanged.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const scope = { Hop: {}, window: { localStorage: { getItem: () => null } } };
vm.createContext(scope); vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8'), scope);
const A = scope.Hop.Audio, J = value => JSON.parse(JSON.stringify(value)), stamp = A.fxRecipes.RANK_STAMP;
assert.deepEqual(J(stamp.map(v => [v[0], v[1], v[2]])), [['tone', 0, 0.22], ['noise', 0, 0.12]], 'both original onsets, source lengths, no added after-hit');
assert.equal(Math.max(...stamp.map(v => v[1] + v[2])), 0.22, 'full normal-stamp tail');
assert.equal(A.specialPeakCap, 0.16); assert(A.peakSum(stamp) <= 0.15, 'no larger overlapping peak budget');
assert(stamp.every(v => v[3] > 0 && v[5] > v[6] && Math.min(v[5], v[6]) >= 50), 'never deepen the old 50Hz floor');
assert(stamp[0][4] === 'triangle' && stamp[0][6] >= 300 && stamp[0][7] > 0 && stamp[0][7] <= 0.003, 'crisp middle-register wood, not sine sub-bass');
assert(stamp[1][4] === 'bandpass' && stamp[1][6] >= 500, 'light paper snap, no heavy lowpass thud');
assert.deepEqual(J(stamp), [['tone', 0, 0.22, 0.075, 'triangle', 1350, 650, 0.0015], ['noise', 0, 0.12, 0.045, 'bandpass', 3400, 1200, 0.9]], 'normal c111 recipe remains exact');
const sRank = A.fxRecipes.RANK_STAMP_S;
assert.deepEqual(J(sRank.map(v => [v[0], v[1], v[2]])), [['tone', 0, 0.3], ['noise', 0, 0.14], ['tone', 0.06, 0.7], ['tone', 0.06, 0.7], ['noise', 0.08, 0.5]], 'all five original S starts/durations, no new beat');
assert(Math.abs(Math.max(...sRank.map(v => v[1] + v[2])) - 0.76) < 1e-9 && sRank.every(v => v[1] + v[2] <= 0.76 + 1e-9), 'S full tail remains 0.76s');
assert(A.peakSum(sRank) <= 0.235 + 1e-9, 'no larger S overlap budget');
assert(sRank.every(v => v[3] > 0 && Math.min(v[5], v[6]) >= 45), 'never lower than the old S 45Hz floor');
assert(sRank[0][4] === 'triangle' && sRank[0][5] > sRank[0][6] && sRank[0][6] >= 300 && sRank[0][7] > 0 && sRank[0][7] <= 0.003 && sRank[1][4] === 'bandpass' && sRank[1][6] >= 500, 'comic wood/paper opening, no heavier sine bass');
assert.deepEqual(J(sRank.slice(2)), [
  ['tone', 0.06, 0.7, 0.03, 'triangle', 1318.5, 1318.5, 0.004], ['tone', 0.06, 0.7, 0.02, 'triangle', 1975.5, 1975.5, 0.004],
  ['noise', 0.08, 0.5, 0.015, 'highpass', 6000, 9000, 0.7]
], 'S two-note ring and shimmer identity stays exact');
assert.deepEqual(J(A.fxRecipes.RANK_STAMP_SS), [
  ['tone', 0, 0.32, 0.1, 'sine', 150, 42, 0.002], ['noise', 0, 0.16, 0.07, 'lowpass', 2800, 400, 0.8],
  ...[1318.5, 1661.2, 1975.5, 2637].map((f, i) => ['tone', 0.06 + i * 0.07, 0.8 - i * 0.08, 0.025, 'triangle', f, f, 0.004]),
  ['noise', 0.1, 0.8, 0.015, 'highpass', 6000, 10000, 0.7]
], 'SS recipe untouched by the normal-stamp change');
console.log('rank-stamp-se PASS: normal/SS exact, S wood-paper opening with original beats/tail/cap and exact S ring');
