"use strict";
Hop.UI = class {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.fields = Object.fromEntries(["state", "angle", "power", "distance", "height", "speed", "final", "hint", "up-status", "down-status", "contact-status"].map(id => [id, document.getElementById(id)]));
    this.action = document.getElementById("action");
    this.downAction = document.getElementById("down-action");
    this.overlay = document.getElementById("overlay");
    this.overlayAction = document.getElementById("overlay-action");
    this.lastState = null;
    this.visual = { launchAt: -Infinity, contactAt: -Infinity, lastContact: null, reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false };
  }
  update() {
    const g = this.game, c = Hop.CONFIG, s = Hop.STATES;
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
    document.getElementById("guard-status").textContent = `GUARD × ${g.guard}`;
    document.getElementById("debug-status").hidden = !g.debug;
    document.getElementById("history").textContent = `CONTACT / ${g.history.slice(-8).map(entry => `${Hop.CAST[entry.type]?.name || entry.type} (${entry.label})`).join(" → ") || "—"}`;
    const specialPanel = document.getElementById("special-panel");
    specialPanel.hidden = !g.special && !g.specialMessage;
    document.getElementById("special-title").textContent = g.special ? "SPECIAL!" : g.specialMessage?.label || "";
    document.getElementById("special-detail").textContent = g.special ? `${Hop.CAST[g.special.type].name} · タップ / Enterで成功！` : "";
    document.getElementById("special-track").hidden = !g.special;
    document.getElementById("special-fill").style.width = `${g.special ? 100 * g.special.remaining / c.specialWindow : 0}%`;
    document.getElementById("special-rules").textContent = `受付 ${c.specialWindow}秒 / STOPPER：接触速度 ${c.specials.STOPPER.min / c.pixelsPerMeter} m/s以上 / BOUNCE：飛距離 ${c.specials.BOUNCE.min} m以上 / DASH：水平速度 ${c.specials.DASH.max / c.pixelsPerMeter} m/s以下`;
    const cooldownText = (Math.ceil(g.downCooldown * 10) / 10).toFixed(1);
    set("up-status", `AERIAL UP × ${g.upRemaining}`);
    set("down-status", g.special ? "DOWN / SPECIAL受付中" : g.state === s.RESULT ? "DOWN / 終了" : g.downCooldown > 0 ? `DOWN / ${cooldownText} s` : airborne ? "DOWN / READY" : "DOWN / 空中で使用可能");
    set("contact-status", `CONTACT / ${g.contact ? Hop.CAST[g.contact.label.split(" ")[0]]?.name || g.contact.label : "—"}`);
    const contactTag = document.getElementById("contact-tag");
    contactTag.hidden = !g.contact;
    const contactType = g.contact?.label.split(" ")[0];
    contactTag.textContent = g.contact ? `${Hop.CAST[contactType]?.name || contactType} · ${g.contact.label.includes("GUARD BLOCK") ? "結界でガード！" : Hop.CAST[contactType]?.effect || g.contact.label}` : "";
    contactTag.style.color = this.objectColor(g.contact?.label);
    this.downAction.hidden = g.state !== s.FLYING;
    this.downAction.disabled = !!g.special || !airborne || g.downCooldown > 0;
    this.downAction.textContent = g.downCooldown > 0 ? `DOWN ${cooldownText} s` : "DOWN ↓";
    this.action.disabled = g.state === s.FLYING && !g.special && (!airborne || g.upRemaining === 0);
    this.action.hidden = g.state === s.RESULT;
    if (g.state === s.FLYING) this.action.textContent = g.special ? "SPECIAL!" : "AERIAL UP ↑";
    if (g.state === this.lastState) return;
    this.lastState = g.state;
    const labels = {
      READY: ["START →", "START または画面をタップして開始"],
      AIM_ANGLE: ["角度を決定", "01 / 矢印が往復します。タップで角度を固定"],
      AIM_POWER: ["発射！", "02 / メーターが往復します。タップでパワーを決定・発射"],
      FLYING: ["AERIAL UP ↑", "03 / タップでUP。Space / DOWNで地上オブジェクトを狙おう"],
      RESULT: ["RETRY ↗", "04 / 記録確定。RETRYで角度選びから再挑戦"]
    };
    this.action.textContent = labels[g.state][0];
    set("hint", labels[g.state][1]);
    this.overlay.hidden = g.state !== s.READY && g.state !== s.RESULT;
    document.getElementById("flight-tag").hidden = g.state !== s.FLYING;
    document.getElementById("overlay-label").textContent = g.state === s.RESULT ? "FINAL DISTANCE / 最終飛距離" : "ONE LAUNCH. HOW FAR?";
    document.getElementById("overlay-title").textContent = g.state === s.RESULT ? `${g.finalDistance.toFixed(1)} m` : "勇者、空の旅へ！";
    document.getElementById("overlay-detail").textContent = g.state === s.RESULT ? `${g.body.bounces} 回の地面接触 · 角度 ${g.angle.toFixed(1)}° · パワー ${Math.round(g.power * 100)}%` : "角度とパワーを決めて、飛距離に挑戦。";
    this.overlayAction.textContent = g.state === s.RESULT ? "RETRY ↗" : "START →";
    document.getElementById("result-stats").hidden = g.state !== s.RESULT;
    if (g.state === s.RESULT) {
      document.getElementById("record-status").textContent = g.debugUsed ? "DEBUG PLAY / 記録対象外" : g.newRecords.length ? "NEW RECORD!" : "FLIGHT RECORD";
      document.getElementById("result-distance").textContent = `${g.finalDistance.toFixed(1)} m`;
      document.getElementById("result-best").textContent = `${g.best.distance.toFixed(1)} m`;
      document.getElementById("result-height").textContent = `${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m`;
      document.getElementById("result-speed").textContent = `${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s`;
      document.getElementById("contact-totals").textContent = `接触総数 ${g.history.length} / SPECIAL発生 ${g.specialCount} / 成功 ${g.specialSuccesses}`;
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
