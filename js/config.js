"use strict";
// Classic scripts deliberately support file:// without modules, fetch, or a server.
window.Hop = {};
Hop.CONFIG = Object.freeze({
  width: 1280, height: 720,
  groundY: 594, launchX: 170, playerRadius: 18,
  pixelsPerMeter: 8,
  angleMin: 10, angleMax: 70, angleDefault: 40, anglePeriod: 2.4,
  powerMin: 0.30, powerMax: 1, powerPeriod: 1.7,
  launchSpeed: 1250, // px/s, multiplied by power (30–100%)
  gravity: 820, // px/s²; positive Y in physics means height above ground
  airDrag: 0.075, // exponential drag, per second
  restitution: 0.67,
  bounceHorizontalRetention: 0.89,
  groundDeceleration: 155, // px/s² while rolling
  settleBounceSpeed: 75, // a smaller rebound becomes rolling
  stopSpeed: 12,
  physicsStep: 1 / 120,
  maxFrameDelta: 0.1, // discard long background gaps; never teleport
  cameraAnchorX: 420, cameraFollowRate: 7,
  markerMeters: 50, trailLength: 22,
  // AERIAL UP = a BOOST-strength kick: the same impulse and angle as a BOOST contact (boostImpulse / boostAngle below).
  // aerialUpCancelFall: a falling hero first loses its downward speed, so the kick always lifts (UP is only used
  // while falling). Merchant A / B do not apply (they act on companion contacts only).
  aerialUpUses: 3, aerialUpImpulse: 800, aerialUpAngle: 45, aerialUpCancelFall: true,
  // AERIAL DOWN = reflect the current flight angle over the horizontal and lock that dive angle until
  // ground or character contact (or UP / reset). aerialDownMinAngleDeg floors shallow ascents so the
  // dive is still clearly stronger than the old -760/+35 kick; speed is kept (|v| * aerialDownSpeedScale).
  aerialDownLockAngle: true, aerialDownMinAngleDeg: 30, aerialDownSpeedScale: 1,
  aerialDownRechargeTime: 1.5,
  maxHorizontalSpeed: 2000, maxVerticalSpeed: 1500,
  effectDuration: 0.7, contactDuration: 1.4,
  objectFirstMin: 400, objectFirstMax: 650,
  objectGapMin: 420, objectGapMax: 850,
  objectAhead: 1500, objectBehind: 700,
  objectWidth: 54, objectHeight: 64,
  // Relative spawn weights. Distances and speeds use pixels and seconds.
  objectWeights: Object.freeze({ BOOST: 0.28, BOUNCE: 0.22, BRAKE: 0.18, ANGLE: 0.12, DASH: 0.08, GUARD: 0.07, STOPPER: 0.05 }),
  boostImpulse: 800, boostAngle: 45,
  bounceImpulseRatio: 1.10, bounceAngle: 60,
  dashImpulseRatio: 1.10, dashAngle: 25,
  brakeRetention: 0.5,
  aerialDirectionThreshold: 40,
  angleSpecialChance: 0.10, guardSpecialDuration: 10.0,
  stopperFlashDuration: 0.32, stopperTrailDuration: 1.8,
  specialWindow: 1.0, specialMessageDuration: 1.3, specialFlashDuration: 0.18,
  specialTrailDuration: 1.2,
  // Display-only early-Tales-feel band cut-in with a decisive face close-up (resolveSpecial true only).
  // Original layout — not a copy of any ToE / Destiny 2 / Symphonia / nicovideo frame.
  // Timeline: short flash → band wipe → hold → fade. reducedMotion: short still, no shake/flash/wipe motion.
  // Face: CUTIN_FACE v2 plate (2:1, crop eye-1.4d .. chin+0.45d baked per JSON "crop") drawn at
  // FaceFill x band height, centred at FaceCenterX of the canvas width, so brows..chin fill the band.
  specialCutinDuration: 1.0, specialCutinImpact: 0.07, specialCutinWipe: 0.24, specialCutinHold: 0.46,
  specialCutinReducedDuration: 0.40, specialCutinBandHeight: 340, specialCutinBandTiltDeg: 7,
  specialCutinFaceFill: 1.2, specialCutinFaceCenterX: 0.37, specialCutinPortraitScale: 3.2,
  specialCutinNameSize: 62, specialCutinNameX: 0.64, specialCutinNameY: 0.30, specialCutinNameSlide: 0.4,
  specialCutinShakePx: 5, specialCutinFlashPeak: 0.70, specialCutinPortraitPop: 1.10,
  // Combo SPECIAL scenes (display only) for BOOST (魔法使い × 武闘家) and BOUNCE (武闘家 × 魔法使い) successes with
  // their adjacent partner. The launch vector is applied at success exactly as before; the game step (physics,
  // distance, play timers, RNG) is frozen while the scene plays, so the flight is identical — only later in
  // wall time. Durations count from the success (cut-in included); the scene starts when the cut-in begins its
  // fade (impact + wipe + hold). Tap skips (same result). reducedMotion: short still version. Merchant: none.
  comboEnabled: true,
  comboWitchDuration: 3.1, comboFighterDuration: 2.65, comboReducedDuration: 0.8, comboAfterglow: 0.6,
  // Scene-relative key times (s after the scene start).
  comboWitchTimes: Object.freeze({ dash: 0.30, rushEnd: 1.60, liftEnd: 1.90, blast: 2.15 }),
  comboWitchHits: 14, comboWitchLiftPx: 110,
  comboFighterTimes: Object.freeze({ arrive: 0.40, buffEnd: 0.85, growEnd: 1.35, upper: 1.60, hitstop: 0.10 }),
  comboFighterScale: 2.8, comboFighterSteps: 3, comboFighterLiftPx: 120,
  comboShakePx: 9,
  // State-based conditions; success sets a launch vector (px/s, degrees).
  specials: Object.freeze({
    BOOST: Object.freeze({ trigger: "adjacent", partner: "BOUNCE", speed: 2000, angle: 45, name: "爆裂斜光" }),
    BOUNCE: Object.freeze({ trigger: "adjacent", partner: "BOOST", speed: 1700, angle: 60, name: "連天蹴り" }),
    DASH: Object.freeze({ trigger: "dash", speed: 2000, angle: 25, name: "戦陣突破" }),
    STOPPER: Object.freeze({ trigger: "stopper", speed: 2300, angle: 35, name: "聖光反転" }),
    BRAKE: Object.freeze({ trigger: "brake", name: "影すり抜け" }),
    ANGLE: Object.freeze({ trigger: "chance", name: "水平曲芸" }),
    GUARD: Object.freeze({ trigger: "guard", name: "聖護結界" })
  }),
  boundaryMeters: 100, boundaryClearance: 140, merchantZoneMeters: 10,
  // Hidden "greatest secret art": even when the merchant conditions hold, the merchant only appears on this
  // draw (a miss falls back to the normal SPECIAL rules). DEBUG plays skip the draw so the merchant can be checked.
  merchantChance: 0.20,
  // Placement only: no two roadside cast members of the same type within this world width (screen 1280 px
  // + both name-tag / READY-label halves), so one screen never shows the same character twice.
  castRepeatWindow: 1400,
  castPickWeights: Object.freeze({ BOOST: 0.50, BOUNCE: 0.23, BRAKE: 0.13, ANGLE: 0.055, DASH: 0.032, GUARD: 0.026, STOPPER: 0.017 }),
  merchantTypes: Object.freeze({ STOPPER: "A", DASH: "B", BOOST: "C", BOUNCE: "D" }),
  merchantNames: Object.freeze({ A: "倍化の秘薬", B: "蓄光の護符", C: "浮遊の絨毯", D: "弾跳の靴" }),
  typeAUses: 3, typeAMultiplier: 2,
  typeBMaxCharge: 10, typeBBaseSpeed: 650, typeBChargeBonus: 115, typeBAngle: 40,
  typeCCount: 100, typeCSpeed: 1600, typeCHeight: 190,
  typeDBounces: 5, typeDMultiplier: 1.2, typeDMinVertical: 450,
  debugGap: 600, debugFirst: 400,
  storageKey: "hop-distance-best-v1"
});
Hop.STATES = Object.freeze({ READY: "READY", AIM_ANGLE: "AIM_ANGLE", AIM_POWER: "AIM_POWER", FLYING: "FLYING", RESULT: "RESULT" });
