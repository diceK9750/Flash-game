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
  // Display-only: early ToE/Destiny2/Symphonia-feel band cut-in progress (pure). age = total - remaining.
  // Short flash → band wipe across → hold → fade. Original geometry — not a frame copy. Never mutates game.
  specialCutinStyle(age, reducedMotion = false, strong = false) {
    const c = Hop.CONFIG, total = c.specialCutinDuration;
    const idle = { visible: false, alpha: 0, wipe: 0, portraitPop: 1, shakeX: 0, shakeY: 0, flash: 0 };
    if (!(age >= 0) || age >= total) return idle;
    if (reducedMotion) {
      return age < c.specialCutinReducedDuration
        ? { ...idle, visible: true, alpha: 1, wipe: 1, portraitPop: 1 }
        : idle;
    }
    const impactT = c.specialCutinImpact, wipeT = c.specialCutinWipe;
    const holdEnd = impactT + wipeT + c.specialCutinHold;
    const easeOut = t => 1 - (1 - Math.max(0, Math.min(1, t))) ** 3;
    const shakeMul = strong ? 1.35 : 1, flashMul = strong ? 1.25 : 1;
    let alpha = 1, wipe = 1, portraitPop = 1, flash = 0, shakeX = 0, shakeY = 0;
    if (age < impactT) {
      const u = age / Math.max(1e-6, impactT);
      flash = (1 - u * 0.4) * c.specialCutinFlashPeak * flashMul;
      const amp = (1 - u) * c.specialCutinShakePx * shakeMul;
      shakeX = Math.sin(age * 90) * amp; shakeY = Math.cos(age * 110) * amp * 0.6;
      wipe = 0.08 + 0.2 * u; portraitPop = c.specialCutinPortraitPop;
    } else if (age < impactT + wipeT) {
      const u = (age - impactT) / wipeT;
      wipe = 0.28 + 0.72 * easeOut(u);
      portraitPop = c.specialCutinPortraitPop - (c.specialCutinPortraitPop - 1) * easeOut(u);
      flash = Math.max(0, (1 - u) * 0.18 * flashMul);
      const amp = (1 - u) * c.specialCutinShakePx * 0.25 * shakeMul;
      shakeX = Math.sin(age * 60) * amp; shakeY = Math.cos(age * 70) * amp * 0.5;
    } else if (age <= holdEnd) {
      wipe = 1; portraitPop = 1;
    } else {
      const fadeT = Math.max(1e-6, total - holdEnd);
      const u = (age - holdEnd) / fadeT;
      alpha = Math.max(0, 1 - u); wipe = 1;
    }
    return { visible: alpha > 0.01, alpha, wipe, portraitPop, shakeX, shakeY, flash };
  },
  // Display-only (pure): true while the cut-in covers the stage — until its fade-out starts, or for the
  // reducedMotion still. The SPECIAL SUCCESS panel waits for this (UI), so it never sits on the face.
  specialCutinCovering(cut, reducedMotion = false) {
    if (!cut) return false;
    const c = Hop.CONFIG, age = cut.total - cut.remaining;
    if (!(age >= 0)) return false;
    return age < (reducedMotion ? c.specialCutinReducedDuration : c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold);
  },
  // Early-Tales band insert (original) with decisive face close-up. Skill name at the edge.
  specialCutin(ctx, g, visual) {
    const cut = g.specialCutin; if (!cut) return;
    const c = Hop.CONFIG, age = cut.total - cut.remaining;
    const style = this.specialCutinStyle(age, !!visual?.reducedMotion, !!cut.strong);
    if (!style.visible) return;
    const accent = cut.strong ? "#e8c878" : (Hop.CAST[cut.castId]?.color || "#674488");
    const tilt = c.specialCutinBandTiltDeg * Math.PI / 180;
    const bandH = c.specialCutinBandHeight;
    const cy = c.height * 0.48;
    const reveal = Math.max(0.02, Math.min(1, style.wipe));
    const bandW = c.width * 1.15;
    ctx.save();
    ctx.globalAlpha = style.alpha;
    ctx.translate(style.shakeX, style.shakeY);
    // Modest dim (early inserts were brief overlays)
    ctx.fillStyle = cut.strong ? "rgba(36,28,10,0.28)" : "rgba(10,10,18,0.30)";
    ctx.fillRect(-20, -20, c.width + 40, c.height + 40);
    if (style.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, style.flash);
      ctx.fillStyle = cut.strong ? "#fff6d8" : "#ffffff";
      ctx.fillRect(-20, -20, c.width + 40, c.height + 40);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(c.width * 0.5, cy);
    ctx.rotate(-tilt);
    const hw = bandW / 2, hh = bandH / 2, skew = 36;
    // Wipe reveal left → right
    ctx.beginPath();
    ctx.rect(-hw - 4, -hh - 30, bandW * reveal + 8, bandH + 60);
    ctx.clip();
    // Opaque flat band (single-tone plate)
    ctx.beginPath();
    ctx.moveTo(-hw + skew, -hh); ctx.lineTo(hw + skew * 0.2, -hh);
    ctx.lineTo(hw - skew * 0.2, hh); ctx.lineTo(-hw - skew, hh);
    ctx.closePath();
    ctx.fillStyle = cut.strong ? "#5a4218" : "#241830";
    ctx.fill();
    // Accent duotone wash on the plate (solid, not translucent over the stage)
    ctx.save();
    ctx.clip();
    const wash = ctx.createLinearGradient(0, -hh, 0, hh);
    if (typeof wash?.addColorStop === "function") {
      wash.addColorStop(0, accent);
      wash.addColorStop(0.45, cut.strong ? "#8a6830" : "#3a2848");
      wash.addColorStop(1, cut.strong ? "#3a2a10" : "#181020");
      ctx.fillStyle = wash;
    } else ctx.fillStyle = accent;
    ctx.globalAlpha = style.alpha * 0.85;
    ctx.fillRect(-hw - skew, -hh, bandW + skew * 2, bandH + 4);
    // Decisive face close-up (CUTIN_FACE plate) filling the band — not full-body.
    ctx.globalAlpha = style.alpha;
    {
      const face = Hop.Sprites?.cutinFaceLayer?.(cut.castId);
      const fall = !face ? Hop.Sprites?.castLayer?.(cut.castId, 0) : null;
      let drawn = false;
      if (face?.asset?.ready) {
        // Drawn height = FaceFill x band height (Sprites.draw: on-screen height = 96 x scale); centre pivot.
        const scale = (face.scale || 1) * bandH * c.specialCutinFaceFill / 96 * style.portraitPop;
        drawn = !!Hop.Sprites.draw(ctx, face.asset, 0, c.width * (c.specialCutinFaceCenterX - 0.5), 0, scale);
      } else if (fall?.asset?.ready) {
        const feetY = hh - 14;
        const scale = (fall.scale || 1.25) * c.specialCutinPortraitScale * style.portraitPop;
        if (fall.flip) {
          ctx.save();
          try { ctx.scale(-1, 1); drawn = !!Hop.Sprites.draw(ctx, fall.asset, 0, 0, feetY, scale); }
          finally { ctx.restore(); }
        } else drawn = !!Hop.Sprites.draw(ctx, fall.asset, 0, 0, feetY, scale);
      }
      if (!drawn) this.character(ctx, cut.castId, 0, hh * 0.35, 1.6 * style.portraitPop);
      // Soft plate wash (keep face readable)
      ctx.globalAlpha = style.alpha * (cut.strong ? 0.12 : 0.14);
      ctx.fillStyle = cut.strong ? "#ffe9a0" : accent;
      ctx.fillRect(-hw - skew, -hh, bandW + skew * 2, bandH + 4);
    }
    ctx.restore();
    // Thin rim
    ctx.globalAlpha = style.alpha;
    ctx.strokeStyle = cut.strong ? "#f0d890" : "#f5eef8";
    ctx.lineWidth = cut.strong ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(-hw + skew, -hh); ctx.lineTo(hw + skew * 0.2, -hh);
    ctx.lineTo(hw - skew * 0.2, hh); ctx.lineTo(-hw - skew, hh);
    ctx.closePath(); ctx.stroke();
    ctx.restore(); // band transform + wipe
    // Skill name rides the band's right end, over the edge of the face (slides in with the wipe).
    const nameX = c.width * (c.specialCutinNameX - (1 - reveal) * c.specialCutinNameSlide);
    const nameY = cy + bandH * c.specialCutinNameY;
    ctx.save();
    ctx.translate(nameX, nameY);
    ctx.rotate(-tilt * 0.55);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 11;
    ctx.strokeStyle = cut.strong ? "#4a3010" : "#141018";
    ctx.fillStyle = cut.strong ? "#ffe9a8" : "#fff6ee";
    ctx.font = `bold ${c.specialCutinNameSize}px system-ui`;
    ctx.strokeText(cut.name, 0, 0); ctx.fillText(cut.name, 0, 0);
    ctx.restore();
    // Cast / SPECIAL — subdued, above band
    ctx.globalAlpha = style.alpha * 0.85;
    ctx.textAlign = "left";
    ctx.font = "bold 18px system-ui";
    ctx.fillStyle = "#efe8f6";
    const tag = cut.merchantType ? `MERCHANT · Type ${cut.merchantType}` : `${cut.castName}`;
    ctx.fillText(tag, c.width * 0.06, cy - bandH * 0.5 - 22);
    ctx.font = "bold 14px system-ui";
    ctx.fillStyle = accent;
    ctx.fillText(cut.merchantType ? "MERCHANT SPECIAL" : "SPECIAL", c.width * 0.06, cy - bandH * 0.5 - 4);
    ctx.restore();
  },
  draw(ctx, g, visual) {
    const c = Hop.CONFIG, ground = c.groundY + g.cameraY;
    const sx = x => c.launchX + x - g.cameraX;
    const sy = y => ground - c.playerRadius - y;
    // Combo scene (display only): one state per frame; screen shake wraps the world, not the cut-in.
    const combo = this.comboState(g), impact = this.comboImpact(combo, !!visual?.reducedMotion);
    ctx.fillStyle = "#bce9f3"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.save(); ctx.translate(impact.x, impact.y);
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
      // Combo actors are drawn by comboBack; they fade back in place during the afterglow.
      const actor = combo && (object === combo.source || object === combo.partner);
      if (actor && combo.after === null) continue;
      ctx.save(); ctx.globalAlpha = (object.used ? 0.35 : 1) * (actor ? Math.min(1, combo.after / combo.afterTotal) : 1);
      // Phase C: CAST sprite when loaded, else the Canvas figure (same feet point; alpha above applies).
      if (!Hop.Sprites?.drawCast?.(ctx, object.type, ox, ground, object.used ? 1 : 0)) this.character(ctx, object.type, ox, ground, 1.365, object.used ? 1 : 0);
      ctx.textAlign = "center"; ctx.font = "bold 25px system-ui";
      ctx.fillStyle = "#fff9e9"; ctx.fillRect(ox - 59, ground - 173, 118, 32);
      ctx.fillStyle = this.objectColor(object.type); ctx.fillText(Hop.CAST[object.type].name, ox, ground - 148);
      const ready = visual.readyTargets?.find(target => target.object === object);
      if (ready) {
        ctx.font = "bold 27px system-ui";
        ctx.fillStyle = ready.label.startsWith("MERCHANT") ? "#754615" : "#674488";
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
    if (combo) this.comboBack(ctx, combo, sx, sy, ground);
    const comboHero = combo && combo.after === null ? this.comboActors(combo).hero : null;
    if (g.contact && !visual.reducedMotion) this.contactEffect(ctx, g.contact.label.split(" ")[0], x, y, g.phaseTime - visual.contactAt);
    if (g.effect) {
      ctx.save(); ctx.globalAlpha = g.effect.remaining / c.effectDuration;
      this.line(ctx, [[x - 28, y + 20], [x - 12, y + (g.effect.label.endsWith("UP") ? -30 : 55)]], "#277ca5", 6); ctx.restore();
    }
    ctx.save(); ctx.translate(x + (comboHero?.dx || 0), y + (comboHero?.dy || 0));
    // GROUND_BOUNCE plays upright (tilt weight 0) and the tilt eases back afterwards.
    const tilt = Hop.Sprites?.tiltWeight ? Hop.Sprites.tiltWeight(visual, g.phaseTime) : 1;
    if (g.state === "FLYING" && !visual.reducedMotion && tilt > 0 && !comboHero) ctx.rotate(Math.max(-0.7, Math.min(0.7, -g.body.vy / 1200)) * tilt);
    // Same foot anchor and rotation as the silhouette; physics stays untouched.
    // phaseTime shares the game's pause/hidden-tab handling (no wall-clock jump).
    // Stopped on the ground (FLYING or RESULT): STOP_RESULT. FLYING order: one-shot (priority
    // table) -> FLIGHT_LOOP; RESULT without STOP_RESULT: frozen FLIGHT_LOOP. READY / AIM: HD IDLE
    // still when loaded. Else -> Canvas HERO. Feet at playerRadius; physics untouched.
    const drawLayer = layer => Hop.Sprites.draw(ctx, layer.asset, layer.time, 0, c.playerRadius, layer.scale);
    const spriteDrawn = (comboHero?.hit && !!Hop.Sprites?.drawHeroHit?.(ctx, 0, c.playerRadius)) || !!Hop.Sprites?.stopLayers?.(visual, g.phaseTime).some(drawLayer) ||
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
    if (combo) this.comboFront(ctx, combo, sx, sy, ground);
    ctx.restore(); // screen shake
    if (impact.flash > 0) { ctx.fillStyle = `rgba(255,255,250,${impact.flash})`; ctx.fillRect(0, 0, c.width, c.height); }
    if (g.flash > 0 && !visual.reducedMotion) { ctx.fillStyle = g.successVisual?.strong ? `rgba(255,250,210,${0.55 * g.flash / c.stopperFlashDuration})` : `rgba(255,255,245,${0.22 * g.flash / c.specialFlashDuration})`; ctx.fillRect(0, 0, c.width, c.height); }
    // SPECIAL success cut-in above the world / flash; DOM special-panel stays separate.
    this.specialCutin(ctx, g, visual);
  },
  // ---- Combo SPECIAL scenes (display only; never mutate game) -------------------------------------------
  // Scene clock (pure). live = g.combo (scene time t = elapsed - S, S = cut-in fade start; negative while the
  // cut-in still covers the stage), after = g.comboAfter (final tableau, then the afterglow age `after`).
  comboSceneStart(short) { const c = Hop.CONFIG; return short ? c.specialCutinReducedDuration : c.specialCutinImpact + c.specialCutinWipe + c.specialCutinHold; },
  comboState(g) {
    const live = g?.combo, after = live ? null : g?.comboAfter, k = live || after;
    if (!k || (k.type !== "BOOST" && k.type !== "BOUNCE")) return null;
    const S = this.comboSceneStart(k.short), c = Hop.CONFIG;
    const full = k.short ? c.comboReducedDuration : k.type === "BOOST" ? c.comboWitchDuration : c.comboFighterDuration;
    const end = full - S, afterAge = after ? Math.max(0, after.total - after.remaining) : null;
    return { type: k.type, short: !!k.short, t: live ? live.elapsed - S : end, end, after: afterAge, afterTotal: after ? after.total : 0,
      heroWX: k.heroX, heroY: k.heroY, source: k.source, partner: k.partner, skipped: !!k.skipped };
  },
  ease(u) { u = Math.max(0, Math.min(1, u)); return 1 - (1 - u) ** 3; },
  // Uniform growth of the giant fighter (pure): 1 until the buff ends, then comboFighterSteps eased steps
  // (small overshoot) up to comboFighterScale at growEnd.
  comboFighterScale(t) {
    const c = Hop.CONFIG, T = c.comboFighterTimes, n = c.comboFighterSteps, max = c.comboFighterScale;
    if (!(t >= T.buffEnd)) return 1;
    if (t >= T.growEnd) return max;
    const span = (T.growEnd - T.buffEnd) / n, k = Math.min(n - 1, Math.floor((t - T.buffEnd) / span)), u = (t - T.buffEnd - k * span) / span;
    const from = 1 + (max - 1) * k / n, to = 1 + (max - 1) * (k + 1) / n, x = Math.min(1, u / 0.45) - 1;
    return from + (to - from) * (1 + 2.70158 * x ** 3 + 1.70158 * x ** 2);
  },
  // Actor placements in world x / pose / scale for a scene time (pure). Used by the drawing and by tests.
  comboActors(st) {
    const c = Hop.CONFIG, H = st.heroWX, t = st.t, lerp = (a, b, u) => a + (b - a) * this.ease(u);
    const src = st.source?.x ?? H, par = st.partner?.x ?? H + 500;
    const out = { hero: { dx: 0, dy: 0, hit: t >= 0 }, witch: null, fighter: null };
    if (st.type === "BOOST") {
      const W = c.comboWitchTimes, hits = c.comboWitchHits, step = (W.rushEnd - W.dash) / hits;
      out.witch = { x: st.short && t >= 0 ? H - 120 : lerp(src, H - 120, t / W.dash), pose: st.short ? (t >= 0 ? 1 : 0) : t >= W.liftEnd - 0.05 ? 1 : 0, flip: false, scale: 1 };
      if (st.short) {
        out.fighter = t >= 0 ? { x: H + 75, pose: 1, flip: true, scale: 1, rotate: 0 } : { x: par, pose: 0, flip: true, scale: 1, rotate: 0 };
        out.hits = t >= 0 ? hits : 0; out.hero.dy = 0; return out;
      }
      if (t < W.dash) out.fighter = { x: lerp(par, H + 75, t / W.dash), pose: 0, flip: true, scale: 1, rotate: 0, dash: Math.max(0, t) / W.dash };
      else if (t < W.rushEnd) {
        const k = Math.min(hits - 1, Math.floor((t - W.dash) / step)), u = (t - W.dash - k * step) / step, right = Math.floor(k / 2) % 2 === 0;
        out.fighter = { x: H + (right ? 1 : -1) * (75 - 14 * (1 - u)), pose: k % 3 === 2 ? 0 : 1, flip: right, scale: 1, rotate: 0, ghost: k > 0 && k % 2 === 0 ? (right ? -1 : 1) : 0, ghostU: u };
        out.hits = k + 1; out.hitU = u;
        out.hero.dx = Math.sin(t * 73) * 4; out.hero.dy = Math.cos(t * 59) * 3;
      } else {
        const u = (t - W.rushEnd) / (W.liftEnd - W.rushEnd);
        out.fighter = { x: t < W.liftEnd ? H - 30 : lerp(H - 30, H - 170, (t - W.liftEnd) / 0.2), pose: 1, flip: false, scale: 1, rotate: -0.95 * this.ease(u * 1.6) };
        out.hits = hits; out.finish = true;
        out.hero.dy = -c.comboWitchLiftPx * this.ease(u) + (t > W.liftEnd ? Math.sin((t - W.liftEnd) * 9) * 3 : 0);
      }
      return out;
    }
    const F = c.comboFighterTimes;
    out.fighter = { x: st.short && t >= 0 ? H - 150 : lerp(src, H - 150, t / F.arrive), pose: 0, flip: false, rotate: 0,
      scale: st.short ? (t >= 0 ? c.comboFighterScale : 1) : this.comboFighterScale(t) };
    const arrived = st.short ? t >= 0 : t >= F.arrive;
    out.witch = { x: st.short && t >= 0 ? H - 330 : lerp(par, H - 330, t / F.arrive), pose: arrived && (st.short || t < F.growEnd) ? 1 : 0, flip: !arrived, scale: 1 };
    if (st.short ? t >= 0 : t >= F.upper) { out.fighter.pose = 1; out.fighter.rotate = -0.45; }
    if (!st.short && t >= F.upper + F.hitstop) out.hero.dy = -c.comboFighterLiftPx * this.ease((t - F.upper - F.hitstop) / 0.18);
    if (!st.short && t >= F.growEnd && t < F.upper) out.fighter.charge = (t - F.growEnd) / (F.upper - F.growEnd);
    if (st.after !== null && !st.short) out.fighter.scale = 1 + (out.fighter.scale - 1) * (1 - this.ease(st.after / 0.35)); // back to normal size
    return out;
  },
  // Screen shake / white flash for the current frame (pure; 0 for the short version or reducedMotion).
  comboImpact(st, reducedMotion) {
    if (!st || st.short || reducedMotion) return { x: 0, y: 0, flash: 0 };
    const c = Hop.CONFIG, t = st.t + (st.after || 0);
    let amp = 0, flash = 0;
    if (st.type === "BOOST") {
      const W = c.comboWitchTimes, b = t - W.blast;
      if (b >= 0) { amp = c.comboShakePx * Math.max(0, 1 - b / 0.55); flash = Math.max(0, 0.85 - b * 2.6); }
      else if (t >= W.rushEnd && t < W.rushEnd + 0.12) amp = c.comboShakePx * 0.5;
      else if (t >= W.dash && t < W.rushEnd) amp = 1.5;
    } else {
      const F = c.comboFighterTimes, u = t - F.upper;
      if (u >= 0) { amp = c.comboShakePx * (u < F.hitstop ? 1.2 : Math.max(0, 1 - (u - F.hitstop) / 0.5)); flash = Math.max(0, 0.6 - u * 2.4); }
      else if (t >= F.buffEnd && t < F.growEnd) amp = 2.5;
      else if (t >= F.growEnd) amp = 1.5;
    }
    const s = Math.floor(t * 60);
    return { x: Math.sin(s * 2.3) * amp, y: Math.cos(s * 3.1) * amp * 0.7, flash };
  },
  comboCast(ctx, id, a, sx, ground, alpha = 1) {
    if (!a) return;
    const ok = Hop.Sprites?.drawCastScaled?.(ctx, id, sx(a.x), ground, a.pose, a.scale || 1, { flip: a.flip, rotate: a.rotate, alpha });
    if (!ok) { ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(sx(a.x), ground); if (a.rotate) ctx.rotate(a.rotate); if (a.flip) ctx.scale(-1, 1); this.character(ctx, id, 0, 0, 1.365 * (a.scale || 1), a.pose); ctx.restore(); }
  },
  spark(ctx, x, y, r, color, rot = 0) {
    const pts = Array.from({ length: 16 }, (_, i) => { const a = rot + i * Math.PI / 8, rr = i % 2 ? r * 0.38 : r; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; });
    this.polygon(ctx, pts, color);
  },
  // Behind the hero: magic circle, actors, afterimages, aura / rings.
  comboBack(ctx, st, sx, sy, ground) {
    const c = Hop.CONFIG, A = this.comboActors(st), t = st.t, fade = st.after === null ? 1 : Math.max(0, 1 - st.after / st.afterTotal);
    ctx.save(); ctx.globalAlpha = fade;
    if (st.type === "BOOST") {
      const W = c.comboWitchTimes, wx = sx(A.witch.x);
      if (st.short ? t >= 0 : t >= 0.15 && t < W.blast + 0.1) { // magic circle at the witch's feet
        const r = st.short ? 80 : 30 + 60 * this.ease((t - 0.15) / 0.5), rot = st.short ? 0 : t * 2.2;
        ctx.save(); ctx.translate(wx, ground - 2); ctx.scale(1, 0.32);
        ctx.strokeStyle = "rgba(255,170,60,0.9)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "rgba(255,230,140,0.95)"; ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const a = rot + i * Math.PI * 4 / 6; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,190,90,0.18)"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (!st.short) { // light motes gathering to the staff
          for (let i = 0; i < 18; i++) {
            const ph = (t * 1.3 + i / 18) % 1, a = i * 2.39, d = (1 - ph) * 150;
            ctx.globalAlpha = fade * Math.min(1, ph * 3) * 0.9;
            this.circle(ctx, wx + 28 + Math.cos(a) * d, ground - 120 + Math.sin(a) * d * 0.7, 3 + ph * 3, i % 3 ? "#ffe9a0" : "#ffb347");
          }
          ctx.globalAlpha = fade;
        }
      }
      this.comboCast(ctx, "BOOST", A.witch, sx, ground);
      const f = A.fighter;
      if (f.dash !== undefined && !st.short) for (let i = 3; i >= 1; i--) this.comboCast(ctx, "BOUNCE", { ...f, x: f.x + i * 55 }, sx, ground, 0.18 * (4 - i) * fade);
      if (f.ghost) this.comboCast(ctx, "BOUNCE", { ...f, x: st.heroWX + f.ghost * 75, flip: f.ghost > 0 }, sx, ground, 0.35 * (1 - f.ghostU) * fade);
      this.comboCast(ctx, "BOUNCE", f, sx, ground);
    } else {
      const F = c.comboFighterTimes, f = A.fighter, fx = sx(f.x), mid = ground - 70 * f.scale;
      if (st.short ? t >= 0 : t >= F.arrive) { // aura (pulsing) around the fighter
        const pulse = st.short ? 1 : 1 + 0.06 * Math.sin(t * 22);
        ctx.save(); ctx.globalAlpha = fade * (st.short ? 0.35 : Math.min(0.55, (t - F.arrive) * 1.5));
        ctx.fillStyle = f.charge ? "#ffef7a" : "#ffd0f0";
        ctx.beginPath(); ctx.ellipse(fx, mid, 55 * f.scale * pulse, 80 * f.scale * pulse, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (!st.short && t >= F.arrive && t < F.growEnd) { // rings of the buff spell
        for (let i = 0; i < 3; i++) {
          const ph = ((t - F.arrive) * 1.8 + i / 3) % 1;
          ctx.save(); ctx.globalAlpha = fade * (1 - ph); ctx.strokeStyle = "#ff8ad8"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(fx, mid, (30 + ph * 70) * f.scale, (12 + ph * 26) * f.scale, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      this.comboCast(ctx, "BOOST", A.witch, sx, ground);
      if (!st.short && t >= F.arrive && t < F.growEnd) { // sparkles from the staff to the fighter
        const wx = sx(A.witch.x) + 40, wy = ground - 110;
        for (let i = 0; i < 10; i++) { const ph = (t * 2 + i / 10) % 1; this.spark(ctx, wx + (fx - wx) * ph, wy + (mid - wy) * ph - Math.sin(ph * Math.PI) * 50, 7, "#fff1a8", t * 5 + i); }
      }
      const shake = f.charge ? Math.sin(t * 90) * 3 * (1 + f.charge) : 0;
      this.comboCast(ctx, "BOUNCE", { ...f, x: f.x + shake }, sx, ground);
      if (f.charge) { // speed lines into the fighter while charging
        ctx.save(); ctx.globalAlpha = fade * 0.7; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + t * 3, r1 = 260 - f.charge * 60, r2 = 170; ctx.beginPath(); ctx.moveTo(fx + Math.cos(a) * r1, mid + Math.sin(a) * r1); ctx.lineTo(fx + Math.cos(a) * r2, mid + Math.sin(a) * r2); ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.restore();
  },
  // In front of the hero: hit sparks, HIT counter, chant gauge, fireball / explosion, shockwave, labels.
  comboFront(ctx, st, sx, sy, ground) {
    const c = Hop.CONFIG, A = this.comboActors(st), t = st.t, fade = st.after === null ? 1 : Math.max(0, 1 - st.after / st.afterTotal);
    // Effects stay where the scene happened (world x / held height), even after the hero flies off.
    const heroX = sx(st.heroWX) + A.hero.dx, heroY = sy(st.heroY) + A.hero.dy;
    const label = (text, x, y, size, color, stroke = "#3b2357") => {
      ctx.save(); ctx.font = `italic 900 ${size}px system-ui`; ctx.textAlign = "center"; ctx.lineWidth = Math.max(4, size / 7); ctx.strokeStyle = stroke;
      ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
    };
    ctx.save(); ctx.globalAlpha = fade;
    if (st.type === "BOOST") {
      const W = c.comboWitchTimes, wx = sx(A.witch.x);
      if (A.hits && st.after === null) {
        if (!st.short && A.hitU !== undefined && A.hitU < 0.6) this.spark(ctx, heroX + (A.fighter.flip ? 22 : -22), heroY - 10 + ((A.hits * 37) % 30) - 15, 30 * (1 - A.hitU * 0.8), A.hits % 2 ? "#fff6b0" : "#ffd27a", A.hits);
        label(`${A.hits} HIT${A.hits >= c.comboWitchHits ? "!!" : ""}`, heroX + 120, heroY - 90, 40, "#ffe55c");
      }
      if (!st.short && t >= 0.15 && t < W.blast && st.after === null) { // chant gauge
        const g = Math.max(0, Math.min(1, (t - 0.15) / (W.rushEnd - 0.15)));
        ctx.fillStyle = "rgba(40,20,60,0.75)"; ctx.fillRect(wx - 60, ground - 205, 120, 14);
        ctx.fillStyle = g >= 1 ? "#ffe066" : "#ff9a3c"; ctx.fillRect(wx - 58, ground - 203, 116 * g, 10);
        label(g >= 1 ? "詠唱完了！" : "詠唱中…", wx, ground - 214, 24, "#fff4d6");
      }
      if (st.short && t >= 0) { this.circle(ctx, heroX, heroY, 70, "rgba(255,190,90,0.35)"); label("爆裂斜光", heroX, heroY - 110, 40, "#ffe55c"); }
      if (!st.short && t >= W.liftEnd && t < W.blast) { // fireball from the staff
        const u = this.ease((t - W.liftEnd) / (W.blast - W.liftEnd)), x0 = wx + 30, y0 = ground - 120;
        const x = x0 + (heroX - x0) * u, y = y0 + (heroY - y0) * u - Math.sin(u * Math.PI) * 60, r = 18 + 18 * u;
        const grad = ctx.createRadialGradient?.(x, y, 2, x, y, r * 1.6);
        if (grad) { grad.addColorStop(0, "#fffbe0"); grad.addColorStop(0.4, "#ffb13b"); grad.addColorStop(1, "rgba(255,80,20,0)"); ctx.fillStyle = grad; }
        else ctx.fillStyle = "#ff9a3c";
        ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      const b = t + (st.after || 0) - W.blast;
      if (!st.short && b >= 0 && b < 1.0) { // big explosion at the lifted hero
        const R = 40 + 200 * this.ease(b / 0.45), a = Math.max(0, 1 - b / 0.9);
        ctx.save(); ctx.globalAlpha = a;
        const grad = ctx.createRadialGradient?.(heroX, heroY, 4, heroX, heroY, R);
        if (grad) { grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.35, "#ffe27a"); grad.addColorStop(0.7, "#ff7a22"); grad.addColorStop(1, "rgba(200,40,10,0)"); ctx.fillStyle = grad; }
        else ctx.fillStyle = "#ffb13b";
        ctx.beginPath(); ctx.arc(heroX, heroY, R, 0, Math.PI * 2); ctx.fill();
        this.spark(ctx, heroX, heroY, R * 1.25, "rgba(255,240,180,0.55)", b * 2);
        ctx.restore();
        if (b < 0.6) label("爆裂斜光!!", heroX, Math.max(70, heroY - R - 10), 54, "#fff3b0", "#7a2a08");
      }
    } else {
      const F = c.comboFighterTimes, f = A.fighter, fx = sx(f.x);
      if (!st.short && t >= F.arrive && t < F.buffEnd + 0.15 && st.after === null) label("強化魔法！", sx(A.witch.x), ground - 190, 30, "#ffd6f2");
      if (!st.short && t >= F.buffEnd && t < F.upper && st.after === null) label(`巨大化!! ×${f.scale.toFixed(1)}`, fx, ground - 150 * f.scale - 20, 34, "#fff4c0");
      const u = t + (st.after || 0) - F.upper;
      if (st.short ? t >= 0 : u >= 0 && u < 1.0) {
        const R = st.short ? 90 : 30 + 520 * this.ease(u / 0.6), a = st.short ? 0.6 : Math.max(0, 1 - u / 0.8);
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "#fffbe6"; ctx.lineWidth = st.short ? 6 : 14 * (1 - Math.min(1, u)); ctx.beginPath(); ctx.arc(heroX, heroY, R, 0, Math.PI * 2); ctx.stroke();
        if (!st.short) for (let i = 0; i < 14; i++) { const ang = i * Math.PI / 7 + 0.2; this.line(ctx, [[heroX + Math.cos(ang) * R * 0.5, heroY + Math.sin(ang) * R * 0.5], [heroX + Math.cos(ang) * R * 0.95, heroY + Math.sin(ang) * R * 0.95]], "#ffe680", 5); }
        this.spark(ctx, heroX, heroY, st.short ? 50 : 70 * Math.max(0.3, 1 - u), "#fff3a0", 0.3);
        ctx.restore();
        if (st.short || u < 0.6) label("連天蹴り!!", heroX, Math.max(70, heroY - 130), 54, "#e9ffd8", "#1f4d1c");
      }
    }
    if (st.after === null && !st.short) { ctx.font = "bold 18px system-ui"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(40,40,60,0.75)"; ctx.fillText("タップでスキップ ▶▶", c.width - 18, c.height - 18); }
    ctx.restore();
  },
  objectColor(type) { return Hop.CAST[type]?.color || "#304c60"; }
};
