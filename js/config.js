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
  // JUST! launch (2026-10-15): power >= justPowerMin AND |angle - justAngleCenter| <= justAngleHalfWidth at the
  // launch tap multiplies the launch speed by justLaunchMultiplier (shows "JUST!" + SE). justLaunchEnabled false
  // (or multiplier 1 with no pop) = the old game. Center = best average distance in the fixed-seed sim.
  justLaunchEnabled: true, justPowerMin: 0.97, justAngleCenter: 42, justAngleHalfWidth: 3, justLaunchMultiplier: 1.15,
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
  // Warrior (DASH) SPECIAL: armed by an earlier warrior contact as before, or else this draw at the warrior contact
  // (one random() only when not armed). The 1-per-screen spacing made a 2nd warrior with no BOOST/BOUNCE/STOPPER
  // between them rare (~5% of warrior contacts vs ~36% for 魔法使い/武闘家); tuned with the fixed-seed sim.
  dashSpecialChance: 0.35,
  // 魔法使い (BOOST) / 武闘家 (BOUNCE) SPECIAL: adjacency only (next untouched object is the partner), no draw. The
  // 2026-10-15 boost/bounceSpecialChance 0.5 gate was abolished 2026-10-16 (user decision: READY must be truthful).
  // Sage (GUARD 聖護結界) SPECIAL (2026-10-13d, 先見の結界): eligible when a GUARD is still held from the previous
  // contact (as before), or when an untouched 僧侶 (STOPPER) or 盗賊 (BRAKE) stands within sageForesightRange px
  // beyond the sage at the contact. Deterministic (no random()); never while 聖護結界 is active or when a merchant
  // SPECIAL takes the contact. Replaces the flat guardSpecialChance draw (0.13, removed). "none" = held-GUARD only.
  sageCondition: "foresight", sageForesightRange: 460,
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
  specialCutinNameSize: 62, specialCutinNameMargin: 0.03, specialCutinNameX: 0.64, specialCutinNameY: 0.30, specialCutinNameSlide: 0.4,
  specialCutinShakePx: 5, specialCutinFlashPeak: 0.70, specialCutinPortraitPop: 1.10,
  // Launch cut-in (display only): the launch collision at AIM_POWER -> FLYING. The launch vector is applied at
  // launch exactly as before; the game step is frozen while it plays (like the combo scenes), so physics, distance
  // and RNG are identical. Tap skips. Beats (fractions of the total): approach (slow-mo close-ups) -> IMPACT
  // (flash / hit-stop / burst / SFX) -> launch (comic flight) -> fade. 1st view per session = full, later = repeat,
  // reducedMotion = calm still (no shake / flash). Intensity follows power: tiers NORMAL / STRONG / MAX.
  launchCutinEnabled: true, launchCutinDuration: 1.5, launchCutinRepeatDuration: 0.8, launchCutinReducedDuration: 0.45,
  launchCutinBeats: { full: [0.30, 0.58, 0.86], repeat: [0.18, 0.56, 0.84] }, launchCutinHitStop: 0.10,
  launchCutinStrongAt: 0.45, launchCutinMaxAt: 0.85, launchCutinShakePx: 10, launchCutinShakeBonusPx: 20,
  // Combo SPECIAL scenes (display only) for BOOST (魔法使い × 武闘家) and BOUNCE (武闘家 × 魔法使い) successes with
  // their adjacent partner. The launch vector is applied at success exactly as before; the game step (physics,
  // distance, play timers, RNG) is frozen while the scene plays, so the flight is identical — only later in
  // wall time. Durations count from the success (cut-in included); the scene starts when the cut-in begins its
  // fade (impact + wipe + hold). Tap skips (same result). reducedMotion: short still version. Merchant: none.
  comboEnabled: true,
  comboWitchDuration: 3.1, comboFighterDuration: 3.2, comboReducedDuration: 0.8, comboAfterglow: 0.6,
  // Scene-relative key times (s after the scene start).
  comboWitchTimes: Object.freeze({ dash: 0.30, rushEnd: 1.60, liftEnd: 1.90, blast: 2.15 }),
  comboWitchHits: 14, comboWitchLiftPx: 110,
  // Fighter SPECIAL (2026-10-13 upper): witch buff -> crouch -> drop out of the bottom of the screen -> hidden
  // rumble (ゴゴゴ…) -> erupts from below as a uniformly scaled giant, fist first -> uppercut (hit-stop) -> launch.
  comboFighterTimes: Object.freeze({ arrive: 0.40, buffEnd: 0.85, crouch: 1.05, gone: 1.25, rise: 1.72, upper: 1.90, hitstop: 0.10 }),
  comboFighterScale: 3.4, comboFighterLiftPx: 260, comboFighterFollowPx: 110,
  comboShakePx: 9,
  // Combo camera (display only): max zoom, part of the canvas the actors' box may fill, box margin (px), zoom-in / back times (s).
  comboLabelMaxW: 0.5, comboZoomMax: 2.4, comboZoomFill: 0.82, comboZoomMargin: 26, comboZoomIn: 0.3, comboZoomOut: 0.5,
  // State-based conditions; success sets a launch vector (px/s, degrees).
  specials: Object.freeze({
    BOOST: Object.freeze({ trigger: "adjacent", partner: "BOUNCE", speed: 2000, angle: 45, name: "爆裂斜光" }),
    BOUNCE: Object.freeze({ trigger: "adjacent", partner: "BOOST", speed: 1700, angle: 60, name: "巨神昇天拳" }),
    DASH: Object.freeze({ trigger: "dash", speed: 2000, angle: 25, name: "戦陣突破" }),
    STOPPER: Object.freeze({ trigger: "stopper", speed: 2300, angle: 35, name: "聖光反転" }),
    BRAKE: Object.freeze({ trigger: "brake", name: "影すり抜け" }),
    ANGLE: Object.freeze({ trigger: "chance", name: "水平曲芸" }),
    GUARD: Object.freeze({ trigger: "guard", name: "聖護結界" })
  }),
  boundaryMeters: 100, boundaryClearance: 140, merchantZoneMeters: 10,
  // Hidden "greatest secret art": even when the merchant conditions hold, the merchant only appears on this
  // draw (a miss falls back to the normal SPECIAL rules). DEBUG plays skip the draw so the merchant can be checked.
  // 2026-10-16: 0.20 -> 0.10 (rarer but grander: stronger type A-D effects below + merchantFlourish presentation).
  merchantChance: 0.10,
  // Display only: merchant flourish (coin burst + sparkles + big skill-name pop) length (s), coins, name pop scale.
  merchantFlourishDuration: 1.9, merchantCoinCount: 26, merchantNamePop: 1.15,
  // Placement only: no two roadside cast members of the same type within this world width (screen 1280 px
  // + both name-tag / READY-label halves), so one screen never shows the same character twice.
  castRepeatWindow: 1400,
  // Witch / fighter next to its partner: pick weight x this (2026-10-16, halves their adjacency SPECIAL; 1 = old placement).
  castPartnerAdjacentFactor: Object.freeze({ BOOST: 0.15, BOUNCE: 0.27 }),
  // READY truth: a STOPPER / BRAKE contact within this many physics steps (1/120 s) after a ground touch keeps the
  // arming the HUD showed that frame (0 = old: the touch disarms first).
  armedGroundGraceSteps: 2,
  castPickWeights: Object.freeze({ BOOST: 0.50, BOUNCE: 0.23, BRAKE: 0.13, ANGLE: 0.055, DASH: 0.032, GUARD: 0.026, STOPPER: 0.017 }),
  merchantTypes: Object.freeze({ STOPPER: "A", DASH: "B", BOOST: "C", BOUNCE: "D" }),
  merchantNames: Object.freeze({ A: "倍化の秘薬", B: "蓄光の護符", C: "浮遊の絨毯", D: "弾跳の靴" }),
  // 2026-10-16 grander (merchantChance halved): A 3 -> 5 uses, x2 -> x2.5; B base 650 -> 900, +115 -> +160 / charge;
  // C 100 -> 150 objects; D 5 -> 8 bounces, x1.2 -> x1.28. Tuned with the fixed-seed sim (S reach ~unchanged, SSS < 0.5%).
  typeAUses: 5, typeAMultiplier: 2.5,
  typeBMaxCharge: 10, typeBBaseSpeed: 900, typeBChargeBonus: 160, typeBAngle: 40,
  typeCCount: 150, typeCSpeed: 1600, typeCHeight: 190,
  typeDBounces: 8, typeDMultiplier: 1.28, typeDMinVertical: 450,
  debugGap: 600, debugFirst: 400,
  // DEBUG kinds (Hop.DEBUG_KINDS in game.js): the check's character(s) stand debugSetupAhead px ahead of the hero
  // before launch (every 10–70° / 30–100% launch touches it during the first ascent, before any ground bounce),
  // an adjacent partner debugPartnerGap px further on (= objectGapMin). Chosen in flight: debugFirst ahead.
  debugSetupAhead: 56, debugPartnerGap: 420,
  // Tempo & feedback (2026-10-13 tempo; display / UX only, browser game only via game.tempoEnabled — headless
  // callers keep the exact old wall-clock behaviour). Physics is always stepped with the same fixed physicsStep,
  // so fast-forward / hit-stop / instant finish never change distances, contacts or RNG.
  // Tail fast-forward: while the run is winding down (rolling on the ground, or airborne slower than tailSpeed px/s
  // after a bounce) with no cut-in / combo / SPECIAL window / merchant, game time runs tailFastForward x (rolling or
  // no AERIAL UP left) or tailAirFastForward x (AERIAL UP still usable), ramped over tailRampTime s; a tap while
  // rolling finishes the run instantly (same final distance).
  tailFastForward: 3, tailAirFastForward: 2, tailSpeed: 400, tailRampTime: 0.25, tailFinishMaxSteps: 120000,
  // Hit-stop (real-time freeze of the game step) on character contacts, scaled by the velocity change.
  hitStopMin: 0.025, hitStopMax: 0.085, hitStopRefSpeed: 1600, hitStopSpecial: 0.07,
  // Repeat views (same combo type, same session) of a combo scene play comboRepeatRate x faster (still skippable).
  comboRepeatRate: 1.6,
  // Feedback: distance milestones (small every milestoneMeters, big every milestoneBigMeters), hit chain
  // (consecutive character contacts without touching the ground), rank stamp thresholds (m) for the RESULT.
  milestoneMeters: 100, milestoneBigMeters: 500,
  rankThresholds: Object.freeze([["SSS", 20000], ["SS", 15000], ["S", 10000], ["A", 5000], ["B", 3000], ["C", 1200], ["D", 0]]),
  shakeMaxPx: 6, shakeSpeedFrom: 1200, shakeSpeedTo: 2000, hitShakePx: 7,
  // RESULT entrance in tempo mode: the overlay appears resultOverlayLead s into the victory pose (fade
  // resultOverlayFade s) and the distance counts up in resultCountTime s. RETRY input is immediate either way.
  resultOverlayLead: 0.35, resultOverlayFade: 0.15, resultCountTime: 0.4,
  storageKey: "hop-distance-best-v1"
});
Hop.STATES = Object.freeze({ READY: "READY", AIM_ANGLE: "AIM_ANGLE", AIM_POWER: "AIM_POWER", FLYING: "FLYING", RESULT: "RESULT" });
