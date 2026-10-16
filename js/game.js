"use strict";
Hop.Game = class {
  constructor(random = Math.random) {
    this.random = random; this.debug = false; this.debugKind = null;
    // Combo scene preferences (kept across RETRY): comboEnabled (config default) and comboShort (the UI mirrors
    // prefers-reduced-motion here so the short version is chosen when the scene starts).
    this.comboEnabled = Hop.CONFIG.comboEnabled !== false; this.comboShort = false;
    // Launch cut-in (display only). launchCutinEnabled is switched on by main.js (the browser game); headless
    // callers keep the original immediate flight. launchCutinReduced mirrors reduced motion (UI); views counts
    // plays per session (kept across RETRY) so later launches use the shorter repeat version.
    this.launchCutinEnabled = false; this.launchCutinReduced = false; this.launchCutinViews = 0;
    // Tempo & feedback (display / UX only; see config "Tempo & feedback"). tempoEnabled is switched on by main.js;
    // headless callers keep the original wall-clock behaviour. comboViews counts combo scenes per type per session.
    this.tempoEnabled = false; this.comboViews = { BOOST: 0, BOUNCE: 0 };
    this.best = this.readBest(); this.reset();
  }
  reset() {
    this.state = Hop.STATES.READY;
    this.body = Hop.Physics.create();
    this.angle = Hop.CONFIG.angleDefault;
    this.power = Hop.CONFIG.powerMin; this.justLaunch = false;
    this.phaseTime = 0; this.accumulator = 0;
    this.cameraX = 0; this.cameraY = 0;
    this.maxHeight = 0; this.maxSpeed = 0; this.finalDistance = null;
    this.trail = [];
    this.upRemaining = Hop.CONFIG.aerialUpUses;
    this.downCharge = 1; this.effect = null; this.contact = null;
    this.normalGuard = 0; this.guardSpecial = { active: false, remaining: 0 };
    this.special = null; this.specialMessage = null;
    this.specialArmed = { dash: false, stopper: false, brake: false };
    this.aerialMode = "DOWN"; this.aerialDownLock = null; this.successVisual = null; this.specialCutin = null; this.soundEvent = null;
    this.merchant = null; this.merchantVisual = null; this.preImpactArmed = null;
    this.combo = null; this.comboAfter = null; this.launchCutin = null;
    // Tempo (display time only): timeScale = current game-time multiplier, hitStop = real seconds of freeze left.
    this.timeScale = 1; this.hitStop = 0; this.tailFinished = false;
    // Feedback bookkeeping (deterministic; never read by physics): hit chain, milestones, in-flight record pass.
    // fxEvents is a short queue the UI consumes (SE + pops); capped so headless runs never grow it unbounded.
    this.hype = { chain: 0, bestChain: 0, milestone: 0, recordPassed: false };
    this.fxEvents = [];
    this.merchantStats = { attempts: 0, successes: 0, lastType: null, revives: 0 };
    this.flash = 0; this.specialTrail = 0;
    this.history = []; this.counts = Object.fromEntries(Object.keys(Hop.CONFIG.objectWeights).map(type => [type, 0]));
    this.specialCount = 0; this.specialSuccesses = 0;
    this.debugUsed = this.debug; this.newRecords = []; this.debugIndex = 0;
    this.objects = [];
    this.nextBoundaryX = Hop.CONFIG.boundaryMeters * Hop.CONFIG.pixelsPerMeter;
    this.nextObjectX = this.debug ? Hop.CONFIG.debugFirst : this.randomBetween(Hop.CONFIG.objectFirstMin, Hop.CONFIG.objectFirstMax);
    this.generateObjects();
    if (this.debug) this.applyDebugSetup(Hop.CONFIG.debugSetupAhead);
  }
  readBest() {
    const best = { distance: 0, height: 0, speed: 0 };
    this.storageAvailable = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(Hop.CONFIG.storageKey));
      for (const key of Object.keys(best)) if (Number.isFinite(saved?.[key]) && saved[key] >= 0) best[key] = saved[key];
    } catch { this.storageAvailable = false; }
    return best;
  }
  finish() {
    this.state = Hop.STATES.RESULT;
    this.finalDistance = this.body.x / Hop.CONFIG.pixelsPerMeter;
    this.accumulator = 0;
    if (this.debugUsed) return;
    const score = { distance: this.finalDistance, height: this.maxHeight / Hop.CONFIG.pixelsPerMeter, speed: this.maxSpeed / Hop.CONFIG.pixelsPerMeter };
    for (const key of Object.keys(score)) {
      if (score[key] > this.best[key]) { this.best[key] = score[key]; this.newRecords.push(key); }
    }
    try { window.localStorage.setItem(Hop.CONFIG.storageKey, JSON.stringify(this.best)); this.storageAvailable = true; }
    catch { this.storageAvailable = false; }
  }
  // Legacy switch: OFF <-> "all" (the original fixed-order DEBUG).
  toggleDebug() { this.setDebugKind(this.debug ? null : "all"); }
  // The DEBUG kind in effect (debug set directly without a kind behaves as "all"), or null in normal play.
  activeDebugKind() { return this.debug ? (this.debugKind || "all") : null; }
  // Select a DEBUG kind (Hop.DEBUG_KINDS id) or null / "off" for normal play. Any use marks the run debugUsed
  // (記録対象外) exactly like the old toggle; switching OFF cannot make this run eligible again (RETRY does).
  setDebugKind(kind) {
    const c = Hop.CONFIG, s = Hop.STATES;
    const id = kind == null || kind === "off" ? null : Hop.Game.debugKind(kind)?.id;
    if (id === undefined || (!id && !this.debug)) return false;
    this.debugKind = id; this.debug = !!id;
    if (this.state !== s.RESULT) this.debugUsed = true;
    // Before launch, drop preconditions a previously chosen kind may have prepared (defaults in normal play).
    const prelaunch = [s.READY, s.AIM_ANGLE, s.AIM_POWER].includes(this.state);
    if (prelaunch) { this.specialArmed = { dash: false, stopper: false, brake: false }; this.normalGuard = 0; }
    // Rebuild only future objects.
    this.objects = []; this.debugIndex = 0;
    const boundary = c.boundaryMeters * c.pixelsPerMeter;
    this.nextBoundaryX = (Math.floor(this.body.x / boundary) + 1) * boundary;
    this.nextObjectX = this.body.x + (this.debug ? c.debugFirst : this.randomBetween(c.objectFirstMin, c.objectFirstMax));
    this.generateObjects();
    // RESULT: the next RETRY (reset) prepares the check.
    if (this.debug && this.state !== s.RESULT) this.applyDebugSetup(prelaunch ? c.debugSetupAhead : c.debugFirst);
    return true;
  }
  // Place the active kind's check ahead of the hero and prepare its preconditions; afterwards the original
  // fixed-order DEBUG placement continues ("aerial": no characters at all). DEBUG plays only.
  applyDebugSetup(ahead) {
    const c = Hop.CONFIG, kind = Hop.Game.debugKind(this.activeDebugKind());
    if (!kind || kind.id === "all") return false;
    this.objects = []; this.debugIndex = 0;
    const x = this.body.x + ahead;
    if (kind.empty) { this.nextObjectX = Infinity; return true; }
    if (kind.special) {
      const rule = c.specials[kind.special], first = { x, type: kind.special, used: false, debugSetup: true };
      this.objects.push(first);
      if (rule.trigger === "adjacent") this.objects.push({ x: x + c.debugPartnerGap, type: rule.partner, used: false, debugSetup: true });
      else if (rule.trigger === "chance") first.debugForce = true; // this ANGLE contact skips the 10% draw
      else if (rule.trigger === "guard") this.normalGuard = 1;
      else this.specialArmed[rule.trigger] = true; // dash / stopper / brake
    } else if (kind.merchant) {
      // GUARD held + this character treated as the 100m boundary (approached from the left); DEBUG skips the draw.
      this.objects.push({ x, type: kind.cast, used: false, debugSetup: true, debugBoundary: true });
      this.normalGuard = 1;
    }
    this.nextObjectX = this.objects[this.objects.length - 1].x + c.debugGap;
    this.generateObjects();
    return true;
  }
  randomBetween(min, max) { return min + (max - min) * this.random(); }
  airborne() { return this.state === Hop.STATES.FLYING && !this.body.stopped && !this.body.grounded && this.body.y > 0; }
  updateAerialMode() {
    const threshold = Hop.CONFIG.aerialDirectionThreshold;
    if (this.body.vy > threshold) this.aerialMode = "DOWN";
    else if (this.body.vy < -threshold) this.aerialMode = "UP";
    return this.aerialMode;
  }
  limitSpeed() {
    const c = Hop.CONFIG, b = this.body;
    b.vx = Math.max(0, Math.min(c.maxHorizontalSpeed, b.vx));
    b.vy = Math.max(-c.maxVerticalSpeed, Math.min(c.maxVerticalSpeed, b.vy));
    this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(b.vx, b.vy));
  }
  clearAerialDownLock() { this.aerialDownLock = null; }
  // Re-project velocity onto the locked dive angle after gravity / drag, without exceeding the speed caps.
  applyAerialDownLock() {
    if (this.aerialDownLock == null || !Hop.CONFIG.aerialDownLockAngle) return;
    const c = Hop.CONFIG, b = this.body, ang = this.aerialDownLock;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    let speed = Math.hypot(b.vx, b.vy);
    if (cos > 1e-9) speed = Math.min(speed, c.maxHorizontalSpeed / cos);
    else if (cos < -1e-9) speed = 0;
    if (Math.abs(sin) > 1e-9) speed = Math.min(speed, c.maxVerticalSpeed / Math.abs(sin));
    b.vx = speed * cos; b.vy = speed * sin;
  }
  aerial(direction) {
    if (this.combo || this.special || this.merchant?.type === "C" || !this.airborne()) return false;
    const c = Hop.CONFIG;
    if (direction === "UP") {
      if (this.upRemaining <= 0) return false;
      this.upRemaining--;
      this.specialArmed.brake = false;
      this.clearAerialDownLock();
      // BOOST-strength kick (same impulse / angle as a BOOST contact); a falling hero first stops falling.
      const angle = c.aerialUpAngle * Math.PI / 180;
      if (c.aerialUpCancelFall) this.body.vy = Math.max(0, this.body.vy);
      this.body.vx += c.aerialUpImpulse * Math.cos(angle); this.body.vy += c.aerialUpImpulse * Math.sin(angle);
    } else if (direction === "DOWN") {
      if (this.downCharge < 1) return false;
      this.downCharge = 0;
      this.specialArmed.brake = true;
      // Reflect the flight angle over the horizontal (ascent +θ → descent −θ), floor shallow dives, keep |v|.
      const b = this.body;
      let ang = -Math.atan2(b.vy, b.vx);
      const minAng = -(c.aerialDownMinAngleDeg * Math.PI / 180);
      if (ang > minAng) ang = minAng;
      const speed = Math.hypot(b.vx, b.vy) * c.aerialDownSpeedScale;
      b.vx = speed * Math.cos(ang); b.vy = speed * Math.sin(ang);
      this.aerialDownLock = c.aerialDownLockAngle ? ang : null;
    } else return false;
    this.limitSpeed();
    if (direction === "DOWN") this.applyAerialDownLock();
    this.updateAerialMode();
    this.effect = { label: `AERIAL ${direction}`, remaining: c.effectDuration };
    return true;
  }
  generateObjects() {
    const c = Hop.CONFIG;
    // Draw weights: castPickWeights (calibrated so the resulting shares stay close to objectWeights despite the
    // exclusion below), drawn among the types not already within castRepeatWindow of x — one random() per object,
    // as before. If every type is nearby, the type whose nearest copy is farthest away is used.
    const entries = Object.entries(c.castPickWeights || c.objectWeights);
    const pickType = x => {
      const near = new Map();
      for (const o of this.objects) {
        const d = Math.abs(o.x - x);
        if (d < c.castRepeatWindow) near.set(o.type, Math.min(near.get(o.type) ?? Infinity, d));
      }
      let pool = entries.filter(([type]) => !near.has(type));
      if (!pool.length) { const far = Math.max(...near.values()); pool = entries.filter(([type]) => near.get(type) === far); }
      // 2026-10-16 placement: a 魔法使い (BOOST) / 武闘家 (BOUNCE) right next to its partner (nearest existing object on
      // either side) gets its weight x castPartnerAdjacentFactor, so fewer witch-fighter pairs stand back to back
      // (their SPECIAL needs exactly that). Still one random() per object; factor 1 = the old placement.
      const fs = c.castPartnerAdjacentFactor || {}, f = (fs.BOOST ?? 1) !== 1 || (fs.BOUNCE ?? 1) !== 1;
      if (f) {
        let left = null, right = null;
        for (const o of this.objects) { if (o.x < x && (!left || o.x > left.x)) left = o; if (o.x > x && (!right || o.x < right.x)) right = o; }
        const partnerOf = { BOOST: "BOUNCE", BOUNCE: "BOOST" };
        pool = pool.map(([type, w]) => [type, partnerOf[type] && (left?.type === partnerOf[type] || right?.type === partnerOf[type]) ? w * (fs[type] ?? 1) : w]);
      }
      const total = pool.reduce((sum, entry) => sum + entry[1], 0);
      let choice = this.random() * total;
      return pool.find(([, weight]) => (choice -= weight) < 0)?.[0] || pool[pool.length - 1][0];
    };
    const boundary = c.boundaryMeters * c.pixelsPerMeter;
    if (!this.debug) {
      while (this.nextBoundaryX < this.body.x + c.objectAhead) {
        this.objects.push({ x: this.nextBoundaryX, type: pickType(this.nextBoundaryX), used: false, boundary: true });
        this.nextBoundaryX += boundary;
      }
    }
    while (this.nextObjectX < this.body.x + c.objectAhead) {
      const nearestBoundary = Math.max(1, Math.round(this.nextObjectX / boundary)) * boundary;
      if (this.debug || Math.abs(this.nextObjectX - nearestBoundary) >= c.boundaryClearance) {
        const type = this.debug ? entries[this.debugIndex++ % entries.length][0] : pickType(this.nextObjectX);
        this.objects.push({ x: this.nextObjectX, type, used: false });
      }
      this.nextObjectX += Math.max(1, this.debug ? c.debugGap : this.randomBetween(c.objectGapMin, c.objectGapMax));
    }
    this.objects = this.objects.filter(object => object.x >= this.body.x - c.objectBehind).sort((a, b) => a.x - b.x);
  }
  // Sweep the player's centre against an expanded box. This detects crossings
  // even when a fast player traverses the whole object in one physics step.
  touches(object, previous) {
    const c = Hop.CONFIG, b = this.body, r = c.playerRadius;
    let enter = 0, leave = 1;
    const axes = [
      [previous.x, b.x - previous.x, object.x - c.objectWidth / 2 - r, object.x + c.objectWidth / 2 + r],
      [previous.y + r, b.y - previous.y, -r, c.objectHeight + r]
    ];
    for (const [start, delta, min, max] of axes) {
      if (Math.abs(delta) < 1e-10) { if (start < min || start > max) return false; }
      else {
        const a = (min - start) / delta, z = (max - start) / delta;
        enter = Math.max(enter, Math.min(a, z)); leave = Math.min(leave, Math.max(a, z));
        if (enter > leave) return false;
      }
    }
    return true;
  }
  contactObjects(previous) {
    const c = Hop.CONFIG, b = this.body;
    if (this.special || this.merchant?.type === "C") return;
    for (const object of this.objects) {
      if (object.used || !this.touches(object, previous)) continue;
      object.used = true; // Single use per run, including a later re-entry.
      this.noteHit(object, previous);
      this.clearAerialDownLock();
      this.counts[object.type]++;
      const entry = { type: object.type, label: object.type };
      this.history.push(entry);
      this.contact = { label: object.type, remaining: c.contactDuration };
      const rule = c.specials[object.type];
      const partner = this.objects.filter(o => !o.used && o.x > object.x).sort((a, z) => a.x - z.x)[0];
      const guardAtContact = this.normalGuard;
      let eligible = rule && (rule.trigger === "adjacent" ? partner?.type === rule.partner :
        rule.trigger === "chance" ? object.debugForce === true || this.random() < c.angleSpecialChance :
        rule.trigger === "guard" ? guardAtContact && !this.guardSpecial.active :
        this.specialArmed[rule.trigger] || !!this.preImpactArmed?.[rule.trigger]);
      const spacing = c.boundaryMeters * c.pixelsPerMeter;
      const atBoundary = object.debugBoundary === true || object.x > 0 && Math.abs(object.x / spacing - Math.round(object.x / spacing)) < 1e-9;
      const inZone = b.x >= object.x - c.merchantZoneMeters * c.pixelsPerMeter && previous.x <= object.x;
      const merchantCandidate = (guardAtContact || this.guardSpecial.active) && atBoundary && inZone ? c.merchantTypes[object.type] : null;
      // Rare draw (merchantChance); a miss is an ordinary contact judged by the normal SPECIAL rules above.
      const merchantType = merchantCandidate && (this.debug || this.random() < c.merchantChance) ? merchantCandidate : null;
      // Warrior (DASH) not armed: dashSpecialChance draw, only when no merchant SPECIAL takes this contact.
      if (rule?.trigger === "dash" && !eligible && !merchantType && c.dashSpecialChance > 0) eligible = this.random() < c.dashSpecialChance;
      // Sage (GUARD) not eligible: 先見の結界 (sageConditionMet, deterministic, no random()), only when no 聖護結界 is
      // active and no merchant SPECIAL takes this contact.
      if (rule?.trigger === "guard" && !eligible && !merchantType && !this.guardSpecial.active) eligible = this.sageConditionMet(object);
      this.normalGuard = 0; // One contact lifetime; snapshot belongs only to this event.
      this.updateSpecialArming(object.type);
      if (merchantType || eligible) {
        this.special = { type: object.type, source: object, merchantType, partner: eligible && rule.trigger === "adjacent" ? partner : null, remaining: c.specialWindow, entry, guardAtContact, velocity: { vx: b.vx, vy: b.vy } };
        this.specialArmed.dash = false;
        this.specialArmed.brake = false;
        if (merchantType) {
          this.merchantStats.attempts++;
          this.merchantVisual = { type: merchantType, remaining: c.specialWindow + c.specialMessageDuration };
        } else this.specialCount++;
        break;
      }
      const speedBefore = Math.hypot(b.vx, b.vy);
      this.normalContact(object.type, entry, guardAtContact);
      this.noteImpact(Math.abs(Math.hypot(b.vx, b.vy) - speedBefore));
      if (b.stopped) break;
    }
  }
  // 先見の結界 (config.sageCondition "foresight"): the nearest untouched 僧侶 (STOPPER) or 盗賊 (BRAKE) beyond the sage
  // within sageForesightRange px, or null. Deterministic; graphics.js uses it for the hint line. "none" disables it.
  sageForesightTarget(object) {
    const c = Hop.CONFIG;
    if (c.sageCondition !== "foresight" || !object || object.type !== "GUARD") return null;
    let best = null;
    for (const o of this.objects) if (!o.used && (o.type === "STOPPER" || o.type === "BRAKE") && o.x > object.x && o.x - object.x <= c.sageForesightRange && (!best || o.x < best.x)) best = o;
    return best;
  }
  sageConditionMet(object) { return this.sageForesightTarget(object) !== null; }
  updateSpecialArming(type) {
    const armed = this.specialArmed;
    if (type !== "BRAKE") armed.brake = false;
    if (["BOOST", "BOUNCE", "STOPPER"].includes(type)) armed.dash = false;
    if (type === "DASH") armed.dash = true;
    if (["BOOST", "BOUNCE", "DASH"].includes(type)) armed.stopper = true;
    if (["GUARD", "STOPPER"].includes(type)) armed.stopper = false;
  }
  normalContact(type, entry, guardAtContact = 0) {
    // Option B: GUARD SPECIAL blocks every STOPPER until its 10s timer ends (only the timer ends it).
    // It takes priority over normalGuard for STOPPER, so a held normalGuard is kept for the next BOOST/BOUNCE/DASH.
    const specialBlock = type === "STOPPER" && this.guardSpecial.active;
    const normalBlock = !specialBlock && guardAtContact && ["BOOST", "BOUNCE", "DASH", "STOPPER"].includes(type);
    if (normalBlock || specialBlock) {
      if (specialBlock && guardAtContact) this.normalGuard = 1;
      if (entry) entry.label += " (GUARDED)";
      this.contact = { label: `${type} / GUARD BLOCK`, remaining: Hop.CONFIG.contactDuration };
    } else this.applyContact(type);
  }
  // Boost the positive change, never multiply the whole current velocity.
  characterAcceleration(before) {
    const b = this.body, c = Hop.CONFIG;
    if (this.merchant?.type === "A") {
      b.vx += Math.max(0, b.vx - before.vx) * (c.typeAMultiplier - 1);
      b.vy += Math.max(0, b.vy - before.vy) * (c.typeAMultiplier - 1);
      if (--this.merchant.remaining === 0) this.merchant = null;
    } else if (this.merchant?.type === "B") {
      this.merchant.charge = Math.min(c.typeBMaxCharge, this.merchant.charge + 1);
    }
  }
  applyContact(type) {
    const c = Hop.CONFIG, b = this.body;
    const before = { vx: b.vx, vy: b.vy };
    const impulse = type === "BOOST" ? c.boostImpulse : type === "BOUNCE" ? c.boostImpulse * c.bounceImpulseRatio : type === "DASH" ? c.boostImpulse * c.dashImpulseRatio : 0;
    if (impulse) {
      const angle = c[type.toLowerCase() + "Angle"] * Math.PI / 180;
      b.vx += impulse * Math.cos(angle); b.vy += impulse * Math.sin(angle); b.grounded = false;
    }
    if (type === "BRAKE") { b.vx *= c.brakeRetention; b.vy *= c.brakeRetention; }
    if (type === "STOPPER") {
      b.vx = 0; b.vy = 0; b.stopped = true;
      this.revive(); return;
    }
    if (type === "ANGLE") {
      // Complement of abs(atan2(vy,vx)): swapping magnitudes is exact and
      // preserves speed even near the acceleration caps. Rotation adds no energy.
      b.vx = Math.abs(before.vy); b.vy = Math.abs(before.vx); b.grounded = false;
      this.updateAerialMode(); return;
    }
    if (type === "GUARD") this.normalGuard = 1;
    if (["BOOST", "BOUNCE", "DASH"].includes(type)) this.characterAcceleration(before);
    if (impulse) { b.stopped = false; this.limitSpeed(); }
    this.updateAerialMode();
  }
  launchVector(speed, angle) {
    const radians = angle * Math.PI / 180;
    this.body.vx = speed * Math.cos(radians); this.body.vy = speed * Math.sin(radians);
    this.body.grounded = false; this.body.stopped = false;
  }
  acquireMerchant(type) {
    const c = Hop.CONFIG;
    // A single object ensures replacement discards every previous counter.
    this.merchant = type === "A" ? { type, remaining: c.typeAUses } : type === "B" ? { type, charge: 0 } :
      type === "C" ? { type, remaining: c.typeCCount, height: c.typeCHeight } : { type, remaining: c.typeDBounces };
    this.merchantStats.lastType = type;
    if (type === "C") {
      Object.assign(this.body, { y: c.typeCHeight, vx: c.typeCSpeed, vy: 0, grounded: false, stopped: false });
      this.limitSpeed(); this.maxHeight = Math.max(this.maxHeight, this.body.y);
    }
  }
  revive() {
    if (this.merchant?.type !== "B" || this.merchant.charge < 1) return false;
    const c = Hop.CONFIG, charge = this.merchant.charge;
    this.merchant = null; this.merchantStats.revives++;
    this.launchVector(c.typeBBaseSpeed + charge * c.typeBChargeBonus, c.typeBAngle); this.limitSpeed();
    this.specialMessage = { label: "TYPE B / 再出発！", remaining: c.specialMessageDuration };
    return true;
  }
  groundImpact(impact) {
    this.hype.chain = 0; // touching the ground ends the hit chain
    this.clearAerialDownLock();
    // READY truth (2026-10-16): a contact within armedGroundGraceSteps physics steps of this touch still uses the
    // arming the HUD showed (the touch and the contact land in the same 1/60 s display frame).
    const grace = Hop.CONFIG.armedGroundGraceSteps || 0;
    if (grace > 0 && (this.specialArmed.stopper || this.specialArmed.brake)) this.preImpactArmed = { stopper: this.specialArmed.stopper, brake: this.specialArmed.brake, steps: grace };
    this.specialArmed.stopper = false;
    this.specialArmed.brake = false;
    if (this.merchant?.type !== "D") return;
    const c = Hop.CONFIG;
    this.body.vx = impact.vx * c.typeDMultiplier;
    this.body.vy = Math.max(c.typeDMinVertical, -impact.vy * c.typeDMultiplier);
    this.body.grounded = false; this.body.stopped = false; this.limitSpeed();
    this.effect = { label: "BOUND BOOST", remaining: c.effectDuration };
    if (--this.merchant.remaining === 0) this.merchant = null;
  }
  floatStep(dt) {
    const c = Hop.CONFIG, b = this.body, effect = this.merchant, beforeX = b.x;
    b.vx = Math.min(c.typeCSpeed, c.maxHorizontalSpeed); b.vy = 0; b.y = effect.height;
    b.x += b.vx * dt;
    for (const object of this.objects) {
      if (object.x <= beforeX || object.x > b.x) continue;
      object.used = true; effect.remaining--;
      if (effect.remaining === 0) {
        b.x = object.x; this.merchant = null;
        this.applyContact("BOOST"); // One exit impulse; no contact/history/arming event.
        break;
      }
    }
  }
  resolveSpecial(success) {
    if (!this.special) return false;
    const pending = this.special, c = Hop.CONFIG;
    this.special = null;
    this.specialArmed.dash = false;
    if (success) {
      if (pending.merchantType) {
        this.normalGuard = 0; this.merchantStats.successes++;
        this.acquireMerchant(pending.merchantType);
        pending.entry.label = `${pending.type} / MERCHANT TYPE ${pending.merchantType}`;
      } else {
        const rule = c.specials[pending.type], before = { vx: this.body.vx, vy: this.body.vy };
        if (rule.speed) {
          this.launchVector(rule.speed, rule.angle); this.characterAcceleration(before); this.limitSpeed();
        } else if (pending.type === "ANGLE") {
          this.launchVector(Math.hypot(pending.velocity.vx, pending.velocity.vy), 0);
        } else if (pending.type === "BRAKE") {
          Object.assign(this.body, pending.velocity);
        } else if (pending.type === "GUARD") {
          this.normalGuard = 0;
          this.guardSpecial = { active: true, remaining: c.guardSpecialDuration };
        }
        this.specialSuccesses++; pending.entry.label = `${pending.type} SPECIAL`;
        if (pending.partner) pending.partner.used = true;
        // Display only: the combo partner joins (used up, no contact event). Non-enumerable so JSON fingerprints of
        // the game state stay identical; ui.js shows it in the contact log / RESULT.
        if (pending.partner) Object.defineProperty(pending.entry, "partner", { value: pending.partner.type, enumerable: false, configurable: true });
      }
      if (this.tempoEnabled) this.hitStop = Math.max(this.hitStop, c.hitStopSpecial);
      this.flash = c.specialFlashDuration; this.specialTrail = c.specialTrailDuration;
      const strong = !pending.merchantType && pending.type === "STOPPER";
      if (strong) { this.flash = c.stopperFlashDuration; this.specialTrail = c.stopperTrailDuration; }
      this.successVisual = { type: strong ? "STOPPER" : pending.type, remaining: strong ? c.stopperTrailDuration : c.specialTrailDuration, strong };
      // Display-only cut-in: restart on every success (normal or merchant). MISS never sets this.
      this.specialCutin = {
        type: pending.merchantType ? "MERCHANT" : pending.type,
        castId: pending.merchantType ? "SPECIAL_ONLY" : pending.type,
        name: pending.merchantType ? c.merchantNames[pending.merchantType] : c.specials[pending.type].name,
        castName: pending.merchantType ? Hop.CAST?.SPECIAL_ONLY?.name || "商人" : (Hop.CAST?.[pending.type]?.name || pending.type),
        merchantType: pending.merchantType || null,
        strong,
        remaining: c.specialCutinDuration,
        total: c.specialCutinDuration
      };
      // Per-SPECIAL SE (Hop.Audio.specialRecipes): SPECIAL_BOOST ... SPECIAL_GUARD, merchant = SPECIAL_MERCHANT. MISS = none.
      this.soundEvent = pending.merchantType ? "SPECIAL_MERCHANT" : `SPECIAL_${pending.type}`;
      this.contact = { label: pending.type, remaining: c.contactDuration };
      if (!pending.merchantType && this.comboEnabled && pending.partner && (pending.type === "BOOST" || pending.type === "BOUNCE")) this.startCombo(pending);
    } else this.normalContact(pending.type, pending.entry, pending.guardAtContact);
    this.updateAerialMode();
    this.specialMessage = {
      label: success ? "SPECIAL SUCCESS" : "SPECIAL MISS",
      detail: pending.merchantType ? `商人 Type ${pending.merchantType} / ${c.merchantNames[pending.merchantType]}` : c.specials[pending.type].name,
      remaining: c.specialMessageDuration
    };
    if (this.body.stopped) this.finish();
    return true;
  }
  // Combo SPECIAL scene (display only). The launch vector was already applied by resolveSpecial; while
  // this.combo exists the game step is frozen (see update), so the flight result is unchanged.
  startCombo(pending) {
    const c = Hop.CONFIG, short = !!this.comboShort;
    this.combo = {
      type: pending.type, source: pending.source || null, partner: pending.partner,
      heroX: this.body.x, heroY: this.body.y, elapsed: 0, short, skipped: false,
      total: short ? c.comboReducedDuration : pending.type === "BOOST" ? c.comboWitchDuration : c.comboFighterDuration,
      // Repeat view of this combo type in the session (tempo mode): the scene clock runs comboRepeatRate x.
      rate: this.tempoEnabled && !short && this.comboViews[pending.type] > 0 ? c.comboRepeatRate : 1
    };
    this.comboViews[pending.type] = (this.comboViews[pending.type] || 0) + 1;
  }
  endCombo(skipped = false) {
    const combo = this.combo; if (!combo) return false;
    combo.skipped = skipped; this.combo = null;
    // Display-only afterglow (explosion fade / giant fighter shrinking); decremented like successVisual.
    this.comboAfter = { ...combo, remaining: Hop.CONFIG.comboAfterglow, total: Hop.CONFIG.comboAfterglow };
    return true;
  }
  skipCombo() { return this.endCombo(true); }
  // Launch cut-in (display only): intensity 0..1 from the launch power; tier NORMAL / STRONG / MAX.
  static launchCutinIntensity(power) {
    const c = Hop.CONFIG, k = (power - c.powerMin) / Math.max(1e-9, c.powerMax - c.powerMin);
    const intensity = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 1));
    return { intensity, tier: intensity >= c.launchCutinMaxAt - 1e-9 ? "MAX" : intensity >= c.launchCutinStrongAt - 1e-9 ? "STRONG" : "NORMAL" };
  }
  startLaunchCutin() {
    const c = Hop.CONFIG, mode = this.launchCutinReduced ? "reduced" : this.launchCutinViews > 0 ? "repeat" : "full";
    const total = mode === "reduced" ? c.launchCutinReducedDuration : mode === "repeat" ? c.launchCutinRepeatDuration : c.launchCutinDuration;
    this.launchCutinViews++;
    this.launchCutin = { mode, total, elapsed: 0, skipped: false, power: this.power, just: !!this.justLaunch, ...Hop.Game.launchCutinIntensity(this.power) };
    return this.launchCutin;
  }
  endLaunchCutin(skipped = false) {
    const cut = this.launchCutin; if (!cut) return false;
    cut.skipped = skipped; this.launchCutin = null;
    return true;
  }
  skipLaunchCutin() { return this.endLaunchCutin(true); }
  // ---- Tempo & feedback (display / UX; never changes physics, contacts or RNG) ----------------------------------
  // Tail of the run: no cut-in / combo / SPECIAL window / merchant, it has bounced at least once, and it is rolling
  // or airborne slower than tailSpeed.
  tailActive() {
    const c = Hop.CONFIG, b = this.body;
    if (this.state !== Hop.STATES.FLYING || this.launchCutin || this.combo || this.special || this.merchant || this.merchantVisual || b.stopped) return false;
    if (b.bounces < 1) return false;
    return b.grounded || b.vx < c.tailSpeed;
  }
  // Fast-forward factor for the tail: tailFastForward when nothing can be done (rolling, or no AERIAL UP left);
  // a gentler tailAirFastForward while airborne with AERIAL UP still available (the tap still works).
  tailScale() {
    const c = Hop.CONFIG; if (!this.tailActive()) return 1;
    return this.body.grounded || this.upRemaining <= 0 ? c.tailFastForward : c.tailAirFastForward;
  }
  // Instant finish: run the remaining fixed steps now (exactly the steps update() would run). Stops early when a
  // SPECIAL window opens or the hero is relaunched (tail no longer active), so no decision is ever skipped.
  finishTail() {
    const c = Hop.CONFIG; if (!this.tailActive()) return false;
    const tempo = this.tempoEnabled; this.tempoEnabled = false;
    let n = 0;
    try { while (n++ < c.tailFinishMaxSteps && this.tailActive()) this.update(c.physicsStep); }
    finally { this.tempoEnabled = tempo; }
    this.tailFinished = true;
    return true;
  }
  pushFx(event) { this.fxEvents.push(event); if (this.fxEvents.length > 32) this.fxEvents.shift(); }
  // Hit chain: consecutive character contacts without touching the ground (a contact while rolling starts at 1).
  noteHit(object, previous) {
    const h = this.hype;
    h.chain = this.body.grounded && previous.y <= 0 ? 1 : h.chain + 1;
    h.bestChain = Math.max(h.bestChain, h.chain);
    if (h.chain >= 2) this.pushFx({ kind: "CHAIN", n: h.chain, x: object.x, type: object.type });
  }
  // Hit-stop scaled by the velocity change of a normal contact (tempo mode only).
  noteImpact(deltaV) {
    const c = Hop.CONFIG; if (!this.tempoEnabled) return;
    const k = Math.max(0, Math.min(1, deltaV / c.hitStopRefSpeed));
    this.hitStop = Math.max(this.hitStop, c.hitStopMin + (c.hitStopMax - c.hitStopMin) * k);
    this.pushFx({ kind: "IMPACT", k });
  }
  static milestoneKind(meters) {
    const c = Hop.CONFIG; return meters > 0 && meters % c.milestoneBigMeters === 0 ? "MILESTONE_BIG" : "MILESTONE";
  }
  noteDistance() {
    const c = Hop.CONFIG, h = this.hype, m = this.body.x / c.pixelsPerMeter;
    const reached = Math.floor(m / c.milestoneMeters + 1e-9);
    while (h.milestone < reached) { h.milestone++; const meters = h.milestone * c.milestoneMeters; this.pushFx({ kind: Hop.Game.milestoneKind(meters), meters }); }
    if (!h.recordPassed && !this.debugUsed && this.best.distance > 0 && m > this.best.distance) { h.recordPassed = true; this.pushFx({ kind: "NEW_RECORD", meters: this.best.distance }); }
  }
  // RESULT rank by final distance (config.rankThresholds, highest first).
  // Stamp SE for a rank: S -> RANK_STAMP_S, SS / SSS -> grander RANK_STAMP_SS, others -> RANK_STAMP.
  // JUST! launch window (config justPowerMin / justAngleCenter / justAngleHalfWidth); never when disabled.
  static isJust(angle, power) {
    const c = Hop.CONFIG;
    return c.justLaunchEnabled === true && power >= c.justPowerMin && Math.abs(angle - c.justAngleCenter) <= c.justAngleHalfWidth;
  }
  static rankStampSe(rank) { return rank === "SS" || rank === "SSS" ? "RANK_STAMP_SS" : rank === "S" ? "RANK_STAMP_S" : "RANK_STAMP"; }
  static rank(distance) {
    const d = Number.isFinite(distance) ? distance : 0;
    return (Hop.CONFIG.rankThresholds.find(([, min]) => d >= min) || ["D"])[0];
  }
  // RESULT entrance timing (s) for the tempo measurement: overlay wait and distance count-up.
  resultTiming() {
    const c = Hop.CONFIG;
    return this.tempoEnabled ? { wait: c.resultOverlayLead + c.resultOverlayFade, count: c.resultCountTime } : { wait: 10 / 12 + 0.2, count: 0.8 };
  }
  act() {
    const s = Hop.STATES;
    switch (this.state) {
      case s.READY: this.state = s.AIM_ANGLE; this.phaseTime = 0; this.angle = Hop.CONFIG.angleMin; break;
      case s.AIM_ANGLE: this.state = s.AIM_POWER; this.phaseTime = 0; break;
      case s.AIM_POWER:
        this.justLaunch = Hop.Game.isJust(this.angle, this.power);
        Hop.Physics.launch(this.body, this.angle, this.power * (this.justLaunch ? Hop.CONFIG.justLaunchMultiplier : 1));
        if (this.justLaunch) this.pushFx({ kind: "JUST" });
        this.maxSpeed = Math.hypot(this.body.vx, this.body.vy);
        this.state = s.FLYING; this.accumulator = 0;
        if (this.launchCutinEnabled && Hop.CONFIG.launchCutinEnabled !== false) this.startLaunchCutin();
        break;
      case s.RESULT: this.reset(); this.act(); break;
      case s.FLYING: if (this.launchCutin) this.skipLaunchCutin(); else if (this.combo) this.skipCombo(); else if (this.special) this.resolveSpecial(true);
        // Rolling on the ground (no AERIAL possible): a tap finishes the run instantly (same steps, same distance).
        else if (this.tempoEnabled && this.body.grounded && this.tailActive()) this.finishTail();
        else this.aerial(this.updateAerialMode()); break;
    }
  }
  update(deltaTime) {
    const c = Hop.CONFIG;
    let dt = Math.max(0, Math.min(deltaTime, c.maxFrameDelta));
    // Tempo (display time only): hit-stop freezes the game step for a few real ms; the tail fast-forward runs game
    // time faster. Physics still advances in identical fixed steps, so results never change.
    this.realTime = (this.realTime || 0) + dt;
    if (this.tempoEnabled && this.state === Hop.STATES.FLYING) {
      if (this.hitStop > 0) { const used = Math.min(this.hitStop, dt); this.hitStop -= used; dt -= used; }
      const target = this.tailScale();
      // Ramp up smoothly; drop back to 1 at once (a SPECIAL window or a relaunch is always real time).
      this.timeScale = target <= 1 ? 1 : Math.min(target, this.timeScale + (target - 1) * dt / Math.max(1e-6, c.tailRampTime));
      dt *= this.timeScale;
    } else { this.timeScale = 1; this.hitStop = 0; }
    this.phaseTime += dt;
    // Display only (render interpolation / smoothing clock); never read by physics, contacts or results.
    this.frameDt = dt; this.displayTime = (this.displayTime || 0) + dt;
    if (this.state !== Hop.STATES.FLYING || this.renderPrevX === undefined) { this.renderPrevX = this.body.x; this.renderPrevY = this.body.y; this.renderAlpha = 1; }
    // Triangle waves: a full period includes both outbound and return sweeps.
    const sweep = period => 1 - Math.abs(2 * ((this.phaseTime / period) % 1) - 1);
    if (this.state === Hop.STATES.AIM_ANGLE) this.angle = c.angleMin + (c.angleMax - c.angleMin) * sweep(c.anglePeriod);
    if (this.state === Hop.STATES.AIM_POWER) this.power = c.powerMin + (c.powerMax - c.powerMin) * sweep(c.powerPeriod);
    if (this.state !== Hop.STATES.FLYING) return;
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= c.physicsStep) {
      // Combo scene: only display timers (cut-in, success flash) run; physics, play timers, generation and
      // RNG are frozen until the scene ends or is skipped.
      // Launch cut-in: same freeze; only its own clock runs.
      // Display only: the interpolation start point is the body before the newest physics step (frozen
      // steps pin it to the current body so a paused scene never oscillates).
      this.renderPrevX = this.body.x; this.renderPrevY = this.body.y;
      if (this.launchCutin) {
        this.launchCutin.elapsed += c.physicsStep; this.accumulator -= c.physicsStep;
        if (this.launchCutin.elapsed >= this.launchCutin.total - 1e-9) this.endLaunchCutin(false);
        continue;
      }
      if (this.combo) {
        const r = this.combo.rate || 1;
        this.combo.elapsed += c.physicsStep * r; this.accumulator -= c.physicsStep;
        this.flash = Math.max(0, this.flash - c.physicsStep * r);
        if (this.specialCutin) { this.specialCutin.remaining -= c.physicsStep * r; if (this.specialCutin.remaining < 1e-9) this.specialCutin = null; }
        if (this.combo.elapsed >= this.combo.total - 1e-9) this.endCombo(false);
        continue;
      }
      const playTimersPaused = this.special || this.specialMessage || this.merchantVisual || this.merchant?.type === "C";
      if (this.guardSpecial.active && !playTimersPaused) {
        this.guardSpecial.remaining = Math.max(0, this.guardSpecial.remaining - c.physicsStep);
        if (this.guardSpecial.remaining < 1e-9) this.guardSpecial = { active: false, remaining: 0 };
      }
      if (!playTimersPaused) {
        this.downCharge = Math.max(0, Math.min(1, this.downCharge + c.physicsStep / c.aerialDownRechargeTime));
        if (1 - this.downCharge < 1e-9) this.downCharge = 1;
      }
      this.flash = Math.max(0, this.flash - c.physicsStep); this.specialTrail = Math.max(0, this.specialTrail - c.physicsStep);
      for (const key of ["effect", "contact", "specialMessage", "merchantVisual", "successVisual", "specialCutin", "comboAfter"]) {
        if (this[key]) { this[key].remaining -= c.physicsStep; if (this[key].remaining < 1e-9) this[key] = null; }
      }
      // A short contact pause gives exactly one decision window. Normal effects
      // are deferred, so STOPPER's penalty is never applied before success.
      if (this.special) {
        this.special.remaining -= c.physicsStep;
        this.accumulator -= c.physicsStep;
        if (this.special.remaining <= 1e-9) this.resolveSpecial(false);
        continue;
      }
      this.generateObjects();
      const previous = { x: this.body.x, y: this.body.y, vx: this.body.vx, vy: this.body.vy };
      if (this.merchant?.type === "C") this.floatStep(c.physicsStep);
      else {
        const impact = Hop.Physics.step(this.body, c.physicsStep);
        if (impact) this.groundImpact(impact);
        else this.applyAerialDownLock();
        this.contactObjects(previous);
        if (this.preImpactArmed && --this.preImpactArmed.steps <= 0) this.preImpactArmed = null;
      }
      this.accumulator -= c.physicsStep;
      this.noteDistance();
      this.maxHeight = Math.max(this.maxHeight, this.body.y);
      this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(this.body.vx, this.body.vy));
      this.updateAerialMode();
      if (this.body.stopped && !this.special) {
        if (!this.revive()) { this.finish(); break; }
      }
    }
    // Display only: fraction of a physics step left in the accumulator (0..1) for render interpolation.
    this.renderAlpha = this.state === Hop.STATES.FLYING ? Math.max(0, Math.min(1, this.accumulator / c.physicsStep)) : 1;
    const follow = 1 - Math.exp(-c.cameraFollowRate * dt);
    this.cameraX += (Math.max(0, c.launchX + this.body.x - c.cameraAnchorX) - this.cameraX) * follow;
    // Lift the view on high shots, keeping the player visible at maximum power.
    this.cameraY = Math.max(0, this.body.y - (c.groundY - 160));
    this.trail.push({ x: this.body.x, y: this.body.y });
    if (this.trail.length > c.trailLength) this.trail.shift();
  }
};
// DEBUG kinds (development only; any use makes the play 記録対象外). Each id is also the ?debug= URL value
// (?debug=boost, ?debug=merchant-a, ?debug=all, ...). key = keyboard shortcut in the DEBUG menu (0 = OFF).
// Labels come from config (SPECIAL / merchant names) and Hop.CAST at display time (Hop.Game.debugKindLabel).
Hop.DEBUG_KINDS = Object.freeze([
  { id: "all", key: "1", group: "basic" },
  { id: "aerial", key: "9", group: "basic", empty: true },
  ...Object.keys(Hop.CONFIG.specials).map((type, i) => ({ id: type.toLowerCase(), key: String(i + 2), group: "special", special: type })),
  ...Object.entries(Hop.CONFIG.merchantTypes).sort((a, b) => a[1].localeCompare(b[1]))
    .map(([type, letter], i) => ({ id: "merchant-" + letter.toLowerCase(), key: "QWER"[i], group: "merchant", merchant: letter, cast: type }))
].map(kind => Object.freeze(kind)));
Hop.Game.debugKind = id => Hop.DEBUG_KINDS.find(kind => kind.id === String(id ?? "").toLowerCase()) || null;
// ?debug / ?debug=1 / on / all -> "all"; ?debug=<id> -> that kind; off / 0 / unknown / absent -> null.
Hop.Game.debugKindFromSearch = search => {
  const match = /[?&]debug(?:=([^&#]*))?(?:[&#]|$)/i.exec(String(search || ""));
  if (!match) return null;
  let value = "";
  try { value = decodeURIComponent((match[1] || "").replace(/\+/g, " ")).trim().toLowerCase(); } catch { return null; }
  if (["", "1", "on", "true"].includes(value)) return "all";
  return Hop.Game.debugKind(value)?.id || null;
};
// Japanese menu / badge text. title: what is checked, detail: how it is prepared.
Hop.Game.debugKindLabel = id => {
  const c = Hop.CONFIG, kind = Hop.Game.debugKind(id), cast = type => Hop.CAST?.[type]?.name || type;
  if (!kind) return { title: "OFF", detail: "通常プレイに戻す（記録はRETRY後から）" };
  if (kind.id === "all") return { title: "全キャラ順番", detail: "従来のDEBUG：7人を一定間隔で順に配置" };
  if (kind.empty) return { title: "キャラなし", detail: "AERIAL UP/DOWN・着地・RESULTの確認" };
  if (kind.merchant) return { title: `商人${kind.merchant} ${c.merchantNames[kind.merchant]}`, detail: `${cast(kind.cast)}を境界扱い・GUARD×1・抽選なし` };
  const type = kind.special, rule = c.specials[type];
  const how = rule.trigger === "adjacent" ? `${cast(type)}＋${cast(rule.partner)}（合体攻撃）` :
    rule.trigger === "dash" ? `${cast(type)}・DASH準備済み` : rule.trigger === "stopper" ? `${cast(type)}・STOPPER準備済み` :
    rule.trigger === "brake" ? `${cast(type)}・AERIAL DOWN後の状態` : rule.trigger === "chance" ? `${cast(type)}・${Math.round(c.angleSpecialChance * 100)}%抽選なし` :
    `${cast(type)}・GUARD×1から`;
  return { title: rule.name, detail: how };
};
