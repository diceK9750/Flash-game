"use strict";
Hop.Game = class {
  constructor(random = Math.random) {
    this.random = random; this.debug = false; this.debugKind = null;
    // Combo scene preferences (kept across RETRY): comboEnabled (config default) and comboShort (the UI mirrors
    // prefers-reduced-motion here so the short version is chosen when the scene starts).
    this.comboEnabled = Hop.CONFIG.comboEnabled !== false; this.comboShort = false;
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
    this.aerialMode = "DOWN"; this.aerialDownLock = null; this.successVisual = null; this.specialCutin = null; this.soundEvent = null;
    this.merchant = null; this.merchantVisual = null;
    this.combo = null; this.comboAfter = null;
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
      this.clearAerialDownLock();
      this.counts[object.type]++;
      const entry = { type: object.type, label: object.type };
      this.history.push(entry);
      this.contact = { label: object.type, remaining: c.contactDuration };
      const rule = c.specials[object.type];
      const partner = this.objects.filter(o => !o.used && o.x > object.x).sort((a, z) => a.x - z.x)[0];
      const guardAtContact = this.normalGuard;
      const eligible = rule && (rule.trigger === "adjacent" ? partner?.type === rule.partner :
        rule.trigger === "chance" ? object.debugForce === true || this.random() < c.angleSpecialChance :
        rule.trigger === "guard" ? guardAtContact && !this.guardSpecial.active : this.specialArmed[rule.trigger]);
      const spacing = c.boundaryMeters * c.pixelsPerMeter;
      const atBoundary = object.debugBoundary === true || object.x > 0 && Math.abs(object.x / spacing - Math.round(object.x / spacing)) < 1e-9;
      const inZone = b.x >= object.x - c.merchantZoneMeters * c.pixelsPerMeter && previous.x <= object.x;
      const merchantCandidate = (guardAtContact || this.guardSpecial.active) && atBoundary && inZone ? c.merchantTypes[object.type] : null;
      // Rare draw (merchantChance); a miss is an ordinary contact judged by the normal SPECIAL rules above.
      const merchantType = merchantCandidate && (this.debug || this.random() < c.merchantChance) ? merchantCandidate : null;
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
    this.clearAerialDownLock();
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
      total: short ? c.comboReducedDuration : pending.type === "BOOST" ? c.comboWitchDuration : c.comboFighterDuration
    };
  }
  endCombo(skipped = false) {
    const combo = this.combo; if (!combo) return false;
    combo.skipped = skipped; this.combo = null;
    // Display-only afterglow (explosion fade / giant fighter shrinking); decremented like successVisual.
    this.comboAfter = { ...combo, remaining: Hop.CONFIG.comboAfterglow, total: Hop.CONFIG.comboAfterglow };
    return true;
  }
  skipCombo() { return this.endCombo(true); }
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
      case s.FLYING: if (this.combo) this.skipCombo(); else if (this.special) this.resolveSpecial(true); else this.aerial(this.updateAerialMode()); break;
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
      // Combo scene: only display timers (cut-in, success flash) run; physics, play timers, generation and
      // RNG are frozen until the scene ends or is skipped.
      if (this.combo) {
        this.combo.elapsed += c.physicsStep; this.accumulator -= c.physicsStep;
        this.flash = Math.max(0, this.flash - c.physicsStep);
        if (this.specialCutin) { this.specialCutin.remaining -= c.physicsStep; if (this.specialCutin.remaining < 1e-9) this.specialCutin = null; }
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
