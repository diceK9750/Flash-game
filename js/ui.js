"use strict";
Hop.UI = class {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.fields = Object.fromEntries(["state", "angle", "power", "distance", "height", "speed", "final", "hint", "up-status", "down-status", "contact-status"].map(id => [id, document.getElementById(id)]));
    this.overlay = document.getElementById("overlay");
    this.lastState = null;
    this.notices = { special: null, message: null, charge: 1, guard: false };
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.visual = { launchAt: -Infinity, contactAt: -Infinity, lastContact: null, oneShot: null, lastEffect: null, lastBounces: 0, lastSpecialSuccesses: 0, lastMerchantSuccesses: 0, flightVoicePlayed: false, stopAt: null, frozenAt: null, reducedMotion: motion?.matches || false };
    // Follow live OS changes; older Safari (< 14) only has the legacy addListener (2026-10-17 cycle 23).
    const follow = event => { this.visual.reducedMotion = event.matches; };
    if (motion?.addEventListener) motion.addEventListener("change", follow); else motion?.addListener?.(follow);
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
    // Landing impact SE (cycle 15): once per display frame with new ground impacts, tier from the impact speed.
    const bn = g.body?.bounces || 0;
    if (g.state === s.FLYING && bn > (this.lastBounces ?? bn)) { const vy = g.lastImpactVy || 0, k = vy >= c.landImpactHard ? "LAND_HARD" : vy >= c.landImpactSoft ? "LAND_SOFT" : null; if (k) { try { Hop.Audio?.play?.(k); } catch { /* SE is optional. */ } } }
    this.lastBounces = g.state === s.FLYING ? bn : 0;
    // GUARD SPECIAL end cue (2026-10-17 cycle 29, display/sound only): when 聖護結界 runs out mid-flight, a soft
    // falling shimmer + one fading ring, so the player knows STOPPER can stop them again.
    const gActive = !!g.guardSpecial?.active;
    if (g.state === s.FLYING && this.visual.guardWasActive && !gActive) {
      this.visual.guardEndAt = g.displayTime || 0;
      try { Hop.Audio?.play?.("GUARD_END"); } catch { /* SE is optional. */ }
    }
    if (g.state !== s.FLYING) this.visual.guardEndAt = null;
    this.visual.guardWasActive = g.state === s.FLYING && gActive;
    // AERIAL ↓ READY cue (2026-10-17 cycle 27, display/sound only): once per recharge, at the moment a tap would
    // really dive (same conditions as the canvas HUD "AERIAL ↓ READY"); a run's initial full charge never cues.
    const v27 = this.visual;
    if (g.state !== s.FLYING) { v27.downCueArmed = false; v27.downCueAt = null; }
    else if (g.downCharge < 1) v27.downCueArmed = true;
    else if (v27.downCueArmed && Hop.UI.downReadyNow(g)) {
      v27.downCueArmed = false; v27.downCueAt = g.displayTime || 0;
      try { Hop.Audio?.play?.("DOWN_READY"); } catch { /* SE is optional. */ }
    }
    if (g.soundEvent) {
      const sound = g.soundEvent; Hop.Audio?.play(sound); g.soundEvent = null;
      if (sound === "SPECIAL_MERCHANT") {
        const type = g.specialCutin?.merchantType || g.merchant?.type || g.merchantStats.lastType;
        if (type && "ABCD".includes(type)) Hop.Voice?.play?.("special_merchant_" + type.toLowerCase(), g.debug, "MERCHANT_SUCCESS_" + type);
      } else if (sound.startsWith("SPECIAL_")) {
        const type = sound.slice("SPECIAL_".length).toLowerCase();
        Hop.Voice?.play?.("special_" + type, g.debug, sound);
      }
    }
    // Combo scenes: the game picks the short version from this preference when a scene starts; the scene SE
    // track starts with the scene and is stopped when it is skipped (or on RETRY).
    if (g.comboShort !== !!this.visual.reducedMotion) g.comboShort = !!this.visual.reducedMotion;
    if (g.combo && g.combo !== this.comboSeen) {
      this.comboSeen = g.combo;
      Hop.Audio?.playCombo?.(`COMBO_${g.combo.type === "BOOST" ? "WITCH" : "FIGHTER"}${g.combo.short ? "_SHORT" : ""}`, g.combo.elapsed, g.combo.rate || 1);
      this.comboFinishVoicePlayed = false;
      const kind = g.combo.type === "BOOST" ? "witch" : "fighter";
      const id = g.combo.short ? `combo_${kind}_short` : `combo_${kind}_call`;
      const event = g.combo.short ? `COMBO_${kind.toUpperCase()}_REDUCED_MOTION` : `COMBO_${kind.toUpperCase()}_START`;
      Hop.Voice?.play?.(id, g.debug, event);
    } else if (!g.combo && this.comboSeen) {
      if (this.comboSeen.skipped || g.state !== s.FLYING) {
        Hop.Audio?.stopCombo?.();
        try { Hop.Voice?.stop?.(); } catch { /* Optional voice interruption must not affect gameplay. */ }
      }
      this.comboSeen = null;
      this.comboFinishVoicePlayed = false;
    }
    if (g.combo && !g.combo.short && !this.comboFinishVoicePlayed) {
      const witch = g.combo.type === "BOOST", threshold = witch ? c.comboWitchTimes.blast : c.comboFighterTimes.upper;
      if (g.combo.elapsed >= threshold) {
        this.comboFinishVoicePlayed = true;
        const kind = witch ? "WITCH" : "FIGHTER";
        Hop.Voice?.play?.(witch ? "combo_witch_blast" : "combo_fighter_upper", g.debug, `COMBO_${kind}_FINISH`);
      }
    }
    if (this.lastState === s.FLYING && g.state !== s.FLYING) {
      try {
        Hop.Voice?.stop?.();
        if (g.state === s.RESULT) Hop.Voice?.play?.("hero_stop", g.debug, "FLYING_TO_RESULT");
      } catch { /* Optional voice must never affect gameplay. */ }
    } else if (this.lastState === s.RESULT && g.state === s.AIM_ANGLE) {
      try { Hop.Voice?.stop?.(); } catch { /* RETRY cannot be blocked by audio. */ }
    }
    const justLaunched = g.state === s.FLYING && this.lastState === s.AIM_POWER;
    // Launch cut-in (display only): impact SE + hero_launch voice at the IMPACT beat (or on an earlier skip);
    // the flight visuals (launchAt clock, HIT one-shot, truck recoil) start when the cut-in ends.
    if (g.launchCutinReduced !== !!this.visual.reducedMotion) g.launchCutinReduced = !!this.visual.reducedMotion;
    if (justLaunched && g.launchCutin) this.launchCut = { ref: g.launchCutin, impactDone: false };
    let cutEnded = false;
    const lc = this.launchCut;
    if (lc) {
      const ended = g.launchCutin !== lc.ref;
      if (!lc.impactDone && (ended || lc.ref.elapsed >= (Hop.Graphics?.launchCutinTimes?.(lc.ref).impact ?? 0))) {
        lc.impactDone = true;
        try { Hop.Audio?.play?.(lc.ref.tier === "MAX" ? "LAUNCH_IMPACT_MAX" : "LAUNCH_IMPACT"); } catch { /* SE is optional. */ }
        try { Hop.Voice?.play?.("hero_launch", g.debug, "AIM_POWER_TO_FLYING"); } catch { /* Optional voice must never affect gameplay. */ }
      }
      if (ended) { this.launchCut = null; cutEnded = g.state === s.FLYING; }
    }
    const launched = (justLaunched && !g.launchCutin && !lc) || cutEnded;
    if (justLaunched && !g.launchCutin) {
      try { Hop.Voice?.play?.("hero_launch", g.debug, "AIM_POWER_TO_FLYING"); } catch { /* Optional voice must never affect gameplay. */ }
    }
    if (launched) this.visual.launchAt = g.phaseTime;
    if (g.state === s.READY || g.state === s.AIM_ANGLE) { this.visual.launchAt = -Infinity; this.launchCut = null; }
    // Display-only hero one-shots. A new AERIAL effect object or a new normal ground
    // bounce (body.bounces grew, still airborne, no new Type D "BOUND BOOST") starts the
    // sprite; Hop.Sprites.startOneShot applies the priority table (SPECIAL_REACTION is never cut
    // by HIT / AERIAL / GROUND_BOUNCE). Settling into rolling does not trigger.
    const v = this.visual, sp = Hop.Sprites;
    this.updateFx();
    // RESULT keeps the last FLIGHT_LOOP frame when no STOP_RESULT plays (frozenAt = RESULT entry).
    if (g.state === s.RESULT) { if (!Number.isFinite(v.frozenAt)) v.frozenAt = g.phaseTime; }
    else v.frozenAt = null;
    if (g.state !== s.FLYING) { v.oneShot = null; v.reactionAfterCombo = false; v.flightVoicePlayed = false; v.lastEffect = g.effect; v.lastBounces = g.body.bounces; v.lastSpecialSuccesses = g.specialSuccesses; v.lastMerchantSuccesses = g.merchantStats.successes; }
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
      // AERIAL DOWN dive SE (2026-10-17 cycle 17, sound only): a falling whoosh once per new dive.
      if (aerial?.[1] === "DOWN") { try { Hop.Audio?.play?.("AERIAL_DIVE"); } catch { /* SE is optional. */ } }
      // AERIAL UP rise SE (2026-10-17 cycle 18, sound only): a rising chirp once per new AERIAL UP.
      if (aerial?.[1] === "UP") { try { Hop.Audio?.play?.("AERIAL_RISE"); } catch { /* SE is optional. */ } }
      if (aerial && sp?.startOneShot) sp.startOneShot(v, "AERIAL_" + aerial[1], g.phaseTime);
      if (aerial && !v.flightVoicePlayed) {
        v.flightVoicePlayed = true;
        try { Hop.Voice?.play?.("hero_flight", g.debug, "AERIAL_SUCCESS_FIRST_PER_RUN"); } catch { /* Voice cannot affect AERIAL or flight. */ }
      }
      // SPECIAL success (specialSuccesses grew via resolveSpecial(true), or a MERCHANT SPECIAL
      // success; MISS does not). Display-only.
      // A combo scene shows the hero being hit (HIT pose) first; the reaction then plays with the launch.
      if (specialOk && g.combo) v.reactionAfterCombo = true;
      else if ((specialOk || v.reactionAfterCombo) && !g.combo) {
        v.reactionAfterCombo = false;
        if (sp?.heroSpecialReaction?.ready) sp.startOneShot(v, "SPECIAL_REACTION", g.phaseTime);
      }
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
    // JUST! window marker (same gauge scale as aim-fill); in-just = the tap now would be JUST (truthful: Game.isJust rules).
    const zone = Hop.UI.justZone(g), justEl = document.getElementById("aim-just");
    if (justEl) {
      justEl.hidden = !zone;
      // A band touching the gauge end is anchored right, so its CSS min-width grows inward (never past the track).
      if (zone) { const end = zone.left + zone.width >= 100 - 1e-9; justEl.style.left = end ? "auto" : `${zone.left}%`; justEl.style.right = end ? "0" : "auto"; justEl.style.width = `${zone.width}%`; }
      document.getElementById("aim-display").classList?.toggle?.("in-just", !!zone && zone.inside);
    }
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
    // DEBUG badge names the active kind (「DEBUG: 爆裂斜光」); the DEBUG button mirrors the menu state.
    const debugStatus = document.getElementById("debug-status");
    debugStatus.hidden = !g.debug;
    const debugText = g.debug ? "DEBUG: " + Hop.Game.debugKindLabel(g.activeDebugKind()).title : "DEBUG";
    if (debugStatus.textContent !== debugText) debugStatus.textContent = debugText;
    document.getElementById("debug-toggle").setAttribute("aria-expanded", String(!!this.debugMenuOpen));
    document.getElementById("history").textContent = `CONTACT / ${g.history.slice(-8).map(entry => `${Hop.CAST[entry.type]?.name || entry.type} (${entry.label}${entry.partner ? "＋" + (Hop.CAST[entry.partner]?.name || entry.partner) : ""})`).join(" → ") || "—"}`;
    // Display only: a SPECIAL SUCCESS panel (normal or merchant) waits while the cut-in covers the stage
    // (Graphics.specialCutinCovering: until its fade-out / the reducedMotion still ends), then stays for
    // specialMessageDuration of game time — the same length as before — even after game.specialMessage
    // expires. MISS / other messages are unchanged. The aria-live announcement is not delayed.
    if (g.specialMessage && g.specialMessage !== this.panelMessage) {
      this.panelMessage = g.specialMessage;
      this.successPanel = g.specialMessage.label === "SPECIAL SUCCESS" && (g.specialCutin || g.combo)
        ? { title: "SPECIAL SUCCESS!", detail: g.specialMessage.detail || "", waiting: true, remaining: c.specialMessageDuration, clock: g.phaseTime } : null;
    }
    const held = this.successPanel;
    if (held) {
      const dt = Math.max(0, g.phaseTime - held.clock); held.clock = g.phaseTime;
      // Also waits for a combo scene to finish (the panel follows the final blow).
      if (held.waiting) held.waiting = !!g.combo || !!Hop.Graphics?.specialCutinCovering?.(g.specialCutin, this.visual.reducedMotion);
      else held.remaining -= dt;
      if (g.special || g.state !== s.FLYING || held.remaining <= 0) this.successPanel = null;
    }
    const success = this.successPanel;
    const specialPanel = document.getElementById("special-panel");
    specialPanel.className = g.special ? "special-panel" : "special-panel resolved";
    specialPanel.hidden = !g.special && success ? success.waiting
      : (g.state !== s.FLYING && !(g.state === s.RESULT && g.specialMessage?.label === "SPECIAL MISS" && Date.now() < this.messageUntil)) || (!g.special && !g.specialMessage);
    document.getElementById("special-title").textContent = g.special ? (g.special.merchantType ? "MERCHANT SPECIAL!" : "SPECIAL!") : success ? success.title : (g.specialMessage?.label === "SPECIAL SUCCESS" ? "SPECIAL SUCCESS!" : g.specialMessage?.label || "");
    document.getElementById("special-detail").textContent = g.special ? (g.special.merchantType ? `商人 Type ${g.special.merchantType} / ${c.merchantNames[g.special.merchantType]}` : `${Hop.CAST[g.special.type].name} / ${c.specials[g.special.type].name}`) + " · タップ / クリック" : success ? success.detail : Hop.UI.specialMessageDetail(g.specialMessage);
    document.getElementById("special-track").hidden = !g.special;
    document.getElementById("special-fill").style.width = `${g.special ? 100 * g.special.remaining / c.specialWindow : 0}%`;
    document.getElementById("special-rules").textContent = `受付 ${c.specialWindow}秒。BOOST→BOUNCE隣接でBOOST SPECIAL、BOUNCE→BOOST隣接でBOUNCE SPECIAL（未使用キャラのx順）。DASH後、BOOST・BOUNCE・STOPPERに触れず再DASHでDASH SPECIAL。BOOST・BOUNCE・DASH後、地面バウンド・GUARD接触なしでSTOPPER SPECIAL。BRAKE：AERIAL DOWN成功後、地面・他キャラ・UPなしで接触。ANGLE：接触時10%抽選。GUARD：通常GUARDを持って再GUARD。ごくまれに謎の商人が現れる…？`;
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
    const labels = { READY: "画面をタップ / クリック / Space", AIM_ANGLE: "タップで角度決定", AIM_POWER: "タップで発射", RESULT: "画面をタップ（Space）してRETRY" };
    const mode = g.aerialMode;
    const flightHint = g.combo ? "TAP → SKIP" : g.special ? "TAP → SPECIAL!" : floating ? "FLOAT / 浮遊中" : !airborne ? "AERIAL / 空中で使用可能" : mode === "DOWN" ? `AERIAL ↓ ${chargeText}` : `AERIAL ↑ ×${g.upRemaining}`;
    const fastHint = g.timeScale > 1.05 ? `スキップ ▶▶ ×${Math.round(g.timeScale)}${g.tapFinishesRun() ? " · タップで結果へ" : ""}` : null;
    set("hint", labels[g.state] || fastHint || flightHint);
    // Display only: let a playing STOP_RESULT show through, then fade the overlay in. Runs every
    // update (before the state-change early return). The overlay stays un-hidden with the same
    // content, aria and tap handling; only its opacity changes.
    const overlayAlpha = g.tempoEnabled ? Hop.UI.tempoOverlayAlpha(this.visual, g.phaseTime, g.state)
      : Hop.Sprites?.resultOverlayAlpha ? Hop.Sprites.resultOverlayAlpha(this.visual, g.phaseTime, g.state) : 1;
    const opacity = overlayAlpha >= 1 ? "" : String(Math.round(overlayAlpha * 1000) / 1000);
    if (this.overlay.style.opacity !== opacity) this.overlay.style.opacity = opacity;
    // RESULT entrance (smooth display only): the distance counts up with an ease-out once the overlay shows.
    if (Hop.Graphics?.smooth && g.state === s.RESULT && g.state === this.lastState && Number.isFinite(g.finalDistance)) {
      if (this.countFrom === null && overlayAlpha > 0) this.countFrom = g.phaseTime;
      const u = this.visual.reducedMotion || this.countFrom === null ? 1 : Math.min(1, (g.phaseTime - this.countFrom) / (g.tempoEnabled ? c.resultCountTime : 0.8));
      const text = `${(g.finalDistance * (u >= 1 ? 1 : Hop.Smooth.easeOutCubic(u))).toFixed(1)} m`, el = document.getElementById("result-distance");
      if (this.countFrom !== null && el.textContent !== text) el.textContent = text;
    }
    // Rank stamp (tempo mode): revealed with its SE once the RESULT overlay is fully in.
    const rankEl = document.getElementById("result-rank");
    if (rankEl && g.state === s.RESULT && g.state === this.lastState && this.rankPending && overlayAlpha >= 1) {
      this.rankPending = false; rankEl.hidden = false;
      const nextEl = document.getElementById("overlay-next"); if (nextEl) nextEl.hidden = !nextEl.innerHTML; // shown with the stamp
      try { Hop.Audio?.play?.(Hop.Game.rankStampSe(rankEl.textContent)); } catch { /* SE is optional. */ }
    }
    if (g.state === this.lastState) return;
    // Final slide stop SE: once, when a run that slid to a halt turns into RESULT (僧侶 stops have their own SE).
    if (g.state === s.RESULT && this.lastState === s.FLYING && g.endCause?.kind === "slide") { try { Hop.Audio?.play?.("SLIDE_STOP"); } catch { /* SE is optional. */ } }
    this.countFrom = null;
    if (rankEl) {
      const rank = g.state === s.RESULT && g.tempoEnabled ? Hop.Game.rank(g.finalDistance) : null;
      rankEl.hidden = true; this.rankPending = !!rank;
      rankEl.textContent = rank || ""; if (rankEl.dataset) rankEl.dataset.rank = rank || "";
      rankEl.className = rank ? "rank-stamp rank-" + rank.toLowerCase() + " rank-len" + rank.length : "rank-stamp"; // len2/3: smaller glyphs fit the circle
    }
    this.overlay.classList?.toggle?.("new-record", g.state === s.RESULT && !g.debugUsed && g.newRecords.includes("distance"));
    this.lastState = g.state;
    document.getElementById("result-highlights").textContent = g.state === s.RESULT ? "今回のハイライト：" + Hop.UI.highlights(g).join(" · ") : "";
    const helpedEl = document.getElementById("result-helped");
    const endEl = document.getElementById("result-end");
    if (endEl) endEl.textContent = g.state === s.RESULT ? Hop.UI.endCauseText(g) : "";
    if (helpedEl) helpedEl.textContent = g.state === s.RESULT ? "効いたもの：" + (Hop.UI.helped(g).join(" · ") || "なし（通常接触のみ）") : "";
    this.overlay.hidden = g.state !== s.READY && g.state !== s.RESULT;
    document.getElementById("flight-tag").hidden = g.state !== s.FLYING;
    document.getElementById("overlay-label").textContent = g.state === s.RESULT ? "FINAL DISTANCE / 最終飛距離" : "ONE LAUNCH. HOW FAR?";
    document.getElementById("overlay-title").textContent = g.state === s.RESULT ? `${g.finalDistance.toFixed(1)} m` : "勇者、空の旅へ！";
    document.getElementById("overlay-detail").textContent = g.state === s.RESULT ? `${g.body.bounces} 回の地面接触 · 角度 ${g.angle.toFixed(1)}° · パワー ${Math.round(g.power * 100)}%` : "角度とパワーを決めて、飛距離に挑戦。";
    // RESULT near-miss line: same table as the stamp (UI.nextRank). Tempo mode reveals it together with the stamp.
    const nextEl = document.getElementById("overlay-next");
    if (nextEl) {
      const nr = g.state === s.RESULT && Number.isFinite(g.finalDistance) ? Hop.UI.nextRank(g.finalDistance) : null;
      nextEl.innerHTML = Hop.UI.nearMissHtml(nr);
      nextEl.hidden = !nr || (g.tempoEnabled && this.rankPending);
    }
    document.getElementById("overlay-prompt").textContent = g.state === s.RESULT ? "画面をタップ（Space）してRETRY" : "画面をタップ / クリック / Space";
    document.getElementById("result-stats").hidden = g.state !== s.RESULT;
    if (g.state === s.RESULT) {
      document.getElementById("record-status").textContent = g.debugUsed ? "DEBUG PLAY / 記録対象外" : g.newRecords.length ? "NEW RECORD!" : "FLIGHT RECORD";
      document.getElementById("result-distance").textContent = Hop.Graphics?.smooth && !this.visual.reducedMotion ? "0.0 m" : `${g.finalDistance.toFixed(1)} m`; // smooth: counted up in update()
      document.getElementById("result-best").textContent = `${g.best.distance.toFixed(1)} m`;
      document.getElementById("result-height").textContent = `${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m`;
      document.getElementById("result-speed").textContent = `${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s`;
      document.getElementById("contact-totals").textContent = `接触総数 ${g.history.length} / SPECIAL発生 ${g.specialCount} / 成功 ${g.specialSuccesses}`;
      // Hidden character: merchant totals only after meeting the merchant this run, or in DEBUG plays.
      const metMerchant = g.debugUsed || g.merchantStats.attempts > 0 || g.merchantStats.successes > 0;
      document.getElementById("merchant-totals").hidden = !metMerchant;
      document.getElementById("merchant-totals").textContent = !metMerchant ? "" : `商人SPECIAL発生 ${g.merchantStats.attempts} / 成功 ${g.merchantStats.successes} / 最終Type ${g.merchantStats.lastType || "—"} / 復活 ${g.merchantStats.revives}`;
      const joined = {}; for (const e of g.history) if (e.partner) joined[e.partner] = (joined[e.partner] || 0) + 1;
      document.getElementById("type-counts").textContent = Object.entries(g.counts).map(([type, count]) => `${Hop.CAST[type].name} ${type} ${count}${joined[type] ? `（＋合体参加 ${joined[type]}）` : ""}`).join(" · ");
      document.getElementById("best-comparison").textContent = [
        `DISTANCE 今回 ${g.finalDistance.toFixed(1)} m / BEST ${g.best.distance.toFixed(1)} m`,
        `HEIGHT 今回 ${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m / BEST ${g.best.height.toFixed(1)} m`,
        `SPEED 今回 ${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s / BEST ${g.best.speed.toFixed(1)} m/s`
      ].join("\n");
      document.getElementById("storage-status").textContent = g.debugUsed ? "このDEBUGプレイは自己ベストを更新・保存していません。" : g.storageAvailable ? "自己ベストはこのブラウザに保存されます。" : "保存領域を使用できません。自己ベストは今回の起動中のみ保持します。";
    }
  }
  // Tempo RESULT overlay: transparent for resultOverlayLead s of the victory pose, then fades in (resultOverlayFade).
  // No victory pose (mid-air stop / asset missing) or reduced motion: shown at once.
  static tempoOverlayAlpha(visual, phaseTime, state) {
    const c = Hop.CONFIG, at = visual?.stopAt;
    if (state !== Hop.STATES.RESULT || visual?.reducedMotion || !Hop.Sprites?.heroStopResult?.ready || !Number.isFinite(at)) return 1;
    const t = phaseTime - at - c.resultOverlayLead;
    return t < 0 ? 0 : c.resultOverlayFade > 0 ? Math.min(1, t / c.resultOverlayFade) : 1;
  }
  // Feedback events from the game (CHAIN / MILESTONE / NEW_RECORD / IMPACT): SE + display pops in visual.fx
  // (aged on the real-time clock, so fast-forward does not rush them). Reset on RETRY.
  updateFx() {
    const g = this.game, v = this.visual, now = g.realTime || 0;
    if (g.state !== Hop.STATES.FLYING) { if (g.state !== Hop.STATES.RESULT) { v.fx = []; v.kick = null; } v.justGlowAt = null; g.fxEvents.length = 0; return; }
    v.fx = (v.fx || []).filter(f => now - f.at < 1.6);
    const held = [];
    for (const e of g.fxEvents.splice(0)) {
      // JUST!: SE at the launch tap; the pop waits behind the launch cut-in (which shows its own JUST!).
      if (e.kind === "JUST" && !e.sePlayed) { e.sePlayed = true; try { Hop.Audio?.play?.("JUST"); } catch { /* SE is optional. */ } }
      if (e.kind === "JUST") { if (g.launchCutin) { held.push(e); continue; } v.fx.push({ ...e, at: now }); v.justGlowAt = now; continue; }
      if (e.kind === "IMPACT") { v.kick = { at: now, k: e.k }; continue; }
      if (e.kind === "CHAIN") { v.fx = v.fx.filter(f => f.kind !== "CHAIN"); }
      v.fx.push({ ...e, at: now });
      try {
        if (e.kind === "CHAIN") Hop.Audio?.play?.("CHAIN", { pitch: Hop.Audio.chainPitch(e.n) });
        else Hop.Audio?.play?.(e.kind);
      } catch { /* SE is optional. */ }
    }
    g.fxEvents.push(...held);
  }
  static zone(g) {
    const c = Hop.CONFIG;
    if (g.state !== Hop.STATES.FLYING || !(g.normalGuard || g.guardSpecial.active) || g.special) return null;
    const distance = g.body.x / c.pixelsPerMeter;
    // DEBUG merchant kinds treat their prepared character as the boundary (game.applyDebugSetup).
    const marked = g.debug && g.objects.find(o => o.debugBoundary && !o.used && o.x >= g.body.x);
    const boundary = marked ? marked.x / c.pixelsPerMeter : Math.max(c.boundaryMeters, Math.ceil(distance / c.boundaryMeters) * c.boundaryMeters);
    const remaining = boundary - distance;
    return remaining >= 0 && remaining <= c.merchantZoneMeters ? { boundary, remaining } : null;
  }
  // JUST! zone on the aim gauge in % of the track (angle: angleMin..angleMax; power: 0..100 like aim-fill), or null.
  // inside: the current angle (AIM_ANGLE) / power (AIM_POWER) is within that part of the JUST window.
  static justZone(g) {
    const c = Hop.CONFIG, s = Hop.STATES;
    if (c.justLaunchEnabled !== true || (g.state !== s.AIM_ANGLE && g.state !== s.AIM_POWER)) return null;
    if (g.state === s.AIM_ANGLE) {
      const lo = c.justAngleCenter - c.justAngleHalfWidth, hi = c.justAngleCenter + c.justAngleHalfWidth, span = c.angleMax - c.angleMin;
      return { left: (lo - c.angleMin) / span * 100, width: (hi - lo) / span * 100, inside: Math.abs(g.angle - c.justAngleCenter) <= c.justAngleHalfWidth };
    }
    return { left: c.justPowerMin * 100, width: (c.powerMax - c.justPowerMin) * 100, inside: g.power >= c.justPowerMin };
  }
  // HUD target names (2026-10-16 cycle 03): on-screen READY characters by name; an armed 戦士 / 僧侶 / 盗賊 with no
  // READY copy on screen is shown as "次の〇〇→" (the next one ahead fires while the arming lasts), so the HUD never
  // reads as if an off-screen character were the one in view. Same conditions as before (truthful).
  // Rank goal for a distance (m): current rank (Game.rank), the next higher rank and whole metres left (ceil), or
  // next null at the top rank. Same table as the RESULT stamp (config.rankThresholds).
  static nextRank(meters) {
    const d = Number.isFinite(meters) ? Math.max(0, meters) : 0, table = Hop.CONFIG.rankThresholds, rank = Hop.Game.rank(d);
    const i = table.findIndex(([r]) => r === rank), up = i > 0 ? table[i - 1] : null;
    return { rank, next: up ? up[0] : null, remaining: up ? Math.max(1, Math.ceil(up[1] - d)) : 0 };
  }
  // RESULT near-miss text for a UI.nextRank result ("" for none).
  // A tap right now would AERIAL ↓ dive (mirrors Game.aerial + the canvas HUD READY text).
  static downReadyNow(g) {
    return g.state === Hop.STATES.FLYING && !g.launchCutin && !g.combo && !g.special && g.merchant?.type !== "C" &&
      g.airborne() && g.aerialMode === "DOWN" && g.downCharge >= 1;
  }
  // SPECIAL panel detail after resolve. MISS adds why (no tap within the window) and what happened instead.
  static specialMessageDetail(m) {
    if (!m) return "";
    if (m.label !== "SPECIAL MISS" || !m.missOutcome) return m.detail || "";
    const why = `タップが間に合わず（受付 ${Hop.CONFIG.specialWindow}秒）`;
    const then = m.missOutcome === "stop" ? "僧侶の効果で停止" : m.missOutcome === "guard" ? (m.missType === "STOPPER" ? "GUARDで停止を防いだ" : "GUARDで打ち消し（効果なし）") : "通常の効果のみ";
    return `${m.detail} · ${why} → ${then}`;
  }
  // RESULT end-cause line from Game.endCause (set where the run actually stops).
  static endCauseText(g) {
    const e = g.endCause, stopper = Hop.CAST?.STOPPER?.name || "STOPPER";
    if (!e) return "";
    if (e.kind === "stopper") return `終了理由：${stopper}にぶつかって停止` + (e.miss ? "（SPECIAL MISS：タップが間に合わず）" : "");
    return "終了理由：地面を滑って停止（勢いが尽きた）";
  }
  static nearMissHtml(nr) {
    return !nr ? "" : nr.next ? `ランク ${nr.rank} · あと <b>${nr.remaining}m</b> で ${nr.next}` : `最高ランク <b>${nr.rank}</b> 到達！`;
  }
  static readyHudTargets(g, ready = Hop.UI.readyTargets(g)) {
    const shown = ready.filter(t => t.label === "SPECIAL"), onScreen = new Set(shown.map(t => t.object.type));
    const names = [...new Set(shown.map(t => Hop.CAST[t.object.type].name))];
    if (g.state === Hop.STATES.FLYING && !g.special && !g.specialMessage && g.merchant?.type !== "C") {
      for (const [key, type] of [["dash", "DASH"], ["stopper", "STOPPER"], ["brake", "BRAKE"]]) {
        if (g.specialArmed[key] && !onScreen.has(type)) names.push("次の" + Hop.CAST[type].name + "→");
      }
    }
    return names;
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
      // The merchant is a hidden character (rare draw): normal play never previews it. Only DEBUG plays (which
      // skip the draw, so the merchant is certain there) mark the boundary target as "MERCHANT".
      const merchant = g.debug && zone && Math.abs(object.x / c.pixelsPerMeter - zone.boundary) < 1e-7 && c.merchantTypes[object.type];
      return merchant || eligible ? [{ object, label: merchant ? "MERCHANT" : "SPECIAL" }] : [];
    });
  }
  // RESULT "what helped": every success of this run with counts, from the run's own records (the same labels
  // resolveSpecial / normalContact write): JUST launch, SPECIAL per character, merchant types, GUARD blocks.
  static helped(g) {
    const sp = {}, merchant = [], out = [], partners = {};
    const withPartner = t => partners[t] ? "（＋" + Object.keys(partners[t]).map(p => Hop.CAST?.[p]?.name || p).join("・") + "）" : "";
    let blocks = 0;
    for (const e of g.history || []) {
      const m = e.label.match(/MERCHANT TYPE ([A-D])/);
      if (m) merchant.push(m[1]);
      else if (e.label === e.type + " SPECIAL") { sp[e.type] = (sp[e.type] || 0) + 1; if (e.partner) (partners[e.type] ||= {})[e.partner] = 1; }
      else if (e.label.includes("GUARDED")) blocks++;
    }
    if (g.justLaunch) out.push("JUST発射");
    for (const t of Object.keys(Hop.CAST || {})) if (sp[t]) out.push(`${Hop.CAST[t].name} SPECIAL×${sp[t]}${withPartner(t)}`);
    for (const t of Object.keys(sp)) if (!Hop.CAST?.[t]) out.push(`${t} SPECIAL×${sp[t]}`);
    if (merchant.length) out.push("商人 Type " + merchant.join("→"));
    if (blocks) out.push(`GUARD BLOCK×${blocks}`);
    return out;
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
    el("se-toggle").textContent = Hop.Audio?.muted ? "音声・SE OFF" : "音声・SE ON";
    el("se-toggle").setAttribute("aria-pressed", String(!!Hop.Audio?.muted));
    el("flight-hud").hidden = !flying;
    el("aerial-hud").className = g.special || g.combo ? "subdued" : "";
    const charge = g.downCharge >= 1 ? "READY" : Math.min(99, Math.floor(g.downCharge * 100 + 1e-9)) + "%";
    el("aerial-hud-text").textContent = g.combo ? "COMBO演出中" : g.special ? "SPECIAL優先" : g.merchant?.type === "C" ? "AERIAL 使用不可" : !g.airborne() ? "AERIAL / 空中のみ" : g.aerialMode === "UP" ? "AERIAL ↑ ×" + g.upRemaining : "AERIAL ↓ " + charge;
    el("aerial-hud-charge").value = g.downCharge;
    el("aerial-hud-charge").hidden = !!g.special || !!g.combo || g.merchant?.type === "C" || g.aerialMode === "UP";
    const m = g.merchant;
    el("merchant-hud").hidden = !m;
    el("merchant-hud-text").textContent = !m ? "" : m.type === "A" ? "🧪 TYPE A ×" + m.remaining : m.type === "B" ? "⚡ CHARGE " + m.charge + "/" + c.typeBMaxCharge : m.type === "C" ? "FLOAT " + m.remaining + "/" + c.typeCCount : "BOUND ×" + m.remaining;
    el("merchant-hud-charge").hidden = m?.type !== "B";
    el("merchant-hud-charge").value = m?.type === "B" ? m.charge / c.typeBMaxCharge : 0;
    this.visual.readyTargets = Hop.UI.readyTargets(g);
    // Next rank goal (flight only): written only when the text changes (whole metres).
    const nr = flying ? Hop.UI.nextRank(g.body.x / c.pixelsPerMeter) : null, nrEl = el("next-rank");
    if (nrEl) {
      nrEl.hidden = !nr;
      const html = !nr ? "" : nr.next ? `次のランク <b>${nr.next}</b> まで あと ${nr.remaining}m` : `最高ランク <b>${nr.rank}</b> 到達！`;
      if (nrEl.innerHTML !== html) nrEl.innerHTML = html;
    }
    const targets = Hop.UI.readyHudTargets(g, this.visual.readyTargets);
    el("ready-targets").hidden = !targets.length;
    el("ready-targets").textContent = targets.length ? "SPECIAL READY · 対象：" + targets.join(" / ") : "";
    // MERCHANT ZONE hint: DEBUG plays only (the merchant is hidden in normal play).
    const zone = g.debug ? Hop.UI.zone(g) : null;
    el("merchant-zone").hidden = !zone || !!g.specialMessage;
    el("merchant-zone").textContent = zone ? "MERCHANT ZONE · あと " + zone.remaining.toFixed(1) + "m" : "";
    // Announce edges only: never percent, seconds or a repeated frame.
    const events = [];
    if (g.specialMessage && g.specialMessage !== this.notices.message) this.messageUntil = Date.now() + g.specialMessage.remaining * 1000;
    if (g.special && g.special !== this.notices.special) events.push((g.special.merchantType ? "商人 Type " + g.special.merchantType : Hop.CAST[g.special.type].name) + " SPECIAL受付開始");
    else if (g.specialMessage && g.specialMessage !== this.notices.message && (g.specialMessage.label !== this.notices.message?.label || g.specialMessage.detail !== this.notices.message?.detail)) { const detail = Hop.UI.specialMessageDetail(g.specialMessage); events.push(g.specialMessage.label + (detail ? " · " + detail : "")); } // MISS: same reason line as the panel (cycle 26)
    if (flying && g.guardSpecial.active !== this.notices.guard) events.push(g.guardSpecial.active ? "GUARD SPECIAL開始" : "GUARD SPECIAL終了");
    if (flying && g.downCharge >= 1 && this.notices.charge < 1) events.push("AERIAL DOWN READY");
    // RESULT edge (2026-10-17 cycle 25): screen readers hear the outcome once (text only; same values as on screen).
    const result = g.state === Hop.STATES.RESULT;
    if (result && !this.notices.result && Number.isFinite(g.finalDistance)) {
      const rank = g.tempoEnabled ? Hop.Game.rank(g.finalDistance) : null;
      events.push(["RESULT " + g.finalDistance.toFixed(1) + " m", rank && "ランク " + rank,
        g.debugUsed ? "DEBUG PLAY / 記録対象外" : g.newRecords.length ? "NEW RECORD!" : null].filter(Boolean).join(" · "));
    }
    const notice = events.join(" · "), live = el("announcements");
    if (notice && live.textContent !== notice) live.textContent = notice;
    else if (!notice && ((this.notices.charge >= 1 && g.downCharge < 1) || (!flying && g.state !== Hop.STATES.RESULT)) && live.textContent) live.textContent = "";
    this.notices = { special: g.special, message: g.specialMessage, charge: g.downCharge, guard: g.guardSpecial.active, result };
  }
  // DEBUG menu (development only). Opened by the D key or the DEBUG button; items are rendered only when it
  // opens (so the hidden merchant never sits in the page in normal play). While open, game time is paused (main.js).
  static debugMenuHtml(active) {
    const esc = text => String(text).replace(/[&<>"']/g, ch => "&#" + ch.charCodeAt(0) + ";");
    const item = (id, key) => {
      const label = Hop.Game.debugKindLabel(id), on = (active || "off") === id;
      return `<button type="button" class="debug-item${on ? " active" : ""}" data-debug-kind="${id}" aria-pressed="${on}"><kbd>${key}</kbd><b>${esc(label.title)}</b><small>${esc(label.detail)}</small></button>`;
    };
    const group = (title, name, extra = "") => `<section class="debug-group"><h3>${title}</h3><div class="debug-items">${extra}${Hop.DEBUG_KINDS.filter(k => k.group === name).map(k => item(k.id, k.key)).join("")}</div></section>`;
    return `<div class="debug-menu-panel"><div class="debug-menu-head"><strong id="debug-menu-title">DEBUGメニュー</strong><button type="button" class="debug-close" data-debug-close>閉じる（Esc）</button></div>` +
      `<p class="debug-menu-note">番号キー（商人は Q W E R）かクリックで選択。発射前に選ぶと、発射直後の最初の接触で確認できます。DEBUGを使ったプレイは記録対象外。</p>` +
      group("基本", "basic", item("off", "0")) + group("SPECIAL（最初の接触で発動）", "special") + group("謎の商人（すぐに出会う）", "merchant") + `</div>`;
  }
  static debugKeyKind(code) {
    const key = /^(?:Digit|Numpad)([0-9])$/.exec(code || "")?.[1] || /^Key([QWER])$/.exec(code || "")?.[1];
    if (!key) return null;
    return key === "0" ? "off" : Hop.DEBUG_KINDS.find(kind => kind.key === key)?.id || null;
  }
  openDebugMenu() {
    const menu = document.getElementById("debug-menu");
    menu.innerHTML = Hop.UI.debugMenuHtml(this.game.activeDebugKind());
    menu.hidden = false; this.debugMenuOpen = true;
    const current = menu.querySelector?.(`[data-debug-kind="${this.game.activeDebugKind() || "off"}"]`);
    current?.focus?.({ preventScroll: true });
    this.update();
  }
  closeDebugMenu() {
    const menu = document.getElementById("debug-menu");
    const wasOpen = !!this.debugMenuOpen;
    menu.hidden = true; this.debugMenuOpen = false;
    if (wasOpen) document.getElementById("debug-toggle").focus?.({ preventScroll: true });
    this.update();
  }
  toggleDebugMenu() { if (this.debugMenuOpen) this.closeDebugMenu(); else this.openDebugMenu(); }
  selectDebugKind(id) {
    this.game.setDebugKind(id === "off" ? null : id);
    this.closeDebugMenu();
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
