"use strict";
// Presentation only. IDs, collisions, physics and spawn weights live elsewhere.
// asset is reserved for a future image renderer; null always uses Canvas shapes.
// color (name label, contact tag/effect, Canvas fallback body) follows the redesign sprites, darkened for
// >= 4.8:1 contrast on the label box (#fff9e9) and >= 3.9:1 on the sky behind the contact tag.
Hop.CAST = Object.freeze({
  HERO: { name: "勇者", gender: "男", color: "#2467ac", shape: "hero", effect: "いざ、空の旅！", asset: null },
  BOOST: { name: "魔法使い", gender: "女", color: "#b8460f", shape: "witch", effect: "爆風でひとっ飛び！", asset: null },
  BOUNCE: { name: "武闘家", gender: "女", color: "#337c2f", shape: "fighter", effect: "空まで蹴り上げ！", asset: null },
  BRAKE: { name: "盗賊", gender: "男", color: "#866b15", shape: "thief", effect: "推進力を半分いただき！", asset: null },
  ANGLE: { name: "遊び人", gender: "男", color: "#bf3a6e", shape: "jester", effect: "くるりと方向転換！", asset: null },
  DASH: { name: "戦士", gender: "女", color: "#a8231b", shape: "warrior", effect: "猛突進！", asset: null },
  GUARD: { name: "賢者", gender: "女", color: "#2b6cb0", shape: "sage", effect: "結界をどうぞ！", asset: null },
  STOPPER: { name: "僧侶", gender: "女", color: "#1f44a8", shape: "cleric", effect: "ここでひと休み！", asset: null },
  SPECIAL_ONLY: { name: "商人", gender: "女", color: "#a3369a", shape: "merchant", effect: "とっておきの品！", asset: null, spawn: false }
});
Hop.Graphics = {
  polygon(ctx, points, color) {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  },
  circle(ctx, x, y, radius, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  },
  line(ctx, points, color, width = 5) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  },
  character(ctx, id, x, feet, scale = 1, pose = 0) {
    const role = Hop.CAST[id] || Hop.CAST.HERO;
    const ink = "#26394b", skin = "#ffd9a4", hair = "#503a39";
    ctx.save(); ctx.translate(x, feet); ctx.scale(scale, scale);
    const shape = role.shape, color = role.color;
    this.line(ctx, [[-10, -19], [-12, 0]], ink, 9);
    this.line(ctx, [[10, -19], [shape === "fighter" ? 32 : 13, shape === "fighter" ? -20 - pose * 12 : 0]], ink, 9);
    this.polygon(ctx, [[-17, -44], [15, -44], [20, -16], [-20, -16]], color);
    if (role.gender === "女") this.polygon(ctx, [[-17, -62], [17, -62], [22, -32], [-22, -32]], hair);
    this.circle(ctx, 0, -54, 17, skin);
    this.line(ctx, [[-18, -39], [-27, -24]], color, 9);
    this.line(ctx, [[17, -39], [27, -32]], color, 9);
    this.circle(ctx, -5, -55, 2.2, ink); this.circle(ctx, 6, -55, 2.2, ink);
    this.line(ctx, [[-3, -46], [3, -46]], ink, 2);
    ctx.fillStyle = "#f6d879"; ctx.fillRect(-17, -26, 34, 5);
    if (shape === "hero" || shape === "warrior") {
      this.polygon(ctx, [[-16, -41], [-29, -9], [-7, -18]], shape === "hero" ? "#d64a48" : "#f09942");
      this.polygon(ctx, [[-17, -61], [-13, -72], [13, -72], [18, -61]], "#dde6e5");
      this.polygon(ctx, [[-7, -72], [0, -82], [7, -72]], color);
      this.line(ctx, [[27, -20], [34, -64]], "#e8f2f5", shape === "warrior" ? 10 : 7);
      this.line(ctx, [[22, -30], [38, -28]], "#b88634", 5);
      this.polygon(ctx, [[-32, -37], [-16, -37], [-17, -17], [-24, -10], [-33, -18]], "#f2cb65");
      this.line(ctx, [[-25, -32], [-25, -20]], color, 4);
    } else if (shape === "witch") {
      this.polygon(ctx, [[-24, -67], [1, -97], [19, -67]], color);
      this.line(ctx, [[-28, -66], [25, -66]], color, 8);
      this.line(ctx, [[28, -4], [30, -73]], "#725039", 6);
      this.circle(ctx, 30, -78, 9, "#f6ca65");
    } else if (shape === "fighter") {
      this.line(ctx, [[-16, -62], [17, -62], [30, -51]], "#fff4dc", 7);
      this.circle(ctx, -20, -66, 8, hair); this.circle(ctx, 20, -66, 8, hair);
      this.circle(ctx, -27, -25, 9, color); this.circle(ctx, 28, -34, 9, color);
    } else if (shape === "jester") {
      this.polygon(ctx, [[-18, -66], [-27, -85], [-4, -74], [17, -88], [19, -65]], color);
      this.circle(ctx, -27, -85, 5, "#ffe27b"); this.circle(ctx, 17, -88, 5, "#ffe27b");
      this.circle(ctx, 0, -51, 4, "#e86d65");
      this.circle(ctx, 32, -47, 8, "#f2ca60");
    } else if (shape === "thief") {
      this.polygon(ctx, [[-21, -56], [-15, -75], [3, -86], [22, -59], [11, -66], [-9, -66]], color);
      this.line(ctx, [[-13, -48], [13, -48]], color, 7);
      this.line(ctx, [[25, -27], [39, -56], [37, -76], [29, -82], [23, -73]], "#516576", 4);
    } else if (shape === "sage") {
      this.polygon(ctx, [[-18, -64], [-12, -88], [12, -88], [18, -64]], "#efe3ff");
      this.line(ctx, [[-12, -72], [12, -72]], color, 6);
      ctx.fillStyle = "#f9e9ad"; ctx.fillRect(-34, -39, 23, 25);
      this.line(ctx, [[-22, -38], [-22, -15]], color, 2);
      this.line(ctx, [[27, -5], [27, -65]], "#765041", 5);
      this.circle(ctx, 27, -71, 8, color);
    } else if (shape === "cleric") {
      this.polygon(ctx, [[-20, -62], [-17, -85], [0, -94], [17, -85], [20, -62]], "#fff5dd");
      this.polygon(ctx, [[0, -87], [6, -79], [0, -71], [-6, -79]], color);
      this.line(ctx, [[28, -7], [28, -63]], "#bd9b49", 5);
      ctx.strokeStyle = "#bd9b49"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(28, -72, 10, 0, Math.PI * 2); ctx.stroke();
    } else if (shape === "merchant") {
      this.line(ctx, [[-20, -69], [20, -69]], color, 9);
      this.polygon(ctx, [[-16, -71], [-10, -85], [13, -82], [17, -71]], color);
      ctx.fillStyle = "#c9904c"; ctx.fillRect(18, -29, 24, 28);
      this.line(ctx, [[23, -29], [23, -37], [36, -37], [36, -29]], ink, 3);
    }
    ctx.restore();
  },
  truck(ctx, x, ground) {
    if (Hop.Sprites?.drawTruck?.(ctx, x, ground)) return; // HD truck still when loaded (display only), else the Canvas truck
    ctx.save(); ctx.translate(x, ground); ctx.scale(1.12, 1.12);
    ctx.fillStyle = "#faf3da"; ctx.fillRect(-110, -91, 91, 70);
    ctx.fillStyle = "#e79748"; ctx.fillRect(-17, -72, 48, 51);
    ctx.fillStyle = "#a3dfed"; ctx.fillRect(-9, -65, 29, 24);
    ctx.fillStyle = "#687886"; ctx.fillRect(-112, -24, 149, 10);
    this.circle(ctx, -80, -12, 15, "#344655"); this.circle(ctx, 12, -12, 15, "#344655");
    this.circle(ctx, -80, -12, 6, "#e8e5d7"); this.circle(ctx, 12, -12, 6, "#e8e5d7");
    ctx.fillStyle = "#fff8ba"; ctx.fillRect(24, -35, 9, 8); ctx.restore();
  },
  contactEffect(ctx, type, x, y, age) {
    const color = Hop.CAST[type]?.color || "#8d622f";
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = Math.max(0, 1 - age / 0.65);
    if (type === "BOOST") {
      const rays = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; const r = i % 2 ? 25 : 58; return [Math.cos(a) * r, Math.sin(a) * r]; });
      this.polygon(ctx, rays, "#ffd05d");
    } else if (type === "BRAKE") this.line(ctx, [[-70, 30], [0, 0], [70, -55]], color, 5);
    else if (type === "GUARD" || type === "STOPPER") {
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 40 + age * 40, 0, Math.PI * 2); ctx.stroke();
    } else if (type === "ANGLE") {
      ctx.font = "bold 65px system-ui"; ctx.fillStyle = color; ctx.fillText("?!", -22, 0);
    } else {
      const up = type === "BOUNCE";
      for (let i = -1; i <= 1; i++) this.line(ctx, up ? [[i * 20, 35], [i * 20 + 15, -45]] : [[-80, i * 18], [35, i * 18]], color, 6);
    }
    ctx.restore();
  },
  // Display-only: flashy SPECIAL cut-in progress (pure). age = total - remaining.
  // Returns wipe/slide/pops/shake/flash/ray phase for drawing; never mutates game.
  specialCutinStyle(age, reducedMotion = false, strong = false) {
    const c = Hop.CONFIG, total = c.specialCutinDuration;
    const idle = { visible: false, alpha: 0, wipe: 0, slide: 0, portraitPop: 1, titlePop: 1, shakeX: 0, shakeY: 0, flash: 0, raySpin: 0, spark: 0 };
    if (!(age >= 0) || age >= total) return idle;
    if (reducedMotion) {
      return age < c.specialCutinReducedDuration
        ? { ...idle, visible: true, alpha: 1, wipe: 1, portraitPop: 1, titlePop: 1 }
        : idle;
    }
    const impactT = c.specialCutinImpact, wipeT = c.specialCutinWipe;
    const holdEnd = impactT + wipeT + c.specialCutinHold;
    const easeOut = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
    const easeOutBack = t => { t = Math.max(0, Math.min(1, t)); return 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2; };
    let alpha = 1, wipe = 1, slide = 0, portraitPop = 1, titlePop = 1, flash = 0, shakeX = 0, shakeY = 0;
    const shakeMul = strong ? 1.55 : 1;
    const flashMul = strong ? 1.25 : 1;
    if (age < impactT) {
      const u = age / impactT;
      flash = (1 - u) * c.specialCutinFlashPeak * flashMul;
      const amp = (1 - u) * c.specialCutinShakePx * shakeMul;
      shakeX = Math.sin(age * 90) * amp;
      shakeY = Math.cos(age * 110) * amp * 0.65;
      wipe = 0.15 + 0.2 * u;
      slide = 1 - u * 0.4;
      portraitPop = c.specialCutinPortraitPop;
      titlePop = c.specialCutinTitlePop;
    } else if (age < impactT + wipeT) {
      const u = (age - impactT) / wipeT;
      wipe = 0.35 + 0.65 * easeOut(u);
      slide = (1 - easeOut(u)) * 0.55;
      portraitPop = c.specialCutinPortraitPop - (c.specialCutinPortraitPop - 1) * easeOutBack(u);
      titlePop = c.specialCutinTitlePop - (c.specialCutinTitlePop - 1) * easeOut(Math.min(1, u * 1.2));
      flash = Math.max(0, (1 - u) * 0.2 * flashMul);
    } else if (age <= holdEnd) {
      wipe = 1; slide = 0; portraitPop = 1; titlePop = 1;
      // Soft idle pulse on rays only (spark/raySpin below).
    } else {
      const fadeT = Math.max(1e-6, total - holdEnd);
      alpha = Math.max(0, 1 - (age - holdEnd) / fadeT);
      wipe = 1;
    }
    return {
      visible: alpha > 0.01, alpha, wipe, slide, portraitPop, titlePop, shakeX, shakeY, flash,
      raySpin: age * (strong ? 2.8 : 2.1), spark: age * 6.5
    };
  },
  // Flashy fighting-game cut-in. Reads game.specialCutin only; never mutates game.
  specialCutin(ctx, g, visual) {
    const cut = g.specialCutin; if (!cut) return;
    const c = Hop.CONFIG, age = cut.total - cut.remaining;
    const style = this.specialCutinStyle(age, !!visual?.reducedMotion, !!cut.strong);
    if (!style.visible) return;
    const bandH = c.specialCutinBandHeight, bandY = (c.height - bandH) / 2;
    const accent = cut.strong ? "#e8c45a" : (Hop.CAST[cut.castId]?.color || "#674488");
    const slidePx = style.slide * (c.width * 0.42);
    ctx.save();
    ctx.translate(style.shakeX, style.shakeY);
    // Impact white flash (screen-wide).
    if (style.flash > 0.01) {
      ctx.globalAlpha = Math.min(1, style.flash);
      ctx.fillStyle = cut.strong ? "#fff6c0" : "#ffffff";
      ctx.fillRect(-20, -20, c.width + 40, c.height + 40);
    }
    // Speed lines / rays behind the band.
    if (!visual?.reducedMotion && style.wipe > 0.2) {
      ctx.save();
      ctx.globalAlpha = style.alpha * (cut.strong ? 0.55 : 0.38) * Math.min(1, style.wipe);
      ctx.translate(c.width * 0.5, bandY + bandH * 0.5);
      for (let i = 0; i < c.specialCutinRayCount; i++) {
        const a = style.raySpin + i * Math.PI * 2 / c.specialCutinRayCount;
        const len = 220 + (i % 3) * 90;
        ctx.rotate(a);
        ctx.fillStyle = cut.strong ? "#ffe9a0" : accent;
        ctx.fillRect(40, -3 - (i % 2), len, 2 + (i % 3));
        ctx.rotate(-a);
      }
      ctx.restore();
    }
    // Diagonal wipe clip for the band.
    const wipeX = -80 + style.wipe * (c.width + 160);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-40 + style.shakeX, bandY - 30);
    ctx.lineTo(wipeX, bandY - 30);
    ctx.lineTo(wipeX - 70, bandY + bandH + 30);
    ctx.lineTo(-40, bandY + bandH + 30);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = style.alpha * 0.78;
    ctx.fillStyle = cut.strong ? "#2a2010" : "#1a1520";
    ctx.fillRect(-20, bandY, c.width + 40, bandH);
    // Accent stripes
    ctx.globalAlpha = style.alpha;
    ctx.fillStyle = accent;
    ctx.fillRect(0, bandY, 18, bandH);
    ctx.fillRect(0, bandY, c.width, 8);
    ctx.fillRect(0, bandY + bandH - 8, c.width, 8);
    // Diagonal slash highlight
    ctx.save();
    ctx.globalAlpha = style.alpha * 0.35;
    ctx.translate(c.width * 0.55 - slidePx, bandY + bandH * 0.5);
    ctx.rotate(-0.35);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-c.width, -10, c.width * 2, 20);
    ctx.restore();
    // Sparks along the wipe edge
    if (!visual?.reducedMotion) {
      ctx.globalAlpha = style.alpha * 0.9;
      for (let i = 0; i < c.specialCutinSparkCount; i++) {
        const t = (i / c.specialCutinSparkCount + style.spark * 0.02) % 1;
        const sx = wipeX - 40 - t * 30;
        const sy = bandY + 20 + (i * 97) % (bandH - 40);
        const r = 2 + (i % 4);
        this.circle(ctx, sx, sy, r, i % 2 ? accent : "#fff4c8");
      }
    }
    // Portrait with pop scale
    const px = 210 - slidePx, feet = bandY + bandH - 16;
    {
      const layer = Hop.Sprites?.castLayer?.(cut.castId, 0);
      const base = (layer?.scale || 1.25) * c.specialCutinPortraitScale * style.portraitPop;
      let drawn = false;
      if (layer?.asset?.ready) {
        if (layer.flip) {
          ctx.save();
          try { ctx.translate(px, 0); ctx.scale(-1, 1); drawn = !!Hop.Sprites.draw(ctx, layer.asset, 0, 0, feet, base); }
          finally { ctx.restore(); }
        } else drawn = !!Hop.Sprites.draw(ctx, layer.asset, 0, px, feet, base);
      }
      if (!drawn) this.character(ctx, cut.castId, px, feet, 1.25 * c.specialCutinPortraitScale * 0.55 * style.portraitPop);
    }
    // Titles with pop
    const tx = 420 - slidePx * 0.35;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.save();
    ctx.translate(tx, bandY + 58);
    ctx.scale(style.titlePop, style.titlePop);
    ctx.fillStyle = "#fff8e8"; ctx.font = "bold 28px system-ui";
    ctx.fillText(cut.merchantType ? "MERCHANT SPECIAL" : "SPECIAL", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(tx, bandY + 128);
    ctx.scale(style.titlePop, style.titlePop);
    ctx.fillStyle = accent; ctx.font = "bold 56px system-ui";
    ctx.fillText(cut.name, 0, 0);
    ctx.restore();
    ctx.globalAlpha = style.alpha;
    ctx.fillStyle = "#f0e6d4"; ctx.font = "bold 26px system-ui";
    const sub = cut.merchantType ? `Type ${cut.merchantType} / ${cut.castName}` : `${cut.castName} · ${cut.type}`;
    ctx.fillText(sub, tx, bandY + 178);
    ctx.restore(); // wipe clip
    ctx.restore(); // shake
  },
  draw(ctx, g, visual) {
    const c = Hop.CONFIG, ground = c.groundY + g.cameraY;
    const sx = x => c.launchX + x - g.cameraX;
    const sy = y => ground - c.playerRadius - y;
    ctx.fillStyle = "#bce9f3"; ctx.fillRect(0, 0, c.width, c.height);
    this.circle(ctx, 1080, 115, 49, "#fff1ad");
    for (let i = -1; i < 5; i++) {
      const x = i * 380 - (g.cameraX * 0.12 % 380), y = 115 + (i % 2) * 60;
      this.circle(ctx, x, y, 26, "#f5fcf6"); this.circle(ctx, x + 30, y - 12, 35, "#f5fcf6"); this.circle(ctx, x + 65, y, 25, "#f5fcf6");
    }
    for (let i = -1; i < 5; i++) {
      const x = i * 440 - (g.cameraX * 0.25 % 440);
      this.polygon(ctx, [[x - 150, ground], [x + 80, ground - 155], [x + 310, ground]], "#95c99c");
    }
    ctx.fillStyle = "#82b973"; ctx.fillRect(0, ground, c.width, Math.max(0, c.height - ground));
    ctx.fillStyle = "#dfc693"; ctx.fillRect(0, ground + 10, c.width, 67);
    this.line(ctx, [[0, ground], [c.width, ground]], "#4b8855", 5);
    const spacing = c.markerMeters * c.pixelsPerMeter;
    const first = Math.max(0, Math.floor((g.cameraX - c.launchX) / spacing));
    ctx.font = "bold 21px system-ui";
    for (let i = first; sx(i * spacing) < c.width; i++) {
      const x = sx(i * spacing);
      this.line(ctx, [[x, ground + 13], [x, ground + 35]], "#867650", 3);
      ctx.fillStyle = "#4f573e"; ctx.fillText(`${i * c.markerMeters} m`, x + 9, ground + 54);
    }
    const prelaunch = ["READY", "AIM_ANGLE", "AIM_POWER"].includes(g.state);
    const launchAge = g.phaseTime - visual.launchAt;
    if (prelaunch || launchAge < 0.5) {
      const offset = g.state === "READY" ? -55 : g.state === "AIM_ANGLE" ? -44 + Math.min(6, g.phaseTime * 12) : -32;
      this.truck(ctx, sx(0) + (prelaunch ? offset : -20), ground);
    }
    for (const object of g.objects) {
      const ox = sx(object.x); if (ox < -120 || ox > c.width + 120) continue;
      ctx.save(); ctx.globalAlpha = object.used ? 0.35 : 1;
      // Phase C: CAST sprite when loaded, else the Canvas figure (same feet point; alpha above applies).
      if (!Hop.Sprites?.drawCast?.(ctx, object.type, ox, ground, object.used ? 1 : 0)) this.character(ctx, object.type, ox, ground, 1.365, object.used ? 1 : 0);
      ctx.textAlign = "center"; ctx.font = "bold 25px system-ui";
      ctx.fillStyle = "#fff9e9"; ctx.fillRect(ox - 59, ground - 173, 118, 32);
      ctx.fillStyle = this.objectColor(object.type); ctx.fillText(Hop.CAST[object.type].name, ox, ground - 148);
      const ready = visual.readyTargets?.find(target => target.object === object);
      if (ready) {
        ctx.font = "bold 27px system-ui";
        ctx.fillStyle = ready.label === "MERCHANT" ? "#754615" : "#674488";
        ctx.fillRect(ox - 85, ground - 211, 170, 34);
        ctx.fillStyle = "#fffdf2"; ctx.fillText(ready.label, ox, ground - 185);
      }
      ctx.restore();
    }
    g.trail.forEach((point, i) => {
      ctx.globalAlpha = i / g.trail.length * (g.successVisual?.strong ? 0.95 : g.specialTrail > 0 ? 0.75 : 0.25);
      this.circle(ctx, sx(point.x), sy(point.y), 4 + i / 4, "#e99c40");
    }); ctx.globalAlpha = 1;
    const x = sx(g.body.x), y = sy(g.body.y);
    if (g.contact && !visual.reducedMotion) this.contactEffect(ctx, g.contact.label.split(" ")[0], x, y, g.phaseTime - visual.contactAt);
    if (g.effect) {
      ctx.save(); ctx.globalAlpha = g.effect.remaining / c.effectDuration;
      this.line(ctx, [[x - 28, y + 20], [x - 12, y + (g.effect.label.endsWith("UP") ? -30 : 55)]], "#277ca5", 6); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y);
    // GROUND_BOUNCE plays upright (tilt weight 0) and the tilt eases back afterwards.
    const tilt = Hop.Sprites?.tiltWeight ? Hop.Sprites.tiltWeight(visual, g.phaseTime) : 1;
    if (g.state === "FLYING" && !visual.reducedMotion && tilt > 0) ctx.rotate(Math.max(-0.7, Math.min(0.7, -g.body.vy / 1200)) * tilt);
    // Same foot anchor and rotation as the silhouette; physics stays untouched.
    // phaseTime shares the game's pause/hidden-tab handling (no wall-clock jump).
    // Stopped on the ground (FLYING or RESULT): STOP_RESULT. FLYING order: one-shot (priority
    // table) -> FLIGHT_LOOP; RESULT without STOP_RESULT: frozen FLIGHT_LOOP. READY / AIM: HD IDLE
    // still when loaded. Else -> Canvas HERO. Feet at playerRadius; physics untouched.
    const drawLayer = layer => Hop.Sprites.draw(ctx, layer.asset, layer.time, 0, c.playerRadius, layer.scale);
    const spriteDrawn = !!Hop.Sprites?.stopLayers?.(visual, g.phaseTime).some(drawLayer) ||
      ((g.state === "FLYING" || g.state === "RESULT") && !!Hop.Sprites?.heroLayers(visual, g.phaseTime, g.state).some(drawLayer)) ||
      (prelaunch && !!Hop.Sprites?.idleLayers?.().some(drawLayer));
    if (!spriteDrawn) this.character(ctx, "HERO", 0, c.playerRadius, 0.936);
    ctx.restore();
    if (g.normalGuard || g.guardSpecial.active) { ctx.strokeStyle = g.guardSpecial.active ? "#e8b936" : "#9970cc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 12, g.guardSpecial.active ? 48 : 39, 0, Math.PI * 2); ctx.stroke(); }
    if (g.successVisual?.strong && !visual.reducedMotion) {
      const age = c.stopperTrailDuration - g.successVisual.remaining;
      ctx.save(); ctx.globalAlpha = g.successVisual.remaining / c.stopperTrailDuration;
      ctx.strokeStyle = "#fff6c0"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(x, y, 55 + age * 110, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (g.merchantVisual) {
      // Merchant is an overlay participant, never a generated collision object.
      const mx = Math.max(90, Math.min(c.width - 100, x + 105));
      if (!Hop.Sprites?.drawCast?.(ctx, "SPECIAL_ONLY", mx, y + 20)) this.character(ctx, "SPECIAL_ONLY", mx, y + 20, 1.25);
      const lift = visual.reducedMotion ? 25 : 25 + (1 - Math.min(1, g.merchantVisual.remaining / c.specialMessageDuration)) * 20;
      this.circle(ctx, mx + 35, y - lift, 12, "#ffd867");
      ctx.font = "bold 23px system-ui"; ctx.fillStyle = "#654417";
      ctx.fillText(`Type ${g.merchantVisual.type}`, mx - 30, y - 110);
    }
    if (g.merchant?.type === "C") this.line(ctx, [[x - 45, y + 23], [x + 40, y + 23]], "#bc7641", 8);
    if (g.effect?.label === "BOUND BOOST") {
      ctx.strokeStyle = "#e4a542"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 47, 0, Math.PI * 2); ctx.stroke();
    }
    if (prelaunch) {
      const a = -g.angle * Math.PI / 180;
      ctx.save(); ctx.translate(x, y - 25); ctx.rotate(a);
      this.line(ctx, [[35, 0], [145, 0], [125, -12]], "#315c78", 5); this.line(ctx, [[145, 0], [125, 12]], "#315c78", 5); ctx.restore();
      if (g.state === "AIM_POWER") { ctx.font = "bold 38px system-ui"; ctx.fillStyle = "#9c442f"; ctx.fillText("!", x - 10, y - 95); }
    }
    if (!visual.reducedMotion && launchAge >= 0 && launchAge < 0.18) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - launchAge / 0.18)})`; ctx.fillRect(0, 0, c.width, c.height);
      this.contactEffect(ctx, "BOOST", sx(0), sy(0), launchAge);
    }
    if (g.flash > 0 && !visual.reducedMotion) { ctx.fillStyle = g.successVisual?.strong ? `rgba(255,250,210,${0.55 * g.flash / c.stopperFlashDuration})` : `rgba(255,255,245,${0.22 * g.flash / c.specialFlashDuration})`; ctx.fillRect(0, 0, c.width, c.height); }
    // SPECIAL success cut-in above the world / flash; DOM special-panel stays separate.
    this.specialCutin(ctx, g, visual);
  },
  objectColor(type) { return Hop.CAST[type]?.color || "#304c60"; }
};
