// C111 normal / C112 S contracts retained; C113 changes only SS opening, retaining its full arpeggio/shimmer.
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
assert.deepEqual(J(sRank), [
  ['tone', 0, 0.3, 0.1, 'triangle', 1450, 680, 0.0015], ['noise', 0, 0.14, 0.07, 'bandpass', 3600, 1250, 0.9],
  ['tone', 0.06, 0.7, 0.03, 'triangle', 1318.5, 1318.5, 0.004], ['tone', 0.06, 0.7, 0.02, 'triangle', 1975.5, 1975.5, 0.004],
  ['noise', 0.08, 0.5, 0.015, 'highpass', 6000, 9000, 0.7]
], 'full c112 S recipe remains exact');
const ssRank = A.fxRecipes.RANK_STAMP_SS;
assert.deepEqual(J(ssRank.map(v => [v[0], v[1], v[2]])), [
  ['tone', 0, 0.32], ['noise', 0, 0.16], ...[0, 1, 2, 3].map(i => ['tone', 0.06 + i * 0.07, 0.8 - i * 0.08]), ['noise', 0.1, 0.8]
], 'all seven SS starts/durations unchanged');
assert(Math.abs(Math.max(...ssRank.map(v => v[1] + v[2])) - 0.90) < 1e-9 && ssRank.every(v => v[1] + v[2] <= 0.90 + 1e-9), 'SS full tail remains 0.90s');
assert(A.peakSum(ssRank) <= 0.235 + 1e-9, 'no larger SS overlap budget');
assert(ssRank.every(v => v[3] > 0 && Math.min(v[5], v[6]) >= 42), 'never deepen the old SS 42Hz floor');
assert(ssRank[0][4] === 'triangle' && ssRank[0][5] > ssRank[0][6] && ssRank[0][6] >= 300 && ssRank[0][7] > 0 && ssRank[0][7] <= 0.003 && ssRank[1][4] === 'bandpass' && ssRank[1][6] >= 500, 'comic wood/paper opening, not heavy sine bass');
assert.deepEqual(J(ssRank.slice(2)), [
  ...[1318.5, 1661.2, 1975.5, 2637].map((f, i) => ['tone', 0.06 + i * 0.07, 0.8 - i * 0.08, 0.025, 'triangle', f, f, 0.004]),
  ['noise', 0.1, 0.8, 0.015, 'highpass', 6000, 10000, 0.7]
], 'all four SS arpeggio tones and highpass shimmer remain exact');
console.log('rank-stamp-se PASS: normal/S exact, SS comic opening with original beats/tail/cap and exact arpeggio/shimmer');
