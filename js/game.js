"use strict";
Hop.Game = class {
  constructor(random = Math.random) {
    this.random = random; this.debug = false;
    this.best = this.readBest(); this.reset();
  }
  reset() {
    this.state = Hop.STATES.READY;
    this.body = Hop.Physics.create();
    this.angle = Hop.CONFIG.angleDefault;
    this.power = Hop.CONFIG.powerMin;
    this.phaseTime = 0; this.accumulator = 0;
    this.cameraX = 0; this.cameraY = 0;
    this.maxHeight = 0; this.maxSpeed = 0; this.finalDistance = null;
    this.trail = [];
    this.upRemaining = Hop.CONFIG.aerialUpUses;
    this.downCharge = 1; this.effect = null; this.contact = null;
    this.normalGuard = 0; this.guardSpecial = { active: false, remaining: 0 };
    this.special = null; this.specialMessage = null;
    this.specialArmed = { dash: false, stopper: false, brake: false };
    this.aerialMode = "DOWN"; this.successVisual = null; this.soundEvent = null;
    this.merchant = null; this.merchantVisual = null;
    this.merchantStats = { attempts: 0, successes: 0, lastType: null, revives: 0 };
    this.flash = 0; this.specialTrail = 0;
    this.history = []; this.counts = Object.fromEntries(Object.keys(Hop.CONFIG.objectWeights).map(type => [type, 0]));
    this.specialCount = 0; this.specialSuccesses = 0;
    this.debugUsed = this.debug; this.newRecords = []; this.debugIndex = 0;
    this.objects = [];
    this.nextBoundaryX = Hop.CONFIG.boundaryMeters * Hop.CONFIG.pixelsPerMeter;
    this.nextObjectX = this.debug ? Hop.CONFIG.debugFirst : this.randomBetween(Hop.CONFIG.objectFirstMin, Hop.CONFIG.objectFirstMax);
    this.generateObjects();
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
  toggleDebug() {
    this.debug = !this.debug;
    if (this.state !== Hop.STATES.RESULT) this.debugUsed = true;
    // Rebuild only future objects; switching OFF cannot make this run eligible.
    this.objects = []; this.debugIndex = 0;
    const boundary = Hop.CONFIG.boundaryMeters * Hop.CONFIG.pixelsPerMeter;
    this.nextBoundaryX = (Math.floor(this.body.x / boundary) + 1) * boundary;
    this.nextObjectX = this.body.x + (this.debug ? Hop.CONFIG.debugFirst : this.randomBetween(Hop.CONFIG.objectFirstMin, Hop.CONFIG.objectFirstMax));
    this.generateObjects();
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
  aerial(direction) {
    if (this.special || this.merchant?.type === "C" || !this.airborne()) return false;
    const c = Hop.CONFIG;
    if (direction === "UP") {
      if (this.upRemaining <= 0) return false;
      this.upRemaining--;
      this.specialArmed.brake = false;
      this.body.vy += c.aerialUpVertical; this.body.vx += c.aerialUpHorizontal;
    } else if (direction === "DOWN") {
      if (this.downCharge < 1) return false;
      this.downCharge = 0;
      this.specialArmed.brake = true;
      this.body.vy -= c.aerialDownVertical; this.body.vx += c.aerialDownHorizontal;
    } else return false;
    this.limitSpeed();
    this.updateAerialMode();
    this.effect = { label: `AERIAL ${direction}`, remaining: c.effectDuration };
    return true;
  }
  generateObjects() {
    const c = Hop.CONFIG;
    const entries = Object.entries(c.objectWeights);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    const pickType = () => {
      let choice = this.random() * total;
      return entries.find(([, weight]) => (choice -= weight) < 0)?.[0] || entries[entries.length - 1][0];
    };
    const boundary = c.boundaryMeters * c.pixelsPerMeter;
    if (!this.debug) {
      while (this.nextBoundaryX < this.body.x + c.objectAhead) {
        this.objects.push({ x: this.nextBoundaryX, type: pickType(), used: false, boundary: true });
        this.nextBoundaryX += boundary;
      }
    }
    while (this.nextObjectX < this.body.x + c.objectAhead) {
      const nearestBoundary = Math.max(1, Math.round(this.nextObjectX / boundary)) * boundary;
      if (this.debug || Math.abs(this.nextObjectX - nearestBoundary) >= c.boundaryClearance) {
        const type = this.debug ? entries[this.debugIndex++ % entries.length][0] : pickType();
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
      this.counts[object.type]++;
      const entry = { type: object.type, label: object.type };
      this.history.push(entry);
      this.contact = { label: object.type, remaining: c.contactDuration };
      const rule = c.specials[object.type];
      const partner = this.objects.filter(o => !o.used && o.x > object.x).sort((a, z) => a.x - z.x)[0];
      const guardAtContact = this.normalGuard;
      const eligible = rule && (rule.trigger === "adjacent" ? partner?.type === rule.partner :
        rule.trigger === "chance" ? this.random() < c.angleSpecialChance :
        rule.trigger === "guard" ? guardAtContact && !this.guardSpecial.active : this.specialArmed[rule.trigger]);
      const spacing = c.boundaryMeters * c.pixelsPerMeter;
      const atBoundary = object.x > 0 && Math.abs(object.x / spacing - Math.round(object.x / spacing)) < 1e-9;
      const inZone = b.x >= object.x - c.merchantZoneMeters * c.pixelsPerMeter && previous.x <= object.x;
      const merchantType = (guardAtContact || this.guardSpecial.active) && atBoundary && inZone ? c.merchantTypes[object.type] : null;
      this.normalGuard = 0; // One contact lifetime; snapshot belongs only to this event.
      this.updateSpecialArming(object.type);
      if (merchantType || eligible) {
        this.special = { type: object.type, merchantType, partner: eligible && rule.trigger === "adjacent" ? partner : null, remaining: c.specialWindow, entry, guardAtContact, velocity: { vx: b.vx, vy: b.vy } };
        this.specialArmed.dash = false;
        this.specialArmed.brake = false;
        if (merchantType) {
          this.merchantStats.attempts++;
          this.merchantVisual = { type: merchantType, remaining: c.specialWindow + c.specialMessageDuration };
        } else this.specialCount++;
        break;
      }
      this.normalContact(object.type, entry, guardAtContact);
      if (b.stopped) break;
    }
  }
  updateSpecialArming(type) {
    const armed = this.specialArmed;
    if (type !== "BRAKE") armed.brake = false;
    if (["BOOST", "BOUNCE", "STOPPER"].includes(type)) armed.dash = false;
    if (type === "DASH") armed.dash = true;
    if (["BOOST", "BOUNCE", "DASH"].includes(type)) armed.stopper = true;
    if (["GUARD", "STOPPER"].includes(type)) armed.stopper = false;
  }
  normalContact(type, entry, guardAtContact = 0) {
    const normalBlock = guardAtContact && ["BOOST", "BOUNCE", "DASH", "STOPPER"].includes(type);
    const specialBlock = !normalBlock && type === "STOPPER" && this.guardSpecial.active;
    if (normalBlock || specialBlock) {
      if (specialBlock) this.guardSpecial = { active: false, remaining: 0 };
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
      }
      this.flash = c.specialFlashDuration; this.specialTrail = c.specialTrailDuration;
      const strong = !pending.merchantType && pending.type === "STOPPER";
      if (strong) { this.flash = c.stopperFlashDuration; this.specialTrail = c.stopperTrailDuration; }
      this.successVisual = { type: strong ? "STOPPER" : pending.type, remaining: strong ? c.stopperTrailDuration : c.specialTrailDuration, strong };
      this.soundEvent = strong ? "STOPPER" : pending.type === "GUARD" ? "GUARD" : "SPECIAL";
      this.contact = { label: pending.type, remaining: c.contactDuration };
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
  act() {
    const s = Hop.STATES;
    switch (this.state) {
      case s.READY: this.state = s.AIM_ANGLE; this.phaseTime = 0; this.angle = Hop.CONFIG.angleMin; break;
      case s.AIM_ANGLE: this.state = s.AIM_POWER; this.phaseTime = 0; break;
      case s.AIM_POWER:
        Hop.Physics.launch(this.body, this.angle, this.power);
        this.maxSpeed = Math.hypot(this.body.vx, this.body.vy);
        this.state = s.FLYING; this.accumulator = 0; break;
      case s.RESULT: this.reset(); this.act(); break;
      case s.FLYING: if (this.special) this.resolveSpecial(true); else this.aerial(this.updateAerialMode()); break;
    }
  }
  update(deltaTime) {
    const c = Hop.CONFIG;
    const dt = Math.max(0, Math.min(deltaTime, c.maxFrameDelta));
    this.phaseTime += dt;
    // Triangle waves: a full period includes both outbound and return sweeps.
    const sweep = period => 1 - Math.abs(2 * ((this.phaseTime / period) % 1) - 1);
    if (this.state === Hop.STATES.AIM_ANGLE) this.angle = c.angleMin + (c.angleMax - c.angleMin) * sweep(c.anglePeriod);
    if (this.state === Hop.STATES.AIM_POWER) this.power = c.powerMin + (c.powerMax - c.powerMin) * sweep(c.powerPeriod);
    if (this.state !== Hop.STATES.FLYING) return;
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= c.physicsStep) {
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
      for (const key of ["effect", "contact", "specialMessage", "merchantVisual", "successVisual"]) {
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
        this.contactObjects(previous);
      }
      this.accumulator -= c.physicsStep;
      this.maxHeight = Math.max(this.maxHeight, this.body.y);
      this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(this.body.vx, this.body.vy));
      this.updateAerialMode();
      if (this.body.stopped && !this.special) {
        if (!this.revive()) { this.finish(); break; }
      }
    }
    const follow = 1 - Math.exp(-c.cameraFollowRate * dt);
    this.cameraX += (Math.max(0, c.launchX + this.body.x - c.cameraAnchorX) - this.cameraX) * follow;
    // Lift the view on high shots, keeping the player visible at maximum power.
    this.cameraY = Math.max(0, this.body.y - (c.groundY - 160));
    this.trail.push({ x: this.body.x, y: this.body.y });
    if (this.trail.length > c.trailLength) this.trail.shift();
  }
};
