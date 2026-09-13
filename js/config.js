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
  aerialDownVertical: 760, aerialDownHorizontal: 35, aerialDownCooldown: 1.5,
  maxHorizontalSpeed: 2000, maxVerticalSpeed: 1500,
  effectDuration: 0.7, contactDuration: 1.4,
  objectFirstMin: 400, objectFirstMax: 650,
  objectGapMin: 420, objectGapMax: 850,
  objectAhead: 1500, objectBehind: 700,
  objectWidth: 54, objectHeight: 64,
  // Relative spawn weights. Distances and speeds use pixels and seconds.
  objectWeights: Object.freeze({ BOOST: 0.28, BOUNCE: 0.22, BRAKE: 0.18, ANGLE: 0.12, DASH: 0.08, GUARD: 0.07, STOPPER: 0.05 }),
  boostHorizontal: 460, bounceHorizontal: 140, bounceVertical: 780,
  brakeRetention: 0.25,
  angleDegrees: 35, angleSpeedRetention: 1,
  dashHorizontal: 900, dashVertical: 90, stopperRetention: 0.06,
  specialWindow: 1.0, specialMessageDuration: 1.3, specialFlashDuration: 0.18,
  specialTrailDuration: 1.2,
  // Conditions use px/s or meters. Success effects set minimum velocities.
  specials: Object.freeze({
    STOPPER: Object.freeze({ metric: "speed", min: 700, vx: 1900, vy: 900 }),
    BOUNCE: Object.freeze({ metric: "distance", min: 200, vx: 1150, vy: 1450 }),
    DASH: Object.freeze({ metric: "horizontal", max: 400, vx: 1650, vy: 220 })
  }),
  debugGap: 600, debugFirst: 400,
  storageKey: "hop-distance-best-v1"
});
Hop.STATES = Object.freeze({ READY: "READY", AIM_ANGLE: "AIM_ANGLE", AIM_POWER: "AIM_POWER", FLYING: "FLYING", RESULT: "RESULT" });
