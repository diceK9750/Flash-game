// 2026-10-15: 魔法使い (BOOST) / 武闘家 (BOUNCE) SPECIALs gained a gating draw (boostSpecialChance /
// bounceSpecialChance 0.5) after the adjacency rule. The historical physics baselines / fingerprints / scripted
// random() sequences predate it, so suites pin both chances to 1 (= no draw, identical to the old game) through this
// helper. The shipped 0.5 gate and its rates / new fingerprint are covered by tests/special-rate.cjs.
const assert = require('node:assert/strict');
const RE = /boostSpecialChance: [\d.]+, bounceSpecialChance: [\d.]+,/;
module.exports = function adjacentGateOff(src, name) {
  if (name !== 'config') return src;
  assert(RE.test(src), 'boost/bounceSpecialChance line present');
  // 2026-10-15 JUST! launch also predates the baselines: disabled here (tests/just-launch.cjs covers it).
  assert(/justLaunchEnabled: true,/.test(src), 'justLaunchEnabled present');
  return src.replace(RE, 'boostSpecialChance: 1, bounceSpecialChance: 1,').replace(/justLaunchEnabled: true,/, 'justLaunchEnabled: false,');
};
