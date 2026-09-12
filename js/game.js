"use strict";
Hop.Game = class {
  constructor(random = Math.random) { this.random = random; this.reset(); }
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
    this.objects = [];
    this.nextObjectX = this.randomBetween(Hop.CONFIG.objectFirstMin, Hop.CONFIG.objectFirstMax);
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
    if (!this.airborne()) return false;
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
      const type = entries.find(([, weight]) => (choice -= weight) < 0)?.[0] || entries[entries.length - 1][0];
      this.objects.push({ x: this.nextObjectX, type, used: false });
      this.nextObjectX += Math.max(1, this.randomBetween(c.objectGapMin, c.objectGapMax));
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
    for (const object of this.objects) {
      if (object.used || !this.touches(object, previous)) continue;
      object.used = true; // Single use per run, including a later re-entry.
      if (object.type === "BOOST") b.vx += c.boostHorizontal;
      if (object.type === "BOUNCE") {
        b.vx += c.bounceHorizontal; b.vy = Math.max(b.vy, c.bounceVertical);
        b.grounded = false;
      }
      if (object.type === "BRAKE") b.vx *= c.brakeRetention;
      b.stopped = false;
      this.limitSpeed();
      this.contact = { label: object.type, remaining: c.contactDuration };
    }
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
      case s.FLYING: this.aerial("UP"); break;
    }
  }
  update(deltaTime) {
    const c = Hop.CONFIG;
    const dt = Math.max(0, Math.min(deltaTime, c.maxFrameDelta));
    this.phaseTime += dt;
    for (const key of ["effect", "contact"]) {
      if (this[key]) { this[key].remaining -= dt; if (this[key].remaining <= 0) this[key] = null; }
    }
    // Triangle waves: a full period includes both outbound and return sweeps.
    const sweep = period => 1 - Math.abs(2 * ((this.phaseTime / period) % 1) - 1);
    if (this.state === Hop.STATES.AIM_ANGLE) this.angle = c.angleMin + (c.angleMax - c.angleMin) * sweep(c.anglePeriod);
    if (this.state === Hop.STATES.AIM_POWER) this.power = c.powerMin + (c.powerMax - c.powerMin) * sweep(c.powerPeriod);
    if (this.state !== Hop.STATES.FLYING) return;
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= c.physicsStep) {
      this.downCooldown = Math.max(0, this.downCooldown - c.physicsStep);
      if (this.downCooldown < 1e-9) this.downCooldown = 0;
      this.generateObjects();
      const previous = { x: this.body.x, y: this.body.y };
      Hop.Physics.step(this.body, c.physicsStep);
      this.contactObjects(previous);
      this.accumulator -= c.physicsStep;
      this.maxHeight = Math.max(this.maxHeight, this.body.y);
      this.maxSpeed = Math.max(this.maxSpeed, Math.hypot(this.body.vx, this.body.vy));
      if (this.body.stopped) {
        this.state = Hop.STATES.RESULT;
        this.finalDistance = this.body.x / c.pixelsPerMeter;
        this.accumulator = 0; break;
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
