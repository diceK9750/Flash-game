// 2026-10-15: 魔法使い (BOOST) / 武闘家 (BOUNCE) SPECIALs gained a gating draw (boostSpecialChance /
// bounceSpecialChance 0.5) after the adjacency rule. The historical physics baselines / fingerprints / scripted
// random() sequences predate it, so suites pin both chances to 1 (= no draw, identical to the old game) through this
// helper. The shipped 0.5 gate and its rates / new fingerprint are covered by tests/special-rate.cjs.
const assert = require('node:assert/strict');
const RE = /boostSpecialChance: [\d.]+, bounceSpecialChance: [\d.]+,/;
// 2026-10-16 merchant "rarer but grander" also predates the baselines: pin the old draw and type A-D strengths here
// (tests/merchant-grand.cjs covers the shipped values). Also the 2026-10-16 old cast placement (castPartnerAdjacentFactor 1). The merchant flourish is display only (no pin needed).
const MERCHANT_OLD = { merchantChance: '0.20', typeAUses: '3', typeAMultiplier: '2', typeBBaseSpeed: '650', typeBChargeBonus: '115', typeCCount: '100', typeDBounces: '5', typeDMultiplier: '1.2',
  // 2026-10-17 A-D balance (cycle 33): A kick / B start charge + restarts pinned off (tests/merchant-balance.cjs covers them).
  typeAKickSpeed: '0', typeBStartCharge: '0', typeBRevives: '1' };
// 2026-10-16 READY-truth fix: old cast placement (castPartnerAdjacentFactor 1/1) and no ground-touch grace for the
// armed STOPPER / BRAKE (armedGroundGraceSteps 0). tests/special-indicator-truth.cjs covers the shipped values.
function placementOld(src) {
  const PL = /castPartnerAdjacentFactor: Object\.freeze\(\{[^}]*\}\),/; assert(PL.test(src), 'placement factor');
  assert(/armedGroundGraceSteps: \d+,/.test(src), 'grace');
  return src.replace(PL, 'castPartnerAdjacentFactor: Object.freeze({ BOOST: 1, BOUNCE: 1 }),').replace(/armedGroundGraceSteps: \d+,/, 'armedGroundGraceSteps: 0,');
}
function merchantOld(src) {
  for (const [k, v] of Object.entries(MERCHANT_OLD)) { const re = new RegExp('\\b' + k + ': [\\d.]+'); assert(re.test(src), k); src = src.replace(re, k + ': ' + v); }
  return src;
}
const adjacentGateOff = function adjacentGateOff(src, name) {
  if (name !== 'config') return src;
  // The gate itself was abolished 2026-10-16 (no key, no draw): pinning it is a no-op on current sources.
  // 2026-10-15 JUST! launch also predates the baselines: disabled here (tests/just-launch.cjs covers it).
  assert(/justLaunchEnabled: true,/.test(src), 'justLaunchEnabled present');
  assert(/debugFillOrder: Object\.freeze\(\[/.test(src), 'debugFillOrder present');
  return placementOld(merchantOld(src)).replace(RE, 'boostSpecialChance: 1, bounceSpecialChance: 1,').replace(/justLaunchEnabled: true,/, 'justLaunchEnabled: false,')
    // 2026-10-16 DEBUG filler order fix (debugFillOrder) postdates the DEBUG baselines: old order here (debug-ends.cjs covers it).
    .replace(/debugFillOrder: Object\.freeze\(\[[^\]]*\]\),/, 'debugFillOrder: null,');
};
adjacentGateOff.merchantOld = merchantOld; adjacentGateOff.placementOld = placementOld; adjacentGateOff.MERCHANT_OLD = MERCHANT_OLD;
module.exports = adjacentGateOff;
