"use strict";
Hop.Physics = {
  create() { return { x: 0, y: 0, vx: 0, vy: 0, grounded: true, stopped: false, bounces: 0 }; },
  launch(body, angle, power) {
    const radians = angle * Math.PI / 180;
    const speed = Hop.CONFIG.launchSpeed * power;
    body.vx = Math.cos(radians) * speed;
    body.vy = Math.sin(radians) * speed;
    body.grounded = false;
  },
  step(body, dt) {
    const c = Hop.CONFIG;
    if (body.stopped) return;
    if (body.grounded) {
      const oldVx = body.vx;
      body.vx = Math.max(0, body.vx - c.groundDeceleration * dt);
      body.x += (oldVx + body.vx) * 0.5 * dt;
      if (body.vx <= c.stopSpeed) { body.vx = 0; body.vy = 0; body.stopped = true; }
      return;
    }
    const drag = Math.exp(-c.airDrag * dt);
    body.vx *= drag;
    body.vy = body.vy * drag - c.gravity * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    if (body.y <= 0 && body.vy < 0) {
      body.y = 0;
      body.vy = -body.vy * c.restitution;
      body.vx *= c.bounceHorizontalRetention;
      body.bounces += 1;
      if (body.vy < c.settleBounceSpeed) { body.vy = 0; body.grounded = true; }
    }
  }
};
