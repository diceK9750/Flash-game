// 2026-10-15: 魔法使い (BOOST) / 武闘家 (BOUNCE) SPECIALs gained a gating draw (boostSpecialChance /
// bounceSpecialChance 0.5) after the adjacency rule. The historical physics baselines / fingerprints / scripted
// random() sequences predate it, so suites pin both chances to 1 (= no draw, identical to the old game) through this
// helper. The shipped 0.5 gate and its rates / new fingerprint are covered by tests/special-rate.cjs.
const assert = require('node:assert/strict');
const RE = /boostSpecialChance: [\d.]+, bounceSpecialChance: [\d.]+,/;
// 2026-10-16 merchant "rarer but grander" also predates the baselines: pin the old draw and type A-D strengths here
// (tests/merchant-grand.cjs covers the shipped values). The merchant flourish is display only (no pin needed).
const MERCHANT_OLD = { merchantChance: '0.20', typeAUses: '3', typeAMultiplier: '2', typeBBaseSpeed: '650', typeBChargeBonus: '115', typeCCount: '100', typeDBounces: '5', typeDMultiplier: '1.2' };
function merchantOld(src) {
  for (const [k, v] of Object.entries(MERCHANT_OLD)) { const re = new RegExp('\\b' + k + ': [\\d.]+'); assert(re.test(src), k); src = src.replace(re, k + ': ' + v); }
  return src;
}
const adjacentGateOff = function adjacentGateOff(src, name) {
  if (name !== 'config') return src;
  assert(RE.test(src), 'boost/bounceSpecialChance line present');
  // 2026-10-15 JUST! launch also predates the baselines: disabled here (tests/just-launch.cjs covers it).
  assert(/justLaunchEnabled: true,/.test(src), 'justLaunchEnabled present');
  return merchantOld(src).replace(RE, 'boostSpecialChance: 1, bounceSpecialChance: 1,').replace(/justLaunchEnabled: true,/, 'justLaunchEnabled: false,');
};
adjacentGateOff.merchantOld = merchantOld; adjacentGateOff.MERCHANT_OLD = MERCHANT_OLD;
module.exports = adjacentGateOff;
