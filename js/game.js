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
    this.downCooldown = 0; this.effect = null; this.contact = null;
    this.guard = 0; this.special = null; this.specialMessage = null;
    this.flash = 0; this.specialTrail = 0;
    this.history = []; this.counts = Object.fromEntries(Object.keys(Hop.CONFIG.objectWeights).map(type => [type, 0]));
    this.specialCount = 0; this.specialSuccesses = 0;
    this.debugUsed = this.debug; this.newRecords = []; this.debugIndex = 0;
    this.objects = [];
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
    this.nextObjectX = this.body.x + (this.debug ? Hop.CONFIG.debugFirst : this.randomBetween(Hop.CONFIG.objectFirstMin, Hop.CONFIG.objectFirstMax));
    this.generateObjects();
  }
  randomBetween(min, max) { return min + (max - min) * this.random(); }
  airborne() { return this.state === Hop.STATES.FLYING && !this.body.grounded && this.body.y > 0; }
  limitSpeed() {
    const c = Hop.CONFIG, b = this.body;
    b.vx = Math.max(0, Math.min(c.maxHorizontalSpeed, b.vx));
    b.vy = Math.max(-c.maxVerticalSpeed, Math.min(c.maxVerticalSpeed, b.vy));
    this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(b.vx, b.vy));
  }
  aerial(direction) {
    if (this.special || !this.airborne()) return false;
    const c = Hop.CONFIG;
    if (direction === "UP") {
      if (this.upRemaining <= 0) return false;
      this.upRemaining--;
      this.body.vy += c.aerialUpVertical; this.body.vx += c.aerialUpHorizontal;
    } else if (direction === "DOWN") {
      if (this.downCooldown > 0) return false;
      this.downCooldown = c.aerialDownCooldown;
      this.body.vy -= c.aerialDownVertical; this.body.vx += c.aerialDownHorizontal;
    } else return false;
    this.limitSpeed();
    this.effect = { label: `AERIAL ${direction}`, remaining: c.effectDuration };
    return true;
  }
  generateObjects() {
    const c = Hop.CONFIG;
    const entries = Object.entries(c.objectWeights);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    while (this.nextObjectX < this.body.x + c.objectAhead) {
      let choice = this.random() * total;
      const type = this.debug ? entries[this.debugIndex++ % entries.length][0] : entries.find(([, weight]) => (choice -= weight) < 0)?.[0] || entries[entries.length - 1][0];
      this.objects.push({ x: this.nextObjectX, type, used: false });
      this.nextObjectX += Math.max(1, this.debug ? c.debugGap : this.randomBetween(c.objectGapMin, c.objectGapMax));
    }
    this.objects = this.objects.filter(object => object.x >= this.body.x - c.objectBehind);
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
    if (this.special) return;
    for (const object of this.objects) {
      if (object.used || !this.touches(object, previous)) continue;
      object.used = true; // Single use per run, including a later re-entry.
      this.counts[object.type]++;
      const entry = { type: object.type, label: object.type };
      this.history.push(entry);
      this.contact = { label: object.type, remaining: c.contactDuration };
      if (this.guard && (object.type === "BRAKE" || object.type === "STOPPER")) {
        this.guard = 0; entry.label += " (GUARDED)";
        this.contact.label = `${object.type} / GUARD BLOCK`; continue;
      }
      const rule = c.specials[object.type];
      const metrics = { speed: Math.hypot(previous.vx ?? b.vx, previous.vy ?? b.vy), horizontal: previous.vx ?? b.vx, distance: b.x / c.pixelsPerMeter };
      if (rule && metrics[rule.metric] >= (rule.min ?? -Infinity) && metrics[rule.metric] <= (rule.max ?? Infinity)) {
        this.special = { type: object.type, remaining: c.specialWindow, entry };
        this.specialCount++; break;
      }
      this.applyContact(object.type);
    }
  }
  applyContact(type) {
    const c = Hop.CONFIG, b = this.body;
    if (type === "BOOST") b.vx += c.boostHorizontal;
    if (type === "BOUNCE") { b.vx += c.bounceHorizontal; b.vy = Math.max(b.vy, c.bounceVertical); b.grounded = false; }
    if (type === "BRAKE") b.vx *= c.brakeRetention;
    if (type === "STOPPER") b.vx *= c.stopperRetention;
    if (type === "ANGLE") {
      const speed = Math.hypot(b.vx, b.vy) * c.angleSpeedRetention;
      const angle = c.angleDegrees * Math.PI / 180;
      b.vx = speed * Math.cos(angle); b.vy = speed * Math.sin(angle); b.grounded = false;
    }
    if (type === "DASH") { b.vx += c.dashHorizontal; b.vy = Math.max(b.vy, c.dashVertical); b.grounded = false; }
    if (type === "GUARD") this.guard = 1;
    b.stopped = false; this.limitSpeed();
  }
  resolveSpecial(success) {
    if (!this.special) return false;
    const pending = this.special, c = Hop.CONFIG;
    this.special = null;
    if (success) {
      const rule = c.specials[pending.type];
      this.body.vx = Math.max(this.body.vx, rule.vx); this.body.vy = Math.max(this.body.vy, rule.vy);
      this.body.grounded = false; this.body.stopped = false; this.limitSpeed();
      this.specialSuccesses++; pending.entry.label = `${pending.type} SPECIAL`;
      this.flash = c.specialFlashDuration; this.specialTrail = c.specialTrailDuration;
    } else this.applyContact(pending.type);
    this.specialMessage = { label: success ? "SPECIAL SUCCESS" : "SPECIAL MISS", remaining: c.specialMessageDuration };
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
      case s.FLYING: if (this.special) this.resolveSpecial(true); else this.aerial("UP"); break;
    }
  }
  update(deltaTime) {
    const c = Hop.CONFIG;
    const dt = Math.max(0, Math.min(deltaTime, c.maxFrameDelta));
    this.phaseTime += dt;
    this.flash = Math.max(0, this.flash - dt); this.specialTrail = Math.max(0, this.specialTrail - dt);
    for (const key of ["effect", "contact", "specialMessage"]) {
      if (this[key]) { this[key].remaining -= dt; if (this[key].remaining <= 0) this[key] = null; }
    }
    // Triangle waves: a full period includes both outbound and return sweeps.
    const sweep = period => 1 - Math.abs(2 * ((this.phaseTime / period) % 1) - 1);
    if (this.state === Hop.STATES.AIM_ANGLE) this.angle = c.angleMin + (c.angleMax - c.angleMin) * sweep(c.anglePeriod);
    if (this.state === Hop.STATES.AIM_POWER) this.power = c.powerMin + (c.powerMax - c.powerMin) * sweep(c.powerPeriod);
    if (this.state !== Hop.STATES.FLYING) return;
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= c.physicsStep) {
      // A short contact pause gives exactly one decision window. Normal effects
      // are deferred, so STOPPER's penalty is never applied before success.
      if (this.special) {
        this.special.remaining -= c.physicsStep;
        this.accumulator -= c.physicsStep;
        if (this.special.remaining <= 1e-9) this.resolveSpecial(false);
        continue;
      }
      this.downCooldown = Math.max(0, this.downCooldown - c.physicsStep);
      if (this.downCooldown < 1e-9) this.downCooldown = 0;
      this.generateObjects();
      const previous = { x: this.body.x, y: this.body.y, vx: this.body.vx, vy: this.body.vy };
      Hop.Physics.step(this.body, c.physicsStep);
      this.contactObjects(previous);
      this.accumulator -= c.physicsStep;
      this.maxHeight = Math.max(this.maxHeight, this.body.y);
      this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(this.body.vx, this.body.vy));
      if (this.body.stopped && !this.special) {
        this.finish(); break;
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
