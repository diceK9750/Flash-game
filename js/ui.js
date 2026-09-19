"use strict";
Hop.UI = class {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.fields = Object.fromEntries(["state", "angle", "power", "distance", "height", "speed", "final", "hint", "up-status", "down-status", "contact-status"].map(id => [id, document.getElementById(id)]));
    this.overlay = document.getElementById("overlay");
    this.lastState = null;
    this.visual = { launchAt: -Infinity, contactAt: -Infinity, lastContact: null, reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false };
  }
  update() {
    const g = this.game, c = Hop.CONFIG, s = Hop.STATES;
    if (g.soundEvent) { Hop.Audio?.play(g.soundEvent); g.soundEvent = null; }
    if (g.state === s.FLYING && this.lastState === s.AIM_POWER) this.visual.launchAt = g.phaseTime;
    if (g.state === s.READY || g.state === s.AIM_ANGLE) this.visual.launchAt = -Infinity;
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
    const armed = [g.specialArmed.dash ? "DASH SPECIAL READY" : "", g.specialArmed.stopper ? "STOPPER SPECIAL READY" : "", g.specialArmed.brake ? "BRAKE SPECIAL READY" : "", g.guardSpecial.active ? `GUARD SPECIAL ${g.guardSpecial.remaining.toFixed(1)}s` : ""].filter(Boolean);
    const merchant = g.merchant;
    const merchantStatus = !merchant ? "" : merchant.type === "A" ? `TYPE A ×${merchant.remaining}` : merchant.type === "B" ? `CHARGE ${merchant.charge}/${c.typeBMaxCharge}` : merchant.type === "C" ? `FLOAT ${merchant.remaining}` : `BOUND BOOST ×${merchant.remaining}`;
    document.getElementById("special-state").textContent = [...armed, merchantStatus].filter(Boolean).join(" · ");
    document.getElementById("special-state").hidden = !armed.length && !merchant;
    document.getElementById("guard-status").textContent = `GUARD × ${g.normalGuard}`;
    document.getElementById("debug-status").hidden = !g.debug;
    document.getElementById("history").textContent = `CONTACT / ${g.history.slice(-8).map(entry => `${Hop.CAST[entry.type]?.name || entry.type} (${entry.label})`).join(" → ") || "—"}`;
    const specialPanel = document.getElementById("special-panel");
    specialPanel.hidden = g.state !== s.FLYING || (!g.special && !g.specialMessage);
    document.getElementById("special-title").textContent = g.special ? (g.special.merchantType ? "MERCHANT SPECIAL!" : "SPECIAL!") : g.specialMessage?.label || "";
    document.getElementById("special-detail").textContent = g.special ? (g.special.merchantType ? `商人 Type ${g.special.merchantType} / ${c.merchantNames[g.special.merchantType]}` : `${Hop.CAST[g.special.type].name} / ${c.specials[g.special.type].name}`) + " · タップ / クリック" : g.specialMessage?.detail || "";
    document.getElementById("special-track").hidden = !g.special;
    document.getElementById("special-fill").style.width = `${g.special ? 100 * g.special.remaining / c.specialWindow : 0}%`;
    document.getElementById("special-rules").textContent = `受付 ${c.specialWindow}秒。BOOST→BOUNCE隣接でBOOST SPECIAL、BOUNCE→BOOST隣接でBOUNCE SPECIAL（未使用キャラのx順）。DASH後、BOOST・BOUNCE・STOPPERに触れず再DASHでDASH SPECIAL。BOOST・BOUNCE・DASH後、地面バウンド・GUARD接触なしでSTOPPER SPECIAL。通常GUARDまたはGUARD SPECIAL中、各${c.boundaryMeters}m区間の最後${c.merchantZoneMeters}mから、その境界ちょうどのBOOST・BOUNCE・DASH・STOPPERに当たると商人SPECIAL。BRAKE：AERIAL DOWN成功後、地面・他キャラ・UPなしで接触。ANGLE：接触時10%抽選。GUARD：通常GUARDを持って再GUARD。`;
    const cooldownText = (Math.ceil(g.downCooldown * 10) / 10).toFixed(1);
    set("up-status", `AERIAL UP × ${g.upRemaining}`);
    set("down-status", floating ? "AERIAL / 浮遊中は使用不可" : g.special ? "DOWN / SPECIAL受付中" : g.state === s.RESULT ? "DOWN / 終了" : g.downCooldown > 0 ? `DOWN / ${cooldownText} s` : airborne ? "DOWN / READY" : "DOWN / 空中で使用可能");
    set("contact-status", `CONTACT / ${g.contact ? Hop.CAST[g.contact.label.split(" ")[0]]?.name || g.contact.label : "—"}`);
    const contactTag = document.getElementById("contact-tag");
    contactTag.hidden = g.state !== s.FLYING || !g.contact || !!g.special || !!g.specialMessage;
    const contactType = g.contact?.label.split(" ")[0];
    contactTag.textContent = g.contact ? `${Hop.CAST[contactType]?.name || contactType} · ${g.contact.label.includes("GUARD BLOCK") ? "結界でガード！" : Hop.CAST[contactType]?.effect || g.contact.label}` : "";
    contactTag.style.color = this.objectColor(g.contact?.label);
    const labels = { READY: "画面をタップ / クリック", AIM_ANGLE: "タップで角度決定", AIM_POWER: "タップで発射", RESULT: "画面をタップしてRETRY" };
    const mode = g.aerialMode;
    const flightHint = g.special ? "TAP → SPECIAL!" : floating ? "FLOAT / 浮遊中" : !airborne ? "AERIAL / 空中で使用可能" : mode === "DOWN" ? (g.downCooldown > 0 ? `AERIAL DOWN ${cooldownText}s` : "TAP → AERIAL DOWN") : `TAP → AERIAL UP ×${g.upRemaining}`;
    set("hint", labels[g.state] || flightHint);
    if (g.state === this.lastState) return;
    this.lastState = g.state;
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
  objectColor(type) { return Hop.Graphics.objectColor(type); }
  draw() { Hop.Graphics.draw(this.ctx, this.game, this.visual); }
};
