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
  aerialUpUses: 3, aerialUpVertical: 620, aerialUpHorizontal: 85,
  aerialDownVertical: 760, aerialDownHorizontal: 35, aerialDownRechargeTime: 1.5,
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
