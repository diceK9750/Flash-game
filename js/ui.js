"use strict";
Hop.UI = class {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.fields = Object.fromEntries(["state", "angle", "power", "distance", "height", "speed", "final", "hint", "up-status", "down-status", "contact-status"].map(id => [id, document.getElementById(id)]));
    this.overlay = document.getElementById("overlay");
    this.lastState = null;
    this.notices = { special: null, message: null, charge: 1, guard: false };
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.visual = { launchAt: -Infinity, contactAt: -Infinity, lastContact: null, oneShot: null, lastEffect: null, lastBounces: 0, lastSpecialSuccesses: 0, lastMerchantSuccesses: 0, stopAt: null, frozenAt: null, reducedMotion: motion?.matches || false };
    motion?.addEventListener?.("change", event => { this.visual.reducedMotion = event.matches; });
    this.initBacking();
  }
  // Display-only: the canvas backing store follows its CSS width x devicePixelRatio (clamped to
  // 1280..2560 wide, 16:9) so DPR2 screens are not upscaled from 1280x720. Game coordinates stay
  // 1280x720 through a base transform applied at the start of every draw; physics, hit boxes,
  // CSS layout and input (stage pointerdown, no coordinates) are unaffected.
  static backingSize(cssWidth, dpr) {
    const c = Hop.CONFIG, css = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : c.width;
    const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const width = Math.min(c.width * 2, Math.max(c.width, Math.round(css * ratio)));
    return { width, height: Math.round(width * c.height / c.width) };
  }
  resizeBacking() {
    const size = Hop.UI.backingSize(this.canvas.clientWidth, window.devicePixelRatio);
    if (this.canvas.width !== size.width || this.canvas.height !== size.height) { this.canvas.width = size.width; this.canvas.height = size.height; }
    this.backing = size; this.backingDpr = window.devicePixelRatio;
    return size;
  }
  initBacking() {
    this.resizeBacking();
    const resize = () => this.resizeBacking();
    window.addEventListener?.("resize", resize);
    if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(this.canvas);
  }
  update() {
    const g = this.game, c = Hop.CONFIG, s = Hop.STATES;
    this.updateQuality();
    if (g.soundEvent) { Hop.Audio?.play(g.soundEvent); g.soundEvent = null; }
    const launched = g.state === s.FLYING && this.lastState === s.AIM_POWER;
    if (launched) this.visual.launchAt = g.phaseTime;
    if (g.state === s.READY || g.state === s.AIM_ANGLE) this.visual.launchAt = -Infinity;
    // Display-only hero one-shots. A new AERIAL effect object or a new normal ground
    // bounce (body.bounces grew, still airborne, no new Type D "BOUND BOOST") starts the
    // sprite; Hop.Sprites.startOneShot applies the priority table (SPECIAL_REACTION is never cut
    // by HIT / AERIAL / GROUND_BOUNCE). Settling into rolling does not trigger.
    const v = this.visual, sp = Hop.Sprites;
    // RESULT keeps the last FLIGHT_LOOP frame when no STOP_RESULT plays (frozenAt = RESULT entry).
    if (g.state === s.RESULT) { if (!Number.isFinite(v.frozenAt)) v.frozenAt = g.phaseTime; }
    else v.frozenAt = null;
    if (g.state !== s.FLYING) { v.oneShot = null; v.lastEffect = g.effect; v.lastBounces = g.body.bounces; v.lastSpecialSuccesses = g.specialSuccesses; v.lastMerchantSuccesses = g.merchantStats.successes; }
    else {
      const fresh = g.effect !== v.lastEffect ? g.effect : null;
      const bounced = g.body.bounces > v.lastBounces;
      const specialOk = g.specialSuccesses > v.lastSpecialSuccesses || g.merchantStats.successes > v.lastMerchantSuccesses;
      v.lastEffect = g.effect; v.lastBounces = g.body.bounces; v.lastSpecialSuccesses = g.specialSuccesses; v.lastMerchantSuccesses = g.merchantStats.successes;
      // Without a loaded GROUND_BOUNCE asset a bounce changes nothing (an AERIAL keeps playing);
      // restart interval / tiny-hop gating lives in Hop.Sprites.groundBounceAllowed.
      // Truck impact at launch: HIT one-shot (only with a loaded asset; otherwise unchanged).
      if (launched && sp?.heroHit?.ready) sp.startOneShot(v, "HIT", g.phaseTime);
      if (bounced && fresh?.label !== "BOUND BOOST" && !g.body.grounded && sp?.groundBounceAllowed?.(v, g.phaseTime, g.body.vy)) sp.startOneShot(v, "GROUND_BOUNCE", g.phaseTime);
      const aerial = /^AERIAL (UP|DOWN)$/.exec(fresh?.label || "");
      if (aerial && sp?.startOneShot) sp.startOneShot(v, "AERIAL_" + aerial[1], g.phaseTime);
      // SPECIAL success (specialSuccesses grew via resolveSpecial(true), or a MERCHANT SPECIAL
      // success; MISS does not). Display-only.
      if (specialOk && sp?.heroSpecialReaction?.ready) sp.startOneShot(v, "SPECIAL_REACTION", g.phaseTime);
    }
    // STOP_RESULT clock: set on the first update after a full stop on the ground, cleared when
    // the hero moves again (Type B revive) or on RETRY (READY / AIM).
    if (Hop.Sprites?.stopResultEligible?.(g)) { if (!Number.isFinite(v.stopAt)) v.stopAt = g.phaseTime; }
    else v.stopAt = null;
    if (g.contact !== this.visual.lastContact) { this.visual.lastContact = g.contact; this.visual.contactAt = g.phaseTime; }
    document.getElementById("best-summary").textContent = `BEST ${g.best.distance.toFixed(1)} m`;
    document.getElementById("aim-display").hidden = ![s.AIM_ANGLE, s.AIM_POWER].includes(g.state);
    document.getElementById("aim-title").textContent = g.state === s.AIM_ANGLE ? `角度 ${g.angle.toFixed(1)}°` : `パワー ${Math.round(g.power * 100)}%`;
    document.getElementById("aim-fill").style.width = `${g.state === s.AIM_ANGLE ? (g.angle - c.angleMin) / (c.angleMax - c.angleMin) * 100 : g.power * 100}%`;
    const set = (id, value) => { if (this.fields[id].textContent !== value) this.fields[id].textContent = value; };
    set("state", g.state); set("angle", `${g.angle.toFixed(1)}°`);
    set("power", `${Math.round(g.power * 100)}%`);
    set("distance", `${(g.body.x / c.pixelsPerMeter).toFixed(1)} m`);
    set("height", `${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m`);
    set("speed", `${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s`);
    set("final", g.finalDistance === null ? "—" : `${g.finalDistance.toFixed(1)} m`);
    const airborne = g.airborne();
    const floating = g.merchant?.type === "C";
    const armed = [g.guardSpecial.active ? `GUARD SPECIAL ${g.guardSpecial.remaining.toFixed(1)}s` : ""].filter(Boolean);
    document.getElementById("special-state").textContent = armed.join(" · ");
    document.getElementById("special-state").hidden = !armed.length;
    document.getElementById("guard-status").textContent = `GUARD × ${g.normalGuard}`;
    document.getElementById("debug-status").hidden = !g.debug;
    document.getElementById("history").textContent = `CONTACT / ${g.history.slice(-8).map(entry => `${Hop.CAST[entry.type]?.name || entry.type} (${entry.label})`).join(" → ") || "—"}`;
    // Display only: a SPECIAL SUCCESS panel (normal or merchant) waits while the cut-in covers the stage
    // (Graphics.specialCutinCovering: until its fade-out / the reducedMotion still ends), then stays for
    // specialMessageDuration of game time — the same length as before — even after game.specialMessage
    // expires. MISS / other messages are unchanged. The aria-live announcement is not delayed.
    if (g.specialMessage && g.specialMessage !== this.panelMessage) {
      this.panelMessage = g.specialMessage;
      this.successPanel = g.specialMessage.label === "SPECIAL SUCCESS" && g.specialCutin
        ? { title: "SPECIAL SUCCESS!", detail: g.specialMessage.detail || "", waiting: true, remaining: c.specialMessageDuration, clock: g.phaseTime } : null;
    }
    const held = this.successPanel;
    if (held) {
      const dt = Math.max(0, g.phaseTime - held.clock); held.clock = g.phaseTime;
      if (held.waiting) held.waiting = !!Hop.Graphics?.specialCutinCovering?.(g.specialCutin, this.visual.reducedMotion);
      else held.remaining -= dt;
      if (g.special || g.state !== s.FLYING || held.remaining <= 0) this.successPanel = null;
    }
    const success = this.successPanel;
    const specialPanel = document.getElementById("special-panel");
    specialPanel.className = g.special ? "special-panel" : "special-panel resolved";
    specialPanel.hidden = !g.special && success ? success.waiting
      : (g.state !== s.FLYING && !(g.state === s.RESULT && g.specialMessage?.label === "SPECIAL MISS" && Date.now() < this.messageUntil)) || (!g.special && !g.specialMessage);
    document.getElementById("special-title").textContent = g.special ? (g.special.merchantType ? "MERCHANT SPECIAL!" : "SPECIAL!") : success ? success.title : (g.specialMessage?.label === "SPECIAL SUCCESS" ? "SPECIAL SUCCESS!" : g.specialMessage?.label || "");
    document.getElementById("special-detail").textContent = g.special ? (g.special.merchantType ? `商人 Type ${g.special.merchantType} / ${c.merchantNames[g.special.merchantType]}` : `${Hop.CAST[g.special.type].name} / ${c.specials[g.special.type].name}`) + " · タップ / クリック" : success ? success.detail : g.specialMessage?.detail || "";
    document.getElementById("special-track").hidden = !g.special;
    document.getElementById("special-fill").style.width = `${g.special ? 100 * g.special.remaining / c.specialWindow : 0}%`;
    document.getElementById("special-rules").textContent = `受付 ${c.specialWindow}秒。BOOST→BOUNCE隣接でBOOST SPECIAL、BOUNCE→BOOST隣接でBOUNCE SPECIAL（未使用キャラのx順）。DASH後、BOOST・BOUNCE・STOPPERに触れず再DASHでDASH SPECIAL。BOOST・BOUNCE・DASH後、地面バウンド・GUARD接触なしでSTOPPER SPECIAL。通常GUARDまたはGUARD SPECIAL中、各${c.boundaryMeters}m区間の最後${c.merchantZoneMeters}mから、その境界ちょうどのBOOST・BOUNCE・DASH・STOPPERに当たると、まれに（${Math.round(c.merchantChance * 100)}%）隠しキャラの商人SPECIAL（外れたら通常どおり判定）。BRAKE：AERIAL DOWN成功後、地面・他キャラ・UPなしで接触。ANGLE：接触時10%抽選。GUARD：通常GUARDを持って再GUARD。`;
    const chargeText = g.downCharge >= 1 ? "READY" : `${Math.min(99, Math.floor(g.downCharge * 100 + 1e-9))}%`;
    document.getElementById("down-charge").value = g.downCharge;
    set("up-status", `AERIAL ↑ ×${g.upRemaining}`);
    set("down-status", floating ? "AERIAL / 浮遊中は使用不可" : g.special ? "DOWN / SPECIAL受付中" : g.state === s.RESULT ? "DOWN / 終了" : `AERIAL ↓ ${chargeText}`);
    set("contact-status", `CONTACT / ${g.contact ? Hop.CAST[g.contact.label.split(" ")[0]]?.name || g.contact.label : "—"}`);
    const contactTag = document.getElementById("contact-tag");
    contactTag.hidden = g.state !== s.FLYING || !g.contact || !!g.special || !!g.specialMessage || !!this.successPanel;
    const contactType = g.contact?.label.split(" ")[0];
    contactTag.textContent = g.contact ? `${Hop.CAST[contactType]?.name || contactType} · ${g.contact.label.includes("GUARD BLOCK") ? "結界でガード！" : Hop.CAST[contactType]?.effect || g.contact.label}` : "";
    contactTag.style.color = this.objectColor(g.contact?.label);
    const labels = { READY: "画面をタップ / クリック", AIM_ANGLE: "タップで角度決定", AIM_POWER: "タップで発射", RESULT: "画面をタップしてRETRY" };
    const mode = g.aerialMode;
    const flightHint = g.special ? "TAP → SPECIAL!" : floating ? "FLOAT / 浮遊中" : !airborne ? "AERIAL / 空中で使用可能" : mode === "DOWN" ? `AERIAL ↓ ${chargeText}` : `AERIAL ↑ ×${g.upRemaining}`;
    set("hint", labels[g.state] || flightHint);
    // Display only: let a playing STOP_RESULT show through, then fade the overlay in. Runs every
    // update (before the state-change early return). The overlay stays un-hidden with the same
    // content, aria and tap handling; only its opacity changes.
    const overlayAlpha = Hop.Sprites?.resultOverlayAlpha ? Hop.Sprites.resultOverlayAlpha(this.visual, g.phaseTime, g.state) : 1;
    const opacity = overlayAlpha >= 1 ? "" : String(Math.round(overlayAlpha * 1000) / 1000);
    if (this.overlay.style.opacity !== opacity) this.overlay.style.opacity = opacity;
    if (g.state === this.lastState) return;
    this.lastState = g.state;
    document.getElementById("result-highlights").textContent = g.state === s.RESULT ? "今回のハイライト：" + Hop.UI.highlights(g).join(" · ") : "";
    this.overlay.hidden = g.state !== s.READY && g.state !== s.RESULT;
    document.getElementById("flight-tag").hidden = g.state !== s.FLYING;
    document.getElementById("overlay-label").textContent = g.state === s.RESULT ? "FINAL DISTANCE / 最終飛距離" : "ONE LAUNCH. HOW FAR?";
    document.getElementById("overlay-title").textContent = g.state === s.RESULT ? `${g.finalDistance.toFixed(1)} m` : "勇者、空の旅へ！";
    document.getElementById("overlay-detail").textContent = g.state === s.RESULT ? `${g.body.bounces} 回の地面接触 · 角度 ${g.angle.toFixed(1)}° · パワー ${Math.round(g.power * 100)}%` : "角度とパワーを決めて、飛距離に挑戦。";
    document.getElementById("overlay-prompt").textContent = g.state === s.RESULT ? "画面をタップしてRETRY" : "画面をタップ / クリック";
    document.getElementById("result-stats").hidden = g.state !== s.RESULT;
    if (g.state === s.RESULT) {
      document.getElementById("record-status").textContent = g.debugUsed ? "DEBUG PLAY / 記録対象外" : g.newRecords.length ? "NEW RECORD!" : "FLIGHT RECORD";
      document.getElementById("result-distance").textContent = `${g.finalDistance.toFixed(1)} m`;
      document.getElementById("result-best").textContent = `${g.best.distance.toFixed(1)} m`;
      document.getElementById("result-height").textContent = `${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m`;
      document.getElementById("result-speed").textContent = `${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s`;
      document.getElementById("contact-totals").textContent = `接触総数 ${g.history.length} / SPECIAL発生 ${g.specialCount} / 成功 ${g.specialSuccesses}`;
      document.getElementById("merchant-totals").textContent = `商人SPECIAL発生 ${g.merchantStats.attempts} / 成功 ${g.merchantStats.successes} / 最終Type ${g.merchantStats.lastType || "—"} / 復活 ${g.merchantStats.revives}`;
      document.getElementById("type-counts").textContent = Object.entries(g.counts).map(([type, count]) => `${Hop.CAST[type].name} ${type} ${count}`).join(" · ");
      document.getElementById("best-comparison").textContent = [
        `DISTANCE 今回 ${g.finalDistance.toFixed(1)} m / BEST ${g.best.distance.toFixed(1)} m`,
        `HEIGHT 今回 ${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m / BEST ${g.best.height.toFixed(1)} m`,
        `SPEED 今回 ${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s / BEST ${g.best.speed.toFixed(1)} m/s`
      ].join("\n");
      document.getElementById("storage-status").textContent = g.debugUsed ? "このDEBUGプレイは自己ベストを更新・保存していません。" : g.storageAvailable ? "自己ベストはこのブラウザに保存されます。" : "保存領域を使用できません。自己ベストは今回の起動中のみ保持します。";
    }
  }
  static zone(g) {
    const c = Hop.CONFIG;
    if (g.state !== Hop.STATES.FLYING || !(g.normalGuard || g.guardSpecial.active) || g.special) return null;
    const distance = g.body.x / c.pixelsPerMeter;
    const boundary = Math.max(c.boundaryMeters, Math.ceil(distance / c.boundaryMeters) * c.boundaryMeters);
    const remaining = boundary - distance;
    return remaining >= 0 && remaining <= c.merchantZoneMeters ? { boundary, remaining } : null;
  }
  static readyTargets(g) {
    if (g.state !== Hop.STATES.FLYING || g.special || g.specialMessage || g.merchant?.type === "C") return [];
    const c = Hop.CONFIG, zone = Hop.UI.zone(g);
    const future = g.objects.filter(o => !o.used).sort((a, b) => a.x - b.x);
    return future.flatMap(object => {
      const x = c.launchX + object.x - g.cameraX;
      if (x < 0 || x > c.width || object.x < g.body.x - c.objectWidth / 2 - c.playerRadius) return [];
      const rule = c.specials[object.type];
      const partner = future.find(o => o.x > object.x);
      const eligible = rule && (rule.trigger === "adjacent" ? partner?.type === rule.partner :
        rule.trigger === "guard" ? g.normalGuard && !g.guardSpecial.active :
        rule.trigger === "chance" ? false : g.specialArmed[rule.trigger]);
      const merchant = zone && Math.abs(object.x / c.pixelsPerMeter - zone.boundary) < 1e-7 && c.merchantTypes[object.type];
      // The merchant is a rare draw (merchantChance), so its preview only promises a chance ("MERCHANT?");
      // a guaranteed ordinary SPECIAL keeps its own label.
      return merchant || eligible ? [{ object, label: eligible ? "SPECIAL" : "MERCHANT?" }] : [];
    });
  }
  static highlights(g) {
    const ranked = g.history.map(entry => {
      const merchant = entry.label.match(/MERCHANT TYPE ([A-D])/);
      if (merchant) return { rank: 0, text: "🎒 商人 Type " + merchant[1] };
      if (entry.label === entry.type + " SPECIAL") return { rank: entry.type === "STOPPER" ? 1 : 2, text: entry.type === "STOPPER" ? "⚡ 僧侶「" + Hop.CONFIG.specials[entry.type].name + "」" : "✨ " + Hop.CAST[entry.type].name + " SPECIAL" };
      if (entry.label.includes("GUARDED")) return { rank: 3, text: "🛡 " + Hop.CAST[entry.type].name + "をGUARD BLOCK" };
      return null;
    }).filter(Boolean).sort((a, b) => a.rank - b.rank);
    return ranked.length ? [...new Set(ranked.map(item => item.text))].slice(0, 3) : [g.history.length + "回の接触・" + g.body.bounces + "回バウンド"];
  }
  updateQuality() {
    const g = this.game, c = Hop.CONFIG, flying = g.state === Hop.STATES.FLYING;
    const el = id => document.getElementById(id);
    el("stage").className = flying ? "stage flying" : "stage";
    el("se-toggle").textContent = Hop.Audio?.muted ? "SE OFF" : "SE ON";
    el("se-toggle").setAttribute("aria-pressed", String(!!Hop.Audio?.muted));
    el("flight-hud").hidden = !flying;
    el("aerial-hud").className = g.special ? "subdued" : "";
    const charge = g.downCharge >= 1 ? "READY" : Math.min(99, Math.floor(g.downCharge * 100 + 1e-9)) + "%";
    el("aerial-hud-text").textContent = g.special ? "SPECIAL優先" : g.merchant?.type === "C" ? "AERIAL 使用不可" : !g.airborne() ? "AERIAL / 空中のみ" : g.aerialMode === "UP" ? "AERIAL ↑ ×" + g.upRemaining : "AERIAL ↓ " + charge;
    el("aerial-hud-charge").value = g.downCharge;
    el("aerial-hud-charge").hidden = !!g.special || g.merchant?.type === "C" || g.aerialMode === "UP";
    const m = g.merchant;
    el("merchant-hud").hidden = !m;
    el("merchant-hud-text").textContent = !m ? "" : m.type === "A" ? "🧪 TYPE A ×" + m.remaining : m.type === "B" ? "⚡ CHARGE " + m.charge + "/" + c.typeBMaxCharge : m.type === "C" ? "FLOAT " + m.remaining + "/" + c.typeCCount : "BOUND ×" + m.remaining;
    el("merchant-hud-charge").hidden = m?.type !== "B";
    el("merchant-hud-charge").value = m?.type === "B" ? m.charge / c.typeBMaxCharge : 0;
    this.visual.readyTargets = Hop.UI.readyTargets(g);
    const targets = new Set(this.visual.readyTargets.filter(t => t.label === "SPECIAL").map(t => Hop.CAST[t.object.type].name));
    if (flying && !g.special && !g.specialMessage && m?.type !== "C") {
      for (const [key, type] of [["dash", "DASH"], ["stopper", "STOPPER"], ["brake", "BRAKE"]]) if (g.specialArmed[key]) targets.add(Hop.CAST[type].name);
    }
    el("ready-targets").hidden = !targets.size;
    el("ready-targets").textContent = targets.size ? "SPECIAL READY · 対象：" + [...targets].join(" / ") : "";
    const zone = Hop.UI.zone(g);
    el("merchant-zone").hidden = !zone || !!g.specialMessage;
    el("merchant-zone").textContent = zone ? "MERCHANT ZONE · あと " + zone.remaining.toFixed(1) + "m" : "";
    // Announce edges only: never percent, seconds or a repeated frame.
    const events = [];
    if (g.specialMessage && g.specialMessage !== this.notices.message) this.messageUntil = Date.now() + g.specialMessage.remaining * 1000;
    if (g.special && g.special !== this.notices.special) events.push((g.special.merchantType ? "商人 Type " + g.special.merchantType : Hop.CAST[g.special.type].name) + " SPECIAL受付開始");
    else if (g.specialMessage && g.specialMessage !== this.notices.message && (g.specialMessage.label !== this.notices.message?.label || g.specialMessage.detail !== this.notices.message?.detail)) events.push(g.specialMessage.label + (g.specialMessage.detail ? " · " + g.specialMessage.detail : ""));
    if (flying && g.guardSpecial.active !== this.notices.guard) events.push(g.guardSpecial.active ? "GUARD SPECIAL開始" : "GUARD SPECIAL終了");
    if (flying && g.downCharge >= 1 && this.notices.charge < 1) events.push("AERIAL DOWN READY");
    const notice = events.join(" · "), live = el("announcements");
    if (notice && live.textContent !== notice) live.textContent = notice;
    else if (!notice && ((this.notices.charge >= 1 && g.downCharge < 1) || (!flying && g.state !== Hop.STATES.RESULT)) && live.textContent) live.textContent = "";
    this.notices = { special: g.special, message: g.specialMessage, charge: g.downCharge, guard: g.guardSpecial.active };
  }
  objectColor(type) { return Hop.Graphics.objectColor(type); }
  draw() {
    // devicePixelRatio can change (zoom, another monitor) without a CSS size change.
    if (window.devicePixelRatio !== this.backingDpr) this.resizeBacking();
    const c = Hop.CONFIG, b = this.backing;
    this.ctx.setTransform(b.width / c.width, 0, 0, b.height / c.height, 0, 0);
    Hop.Graphics.draw(this.ctx, this.game, this.visual);
  }
};
