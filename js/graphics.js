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
  // Truck entrance after the launch cut-in (display only): rush-in time (s) and start offset (px, left of its spot).
  truckRushIn: 0.22, truckRushInPx: 420,
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
    // 2026-10-15 smooth: uniform pop-in with a small overshoot and an eased fade (was a linear fade on a static shape).
    const u = Math.max(0, Math.min(1, age / 0.65)), pin = Math.max(0, Math.min(1, age / 0.16)), b = 1.7;
    const pop = Hop.Graphics.smooth ? 0.55 + 0.45 * (1 + (b + 1) * (pin - 1) ** 3 + b * (pin - 1) ** 2) : 1;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = Hop.Graphics.smooth ? (1 - u) * (1 - u) * (1 + 2 * u) : Math.max(0, 1 - age / 0.65); ctx.scale(pop, pop);
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
    const idle = { visible: false, alpha: 0, wipe: 0, portraitPop: 1, shakeX: 0, shakeY: 0, flash: 0, slide: 0 };
    if (!(age >= 0) || age >= total) return idle;
    if (reducedMotion) {
      return age < c.specialCutinReducedDuration
        ? { ...idle, visible: true, alpha: 1, wipe: 1, portraitPop: 1, slide: 0 }
        : idle;
    }
    // 2026-10-15 smooth: one continuous envelope per channel (no steps at the beat boundaries), overshoot pop,
    // slow push-in during the hold, eased slide-out exit. Beat times / covering / reduced still unchanged.
    const impactT = c.specialCutinImpact, wipeT = c.specialCutinWipe, inT = impactT + wipeT;
    const holdEnd = inT + c.specialCutinHold, cl = u => Math.max(0, Math.min(1, u));
    const easeOutQuart = u => 1 - (1 - cl(u)) ** 4, smooth = u => { u = cl(u); return u * u * (3 - 2 * u); };
    const shakeMul = strong ? 1.35 : 1, flashMul = strong ? 1.25 : 1;
    let alpha = 1, slide = 0;
    const uIn = cl(age / inT), env = (1 - uIn) ** 2;
    // Flash: peak at the hit, fades out smoothly by the end of the wipe.
    const flash = age < inT ? c.specialCutinFlashPeak * flashMul * (1 - smooth(uIn)) ** 1.6 : 0;
    // Shake: continuous decaying envelope over the whole entry (sum of two incommensurate sines, sub-frame smooth).
    const amp = env * c.specialCutinShakePx * shakeMul;
    const shakeX = (Math.sin(age * 71) * 0.65 + Math.sin(age * 113 + 1.3) * 0.35) * amp, shakeY = (Math.cos(age * 89) * 0.65 + Math.cos(age * 131 + 0.4) * 0.35) * amp * 0.6;
    // Wipe: anticipation (tiny reveal) then fast ease-out reveal, one curve.
    const wipe = age < impactT ? 0.08 + 0.2 * smooth(age / impactT) : 0.28 + 0.72 * easeOutQuart((age - impactT) / wipeT);
    // Portrait: pop that settles with one soft rebound (uniform scale), exactly 1 from the hold on.
    const P = c.specialCutinPortraitPop - 1;
    const portraitPop = age < inT ? 1 + P * (1 - uIn) ** 2 * Math.cos(uIn * Math.PI * 1.5) : 1; // ends at exactly 1, zero slope
    if (age > holdEnd) { // exit: ease-in slide to the right + smooth fade (follow-through)
      const u = cl((age - holdEnd) / Math.max(1e-6, total - holdEnd));
      alpha = 1 - smooth(u); slide = u * u;
    }
    return { visible: alpha > 0.01, alpha, wipe, portraitPop, shakeX, shakeY, flash, slide };
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
    const c = Hop.CONFIG, age = cut.total - cut.remaining + this.subStep(g, g.combo ? g.combo.rate || 1 : 1);
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
    const slidePx = (style.slide || 0) * c.width * 0.45;
    ctx.translate(c.width * 0.5 + slidePx * Math.cos(tilt), cy - slidePx * Math.sin(tilt));
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
    const nameX = c.width * (c.specialCutinNameX - (1 - reveal) * c.specialCutinNameSlide) + (style.slide || 0) * c.width * 0.7;
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
    // Long names shrink to fit between the settled anchor and the right edge (font size only).
    const nameMaxW = c.width * (1 - c.specialCutinNameX - c.specialCutinNameMargin);
    const nameW = ctx.measureText?.(cut.name)?.width || 0;
    if (nameW > nameMaxW) ctx.font = `bold ${Math.floor(c.specialCutinNameSize * nameMaxW / nameW)}px system-ui`;
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
  // Merchant SPECIAL flourish (2026-10-16, display only; never mutates game): gold coin burst + sparkles and a big
  // skill-name pop, timed on the real-time clock from the merchant cut-in's start and lasting merchantFlourishDuration
  // (longer than the cut-in). Effects / text only (no characters, no UI motion); reduced motion = a still name plate.
  merchantFlourish(ctx, g, visual) {
    if (!visual) return;
    const c = Hop.CONFIG, cut = g.specialCutin, now = g.realTime || 0, rm = !!visual.reducedMotion;
    if (cut?.merchantType && visual.merchantFx?.cut !== cut) visual.merchantFx = { cut, at: now, type: cut.merchantType, name: cut.name };
    const fx = visual.merchantFx; if (!fx) return;
    const T = c.merchantFlourishDuration, a = now - fx.at;
    if (g.state !== "FLYING" || !(a >= 0) || a >= T) { if (a >= T || g.state !== "FLYING") visual.merchantFx = null; return; }
    const fade = Math.min(1, (T - a) / 0.35), cx = c.width * 0.5, cy = c.height * 0.48;
    ctx.save();
    if (!rm) {
      // Coin burst: two waves fly out, arc under gravity and spin (uniform-scale gold discs + glint).
      for (let i = 0; i < c.merchantCoinCount; i++) {
        const wave = i % 2, t = a - wave * 0.18; if (t < 0) continue;
        const ang = (i * 2.399963) % (Math.PI * 2), sp = 520 + (i * 97) % 380;
        const x = cx + Math.cos(ang) * sp * t, y = cy + Math.sin(ang) * sp * t * 0.75 + 520 * t * t;
        const r = 13 + (i % 3) * 4, spin = t * 9 + i;
        ctx.globalAlpha = fade * Math.max(0, 1 - t / (T * 0.9));
        ctx.fillStyle = "#b8860b"; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffd447"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(x - r * 0.3 * Math.cos(spin), y - r * 0.3, r * 0.32, 0, Math.PI * 2); ctx.fill();
      }
      // Sparkles twinkling around the burst.
      for (let i = 0; i < 14; i++) {
        const ph = (a * 1.6 + i / 14) % 1, ang = i * 0.449 * Math.PI, rr = 160 + 300 * ph;
        ctx.globalAlpha = fade * Math.sin(ph * Math.PI);
        this.spark(ctx, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.6, 10 + 10 * Math.sin(ph * Math.PI), i % 2 ? "#fff1a8" : "#ffd447", a * 4 + i);
      }
      // Gold ring shockwave at the start.
      if (a < 0.6) { ctx.globalAlpha = 0.7 * (1 - a / 0.6); ctx.strokeStyle = "#ffd447"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, 60 + a * 900, 0, Math.PI * 2); ctx.stroke(); }
    }
    // Big skill-name pop (above the cut-in band) from the end of the wipe.
    const na = a - (c.specialCutinImpact + c.specialCutinWipe);
    if (na >= 0 || rm) {
      const sc = rm ? 1 : this.popScale(Math.max(0, na), false) * c.merchantNamePop;
      this.tempoText(ctx, `✦ ${fx.name} ✦`, cx, c.height * 0.24, 70, "#ffd447", sc, fade, rm ? 0 : -0.04);
      this.tempoText(ctx, `商人 Type ${fx.type} ・ とっておきの品！`, cx, c.height * 0.24 + 62, 30, "#fff6c0", rm ? 1 : Math.min(1, sc), fade);
    }
    ctx.restore();
  },
  // Smooth display (render interpolation, spring camera, smoothed tilt, pose / sprite cross-fades, extra
  // ambient motion). Off by default so geometry tests keep the raw game camera; main.js turns it on.
  smooth: false,
  lastDisplay: null, // { heroX, heroY, camX, camY, rot } of the latest smooth frame (frame traces / tests)
  draw(ctx, g, visual) {
    const D = this.smooth ? Hop.Smooth.frame(g, visual) : null;
    const camX = D ? D.camX : g.cameraX, camY = D ? D.camY : g.cameraY, bodyX = D ? D.bx : g.body.x, bodyY = D ? D.by : g.body.y;
    const c = Hop.CONFIG, ground = c.groundY + camY;
    const sx = x => c.launchX + x - camX;
    const sy = y => ground - c.playerRadius - y;
    // Combo scene (display only): one state per frame; screen shake wraps the world, not the cut-in.
    const combo = this.comboState(g);
    if (combo && this.smooth) { const sub = this.subStep(g, g.combo?.rate || 1); if (combo.after === null) combo.t = Math.min(combo.end, combo.t + sub); else combo.after = Math.min(combo.afterTotal, combo.after + sub); }
    const impact = this.comboImpact(combo, !!visual?.reducedMotion);
    ctx.fillStyle = "#bce9f3"; ctx.fillRect(0, 0, c.width, c.height);
    // Tempo feedback shake (speed + hit kick, capped; none in reduced motion or while a scene / cut-in plays).
    const shake = combo || g.launchCutin ? { x: 0, y: 0 } : this.tempoShake(g, visual);
    ctx.save(); ctx.translate(impact.x + shake.x, impact.y + shake.y);
    // Combo camera (display only): zoom toward the scene actors; identity when cam.w = 0.
    let cam = this.comboCamera(combo, !!visual?.reducedMotion, sx, sy, ground, sx(bodyX), sy(bodyY));
    if (D) cam = this.camSpring(D, cam, combo); // 2026-10-15: spring-follow of the combo camera (display only)
    ctx.save();
    if (cam.w > 0) { ctx.translate(cam.ax, cam.ay); ctx.scale(cam.z, cam.z); ctx.translate(-cam.fx, -cam.fy); }
    this.circle(ctx, 1080, 115, 49, "#fff1ad");
    const drift = D && !D.rm ? D.time * 7 : 0; // gentle cloud drift (display clock; none in reduced motion)
    for (let i = -1; i < 5; i++) {
      const x = i * 380 - ((camX * 0.12 + drift) % 380), y = 115 + (i % 2) * 60;
      this.circle(ctx, x, y, 26, "#f5fcf6"); this.circle(ctx, x + 30, y - 12, 35, "#f5fcf6"); this.circle(ctx, x + 65, y, 25, "#f5fcf6");
    }
    for (let i = -1; i < 5; i++) {
      const x = i * 440 - (camX * 0.25 % 440);
      this.polygon(ctx, [[x - 150, ground], [x + 80, ground - 155], [x + 310, ground]], "#95c99c");
    }
    ctx.fillStyle = "#82b973"; ctx.fillRect(0, ground, c.width, Math.max(0, c.height - ground));
    ctx.fillStyle = "#dfc693"; ctx.fillRect(0, ground + 10, c.width, 67);
    this.line(ctx, [[0, ground], [c.width, ground]], "#4b8855", 5);
    const spacing = c.markerMeters * c.pixelsPerMeter;
    const first = Math.max(0, Math.floor((camX - c.launchX) / spacing));
    ctx.font = "bold 21px system-ui";
    for (let i = first; sx(i * spacing) < c.width; i++) {
      const x = sx(i * spacing);
      this.line(ctx, [[x, ground + 13], [x, ground + 35]], "#867650", 3);
      ctx.fillStyle = "#4f573e"; ctx.fillText(`${i * c.markerMeters} m`, x + 9, ground + 54);
    }
    const prelaunch = ["READY", "AIM_ANGLE", "AIM_POWER"].includes(g.state);
    const launchAge = g.phaseTime - visual.launchAt;
    // Character motion (display only): event clocks in visual.anim; poses from the pure Hop.Anim functions.
    const A = Hop.Anim, anim = A.track(g, visual), rm = !!visual.reducedMotion || !A.enabled, pose = anim.pose;
    // Truck (display only): hidden in READY / AIM_ANGLE / AIM_POWER and while the launch cut-in plays. From the
    // launch clock (cut-in end / skip, or the launch itself when no cut-in runs) it rushes in from the left
    // (truckRushIn s; reduced motion: appears in place), then recoils with the suspension bounce + dust as before.
    const rush = rm ? 0 : this.truckRushIn, truckAge = launchAge - rush;
    if (!prelaunch && !g.launchCutin && launchAge >= 0 && truckAge < 0.5) {
      const tx = sx(0) - 20;
      A.truck(pose, g.state, g.phaseTime, Math.max(0, truckAge), rm);
      if (truckAge < 0) { const u = 1 - launchAge / rush; pose.dx -= this.truckRushInPx * u * u; pose.dy = 0; pose.rot = 0; }
      ctx.save(); ctx.translate(tx + pose.dx, ground + pose.dy); if (pose.rot) ctx.rotate(pose.rot); ctx.translate(-tx, -ground);
      this.truck(ctx, tx, ground);
      if (D && !rm) this.truckMotion(ctx, tx, ground, truckAge, D.time);
      ctx.restore();
      if (!rm && truckAge >= 0 && truckAge < 0.45) this.dustPuffs(ctx, anim, tx + 40, ground, truckAge, 1.2);
    }
    if (cam.w === 0) this.sageForesightHints(ctx, g, sx, ground, g.phaseTime, rm);
    for (const object of g.objects) {
      const ox = sx(object.x); if (ox < -120 || ox > c.width + 120) continue;
      // Combo actors are drawn by comboBack; they fade back in place during the afterglow.
      const actor = combo && (object === combo.source || object === combo.partner);
      if (actor && combo.after === null) continue;
      ctx.save(); ctx.globalAlpha = (object.used ? 0.35 : 1) * (actor ? Math.min(1, combo.after / combo.afterTotal) : 1);
      // Phase C: CAST sprite when loaded, else the Canvas figure (same feet point; alpha above applies).
      const ready = visual.readyTargets?.find(target => target.object === object);
      A.cast(pose, object.type, g.phaseTime, !!ready && !object.used, A.usedAge(anim, object, g.phaseTime), rm, D && !object.used ? Hop.Smooth.near(bodyX - object.x, bodyY) : 0,
        A.specialNear(anim, object, g.phaseTime), g.state === "FLYING" ? A.overhead(bodyX - object.x, bodyY) : 0, A.seedOf(object));
      ctx.save(); ctx.translate(ox + pose.dx, ground + pose.dy); if (pose.rot) ctx.rotate(pose.rot); ctx.scale(pose.sx, pose.sy); ctx.translate(-ox, -ground);
      if (!Hop.Sprites?.drawCast?.(ctx, object.type, ox, ground, object.used ? 1 : 0)) this.character(ctx, object.type, ox, ground, 1.365, object.used ? 1 : 0);
      ctx.restore();
      // Name / READY labels step aside while the combo camera is zoomed (they would be huge).
      if (cam.w > 0) ctx.globalAlpha *= 1 - cam.w;
      ctx.textAlign = "center"; ctx.font = "bold 25px system-ui";
      ctx.fillStyle = "#fff9e9"; ctx.fillRect(ox - 59, ground - 173, 118, 32);
      ctx.fillStyle = this.objectColor(object.type); ctx.fillText(Hop.CAST[object.type].name, ox, ground - 148);
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
    const x = sx(bodyX), y = sy(bodyY);
    if (D && !D.rm && g.state === "FLYING" && !g.launchCutin && !combo) this.speedLines(ctx, x, y, g.body.vx, g.body.vy, D.time);
    if (g.tempoEnabled && !visual.reducedMotion && g.state === "FLYING" && !g.launchCutin && !combo) this.windLines(ctx, g.body.vx, g.body.vy, g.realTime || 0, cam.w > 0 ? 0 : 1);
    if (combo) this.comboBack(ctx, combo, sx, sy, ground);
    const comboHero = combo && combo.after === null ? this.comboActors(combo).hero : null;
    if (g.contact && !visual.reducedMotion) this.contactEffect(ctx, g.contact.label.split(" ")[0], x, y, g.phaseTime - visual.contactAt);
    if (g.effect) {
      ctx.save(); ctx.globalAlpha = g.effect.remaining / c.effectDuration;
      this.line(ctx, [[x - 28, y + 20], [x - 12, y + (g.effect.label.endsWith("UP") ? -30 : 55)]], "#277ca5", 6); ctx.restore();
    }
    // Afterimages (display only): two fading ghosts along the trail while fast or spinning after a hit.
    const ev = anim.ev, speed = Math.hypot(g.body.vx, g.body.vy);
    const ghosts = g.state === "FLYING" && !rm && !comboHero && g.trail.length > 8 && (speed > 950 || ev.hitAge < 0.4);
    if (!comboHero) A.hero(pose, g.state, g.phaseTime, ev, rm, Hop.Sprites?.tiltWeight ? Hop.Sprites.tiltWeight(visual, g.phaseTime) : 1);
    if (!comboHero && D) Hop.Smooth.blendPose(D, pose, g.state);
    // Combo scene smear (2026-10-15, display only): when the hero is launched / knocked around fast, two
    // afterimages of the same sprite at the scene's earlier placements (motion blur feel).
    const comboSmear = !!comboHero && !rm && !combo.short;
    const heroGhost = k => { const p = this.comboActors({ ...combo, t: combo.t - 0.028 * k }).hero, ddx = p.dx - comboHero.dx, ddy = p.dy - comboHero.dy; return Math.hypot(ddx, ddy) > 10 ? [ddx, ddy] : null; };
    for (let k = ghosts || comboSmear ? 2 : 0; k >= 0; k--) {
    const gp = k && !comboSmear ? g.trail[g.trail.length - 1 - k * 4] : null, hg = k && comboSmear ? heroGhost(k) : null;
    if (k && !gp && !hg) continue;
    ctx.save(); if (k) { ctx.globalAlpha = k === 1 ? 0.3 : 0.15; if (gp) ctx.translate(sx(gp.x) - x, sy(gp.y) - y); else ctx.translate(hg[0], hg[1]); }
    ctx.translate(x + (comboHero?.dx || 0), y + (comboHero?.dy || 0));
    // GROUND_BOUNCE plays upright (tilt weight 0) and the tilt eases back afterwards.
    const tilt = Hop.Sprites?.tiltWeight ? Hop.Sprites.tiltWeight(visual, g.phaseTime) : 1;
    if (D) { if (!comboHero && D.rot) ctx.rotate(D.rot); } // smoothed tilt (Smooth.frame, already weighted)
    else if (g.state === "FLYING" && !visual.reducedMotion && tilt > 0 && !comboHero) ctx.rotate(Math.max(-0.7, Math.min(0.7, -g.body.vy / 1200)) * tilt);
    if (!comboHero) { // spin about the body centre, squash / stretch about the feet (whole sprite, <= 8%)
      const pr = c.playerRadius, mid = pr - 52;
      ctx.translate(pose.dx, pose.dy + mid); if (pose.rot) ctx.rotate(pose.rot); ctx.translate(0, pr - mid); ctx.scale(pose.sx, pose.sy); ctx.translate(0, -pr);
    }
    // Same foot anchor and rotation as the silhouette; physics stays untouched.
    // phaseTime shares the game's pause/hidden-tab handling (no wall-clock jump).
    // Stopped on the ground (FLYING or RESULT): STOP_RESULT. FLYING order: one-shot (priority
    // table) -> FLIGHT_LOOP; RESULT without STOP_RESULT: frozen FLIGHT_LOOP. READY / AIM: HD IDLE
    // still when loaded. Else -> Canvas HERO. Feet at playerRadius; physics untouched.
    // Sprite cross-fade (display only): the previous clip's last frame fades out under the new one (~110 ms).
    const drawLayer = layer => {
      if (D && !k && layer.asset?.ready) {
        Hop.Smooth.noteLayer(D, layer); const f = Hop.Smooth.layerFade(D);
        if (f) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * f.alpha; Hop.Sprites.draw(ctx, f.asset, f.time, 0, c.playerRadius, f.scale); ctx.globalAlpha = a0; }
      }
      return Hop.Sprites.draw(ctx, layer.asset, layer.time, 0, c.playerRadius, layer.scale);
    };
    const spriteDrawn = (comboHero?.hit && !!Hop.Sprites?.drawHeroHit?.(ctx, 0, c.playerRadius)) || !!Hop.Sprites?.stopLayers?.(visual, g.phaseTime).some(drawLayer) ||
      ((g.state === "FLYING" || g.state === "RESULT") && !!Hop.Sprites?.heroLayers(visual, g.phaseTime, g.state).some(drawLayer)) ||
      (prelaunch && !!Hop.Sprites?.idleLayers?.().some(drawLayer));
    if (!spriteDrawn) this.character(ctx, "HERO", 0, c.playerRadius, 0.936);
    ctx.restore();
    }
    if (!rm && ev.landAge < 0.45) this.dustPuffs(ctx, anim, sx(anim.landX), ground, ev.landAge, anim.landV);
    if (!rm && ev.skid > 0.02) this.skidDust(ctx, x, ground, g.displayTime || 0, ev.skid);
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
      A.cast(pose, "SPECIAL_ONLY", g.phaseTime, false, Infinity, rm);
      ctx.save(); ctx.translate(mx + pose.dx, y + 20 + pose.dy); if (pose.rot) ctx.rotate(pose.rot); ctx.scale(pose.sx, pose.sy); ctx.translate(-mx, -(y + 20));
      if (!Hop.Sprites?.drawCast?.(ctx, "SPECIAL_ONLY", mx, y + 20)) this.character(ctx, "SPECIAL_ONLY", mx, y + 20, 1.25);
      ctx.restore();
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
    const overlay = combo ? this.comboFront(ctx, combo, sx, sy, ground) : null;
    ctx.restore(); // combo camera
    if (overlay) this.comboOverlay(ctx, overlay, cam);
    ctx.restore(); // screen shake
    if (impact.flash > 0) { ctx.fillStyle = `rgba(255,255,250,${impact.flash})`; ctx.fillRect(0, 0, c.width, c.height); }
    if (g.flash > 0 && !visual.reducedMotion) { ctx.fillStyle = g.successVisual?.strong ? `rgba(255,250,210,${0.55 * g.flash / c.stopperFlashDuration})` : `rgba(255,255,245,${0.22 * g.flash / c.specialFlashDuration})`; ctx.fillRect(0, 0, c.width, c.height); }
    // Tempo feedback pops (chain / milestones / record) and the fast-forward badge, under the cut-ins.
    if (g.tempoEnabled) this.tempoOverlay(ctx, g, visual, x, y);
    // SPECIAL success cut-in above the world / flash; DOM special-panel stays separate.
    this.specialCutin(ctx, g, visual);
    // Merchant SPECIAL flourish (display only, over the cut-in and outliving it).
    this.merchantFlourish(ctx, g, visual);
    // Launch cut-in (truck x hero) above everything while it plays.
    this.launchCutin(ctx, g, visual);
  },
  // ---- Launch cut-in (truck x hero at AIM_POWER -> FLYING; display only, never mutates game) -------------
  // Beat times in seconds for a cut-in record (pure): impact = IMPACT start, launch = flight start, fade = fade start.
  launchCutinTimes(cut) {
    const c = Hop.CONFIG, total = cut?.total || c.launchCutinDuration;
    if (cut?.mode === "reduced") return { total, impact: 0, launch: total * 0.5, fade: total * 0.6 };
    const b = c.launchCutinBeats[cut?.mode === "repeat" ? "repeat" : "full"];
    return { total, impact: total * b[0], launch: total * b[1], fade: total * b[2] };
  },
  // Frame state (pure, deterministic in cut.elapsed). beat: approach / impact / launch / fade (reduced: still).
  launchCutinStyle(cut, reducedMotion = false) {
    const idle = { visible: false, beat: null, u: 0, alpha: 0, flash: 0, shakeX: 0, shakeY: 0, hitStop: false, burst: 0, sfx: 0, flight: 0 };
    if (!cut) return idle;
    const T = this.launchCutinTimes(cut), t = cut.elapsed, k = cut.intensity ?? 1;
    if (!(t >= 0) || t >= T.total) return idle;
    const clamp = u => Math.max(0, Math.min(1, u));
    if (reducedMotion || cut.mode === "reduced") {
      // Calm still: fade in, hold, fade out. No shake, no flash.
      const a = Math.min(clamp(t / 0.08), clamp((T.total - t) / 0.12));
      return { ...idle, visible: true, beat: "still", u: t / T.total, alpha: a, burst: 1, sfx: 1, flight: 0 };
    }
    const st = { ...idle, visible: true, alpha: 1 };
    if (t < T.impact) {
      st.beat = "approach"; st.u = t / T.impact;
    } else if (t < T.launch) {
      const dt = t - T.impact, span = T.launch - T.impact, hs = Math.min(Hop.CONFIG.launchCutinHitStop, span * 0.3);
      st.beat = "impact"; st.u = dt / span; st.hitStop = dt < hs;
      st.flash = dt < hs ? 0.85 : Math.max(0, 1 - (dt - hs) / (span * 0.35)) * 0.55;
      st.burst = clamp((dt - hs * 0.5) / (span * 0.45));
      st.sfx = clamp((dt - hs * 0.3) / (span * 0.25));
      const shakeDur = span * (0.6 + 0.4 * k) + (T.fade - T.launch) * 0.5 * k;
      const amp = (Hop.CONFIG.launchCutinShakePx + Hop.CONFIG.launchCutinShakeBonusPx * k) * Math.max(0, 1 - dt / shakeDur);
      st.shakeX = Math.sin(t * 97) * amp; st.shakeY = Math.cos(t * 83) * amp * 0.7;
    } else {
      const dt = t - T.impact, span = T.launch - T.impact;
      const shakeDur = span * (0.6 + 0.4 * k) + (T.fade - T.launch) * 0.5 * k;
      const amp = (Hop.CONFIG.launchCutinShakePx + Hop.CONFIG.launchCutinShakeBonusPx * k) * Math.max(0, 1 - dt / shakeDur);
      st.shakeX = Math.sin(t * 97) * amp; st.shakeY = Math.cos(t * 83) * amp * 0.7;
      st.beat = t < T.fade ? "launch" : "fade"; st.burst = 1; st.sfx = 1;
      st.flight = clamp((t - T.launch) / (T.total - T.launch));
      st.u = t < T.fade ? (t - T.launch) / (T.fade - T.launch) : (t - T.fade) / (T.total - T.fade);
      if (t >= T.fade) st.alpha = 1 - st.u;
    }
    return st;
  },
  // Deterministic pseudo-random in [0,1) (sparks / debris; same picture every play).
  lcRand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); },
  // Uniformly scaled hero / truck stills (5-heads-tall kept); false when the asset is missing.
  lcHero(ctx, x, feet, mul, idle = false) {
    const S = Hop.Sprites, def = S?.definitions?.HERO?.[idle ? "IDLE" : "HIT"], asset = idle ? S?.heroIdle : S?.heroHit;
    if (asset?.ready && def && S.draw(ctx, asset, 0, x, feet, def.scale * mul)) return true;
    ctx.save(); ctx.translate(x, feet); ctx.scale(mul, mul); this.character(ctx, "HERO", 0, 0, 0.936); ctx.restore();
    return false;
  },
  // Screen px per sprite-cell px at mul 1 (HD cells: def.scale / unit); Canvas fallback ≈ the same size.
  lcCellPx(kind) {
    const S = Hop.Sprites, def = kind === "truck" ? S?.definitions?.TRUCK?.IDLE : S?.definitions?.HERO?.HIT;
    const asset = kind === "truck" ? S?.truckIdle : S?.heroHit, unit = asset?.data?.unit;
    return def && unit > 0 ? def.scale / unit : kind === "truck" ? 0.29 : 0.4167;
  },
  lcTruck(ctx, x, ground, mul) {
    ctx.save(); ctx.translate(x, ground); ctx.scale(mul, mul); this.truck(ctx, 0, 0); ctx.restore();
  },
  lcSpeedLines(ctx, w, h, t, color, n = 26, dir = -1) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const y = (this.lcRand(i) - 0.5) * h, len = 120 + this.lcRand(i + 50) * 260, sp = 900 + this.lcRand(i + 90) * 900;
      const x = ((this.lcRand(i + 7) * (w + len) + dir * t * sp) % (w + len) + (w + len)) % (w + len) - w / 2 - len / 2;
      ctx.lineWidth = 2 + this.lcRand(i + 30) * 5; ctx.globalAlpha = 0.35 + this.lcRand(i + 13) * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
    ctx.restore();
  },
  lcFocusLines(ctx, cx, cy, inner, outer, n, color, spin = 0) {
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + spin + this.lcRand(i) * 0.08, w = 0.012 + this.lcRand(i + 40) * 0.02;
      const r0 = inner * (0.85 + this.lcRand(i + 80) * 0.4);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - w) * outer, cy + Math.sin(a - w) * outer);
      ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + w) * outer, cy + Math.sin(a + w) * outer);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  lcBand(ctx, cy, h, tilt, fill, draw) {
    const c = Hop.CONFIG, w = c.width * 1.3;
    ctx.save(); ctx.translate(c.width / 2, cy); ctx.rotate(tilt);
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.save(); ctx.clip();
    ctx.fillStyle = fill; ctx.fillRect(-w / 2, -h / 2, w, h);
    draw(w, h);
    ctx.restore();
    ctx.lineWidth = 8; ctx.strokeStyle = "#111"; ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.strokeRect(-w / 2, -h / 2 + 6, w, h - 12);
    ctx.restore();
  },
  lcText(ctx, text, x, y, size, rot, fill, stroke = "#1a0f08", scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
    ctx.font = `900 ${size}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.26; ctx.strokeStyle = stroke; ctx.strokeText(text, 0, 0);
    ctx.lineWidth = size * 0.1; ctx.strokeStyle = "#ffffff"; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill; ctx.fillText(text, 0, 0);
    ctx.restore();
  },
  launchCutin(ctx, g, visual) {
    const cut = g.launchCutin; if (!cut) return;
    const rm = !!visual?.reducedMotion, st = this.launchCutinStyle(cut, rm);
    if (!st.visible) return;
    const c = Hop.CONFIG, W = c.width, H = c.height, k = cut.intensity ?? 1, t = cut.elapsed;
    const label = cut.tier === "MAX" ? "MAX!!" : cut.tier === "STRONG" ? "STRONG!" : "";
    ctx.save(); ctx.globalAlpha = st.alpha;
    if (st.beat === "still") {
      // Calm version: dim + one band with the frozen collision and a small SFX label.
      ctx.fillStyle = "rgba(12,14,30,0.55)"; ctx.fillRect(0, 0, W, H);
      this.lcBand(ctx, H * 0.5, 300, -0.05, "#f7c948", () => {
        this.lcTruck(ctx, -60, 120, 1.9); this.lcHero(ctx, 210, 110, 1.9);
      });
      this.lcText(ctx, "ドカン！", W * 0.72, H * 0.28, 64, -0.08, "#ff5a2a");
      if (label) this.lcText(ctx, label, W * 0.72, H * 0.74, 40, -0.05, "#ffe14d");
      ctx.restore(); return;
    }
    ctx.translate(st.shakeX, st.shakeY);
    ctx.fillStyle = "#14111f"; ctx.fillRect(-40, -40, W + 80, H + 80);
    if (st.beat === "approach") {
      // (1) slow-mo close-ups: truck grille / headlight band + the hero's shocked face band.
      const u = st.u, slow = t * 0.25;
      this.lcFocusLines(ctx, W / 2, H / 2, 260, 900, 48, "rgba(255,255,255,0.10)", slow);
      this.lcBand(ctx, H * 0.27, 300, -0.07, "#ffb22e", (w, h) => {
        this.lcSpeedLines(ctx, w, h, slow, "#fff4c8");
        // headlight = cell (+88,-73) from the pivot: put it at band (x0, 0)
        const mul = 8.5 + 1.2 * u, px = this.lcCellPx("truck") * mul, hx = 60 + u * 140, hy = 10;
        this.lcTruck(ctx, hx - 88 * px, hy + 73 * px, mul);
        const glow = ctx.createRadialGradient?.(hx, hy, 4, hx, hy, 150 + 40 * Math.sin(t * 30));
        if (glow?.addColorStop) { glow.addColorStop(0, "rgba(255,255,230,0.95)"); glow.addColorStop(0.3, "rgba(255,240,150,0.55)"); glow.addColorStop(1, "rgba(255,240,150,0)"); ctx.fillStyle = glow; ctx.fillRect(-w / 2, -h / 2, w, h); }
      });
      this.lcBand(ctx, H * 0.73, 300, -0.07, "#3d6fd6", (w, h) => {
        this.lcFocusLines(ctx, 130, 0, 150, 800, 40, "rgba(255,255,255,0.45)", 0);
        // shocked face = HIT cell (+46,-140) from the pivot, centred in the band (uniform zoom)
        const mul = 10 + 1 * u, px = this.lcCellPx("hero") * mul;
        this.lcHero(ctx, 130 - 46 * px, 30 + 140 * px, mul);
        this.lcText(ctx, "!?", 330, -60, 96, 0.12, "#ffe14d");
      });
      this.lcText(ctx, "ブォォォン…", W * 0.2, H * 0.52, 44, -0.07, "#ffffff", "#2a1a08", 1 + 0.05 * Math.sin(t * 20));
    } else {
      const cx = W * 0.5, cy = H * 0.52, burstR = (520 + 420 * k) * (0.35 + 0.65 * st.burst);
      // (2) IMPACT: burst rays, shattering rings, sparks; (3) launch: comic flight with afterimages.
      ctx.fillStyle = cut.tier === "MAX" ? "#ff3d1f" : "#ff7a1a"; ctx.fillRect(-40, -40, W + 80, H + 80);
      const rays = 18 + Math.round(18 * k);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.hitStop ? 0 : t * 0.6);
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2, a1 = a0 + Math.PI / rays;
        ctx.fillStyle = i % 2 ? "#ffe14d" : "#fff8e0";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * burstR * 2, Math.sin(a0) * burstR * 2); ctx.lineTo(Math.cos(a1) * burstR * 2, Math.sin(a1) * burstR * 2); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      this.lcFocusLines(ctx, cx, cy, 300 + 80 * k, 1100, 64, "rgba(30,10,0,0.55)", t * 2);
      // shattering rings
      for (let r = 0; r < 2 + (k > 0.5 ? 1 : 0); r++) {
        const rr = burstR * (0.35 + 0.3 * r) * (0.6 + st.burst), segs = 14;
        ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = r % 2 ? "#ffffff" : "#ffd23a"; ctx.lineWidth = 14 - r * 4; ctx.globalAlpha = st.alpha * Math.max(0, 1 - st.burst * 0.6);
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2 + r, off = st.burst * 60 * this.lcRand(s + r * 20);
          ctx.beginPath(); ctx.arc(Math.cos(a) * off, Math.sin(a) * off, rr, a, a + Math.PI * 2 / segs * 0.7); ctx.stroke();
        }
        ctx.restore();
      }
      // sparks
      ctx.save(); ctx.strokeStyle = "#fffbe6"; ctx.lineCap = "round";
      const sparks = 24 + Math.round(24 * k);
      for (let i = 0; i < sparks; i++) {
        const a = this.lcRand(i) * Math.PI * 2, sp = 0.4 + this.lcRand(i + 9) * 0.9, d = burstR * sp * (0.2 + st.burst), len = 20 + 40 * this.lcRand(i + 3);
        ctx.lineWidth = 3 + 3 * this.lcRand(i + 5); ctx.globalAlpha = st.alpha * Math.max(0, 1 - st.burst * 0.7 * sp);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); ctx.lineTo(cx + Math.cos(a) * (d + len), cy + Math.sin(a) * (d + len)); ctx.stroke();
      }
      ctx.restore();
      if (st.beat === "impact") {
        // frozen collision tableau (hit-stop), slight push-in afterwards
        const z = st.hitStop ? 1.12 : 1.12 - 0.08 * st.u, mul = 2.6 * z;
        this.lcTruck(ctx, cx - 120 * z, cy + 120 * z, mul);
        this.lcHero(ctx, cx + 120 * z, cy + 90 * z, mul * 1.05);
      } else {
        // Rumiko flight: arcs up-right, spins, shrinks; afterimages trail; a twinkle where it vanishes.
        const f = st.flight, path = q => ({ x: cx + 80 + q * 620, y: cy + 100 - q * 560 + q * q * 120, s: 2.9 * (1 - 0.75 * q), r: -q * 7 });
        this.lcTruck(ctx, cx - 160 - f * 80, cy + 200 + f * 40, 2.6);
        for (let i = 5; i >= 0; i--) {
          const q = Math.max(0, f - i * 0.045), p = path(q);
          ctx.save(); ctx.globalAlpha = st.alpha * (i ? 0.12 + 0.1 * (5 - i) / 5 : 1);
          ctx.translate(p.x, p.y); ctx.rotate(p.r); this.lcHero(ctx, 0, 60 * p.s, p.s); ctx.restore();
        }
        if (f > 0.7) {
          const p = path(f), tw = (f - 0.7) / 0.3, r = 40 * Math.sin(tw * Math.PI);
          ctx.save(); ctx.translate(p.x + 30, p.y - 20); ctx.rotate(tw * 2); ctx.fillStyle = "#fffbd0";
          this.polygon(ctx, Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.25 : r; return [Math.cos(a) * rr, Math.sin(a) * rr]; }), "#fffbd0");
          ctx.restore();
          this.lcText(ctx, "キラーン☆", p.x - 40, p.y + 70, 36, -0.1, "#fff6a0", "#3a2000", Math.min(1, tw * 3));
        }
      }
      // SFX + power label
      const pop = st.sfx < 1 ? 2.2 - 1.2 * (1 - (1 - st.sfx) ** 3) : 1 + 0.03 * Math.sin(t * 40);
      const sfxY = st.beat === "impact" ? H * 0.2 : H * 0.18 + st.flight * 20;
      this.lcText(ctx, "ドカァァァン！！", W * 0.5, sfxY, 104 + 26 * k, -0.08, cut.tier === "MAX" ? "#ff2d55" : "#ff5a1f", "#1a0f08", pop);
      if (label) this.lcText(ctx, label, W * 0.78, H * 0.84, 70 + 20 * k, -0.12, "#ffe14d", "#3a1200", st.sfx < 1 ? pop : 1 + 0.06 * Math.sin(t * 30));
      if (cut.just) this.lcText(ctx, "JUST!", W * 0.5, H * 0.36, 88 + 20 * k, -0.1, "#7df9ff", "#062a3a", pop);
      this.lcText(ctx, `POWER ${Math.round((cut.power ?? 1) * 100)}%`, W * 0.18, H * 0.88, 34, -0.05, "#ffffff", "#2a1408");
    }
    ctx.restore();
    if (st.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, st.flash) * st.alpha})`; ctx.fillRect(0, 0, W, H); }
  },
  // ---- Combo SPECIAL scenes (display only; never mutate game) -------------------------------------------
  // Scene clock (pure). live = g.combo (scene time t = elapsed - S, S = cut-in fade start; negative while the
  // cut-in still covers the stage), after = g.comboAfter (final tableau, then the afterglow age `after`).
  // Render interpolation for the frozen-scene clocks (display only): the part of a physics step already
  // accumulated but not yet stepped (g.accumulator is read, never written). 0 unless the smooth display is on.
  subStep(g, rate = 1) {
    if (!this.smooth || !g || g.state !== "FLYING" || !(g.combo || g.specialCutin || g.comboAfter)) return 0;
    const a = g.accumulator, h = Hop.CONFIG.physicsStep; return Number.isFinite(a) ? Math.max(0, Math.min(h, a)) * rate : 0;
  },
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
  // Actor travel / camera push (2026-10-15): slow-in slow-out with a quick middle (no full-speed first frame).
  glide(u) { u = Math.max(0, Math.min(1, u)); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; },
  smoother(u) { u = Math.max(0, Math.min(1, u)); return u * u * u * (u * (u * 6 - 15) + 10); },
  // Uniform size of the fighter (pure): normal until she has dropped out of the bottom of the screen, giant
  // (comboFighterScale, the whole sprite, one factor for x and y) from then on — the growth happens off-screen.
  comboFighterScale(t) { const c = Hop.CONFIG; return t >= c.comboFighterTimes.gone ? c.comboFighterScale : 1; },
  // Fighter feet offset below the ground line (screen px, + = down) that puts the whole sprite (mul x) below the
  // canvas bottom (ground >= groundY since cameraY >= 0), and the offset that puts the giant fist on the hero.
  comboFighterHiddenDy(mul) { const c = Hop.CONFIG; return c.height - c.groundY + 112 * mul + 40; },
  // UPPER still: fist top ~96 px x mul above the feet, ~19 px x mul in front of them (comboFighterFistDx).
  comboFighterContactDy(st, mul) { const c = Hop.CONFIG; return Math.max(-60, -c.playerRadius - (st.heroY || 0) + 96 * mul - 30); },
  comboFighterFistDx(mul) { return 19 * mul; },
  // Actor placements in world x / pose / scale for a scene time (pure). Used by the drawing and by tests.
  // pose = CAST slot name (combo poses PUNCH / UPPER / CAST, else IDLE / KICK / USED); face = "left" / "right"
  // (Sprites.drawCastScaled mirrors a slot whose drawn facing differs, about the feet).
  comboActors(st) {
    const c = Hop.CONFIG, H = st.heroWX, t = st.t, lerp = (a, b, u) => a + (b - a) * this.glide(u);
    const src = st.source?.x ?? H, par = st.partner?.x ?? H + 500;
    const out = { hero: { dx: 0, dy: 0, hit: t >= 0 }, witch: null, fighter: null };
    if (st.type === "BOOST") {
      const W = c.comboWitchTimes, hits = c.comboWitchHits, step = (W.rushEnd - W.dash) / hits;
      // Witch: chants with the staff raised (CAST), fires the big spell with the staff thrust (USED).
      const witchPose = st.short ? (t >= 0 ? "CAST" : "IDLE") : t < 0.15 ? "IDLE" : t < W.liftEnd - 0.05 ? "CAST" : "USED";
      out.witch = { x: st.short && t >= 0 ? H - 120 : lerp(src, H - 120, t / W.dash), pose: witchPose, scale: 1 };
      out.witch.face = out.witch.x < H ? "right" : "left";
      if (st.short) {
        out.fighter = t >= 0 ? { x: H - 40, pose: "UPPER", face: "right", scale: 1, rotate: 0 } : { x: par, pose: "IDLE", face: "left", scale: 1, rotate: 0 };
        out.hits = t >= 0 ? hits : 0; out.hero.dy = 0; return out;
      }
      if (t < W.dash) out.fighter = { x: lerp(par, H + 75, t / W.dash), pose: "IDLE", face: "left", scale: 1, rotate: 0, dash: Math.max(0, t) / W.dash };
      else if (t < W.rushEnd) {
        // Rush: PUNCH (every third blow the old KICK), teleporting left / right every two blows, always facing the hero.
        const k = Math.min(hits - 1, Math.floor((t - W.dash) / step)), u = (t - W.dash - k * step) / step, right = Math.floor(k / 2) % 2 === 0;
        out.fighter = { x: H + (right ? 1 : -1) * (75 - 14 * (1 - u)), pose: k % 3 === 2 ? "KICK" : "PUNCH", face: right ? "left" : "right", scale: 1, rotate: 0,
          ghost: k > 0 && k % 2 === 0 ? (right ? -1 : 1) : 0, ghostU: u };
        out.hits = k + 1; out.hitU = u;
        out.hero.dx = Math.sin(t * 73) * 4; out.hero.dy = Math.cos(t * 59) * 3;
      } else {
        // Finisher: UPPER from the hero's left, launching the hero; then she hops back out of the blast.
        const u = (t - W.rushEnd) / (W.liftEnd - W.rushEnd);
        out.fighter = { x: t < W.liftEnd ? H - 40 : lerp(H - 40, H - 170, (t - W.liftEnd) / 0.2), pose: "UPPER", face: "right", scale: 1, rotate: -0.12 * this.ease(u * 1.6) };
        out.hits = hits; out.finish = true;
        out.hero.dy = -c.comboWitchLiftPx * this.ease(u) + (t > W.liftEnd ? Math.sin((t - W.liftEnd) * 9) * 3 : 0);
      }
      return out;
    }
    const F = c.comboFighterTimes, max = c.comboFighterScale, easeIn = u => Math.max(0, Math.min(1, u)) ** 2;
    const arrived = st.short ? t >= 0 : t >= F.arrive;
    // Witch comes from the right (facing her way), then turns to the fighter and casts the buff (CAST).
    out.witch = { x: st.short && t >= 0 ? H - 330 : lerp(par, H - 330, t / F.arrive), pose: arrived && (st.short || t < F.gone) ? "CAST" : "IDLE", face: arrived ? "right" : "left", scale: 1 };
    if (st.short) { // calm still: the giant fighter's fist already on the hero (no drop / rumble / shake)
      out.fighter = t >= 0 ? { x: H - this.comboFighterFistDx(max), pose: "UPPER", face: "right", scale: max, rotate: 0, dy: this.comboFighterContactDy(st, max), beat: "upper" }
        : { x: src, pose: "IDLE", face: src < H ? "right" : "left", scale: 1, rotate: 0, dy: 0, beat: "arrive" };
      return out;
    }
    let f;
    if (t < F.rise) { // walk in, buff, crouch, drop out of the bottom of the screen, hidden
      const x = lerp(src, H - 150, t / F.arrive), scale = this.comboFighterScale(t);
      let dy = 0, beat = t < F.arrive ? "arrive" : t < F.buffEnd ? "buff" : t < F.crouch ? "crouch" : t < F.gone ? "drop" : "hidden";
      if (beat === "crouch") dy = 10 * this.ease((t - F.buffEnd) / (F.crouch - F.buffEnd));
      else if (beat === "drop") dy = 10 + (this.comboFighterHiddenDy(1) - 10) * easeIn((t - F.crouch) / (F.gone - F.crouch));
      else if (beat === "hidden") dy = this.comboFighterHiddenDy(scale);
      f = { x: beat === "hidden" ? H - this.comboFighterFistDx(max) : x, pose: "IDLE", scale, rotate: 0, dy, beat };
      if (beat === "hidden") f.rumble = (t - F.gone) / (F.rise - F.gone);
    } else { // erupt from below, fist first (UPPER), hit at F.upper, hit-stop, follow-through upward
      const contact = this.comboFighterContactDy(st, max), hidden = this.comboFighterHiddenDy(max);
      let dy, beat;
      if (t < F.upper) { beat = "rise"; dy = hidden + (contact - hidden) * this.ease((t - F.rise) / (F.upper - F.rise)); }
      else { beat = "upper"; dy = contact - c.comboFighterFollowPx * this.ease((t - F.upper - F.hitstop) / 0.3); }
      f = { x: H - this.comboFighterFistDx(max), pose: "UPPER", scale: max, rotate: 0, dy, beat };
      if (beat === "rise") f.rise = (t - F.rise) / (F.upper - F.rise);
    }
    f.face = f.x < H ? "right" : "left";
    out.fighter = f;
    if (t >= F.upper + F.hitstop) out.hero.dy = -c.comboFighterLiftPx * this.ease((t - F.upper - F.hitstop) / 0.25);
    else if (t >= F.gone && t < F.upper) { out.hero.dx = Math.sin(t * 61) * 1.5; out.hero.dy = Math.cos(t * 47) * 1.5; } // trembling with the ground
    return out;
  },
  // 先見の結界 hint (display only, 2026-10-13d): for each untouched on-screen sage whose game.sageConditionMet is
  // true, a faint pale-gold arc from the sage to the qualifying 僧侶 / 盗賊 plus a soft glow and a 先見 mark on the
  // sage. Gentle pulse; static under reduced motion. Returns the number of hints drawn (tests).
  sageForesightHints(ctx, g, sx, ground, t, rm) {
    const c = Hop.CONFIG; let drawn = 0;
    if (!g.sageForesightTarget) return 0;
    for (const sage of g.objects) {
      if (sage.used || sage.type !== "GUARD") continue;
      const ax = sx(sage.x); if (ax < -120 || ax > c.width + 120) continue;
      const target = g.sageForesightTarget(sage); if (!target) continue;
      const bx = sx(target.x), a = rm ? 0.55 : 0.45 + 0.2 * Math.sin(t * 3.2), y = ground - 70, lift = Math.min(90, 30 + (bx - ax) * 0.18);
      ctx.save();
      ctx.globalAlpha = a; ctx.strokeStyle = "#ffe7a3"; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ax, y); ctx.quadraticCurveTo((ax + bx) / 2, y - lift, bx, y); ctx.stroke(); ctx.setLineDash([]);
      const glow = ctx.createRadialGradient(ax, y, 6, ax, y, 70);
      if (glow) { // (null from stub contexts in node tests)
        glow.addColorStop(0, "rgba(255,236,170,0.55)"); glow.addColorStop(1, "rgba(255,236,170,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ax, y, 70, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = Math.min(1, a + 0.35); ctx.font = "bold 22px system-ui"; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(120,86,20,0.75)"; ctx.fillRect(ax - 30, ground - 250, 60, 30);
      ctx.fillStyle = "#fff3c4"; ctx.fillText("先見", ax, ground - 227);
      ctx.restore(); drawn++;
    }
    return drawn;
  },
  // Combo camera (pure, display only). Returns the zoom weight w (0 = normal camera), the full zoom z and the
  // focus (fx, fy) in normal screen coordinates; draw maps p -> (ax, ay) + z * (p - (fx, fy)).
  // Focus = centre of the bounding box of the scene actors (hero, witch, fighter), zoom fits that box up to
  // comboZoomMax (so the giant fighter pulls the camera back); the launched hero is followed. Zooms in over
  // comboZoomIn when the scene starts, back to normal over comboZoomOut of the afterglow (following the hero).
  // Skip, the short (reducedMotion) version or reducedMotion: no zoom.
  comboCamera(st, reducedMotion, sx, sy, ground, heroScreenX, heroScreenY) {
    const c = Hop.CONFIG, none = { w: 0, z: 1, fx: c.width / 2, fy: c.height / 2, ax: c.width / 2, ay: c.height / 2 };
    if (!st || st.short || st.skipped || reducedMotion || c.comboZoomMax <= 1) return none;
    const box = this.comboBox(st, sx, sy, ground);
    let z = Math.max(1, Math.min(c.comboZoomMax, c.width * c.comboZoomFill / (box.r - box.l), c.height * c.comboZoomFill / (box.b - box.t)));
    let fx = (box.l + box.r) / 2, fy = (box.t + box.b) / 2, w;
    if (st.after === null) w = this.smoother(st.t / c.comboZoomIn);
    else {
      w = 1 - this.smoother(st.after / c.comboZoomOut);
      const u = this.ease(st.after / (c.comboZoomOut * 0.5)); // follow the flying hero
      fx += (heroScreenX - fx) * u; fy += (heroScreenY - 30 - fy) * u;
    }
    if (!(w > 0)) return none;
    const hx = c.width / 2 / z, hy = c.height / 2 / z;
    fx = Math.max(hx, Math.min(c.width - hx, fx)); fy = Math.max(hy, Math.min(c.height - hy, fy));
    const zoom = 1 + (z - 1) * w;
    return { w, z: zoom, full: z, fx, fy, ax: fx + (c.width / 2 - fx) * w, ay: fy + (c.height / 2 - fy) * w };
  },
  // Spring-follow of the combo camera transform (display only, 2026-10-15). screen = o + z * p; z and o follow
  // the pure target with a critically damped spring (exact for any dt), so zoom-in / re-framing / zoom-out
  // glide instead of snapping. Snaps (no glide) with no scene, skip, the short version or reduced motion.
  CAM_SPRING: 10,
  camSpring(d, target, st) {
    const S = Hop.Smooth, time = d.time, k = d.comboCam || (d.comboCam = { z: 1, zV: 0, ox: 0, oxV: 0, oy: 0, oyV: 0, at: -1 });
    const tz = target.z, tox = target.ax - target.z * target.fx, toy = target.ay - target.z * target.fy;
    const dt = k.at < 0 ? 0 : Math.max(0, Math.min(0.1, time - k.at)); k.at = time;
    if (!st || st.short || st.skipped || d.rm || dt === 0 && target.w === 0) { k.z = tz; k.ox = tox; k.oy = toy; k.zV = k.oxV = k.oyV = 0; return target; }
    S.spring(k, "z", tz, this.CAM_SPRING, dt); S.spring(k, "ox", tox, this.CAM_SPRING, dt); S.spring(k, "oy", toy, this.CAM_SPRING, dt);
    if (k.z < 1) { k.z = 1; k.zV = Math.max(0, k.zV); }
    const w = Math.max(target.w, Math.min(1, Math.abs(k.z - 1) * 4 + Math.hypot(k.ox, k.oy) / 40));
    if (target.w === 0 && w < 0.002) return target;
    return { w, z: k.z, full: target.full, fx: 0, fy: 0, ax: k.ox, ay: k.oy };
  },
  // Screen bounding box of the actors (normal camera) with a margin. The rush teleports are boxed by the
  // fighter's stance so the camera does not jitter.
  camBlend(t, R) { const u = Math.max(0, Math.min(1, (t - (R - 0.14)) / 0.26)); return u * u * (3 - 2 * u); },
  comboBox(st, sx, sy, ground, noBlend = false) {
    const c = Hop.CONFIG, A = this.comboActors(st), H = st.heroWX, m = c.comboZoomMargin;
    const boxes = [];
    const cast = (x, s = 1) => boxes.push([sx(x) - 48 * s, ground - 122 * s, sx(x) + 48 * s, ground]);
    const hx = sx(H) + A.hero.dx, hy = sy(st.heroY) + A.hero.dy;
    boxes.push([hx - 42, hy + c.playerRadius - 88, hx + 42, hy + c.playerRadius]);
    // Fighter SPECIAL eruption / uppercut: tight on the hero and the fist below her (the witch leaves the frame),
    // following the launched hero upward.
    const R = c.comboFighterTimes.rise, blendK = st.type === "BOUNCE" && !st.short && !noBlend ? this.camBlend(st.t, R) : 0;
    if (blendK > 0 && blendK < 1) { // 2026-10-15: cross-blend the two framings (no camera jump at the eruption)
      const a = this.comboBox({ ...st, t: Math.min(st.t, R - 1e-6) }, sx, sy, ground, true), b = this.comboBox({ ...st, t: Math.max(st.t, R) }, sx, sy, ground, true);
      const L = (p, q) => p + (q - p) * blendK; return { l: L(a.l, b.l), t: L(a.t, b.t), r: L(a.r, b.r), b: L(a.b, b.b) };
    }
    const erupt = st.type === "BOUNCE" && !st.short && st.t >= c.comboFighterTimes.rise;
    if (erupt) { const hy0 = sy(st.heroY), fist = sx(A.fighter.x) + this.comboFighterFistDx(A.fighter.scale); const up = c.comboFighterFollowPx * this.ease((st.t - c.comboFighterTimes.upper - c.comboFighterTimes.hitstop) / 0.3);
      boxes.push([fist - 90, hy0 - 40 - up, fist + 90, hy0 + 150 - up * 1.2]); }
    if (A.witch && !erupt) cast(A.witch.x, A.witch.scale || 1);
    if (A.fighter && !erupt) {
      const W = c.comboWitchTimes;
      // Fighter SPECIAL: the camera frames the normal-size stance only, so the giant fist bursts out of the frame.
      if (st.type === "BOOST" && st.t >= W.dash) cast(H + 75); else if (st.type === "BOUNCE") cast(A.fighter.x); else cast(A.fighter.x, A.fighter.scale || 1);
    }
    const l = Math.min(...boxes.map(b => b[0])) - m, t = Math.min(...boxes.map(b => b[1])) - m;
    const r = Math.max(...boxes.map(b => b[2])) + m, b = Math.max(...boxes.map(b => b[3])) + m * 0.5;
    return { l, t, r, b };
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
      if (u >= 0) { amp = c.comboShakePx * (u < F.hitstop ? 1.4 : Math.max(0, 1 - (u - F.hitstop) / 0.55)); flash = u < F.hitstop ? 0.55 : Math.max(0, 0.45 - (u - F.hitstop) * 2.5); }
      else if (t >= F.rise) amp = c.comboShakePx * 0.6;                                   // eruption
      else if (t >= F.gone) amp = 1.5 + 3 * (t - F.gone) / (F.rise - F.gone);             // rumble (ゴゴゴ…) builds up
      else if (t >= F.crouch) amp = 2;                                                    // drop into the ground
    }
    // Continuous shake (no 60 Hz stepping): two incommensurate sines per axis, sub-frame smooth.
    return { x: (Math.sin(t * 67) * 0.7 + Math.sin(t * 109 + 2.1) * 0.3) * amp, y: (Math.cos(t * 83) * 0.7 + Math.cos(t * 127 + 0.7) * 0.3) * amp * 0.7, flash };
  },
  comboCast(ctx, id, a, sx, ground, alpha = 1) {
    if (!a) return;
    const ok = Hop.Sprites?.drawCastScaled?.(ctx, id, sx(a.x), ground + (a.dy || 0), a.pose, a.scale || 1, { face: a.face, rotate: a.rotate, alpha });
    // Canvas fallback (no sprite): pose 0 / 1, the Canvas figures face the viewer's left.
    if (!ok) { ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(sx(a.x), ground + (a.dy || 0)); if (a.rotate) ctx.rotate(a.rotate); if (a.face === "right") ctx.scale(-1, 1); this.character(ctx, id, 0, 0, 1.365 * (a.scale || 1), a.pose === "IDLE" ? 0 : 1); ctx.restore(); }
  },
  // Pose in-between (2026-10-15, display only): for POSE_FADE s after an actor's pose / facing changes in place,
  // the previous still fades out over the new one (cross-fade of existing sprites; same uniform scale).
  POSE_FADE: 0.1,
  comboCastBlend(ctx, id, key, st, a, sx, ground, alpha = 1) {
    if (!a) return;
    this.comboCast(ctx, id, a, sx, ground, alpha);
    if (st.short || st.after !== null || st.skipped) return;
    const h = 1 / 120;
    for (let back = h; back <= this.POSE_FADE + 1e-9; back += h) {
      const p = this.comboActors({ ...st, t: st.t - back })[key];
      if (!p) return;
      if (p.pose === a.pose && p.face === a.face) continue;
      if (Math.abs(p.x - a.x) > 40 || (p.scale || 1) !== (a.scale || 1) || Math.abs((p.dy || 0) - (a.dy || 0)) > 40) return;
      const u = (back - h * 0.5) / this.POSE_FADE, k = 1 - Math.max(0, Math.min(1, u)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, u)));
      // the previous pose is drawn at the current placement so only the drawing changes
      this.comboCast(ctx, id, { ...a, pose: p.pose, face: p.face }, sx, ground, alpha * (1 - k) * 0.9);
      return;
    }
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
      this.comboCastBlend(ctx, "BOOST", "witch", st, A.witch, sx, ground);
      const f = A.fighter;
      if (f.dash !== undefined && !st.short) for (let i = 3; i >= 1; i--) this.comboCast(ctx, "BOUNCE", { ...f, x: f.x + i * 55 }, sx, ground, 0.18 * (4 - i) * fade);
      if (f.ghost) this.comboCast(ctx, "BOUNCE", { ...f, x: st.heroWX + f.ghost * 75, face: f.ghost > 0 ? "left" : "right" }, sx, ground, 0.35 * (1 - f.ghostU) * fade);
      this.comboCast(ctx, "BOUNCE", f, sx, ground);
    } else {
      const F = c.comboFighterTimes, f = A.fighter, fx = sx(f.x), feet = ground + (f.dy || 0), mid = feet - 70 * f.scale, heroX = sx(st.heroWX);
      const visible = st.short || f.beat === "arrive" || f.beat === "buff" || f.beat === "crouch" || f.beat === "drop";
      if (!st.short && visible && t >= F.arrive) { // buff aura (pulsing), brighter while crouching
        const pulse = 1 + 0.06 * Math.sin(t * 22), k = f.beat === "crouch" || f.beat === "drop" ? 0.7 : Math.min(0.55, (t - F.arrive) * 1.5);
        ctx.save(); ctx.globalAlpha = fade * k; ctx.fillStyle = f.beat === "buff" ? "#ffd0f0" : "#ffef7a";
        ctx.beginPath(); ctx.ellipse(fx, mid, 55 * pulse, 80 * pulse, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (!st.short && t >= F.arrive && t < F.crouch) { // rings of the buff spell
        for (let i = 0; i < 3; i++) {
          const ph = ((t - F.arrive) * 1.8 + i / 3) % 1;
          ctx.save(); ctx.globalAlpha = fade * (1 - ph); ctx.strokeStyle = "#ff8ad8"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(fx, mid, 30 + ph * 70, 12 + ph * 26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      // Ground cracks from where she dived to under the hero, glowing brighter until the eruption.
      const crackAge = st.short ? -1 : t - F.crouch;
      if (crackAge >= 0) {
        const dive = sx(st.heroWX - 150), glow = t < F.upper ? Math.min(1, crackAge / (F.rise - F.crouch)) : Math.max(0, 1 - (t - F.upper) / 0.5);
        const reach = Math.min(1, crackAge / (F.rise - F.crouch));
        ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
        const crack = (x0, x1, seed, w) => { ctx.beginPath(); ctx.moveTo(x0, ground + 2);
          for (let k = 1; k <= 8; k++) { const x = x0 + (x1 - x0) * k / 8 * reach; ctx.lineTo(x, ground + 3 + ((k * seed * 7) % 11) + (k % 2 ? 4 : -1)); } ctx.lineWidth = w; ctx.stroke(); };
        ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = "#3b2a1a"; crack(dive, heroX + 40, 3, 6); crack(dive, dive - 90, 5, 4); crack(heroX - 24, heroX + 110, 2, 5);
        if (glow > 0) { ctx.globalAlpha = fade * glow; ctx.strokeStyle = "#ffe36b"; crack(dive, heroX + 40, 3, 2.5); crack(heroX - 24, heroX + 110, 2, 2); }
        ctx.restore();
        // Light leaking up from below the hero while hidden.
        if (t >= F.gone && t < F.upper + 0.3) {
          const a = t < F.upper ? 0.25 + 0.35 * (t - F.gone) / (F.upper - F.gone) : 0.6 * (1 - (t - F.upper) / 0.3);
          const lx = sx(st.heroWX), grad = ctx.createRadialGradient?.(lx, ground + 10, 4, lx, ground + 10, 130);
          ctx.save(); ctx.globalAlpha = fade * a;
          if (grad) { grad.addColorStop(0, "rgba(255,236,140,0.95)"); grad.addColorStop(1, "rgba(255,230,120,0)"); ctx.fillStyle = grad; } else ctx.fillStyle = "rgba(255,230,120,0.5)";
          ctx.beginPath(); ctx.ellipse(lx, ground + 10, 130, 70, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      if (!st.short && t > 0 && t < F.arrive) for (let i = 3; i >= 1; i--) { // witch dash afterimages (same sprite)
        const p = this.comboActors({ ...st, t: Math.max(0, t - 0.03 * i) }).witch; if (Math.abs(p.x - A.witch.x) > 6) this.comboCast(ctx, "BOOST", p, sx, ground, 0.12 * (4 - i) * fade); }
      this.comboCastBlend(ctx, "BOOST", "witch", st, A.witch, sx, ground);
      if (!st.short && t >= F.arrive && t < F.crouch) { // sparkles from the staff to the fighter
        const wx = sx(A.witch.x) + 40, wy = ground - 110;
        for (let i = 0; i < 10; i++) { const ph = (t * 2 + i / 10) % 1; this.spark(ctx, wx + (fx - wx) * ph, wy + (mid - wy) * ph - Math.sin(ph * Math.PI) * 50, 7, "#fff1a8", t * 5 + i); }
      }
      if (f.beat === "rise") { // upward speed lines in the fighter's column + afterimages of the same sprite
        ctx.save(); ctx.globalAlpha = fade * 0.75; ctx.strokeStyle = "#ffffff"; ctx.lineCap = "round";
        for (let i = 0; i < 16; i++) { const lx = fx + ((i * 53) % 340) - 170, len = 120 + (i * 37) % 160, y0 = ground + 140 - ((t * 2400 + i * 97) % 760);
          ctx.lineWidth = 2 + (i % 3) * 2; ctx.beginPath(); ctx.moveTo(lx, y0); ctx.lineTo(lx, y0 + len); ctx.stroke(); }
        ctx.restore();
        for (let k = 3; k >= 1; k--) this.comboCast(ctx, "BOUNCE", { ...f, dy: f.dy + k * 70 }, sx, ground, 0.16 * (4 - k) * fade);
      }
      if (f.beat === "rise" || (f.beat === "upper" && t < F.upper + 0.45)) { // fist-shaped energy aura: same sprite, slightly larger (uniform)
        const a = f.beat === "rise" ? 0.45 : 0.55 * (1 - (t - F.upper) / 0.45);
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        this.comboCast(ctx, "BOUNCE", { ...f, scale: f.scale * 1.07 }, sx, ground, a * fade); ctx.restore();
      }
      if (st.short || f.beat !== "hidden") this.comboCastBlend(ctx, "BOUNCE", "fighter", st, f, sx, ground);
      // Dust puffs where she dived in and where she bursts out.
      for (const [at, x, big] of [[F.crouch, sx(st.heroWX - 150), 1], [F.rise, sx(f.x), 2]]) {
        const age = t - at; if (st.short || age < 0 || age > 0.7) continue;
        ctx.save(); ctx.globalAlpha = fade * 0.85 * (1 - age / 0.7); ctx.fillStyle = "#e9dcb8";
        for (let i = 0; i < 9; i++) { const side = i % 2 ? 1 : -1, d = (20 + i * 12) * big * this.ease(age / 0.5);
          this.circle(ctx, x + side * d, ground - 8 - (i % 3) * 10 * big * this.ease(age / 0.4), (14 + (i % 4) * 6) * big * (0.6 + age), "#e9dcb8"); }
        if (big > 1) for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i - 4.5) * 0.22, d = 60 + 520 * age; // rocks thrown up
          ctx.fillStyle = i % 2 ? "#6b5136" : "#8a6a48"; ctx.fillRect(x + Math.cos(a) * d - 6, ground + Math.sin(a) * d + 300 * age * age - 6, 12 + (i % 3) * 4, 10 + (i % 2) * 5); }
        ctx.restore();
      }
    }
    ctx.restore();
  },
  // In front of the hero: hit sparks, HIT counter, chant gauge, fireball / explosion, shockwave, labels.
  // Effects are drawn in world space (under the combo camera); texts / gauge / skip hint are returned as an
  // overlay list (world anchor + screen offset) and drawn by comboOverlay at a readable size.
  comboFront(ctx, st, sx, sy, ground) {
    const c = Hop.CONFIG, A = this.comboActors(st), t = st.t, fade = st.after === null ? 1 : Math.max(0, 1 - st.after / st.afterTotal);
    // Effects stay where the scene happened (world x / held height), even after the hero flies off.
    const heroX = sx(st.heroWX) + A.hero.dx, heroY = sy(st.heroY) + A.hero.dy;
    const overlay = [];
    let life = null; // [t0, t1] of the next label: pop in with overshoot, fade out (2026-10-15 smooth)
    const label = (text, x, y, size, color, stroke = "#3b2357", dx = 0, dy = 0) => {
      const k = life && !st.short ? this.labelLife(life[2] ?? t, life[0], life[1]) : { a: 1, s: 1 }; life = null;
      overlay.push({ kind: "label", text, x, y, dx, dy, size, color, stroke, alpha: fade * k.a, scale: k.s });
    };
    const within = (t0, t1, at) => { life = [t0, t1, at]; };
    ctx.save(); ctx.globalAlpha = fade;
    if (st.type === "BOOST") {
      const W = c.comboWitchTimes, wx = sx(A.witch.x);
      if (A.hits && st.after === null) {
        if (!st.short && A.hitU !== undefined && A.hitU < 0.6) this.spark(ctx, heroX + (A.fighter.flip ? 22 : -22), heroY - 10 + ((A.hits * 37) % 30) - 15, 30 * (1 - A.hitU * 0.8), A.hits % 2 ? "#fff6b0" : "#ffd27a", A.hits);
        if (!st.short) life = [0.3, W.blast, t]; const hitPop = st.short ? 1 : 1 + 0.22 * (1 - Math.min(1, (A.finish ? (t - W.rushEnd) / 0.2 : A.hitU ?? 1) * 1.6)) ** 2;
        if (st.short || t < W.blast) label(`${A.hits} HIT${A.hits >= c.comboWitchHits ? "!!" : ""}`, heroX + 40, heroY - 60, 40 * hitPop, "#ffe55c", undefined, 80, -30);
      }
      if (!st.short && t >= 0.15 && t < W.blast && st.after === null) { // chant gauge
        const g = Math.max(0, Math.min(1, (t - 0.15) / (W.rushEnd - 0.15)));
        overlay.push({ kind: "gauge", x: wx, y: ground - 125, dy: -30, value: g, alpha: fade });
        within(0.15, W.blast); label(g >= 1 ? "詠唱完了！" : "詠唱中…", wx, ground - 125, 24, "#fff4d6", undefined, 0, -44);
      }
      if (st.short && t >= 0) { this.circle(ctx, heroX, heroY, 70, "rgba(255,190,90,0.35)"); label("爆裂斜光", heroX, heroY - 60, 40, "#ffe55c", undefined, 0, -50); }
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
        within(0, 0.6, b); if (b < 0.6) label(`${c.specials.BOOST.name}!!`, heroX, heroY - R * 0.55, 54, "#fff3b0", "#7a2a08", 0, -20);
      }
    } else {
      const F = c.comboFighterTimes, f = A.fighter, fx = sx(f.x);
      within(F.arrive, F.buffEnd + 0.15); if (!st.short && t >= F.arrive && t < F.buffEnd + 0.15 && st.after === null) label("強化魔法！", sx(A.witch.x), ground - 125, 30, "#ffd6f2", undefined, 0, -30);
      within(F.buffEnd, F.gone); if (!st.short && t >= F.buffEnd && t < F.gone && st.after === null) label("溜め…！", fx, ground - 130, 30, "#fff4c0", undefined, 0, -24);
      if (!st.short && t >= F.gone && t < F.upper && st.after === null) { // ゴゴゴ… rumble texts
        const n = Math.min(3, 1 + Math.floor((t - F.gone) / 0.15));
        for (let i = 0; i < n; i++) { within(F.gone + 0.15 * i, F.upper + 0.06); label("ゴゴゴ…", sx(st.heroWX) + [-150, 140, -10][i], ground - 20, 40 + 4 * i, "#ffe9b0", "#4a2f12", Math.sin(t * 40 + i) * 3, -30 - 60 * i); }
      }
      const u = t + (st.after || 0) - F.upper;
      if (st.short ? t >= 0 : u >= 0 && u < 1.0) {
        const R = st.short ? 90 : 30 + 600 * this.ease(u / 0.6), a = st.short ? 0.6 : Math.max(0, 1 - u / 0.8);
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "#fffbe6"; ctx.lineWidth = st.short ? 6 : 16 * (1 - Math.min(1, u)); ctx.beginPath(); ctx.arc(heroX, heroY, R, 0, Math.PI * 2); ctx.stroke();
        if (!st.short) { ctx.lineWidth = 8 * (1 - Math.min(1, u)); ctx.beginPath(); ctx.arc(heroX, heroY, R * 0.62, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 16; i++) { const ang = i * Math.PI / 8 + 0.2; this.line(ctx, [[heroX + Math.cos(ang) * R * 0.5, heroY + Math.sin(ang) * R * 0.5], [heroX + Math.cos(ang) * R * 0.95, heroY + Math.sin(ang) * R * 0.95]], "#ffe680", 5); } }
        this.spark(ctx, heroX, heroY, st.short ? 50 : 90 * Math.max(0.3, 1 - u), "#fff3a0", 0.3);
        ctx.restore();
        if (!st.short && u > F.hitstop && u < 0.6) { // upward speed lines behind the launched hero
          ctx.save(); ctx.globalAlpha = 0.7 * (1 - u / 0.6); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
          for (let i = 0; i < 10; i++) { const lx = heroX + ((i * 41) % 160) - 80, y0 = heroY + 30 + (i * 23) % 60; ctx.beginPath(); ctx.moveTo(lx, y0); ctx.lineTo(lx, y0 + 140 + (i % 3) * 40); ctx.stroke(); }
          ctx.restore();
        }
        within(0, 0.75, u); if (st.short || u < 0.75) label(`${c.specials.BOUNCE.name}！！`, heroX, heroY - 70, st.short ? 54 : 72, "#e9ffd8", "#1f4d1c", 0, -90);
      }
    }
    if (st.after === null && !st.short) overlay.push({ kind: "hint", text: "タップでスキップ ▶▶" });
    ctx.restore();
    return overlay;
  },
  // Screen-space texts for the combo scenes: anchors follow the combo camera, sizes grow only a little
  // with the zoom (readable, never huge) and stay inside the canvas.
  // Label envelope (pure): pop in with a damped overshoot over ~0.16 s, ease out over the last 0.12 s. Uniform scale.
  labelLife(t, t0, t1) {
    const a = t - t0, cl = u => Math.max(0, Math.min(1, u)), sm = u => { u = cl(u); return u * u * (3 - 2 * u); };
    if (!(a >= 0)) return { a: 0, s: 1 };
    const inA = sm(a / 0.1), out = 1 - sm((t - (t1 - 0.12)) / 0.12);
    return { a: inA * out, s: 1 + 0.45 * Math.exp(-a * 22) * Math.cos(a * 26) * (a < 0.35 ? 1 : 0) };
  },
  comboOverlay(ctx, items, cam) {
    const c = Hop.CONFIG, z = cam?.w > 0 ? cam.z : 1, k = 1 + 0.18 * (z - 1);
    const map = (x, y) => cam?.w > 0 ? [cam.ax + z * (x - cam.fx), cam.ay + z * (y - cam.fy)] : [x, y];
    for (const it of items) {
      ctx.save();
      if (it.kind === "hint") {
        ctx.font = "bold 20px system-ui"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillRect(c.width - 232, c.height - 46, 220, 34);
        ctx.fillStyle = "rgba(40,40,60,0.85)"; ctx.fillText(it.text, c.width - 22, c.height - 22); ctx.restore(); continue;
      }
      ctx.globalAlpha *= it.alpha ?? 1;
      let [x, y] = map(it.x, it.y); y += (it.dy || 0) * k; x += (it.dx || 0) * k;
      if (it.kind === "gauge") {
        const w = 150 * k, h = 16 * k; x = Math.max(w / 2 + 8, Math.min(c.width - w / 2 - 8, x)); y = Math.max(40 * k, Math.min(c.height - 20, y));
        ctx.fillStyle = "rgba(40,20,60,0.78)"; ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = it.value >= 1 ? "#ffe066" : "#ff9a3c"; ctx.fillRect(x - w / 2 + 2, y - h / 2 + 2, (w - 4) * it.value, h - 4);
        ctx.restore(); continue;
      }
      let size = Math.round(it.size * k * (it.scale ?? 1));
      ctx.font = `italic 900 ${size}px system-ui`; ctx.textAlign = "center";
      const maxW = c.width * c.comboLabelMaxW, measured = ctx.measureText?.(it.text)?.width || 0;
      if (measured > maxW) { size = Math.floor(size * maxW / measured); ctx.font = `italic 900 ${size}px system-ui`; }
      ctx.lineWidth = Math.max(4, size / 7); ctx.strokeStyle = it.stroke; ctx.lineJoin = "round";
      const half = measured > 0 ? Math.min(measured, maxW) / 2 + ctx.lineWidth / 2 : size * it.text.length * 0.36;
      x = Math.max(half + 10, Math.min(c.width - half - 10, x)); y = Math.max(size + 8, Math.min(c.height - 16, y));
      ctx.strokeText(it.text, x, y); ctx.fillStyle = it.color; ctx.fillText(it.text, x, y);
      ctx.restore();
    }
  },
  // Landing / launch dust (display only): six deterministic puffs, no allocation.
  dustPuffs(ctx, anim, x, ground, age, strength) {
    const p = anim.puff;
    ctx.save(); ctx.fillStyle = "#e9dcb8";
    for (let i = 0; i < 6; i++) {
      Hop.Anim.dust(p, i, 6, age, strength);
      if (p.alpha <= 0) continue;
      ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(x + p.x, ground + p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  // Final-slide skid dust (2026-10-16 cycle 14, display only): three puffs trailing behind the rolling hero, fading
  // with speed (skid = vx / 600, 0..1; drawn with sqrt so a slow roll still shows). Deterministic in display time, no allocation; hero area only.
  skidDust(ctx, x, ground, t, skid) {
    const k = Math.sqrt(skid); // visible even at low rolling speed, fades to 0 as the hero stops
    ctx.save(); ctx.fillStyle = "#c2a06a"; // earthy tan: reads on both sky and ground
    for (let i = 0; i < 3; i++) {
      const p = (t * 3 + i / 3) % 1;
      ctx.globalAlpha = Math.min(0.85, 0.35 + 0.6 * k) * (1 - p);
      ctx.beginPath(); ctx.arc(x - 16 - p * 56, ground - 6 - p * 16, (7 + p * 14) * (0.7 + 0.3 * k), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  objectColor(type) { return Hop.CAST[type]?.color || "#304c60"; },
  // Truck exhaust puffs + wheel spin (display only, deterministic in truckAge; called inside the truck transform).
  truckMotion(ctx, tx, ground, truckAge, time) {
    const k = 1.12, spin = (truckAge < 0 ? 40 : 18 * Math.exp(-4 * truckAge)) * (truckAge + 1) + time * 2;
    ctx.save(); ctx.strokeStyle = "#e8e5d7"; ctx.lineWidth = 3;
    for (const wx of this.WHEELS) {
      const cx = tx + wx * k, cy = ground - 12 * k;
      ctx.beginPath(); ctx.moveTo(cx - Math.cos(spin) * 13, cy - Math.sin(spin) * 13); ctx.lineTo(cx + Math.cos(spin) * 13, cy + Math.sin(spin) * 13);
      ctx.moveTo(cx + Math.sin(spin) * 13, cy - Math.cos(spin) * 13); ctx.lineTo(cx - Math.sin(spin) * 13, cy + Math.cos(spin) * 13); ctx.stroke();
    }
    ctx.fillStyle = "#9aa2a8";
    for (let i = 0; i < 3; i++) {
      const a = ((truckAge + 0.4 + i * 0.13) % 0.4) / 0.4; // 0..1 per puff, staggered
      ctx.globalAlpha = 0.45 * (1 - a); ctx.beginPath(); ctx.arc(tx - 126 - a * 34, ground - 22 - a * 16, 5 + a * 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
  WHEELS: [-80, 12],
  // Speed-line strip behind the hero at high speed (display only; fixed lanes, no allocation).
  // ---- Tempo feedback (display only; reads game + visual, never writes the game) ---------------------------------
  // Screen shake offset: a gentle speed rumble (shakeSpeedFrom..To px/s -> 0..shakeMaxPx/2) plus a decaying kick
  // after a character hit (scaled by the impact), total capped at shakeMaxPx. Deterministic in realTime.
  tempoShake(g, visual) {
    const c = Hop.CONFIG;
    if (!g.tempoEnabled || visual?.reducedMotion || g.state !== "FLYING") return { x: 0, y: 0 };
    const t = g.realTime || 0, v = Math.hypot(g.body.vx, g.body.vy);
    const sp = Math.max(0, Math.min(1, (v - c.shakeSpeedFrom) / (c.shakeSpeedTo - c.shakeSpeedFrom))) * c.shakeMaxPx * 0.5;
    const kick = visual?.kick, ka = kick ? t - kick.at : Infinity;
    const kp = ka < 0.22 ? c.hitShakePx * (0.35 + 0.65 * kick.k) * (1 - ka / 0.22) : 0;
    const a = Math.min(c.shakeMaxPx, sp + kp);
    return a <= 0 ? { x: 0, y: 0 } : { x: a * Math.sin(t * 71.3) * Math.cos(t * 23.1), y: a * Math.sin(t * 57.7 + 1.3) * 0.8 };
  },
  // Full-screen wind streaks that thicken with speed (from 900 px/s; densest at the 2000 px/s cap).
  windLines(ctx, vx, vy, time, alpha = 1) {
    const c = Hop.CONFIG, v = Math.hypot(vx, vy), k = Math.max(0, Math.min(1, (v - 900) / 1100)) * alpha;
    if (k <= 0) return;
    const n = Math.round(6 + 18 * k), ux = vx / v, uy = -vy / v;
    ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const r1 = this.lcRand(i * 3 + 1), r2 = this.lcRand(i * 3 + 2), sp = 1.6 + 1.4 * r2;
      const ph = (time * sp + r1) % 1, len = 60 + 180 * k * (0.5 + r2);
      const px = c.width * (1.15 - ph * 1.3), py = 40 + (c.height - 140) * this.lcRand(i * 3 + 3);
      ctx.globalAlpha = (0.12 + 0.28 * k) * Math.sin(Math.PI * ph); ctx.lineWidth = 1.5 + 2 * r1 * k;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - ux * len, py - uy * len); ctx.stroke();
    }
    ctx.restore();
  },
  // Pop scale for a text that lands at age a (s): overshoot 1.6 -> 1 in 0.18 s (reduced motion: 1).
  popScale(a, rm) { if (rm) return 1; if (a < 0) return 0; const u = Math.min(1, a / 0.18); return 1 + 0.6 * (1 - u) * (1 - u) - 0.08 * Math.sin(Math.PI * u); },
  tempoText(ctx, text, x, y, size, fill, scale = 1, alpha = 1, rot = 0) {
    if (alpha <= 0 || scale <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(scale, scale);
    ctx.font = `900 ${size}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(4, size * 0.16); ctx.strokeStyle = "#1a0f08"; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill; ctx.fillText(text, 0, 0); ctx.restore();
  },
  tempoOverlay(ctx, g, visual, heroX, heroY) {
    const c = Hop.CONFIG, rm = !!visual?.reducedMotion, now = g.realTime || 0;
    for (const f of visual?.fx || []) {
      const a = now - f.at, life = f.kind === "CHAIN" || f.kind === "MILESTONE" || f.kind === "JUST" ? 0.9 : 1.5;
      if (a < 0 || a > life) continue;
      const fade = Math.min(1, (life - a) / 0.3), sc = this.popScale(a, rm);
      if (f.kind === "CHAIN") {
        const n = Math.min(f.n, 12), hue = ["#ffe066", "#ffb340", "#ff7a3d", "#ff4d6d", "#d06bff"][Math.min(4, n - 2)];
        const x = Math.max(120, Math.min(c.width - 120, heroX + 40)), y = Math.max(90, heroY - 120) - (rm ? 0 : a * 30);
        this.tempoText(ctx, `${f.n}HIT!`, x, y, 44 + 5 * n, hue, sc, fade, rm ? 0 : -0.08);
      } else if (f.kind === "MILESTONE") {
        this.tempoText(ctx, `${f.meters} m`, c.width / 2, 92 - (rm ? 0 : a * 12), 40, "#ffffff", sc * 0.95, fade);
      } else if (f.kind === "MILESTONE_BIG") {
        if (!rm && a < 0.5) { ctx.save(); ctx.globalAlpha = 0.6 * (1 - a / 0.5); ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(c.width / 2, 110, 40 + a * 360, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        this.tempoText(ctx, `${f.meters} m!!`, c.width / 2, 110, 74, "#ffe066", sc, fade, rm ? 0 : -0.04);
      } else if (f.kind === "JUST") { // near the hero (effect area), same pop as CHAIN
        const x = Math.max(120, Math.min(c.width - 120, heroX)), y = Math.max(90, heroY - 90) - (rm ? 0 : a * 30);
        this.tempoText(ctx, "JUST!", x, y, 60, "#7df9ff", sc, fade, rm ? 0 : -0.08);
      } else if (f.kind === "NEW_RECORD") {
        const y = 200;
        ctx.save(); ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = "#c2410c";
        const w = rm ? c.width : c.width * Math.min(1, a / 0.2); ctx.fillRect((c.width - w) / 2, y - 38, w, 76); ctx.restore();
        this.tempoText(ctx, "NEW RECORD!", c.width / 2, y, 64, "#fff3a0", sc, fade);
      }
    }
    // Fast-forward badge (the hint line says the same in DOM text).
    if (g.state === "FLYING" && g.timeScale > 1.05) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (g.timeScale - 1) * 2); ctx.fillStyle = "#1a0f08cc";
      const tap = g.body.grounded, w = tap ? 300 : 210; ctx.fillRect(c.width - w - 24, 24, w, tap ? 78 : 48);
      ctx.font = "900 30px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffffff";
      ctx.fillText(`スキップ ▶▶ ×${Math.round(g.timeScale)}`, c.width - w - 8, 49);
      if (tap) { ctx.font = "bold 22px system-ui, sans-serif"; ctx.fillStyle = "#ffe066"; ctx.fillText("タップで結果へ", c.width - w - 8, 84); }
      ctx.restore();
    }
  },
  speedLines(ctx, x, y, vx, vy, time) {
    const v = Math.hypot(vx, vy), k = Math.min(1, (v - 1050) / 650);
    if (k <= 0) return;
    const ux = vx / v, uy = -vy / v; // screen direction of travel
    ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const lane = (i - 3) * 11, ph = ((time * 3.1 + i * 0.37) % 1), len = 50 + 70 * k * (1 - ph);
      const bx = x - ux * (40 + ph * 120) - uy * lane, by = y - 12 - uy * (40 + ph * 120) + ux * lane;
      ctx.globalAlpha = 0.5 * k * (1 - ph); ctx.lineWidth = 2 + (i % 2);
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * len, by - uy * len); ctx.stroke();
    }
    ctx.restore();
  }
};
// ---- Character motion (display only; never reads or writes physics) ----------------------------------------
// Pure pose functions: (out, ..., time inputs, reducedMotion) -> { sx, sy, rot, dx, dy } written into `out`
// (no per-frame allocation). Squash / stretch is whole-sprite and clamped to +-8% (Anim.SCALE_MIN / MAX), so
// the 5-head proportions never change. reducedMotion keeps only a faint breath (amplitude x0.3), no shake /
// spin / wobble / dust / afterimages.
Hop.Anim = {
  SCALE_MIN: 0.92, SCALE_MAX: 1.08, RM: 0.3,
  enabled: true, // false = every pose is the identity (static-geometry tests; a kill switch)
  CAST_ORDER: ["BOOST", "BOUNCE", "BRAKE", "ANGLE", "DASH", "GUARD", "STOPPER", "SPECIAL_ONLY"],
  // Per-character idle flavour: breath period (s), bob px, sway rad, hop (1 = little hops), float (1 = hover).
  CAST_STYLE: {
    BOOST: { period: 2.2, bob: 3, sway: 0.03, hop: 0, float: 1 },        // witch: floaty hover
    BOUNCE: { period: 0.9, bob: 2, sway: 0, hop: 1, float: 0 },          // fighter: light footwork hops
    BRAKE: { period: 1.6, bob: 1, sway: 0.05, hop: 0, float: 0 },        // thief: sly sway
    ANGLE: { period: 1.2, bob: 2, sway: 0.08, hop: 0, float: 0 },        // jester: rocking
    DASH: { period: 2.0, bob: 1, sway: 0.015, hop: 0, float: 0 },        // warrior: heavy, steady breath
    GUARD: { period: 2.6, bob: 2.5, sway: 0.02, hop: 0, float: 1 },      // sage: calm hover
    STOPPER: { period: 2.4, bob: 1.5, sway: 0.025, hop: 0, float: 0 },   // priest: gentle prayer sway
    SPECIAL_ONLY: { period: 1.4, bob: 2, sway: 0.04, hop: 0, float: 0 }  // merchant: cheerful swing
  },
  clampScale(v) { return v < this.SCALE_MIN ? this.SCALE_MIN : v > this.SCALE_MAX ? this.SCALE_MAX : v; },
  reset(out) { out.sx = 1; out.sy = 1; out.rot = 0; out.dx = 0; out.dy = 0; return out; },
  finish(out) { out.sx = this.clampScale(out.sx); out.sy = this.clampScale(out.sy); return out; },
  easeOutCubic(p) { p = p < 0 ? 0 : p > 1 ? 1 : p; return 1 - (1 - p) * (1 - p) * (1 - p); },
  // Landing settle: 1 at impact (squash), a damped overshoot past 0 (stretch), continuous 0 at 0.5 s.
  settle(a) { return a >= 0.5 ? 0 : Math.exp(-7 * a) * Math.cos(19 * a) * (1 - a / 0.5); },
  // Hero. ev: { launchAge, hitAge, hitDir, landAge, specialAge } (seconds since the event, Infinity = none).
  // wobble (0..1) scales the flight flutter (Sprites.tiltWeight: 0 while GROUND_BOUNCE plays upright).
  hero(out, state, t, ev, rm, wobble = 1) {
    this.reset(out); if (!this.enabled) return out;
    const amp = rm ? this.RM : 1, TAU = Math.PI * 2;
    if (state === "READY" || state === "AIM_ANGLE") {
      const b = Math.sin(TAU * t / 1.8) * amp;
      out.sy = 1 + 0.025 * b; out.sx = 1 - 0.015 * b;
      const blink = (t % 3.2) / 0.14; // quick blink-style nod every 3.2 s
      if (!rm && blink < 1) out.dy = 2.5 * Math.sin(Math.PI * blink);
    } else if (state === "AIM_POWER") {
      // Anticipation: crouch (ease in) and a nervous tremble.
      const k = this.easeOutCubic(t / 0.25) * amp;
      out.sy = 1 - 0.05 * k; out.sx = 1 + 0.04 * k;
      if (!rm) out.dx = 1.2 * Math.sin(t * 55);
    } else if (state === "FLYING") {
      if (!rm) { out.rot = 0.07 * wobble * Math.sin(t * 9); out.sy = 1 + 0.02 * Math.sin(t * 14); out.sx = 1 - 0.012 * Math.sin(t * 14); } // cape-flutter wobble
      const la = ev.launchAge;
      if (la < 0.07) { const k = Math.sin(Math.PI * 0.5 * (1 - la / 0.07)) * amp; out.sy -= 0.06 * k; out.sx += 0.05 * k; } // anticipation squash
      else if (la < 0.37) { const k = Math.sin(Math.PI * Math.min(1, (la - 0.07) / 0.06) * 0.5) * (1 - (la - 0.07) / 0.3) * amp; out.sy += 0.08 * k; out.sx -= 0.06 * k; } // launch stretch
      if (ev.hitAge < 0.55) {
        const a = ev.hitAge;
        if (a < 0.07) { // hit-stop: squash + shake
          out.sy = 1 - 0.07 * amp; out.sx = 1 + 0.07 * amp;
          if (!rm) out.dx = 3.5 * Math.sin(a * 320);
        } else { // comic spin and follow-through stretch
          const p = (a - 0.07) / 0.48, f = this.HIT_FLAVOR[ev.hitType] || this.HIT_FLAVOR.DEFAULT;
          if (!rm) { out.rot += TAU * f.turns * this.easeOutCubic(p) * (ev.hitDir < 0 ? -1 : 1); out.dx += f.dx * Math.sin(Math.PI * p); out.dy += f.dy * Math.sin(Math.PI * p); }
          out.sy = 1 + f.st * (1 - p) * amp; out.sx = 1 - f.st * 0.8 * (1 - p) * amp;
        }
      }
      if (ev.effAge < 0.5) this.heroEffect(out, ev.effKind, ev.effAge / 0.5, amp, rm); // AERIAL UP / DOWN, BOOST, DASH, BOUNCE poses
      if (ev.skid > 0 && !rm) { out.rot += -0.16 * ev.skid + 0.05 * ev.skid * Math.sin(t * 40); out.dy += 1.5 * ev.skid * Math.abs(Math.sin(t * 31)); } // ground skid / tumble
      if (ev.landAge < 0.5) { const q = this.settle(ev.landAge) * amp; out.sy = 1 - 0.08 * q; out.sx = 1 + 0.07 * q; } // squash, overshoot, settle
      if (ev.specialAge < 0.6) { const s = 1 + 0.08 * Math.sin(Math.PI * ev.specialAge / 0.6) * amp; out.sx *= s; out.sy *= s; }
    } else if (state === "RESULT") {
      const b = Math.sin(TAU * t / 2.4) * amp;
      out.sy = 1 + 0.015 * b; out.sx = 1 - 0.01 * b;
      if (!rm) {
        if (ev.tier === 2) { out.dy = -7 * Math.abs(Math.sin(Math.PI * t / 0.6)); out.rot = 0.06 * Math.sin(TAU * t / 1.2); } // far: victory hops
        else if (ev.tier === 1) { out.dy = -3 * (1 + Math.sin(TAU * t / 0.9)); out.rot = -0.04; }                            // mid: proud chest-out bob
        else { out.dy = -1.5 * (1 + Math.sin(TAU * t / 1.2)); out.rot = 0.05 * Math.sin(TAU * t / 3.6); }                      // short: relaxed bob, sheepish sway
      }
      if (ev.landAge < 0.5) { const q = this.settle(ev.landAge) * amp; out.sy -= 0.07 * q; out.sx += 0.06 * q; }
    }
    return this.finish(out);
  },
  // Hit flavour by character: spin turns, stretch, and a sideways / vertical nudge (px) during the follow-through.
  HIT_FLAVOR: {
    BOOST: { turns: 1, st: 0.07, dx: 10, dy: -6 }, BOUNCE: { turns: 1, st: 0.08, dx: 0, dy: -12 }, BRAKE: { turns: -0.5, st: 0.03, dx: -10, dy: 4 },
    ANGLE: { turns: 2, st: 0.05, dx: 0, dy: -4 }, DASH: { turns: 1.5, st: 0.08, dx: 14, dy: 0 }, GUARD: { turns: 0.5, st: 0.04, dx: 0, dy: -8 },
    STOPPER: { turns: -1, st: 0.04, dx: -6, dy: 0 }, SPECIAL_ONLY: { turns: 1, st: 0.06, dx: 4, dy: -10 }, DEFAULT: { turns: 1, st: 0.06, dx: 0, dy: 0 }
  },
  // Hero flight-effect pose, p 0..1 over 0.5 s.
  heroEffect(out, kind, p, amp, rm) {
    const s = Math.sin(Math.PI * p);
    if (kind === "UP") { out.sy *= 1 + 0.06 * s * amp; out.sx *= 1 - 0.04 * s * amp; if (!rm) { out.dy -= 6 * s; out.rot -= 0.15 * s; } }        // AERIAL UP: reach up
    else if (kind === "DOWN") { out.sy *= 1 - 0.05 * s * amp; out.sx *= 1 + 0.04 * s * amp; if (!rm) { out.rot += 0.4 * s; out.dy += 4 * s; } } // AERIAL DOWN: dive tuck
    else if (kind === "BOOST") { out.sx *= 1 + 0.06 * s * amp; out.sy *= 1 - 0.04 * s * amp; if (!rm) out.rot += 0.22 * s; }                    // BOOST: streamline forward
    else if (kind === "DASH") { if (!rm) { out.dx += 8 * Math.sin(Math.PI * 2 * p) * (1 - p); out.rot += 0.3 * s; } }                           // DASH: lunge
    else if (kind === "BOUNCE") { const q = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7; out.sy *= 1 - 0.06 * q * amp + 0.05 * s * amp; out.sx *= 1 + 0.05 * q * amp; } // BOUNCE: squash, pop
    return out;
  },
  // Roadside character. ready = a READY target (anticipation pose), recoilAge = s since it was used.
  // near (display only, -1..1): hero proximity from Smooth.near; > 0 approaching (lean away + flinch), < 0 just passed (look after it).
  // sp = s since the last SPECIAL near it (Infinity = none), over (-1..1) = hero overhead (sign = side), seed = display seed.
  cast(out, type, t, ready, recoilAge, rm, near = 0, sp = Infinity, over = 0, seed = 0) {
    this.reset(out); if (!this.enabled) return out;
    const st = this.CAST_STYLE[type] || this.CAST_STYLE.DASH, amp = rm ? this.RM : 1, TAU = Math.PI * 2;
    const idx = this.CAST_ORDER.indexOf(type), ph = (idx < 0 ? 0 : idx) * 0.7;
    const b = Math.sin(TAU * t / st.period + ph);
    out.sy = 1 + 0.02 * b * amp; out.sx = 1 - 0.012 * b * amp;
    if (!rm) {
      out.rot = st.sway * Math.sin(TAU * t / (st.period * 1.7) + ph);
      if (st.float) out.dy = -st.bob * (1 + Math.sin(TAU * t / st.period + ph));
      else if (st.hop) out.dy = -st.bob * 2 * Math.abs(Math.sin(Math.PI * t / st.period + ph));
      else out.dy = -st.bob * 0.5 * (1 + b);
    }
    if (ready) { // ready pose: crouch, lean toward the incoming hero (left) and bounce on the toes
      out.sy = 1 - 0.04 * amp; out.sx = 1 + 0.03 * amp;
      if (!rm) { out.rot = -0.06 + 0.02 * Math.sin(t * 8); out.dy = -3 * Math.abs(Math.sin(t * 7)); }
    }
    if (!ready && recoilAge >= this.HIT_T && sp >= this.SP_T && !rm) this.fidget(out, type, t, seed); // occasional idle fidget
    if (over && !rm && recoilAge >= this.HIT_T) { const w = over < 0 ? -over : over; out.rot = out.rot * (1 - w) - 0.12 * over; out.dy -= 2 * w; out.sy += 0.015 * w; } // look up and track the hero overhead
    if (recoilAge < this.HIT_T) this.castHit(out, type, recoilAge / this.HIT_T, amp, rm); // per-character hit reaction
    else if (sp < this.SP_T) this.castSpecial(out, type, sp / this.SP_T, amp, rm); // per-character reaction to a nearby SPECIAL
    if (near && !rm) { out.rot += near > 0 ? 0.11 * near : 0.06 * near; out.dy -= 3 * Math.abs(near); out.dx += near > 0 ? 3 * near : 0; }
    return this.finish(out);
  },
  // Hero overhead weight (-1..1): high above and within ~350 px; sign = which side the hero is on.
  overhead(dx, heroY) { if (heroY < 220 || dx < -350 || dx > 350) return 0; const h = Math.min(1, (heroY - 220) / 200); return (dx / 350) * h; },
  HIT_T: 0.6, SP_T: 0.8, FIDGET_EVERY: 3.5, FIDGET_T: 0.6,
  // Display-only hash RNG in [0,1) (never the game RNG): per-object seed x slot index.
  drand(seed, i) { let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i | 0, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 13; return (h >>> 0) / 4294967296; },
  seedOf(object) { return object ? Math.round(object.x * 7) ^ 0x5bd1e995 : 0; },
  // Every FIDGET_EVERY s slot, ~60% of slots play a short per-character fidget at a random offset (deterministic).
  fidget(out, type, t, seed) {
    const slot = Math.floor(t / this.FIDGET_EVERY), r = this.drand(seed, slot);
    if (r > 0.6) return out;
    const start = slot * this.FIDGET_EVERY + this.drand(seed, slot + 7919) * (this.FIDGET_EVERY - this.FIDGET_T), p = (t - start) / this.FIDGET_T;
    if (p < 0 || p >= 1) return out;
    const s = Math.sin(Math.PI * p), TAU = Math.PI * 2;
    switch (type) {
      case "BOOST": out.rot += 0.08 * Math.sin(TAU * p); out.dy -= 4 * s; break;                   // witch: little broom-float lift
      case "BOUNCE": out.dx += 4 * Math.sin(TAU * 2 * p); out.dy -= 3 * Math.abs(Math.sin(TAU * p)); break; // fighter: shadow-box shuffle
      case "BRAKE": out.dx -= 5 * s; out.rot -= 0.07 * s; break;                                  // thief: glance back over the shoulder
      case "ANGLE": out.rot += 0.18 * Math.sin(TAU * p); break;                                    // jester: head-tilt wiggle
      case "DASH": out.sy *= 1 + 0.03 * s; out.sx *= 1 + 0.03 * s; break;                         // warrior: chest-out flex (uniform)
      case "GUARD": out.dy -= 5 * s; break;                                                       // sage: slow levitate
      case "STOPPER": out.rot -= 0.06 * s; out.dy += 1.5 * s; break;                              // priest: small bow
      default: out.dy -= 6 * Math.abs(Math.sin(TAU * p)); break;                                  // merchant: double hop
    }
    return out;
  },
  // Per-character hit reaction, p 0..1 over HIT_T. Reduced motion: squash only (faint).
  castHit(out, type, p, amp, rm) {
    const k = 1 - p, d = k * k, TAU = Math.PI * 2, s = Math.sin(Math.PI * p);
    out.sx = 1 + 0.05 * d * amp; out.sy = 1 - 0.06 * d * amp; out.rot = 0; out.dx = 0; out.dy = 0;
    if (rm) return out;
    switch (type) {
      case "BOOST": out.rot = TAU * this.easeOutCubic(p) * 0.5 * Math.sin(Math.PI * p); out.dy = -10 * s; out.dx = 6 * d; break;   // witch: staff twirl lift
      case "BOUNCE": out.dy = -14 * s; out.rot = -0.2 * s; out.sx = 1 - 0.03 * s * amp; out.sy = 1 + 0.06 * s * amp; break;         // fighter: fist-pump jump
      case "BRAKE": out.dx = 22 * s; out.dy = 6 * s; out.rot = 0.3 * s; out.sy = 1 - 0.07 * s * amp; break;                         // thief: duck and dodge sideways
      case "ANGLE": out.rot = TAU * this.easeOutCubic(p); out.dy = -18 * s; out.dx = 10 * s; break;                                  // jester: cartwheel spin
      case "DASH": out.dx = 3 * Math.sin(p * 60) * d; out.sx = 1 + 0.07 * d * amp; out.sy = 1 - 0.07 * d * amp; break;               // warrior: plants and braces (shudder)
      case "GUARD": out.dx = 8 * d; out.dy = -12 * this.easeOutCubic(p) * k; out.rot = 0.05 * s; out.sy = 1; out.sx = 1; break;      // sage: calm float-up
      case "STOPPER": out.rot = -0.22 * s; out.dy = 4 * Math.abs(Math.sin(TAU * p)); out.dx = 6 * d; break;                          // priest: deep bow / prayer bob
      default: out.dy = -8 * Math.abs(Math.sin(TAU * 1.5 * p)) * k; out.rot = 0.1 * Math.sin(TAU * 3 * p) * k; out.dx = 8 * d; break; // merchant: coin-counting bounce
    }
    return out;
  },
  // Per-character reaction to a SPECIAL near it (hero within ~700 px), p 0..1 over SP_T.
  castSpecial(out, type, p, amp, rm) {
    const s = Math.sin(Math.PI * p), TAU = Math.PI * 2;
    if (rm) { const u = 1 + 0.02 * s * amp; out.sx *= u; out.sy *= u; return out; }
    switch (type) {
      case "BOOST": out.rot += 0.25 * Math.sin(TAU * 2 * p) * s; out.dy -= 6 * s; break;          // witch: staff twirl
      case "BOUNCE": out.dy -= 10 * Math.abs(Math.sin(TAU * p)); out.rot -= 0.12 * s; break;      // fighter: fist pump x2
      case "BRAKE": out.dx -= 14 * s; out.dy += 4 * s; out.sy *= 1 - 0.05 * s; break;             // thief: ducks back
      case "ANGLE": out.rot += TAU * this.easeOutCubic(p); out.dy -= 12 * s; break;               // jester: celebratory spin
      case "DASH": out.sx *= 1 + 0.04 * s; out.sy *= 1 + 0.04 * s; out.dx += 1.5 * Math.sin(p * 50) * s; break; // warrior: plants, braces
      case "GUARD": out.dy -= 14 * s; out.rot += 0.03 * Math.sin(TAU * p); break;                 // sage: calm float-up
      case "STOPPER": out.rot -= 0.12 * Math.abs(Math.sin(TAU * p)); out.dy += 3 * Math.abs(Math.sin(TAU * p)); break; // priest: prayer bobs
      default: out.dy -= 7 * Math.abs(Math.sin(TAU * 2 * p)); out.rot += 0.08 * Math.sin(TAU * 4 * p); break; // merchant: coin-count bounce
    }
    return out;
  },
  // Truck: engine idle shimmy, revving on AIM_POWER, launch recoil + damped suspension bounce. No scaling.
  truck(out, state, t, launchAge, rm) {
    this.reset(out); if (!this.enabled) return out;
    if (rm) return out;
    if (state === "READY" || state === "AIM_ANGLE") out.dy = 0.8 * Math.sin(t * 34);
    else if (state === "AIM_POWER") { out.dy = 1.6 * Math.sin(t * 52); out.dx = -1.5 + Math.sin(t * 23); }
    if (launchAge >= 0 && launchAge < 0.5) {
      const e = Math.exp(-7 * launchAge);
      out.dx = -14 * e; out.dy = -6 * e * Math.cos(launchAge * 24); out.rot = -0.035 * e * Math.sin(launchAge * 24);
      if (launchAge > 0.12) { const u = (launchAge - 0.12) / 0.38, h = Math.sin(Math.PI * Math.min(1, u * 1.6)); // after-impact hop + skid
        out.dy -= 5 * h * (1 - u); out.rot += 0.03 * h * (1 - u); out.dx += 1.5 * Math.sin(launchAge * 70) * (1 - u); }
    }
    return out;
  },
  // Dust puff i (0..count-1) at age a: writes { x, y, r, alpha } relative to the impact point. Deterministic.
  dust(out, i, count, a, strength) {
    const p = a / 0.45, side = i % 2 ? 1 : -1, lane = (i >> 1) + 1;
    const ease = this.easeOutCubic(p);
    out.x = side * (8 + lane * 13 * strength) * (0.3 + ease);
    out.y = -3 - lane * 4 * ease * strength;
    out.r = (5 + lane * 2) * (0.6 + ease) * strength;
    out.alpha = p >= 1 ? 0 : 0.55 * (1 - p);
    return out;
  },
  // Per-frame event tracker (display cache only). Returns the ev object (reused).
  // The cache lives in a WeakMap keyed by visual, so draw never mutates game or visual.
  cache: new WeakMap(),
  track(g, visual) {
    let a = this.cache.get(visual);
    if (!a) this.cache.set(visual, a = { ev: { launchAge: Infinity, hitAge: Infinity, hitDir: 1, landAge: Infinity, specialAge: Infinity, effAge: Infinity, effKind: null, hitType: null, skid: 0, tier: 0 },
      bounces: 0, landAt: -Infinity, landX: 0, landV: 0, contact: null, hitAt: -Infinity, hitDir: 1, specials: 0, specialAt: -Infinity, state: null, used: new WeakMap(), pose: {}, puff: {},
      effect: null, effAt: -Infinity, effKind: null, hitType: null, specialX: 0 });
    const t = g.phaseTime, b = g.body;
    if (a.state !== g.state) {
      if (a.state === "FLYING" && g.state === "RESULT") { a.landAt = t; a.landX = b.x; a.landV = 0.6; }
      else if (g.state !== "FLYING") { a.landAt = -Infinity; a.hitAt = -Infinity; a.specialAt = -Infinity; }
      a.state = g.state; a.bounces = b.bounces; a.specials = g.specialSuccesses;
    }
    if (b.bounces > a.bounces) { a.landAt = t; a.landX = b.x; a.landV = Math.min(1.4, 0.6 + Math.abs(b.vy) / 900); }
    a.bounces = b.bounces;
    if (g.contact && g.contact !== a.contact) { a.hitAt = t; a.hitDir = b.vy > 0 ? -1 : 1; }
    if (g.specialSuccesses > a.specials) { a.specialAt = t; a.specialX = b.x; }
    if (g.contact && g.contact !== a.contact) a.hitType = String(g.contact.label).split(" ")[0];
    const fx = g.effect, fk = fx && fx !== a.effect ? (fx.label === "AERIAL UP" ? "UP" : fx.label === "AERIAL DOWN" ? "DOWN" : fx.label === "BOUND BOOST" ? "BOUNCE" : null) : null;
    if (fk) { a.effAt = t; a.effKind = fk; }
    else if (g.contact && g.contact !== a.contact && (a.hitType === "BOOST" || a.hitType === "DASH" || a.hitType === "BOUNCE")) { a.effAt = t; a.effKind = a.hitType; }
    a.effect = fx;
    a.specials = g.specialSuccesses;
    const ev = a.ev;
    ev.launchAge = Math.max(0, t - visual.launchAt); ev.hitAge = Math.max(0, t - a.hitAt); ev.hitDir = a.hitDir;
    a.contact = g.contact;
    ev.landAge = Math.max(0, t - a.landAt); ev.specialAge = Math.max(0, t - a.specialAt);
    ev.effAge = Math.max(0, t - a.effAt); ev.effKind = a.effKind; ev.hitType = a.hitType;
    ev.skid = g.state === "FLYING" && b.grounded && !b.stopped && b.vx > 0 ? Math.min(1, b.vx / 600) : 0;
    const m = g.finalDistance ?? 0; ev.tier = m >= 400 ? 2 : m >= 150 ? 1 : 0;
    if (!Number.isFinite(ev.launchAge)) ev.launchAge = Infinity;
    return a;
  },
  // Seconds since a SPECIAL fired within 700 px of this object (display only).
  specialNear(a, object, t) { return a.ev.specialAge < this.SP_T && Math.abs(object.x - a.specialX) < 700 ? a.ev.specialAge : Infinity; },
  usedAge(a, object, t) {
    if (!object.used) { a.used.delete(object); return Infinity; }
    let at = a.used.get(object);
    if (at === undefined || at > t) { at = t; a.used.set(object, at); }
    return t - at;
  }
};

// Smooth display helpers (pure easing / spring math + a per-visual display cache). Display only: reads game state,
// never writes it, so physics steps, RNG, distances and results are identical with or without smoothing.
Hop.Smooth = {
  BLEND: 0.12,  // s, pose cross-fade on a state change
  FADE: 0.11,   // s, sprite clip cross-fade
  CAM_W: 10, CAM_WY: 14, CAM_Y_LAG: 90, LOOK_K: 0.06, LOOK_MAX: 100, ROT_RATE: 12,
  lerp(a, b, u) { return a + (b - a) * u; },
  clamp01(u) { return u < 0 ? 0 : u > 1 ? 1 : u; },
  smoothstep(u) { u = this.clamp01(u); return u * u * (3 - 2 * u); },
  easeInOutCubic(u) { u = this.clamp01(u); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; },
  easeOutCubic(u) { u = this.clamp01(u); return 1 - (1 - u) ** 3; },
  wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); },
  // Critically damped spring, exact for any dt (stable for tab-return spikes; no overshoot from rest).
  spring(st, key, target, w, dt) {
    const y = st[key] - target, v = st[key + "V"], e = Math.exp(-w * dt), j = (v + w * y) * dt;
    st[key] = target + (y + j) * e; st[key + "V"] = (v - w * j) * e;
  },
  // Interpolated body position (fixed step + alpha): between the previous and the current physics step.
  interp(g, out) {
    const a = g.state === "FLYING" && Number.isFinite(g.renderAlpha) ? g.renderAlpha : 1;
    const px = Number.isFinite(g.renderPrevX) ? g.renderPrevX : g.body.x, py = Number.isFinite(g.renderPrevY) ? g.renderPrevY : g.body.y;
    out.bx = px + (g.body.x - px) * a; out.by = py + (g.body.y - py) * a; return out;
  },
  // Roadside reaction weight from the hero's offset (dx = hero - character, world px) and height.
  near(dx, heroY) {
    if (heroY > 260 || dx < -420 || dx > 420) return 0;
    const h = 1 - Math.max(0, heroY) / 260, q = dx / 160; // continuous: 0 when overhead, + approaching, - just passed
    return -Math.tanh(dx / 55) * Math.exp(-q * q) * h;
  },
  cache: new WeakMap(),
  frame(g, visual) {
    let d = this.cache.get(visual);
    const c = Hop.CONFIG, rm = !!visual.reducedMotion || !Hop.Anim.enabled;
    if (!d) this.cache.set(visual, d = { camX: g.cameraX, camXV: 0, camY: g.cameraY, camYV: 0, look: 0, lookV: 0, rot: 0, bx: 0, by: 0, time: 0, lastTime: -1,
      state: null, blendAt: -Infinity, from: { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 }, last: { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0 },
      layer: { asset: null, time: 0, scale: 1 }, prevLayer: { asset: null, time: 0, scale: 1 }, fadeAt: -Infinity, fade: { asset: null, time: 0, scale: 1, alpha: 0 }, rm });
    const time = Number.isFinite(g.displayTime) ? g.displayTime : g.phaseTime;
    const dt = d.lastTime < 0 ? 0 : Math.max(0, Math.min(0.1, time - d.lastTime));
    d.lastTime = time; d.time = time; d.rm = rm;
    this.interp(g, d); const px = d.bx, py = d.by;
    const prelaunch = g.state === "READY" || g.state === "AIM_ANGLE" || g.state === "AIM_POWER";
    const look = rm || g.state !== "FLYING" ? 0 : Math.min(this.LOOK_MAX, Math.max(0, g.body.vx * this.LOOK_K));
    const tx = Math.max(0, c.launchX + px - c.cameraAnchorX), ty = Math.max(0, py - (c.groundY - 160));
    if (prelaunch || dt === 0 && d.state === null) { d.camX = g.cameraX; d.camXV = 0; d.camY = g.cameraY; d.camYV = 0; d.look = 0; d.lookV = 0; }
    else {
      this.spring(d, "look", look, 4, dt);
      this.spring(d, "camX", Math.max(0, tx + d.look), this.CAM_W, dt);
      this.spring(d, "camY", ty, this.CAM_WY, dt);
      if (d.camY < ty - this.CAM_Y_LAG) { d.camY = ty - this.CAM_Y_LAG; d.camYV = Math.max(0, d.camYV); } // keep a high shot on screen
      if (d.camY < 0) { d.camY = 0; d.camYV = 0; }
    }
    // Tilt from velocity, eased toward its target (impulses / bounces no longer snap the sprite).
    const tilt = Hop.Sprites?.tiltWeight ? Hop.Sprites.tiltWeight(visual, g.phaseTime) : 1;
    const target = g.state === "FLYING" && !rm && tilt > 0 ? Math.max(-0.7, Math.min(0.7, -g.body.vy / 1200)) * tilt : 0;
    d.rot = prelaunch || dt === 0 && d.state === null ? target : d.rot + (target - d.rot) * (1 - Math.exp(-this.ROT_RATE * dt));
    if (g.state !== d.state) { if (d.state !== null) { Object.assign(d.from, d.last); d.blendAt = time; } d.state = g.state; }
    Hop.Graphics.lastDisplay = d.out || (d.out = {});
    const o = d.out; o.heroX = c.launchX + px - d.camX; o.heroY = c.groundY + d.camY - c.playerRadius - py; o.camX = d.camX; o.camY = d.camY; o.rot = d.rot;
    return d;
  },
  // Cross-fade the hero pose from the last drawn pose for BLEND s after a state change (writes into pose).
  blendPose(d, pose, state) {
    const u = this.easeInOutCubic((d.time - d.blendAt) / this.BLEND);
    if (u < 1) {
      const f = d.from;
      pose.sx = this.lerp(f.sx, pose.sx, u); pose.sy = this.lerp(f.sy, pose.sy, u); pose.dx = this.lerp(f.dx, pose.dx, u); pose.dy = this.lerp(f.dy, pose.dy, u);
      pose.rot = this.lerp(this.wrapAngle(f.rot), this.wrapAngle(pose.rot), u);
    }
    const l = d.last; l.sx = pose.sx; l.sy = pose.sy; l.rot = this.wrapAngle(pose.rot); l.dx = pose.dx; l.dy = pose.dy;
    return pose;
  },
  // Sprite clip bookkeeping: remember the first layer drawn this frame; a different asset starts a fade.
  noteLayer(d, layer) {
    if (d.layerNoted === d.time) return; d.layerNoted = d.time;
    const cur = d.layer;
    if (cur.asset && cur.asset !== layer.asset) { Object.assign(d.prevLayer, cur); d.fadeAt = d.time; }
    cur.asset = layer.asset; cur.time = layer.time; cur.scale = layer.scale;
  },
  layerFade(d) {
    if (d.rm || !d.prevLayer.asset || d.state === "READY" || d.state === "AIM_ANGLE" || d.state === "AIM_POWER") return null;
    const u = (d.time - d.fadeAt) / this.FADE;
    if (u >= 1 || u < 0) return null;
    const f = d.fade; f.asset = d.prevLayer.asset; f.time = d.prevLayer.time; f.scale = d.prevLayer.scale; f.alpha = 1 - this.smoothstep(u);
    return f;
  }
};
