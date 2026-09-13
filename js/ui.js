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
  }
  update() {
    const g = this.game, c = Hop.CONFIG, s = Hop.STATES;
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
    document.getElementById("history").textContent = `CONTACT / ${g.history.slice(-8).map(entry => entry.label).join(" → ") || "—"}`;
    const specialPanel = document.getElementById("special-panel");
    specialPanel.hidden = !g.special && !g.specialMessage;
    document.getElementById("special-title").textContent = g.special ? "SPECIAL!" : g.specialMessage?.label || "";
    document.getElementById("special-detail").textContent = g.special ? `${g.special.type} · CLICK / TAP / ENTER` : "";
    document.getElementById("special-track").hidden = !g.special;
    document.getElementById("special-fill").style.width = `${g.special ? 100 * g.special.remaining / c.specialWindow : 0}%`;
    document.getElementById("special-rules").textContent = `受付 ${c.specialWindow}秒 / STOPPER：接触速度 ${c.specials.STOPPER.min / c.pixelsPerMeter} m/s以上 / BOUNCE：飛距離 ${c.specials.BOUNCE.min} m以上 / DASH：水平速度 ${c.specials.DASH.max / c.pixelsPerMeter} m/s以下`;
    const cooldownText = (Math.ceil(g.downCooldown * 10) / 10).toFixed(1);
    set("up-status", `AERIAL UP × ${g.upRemaining}`);
    set("down-status", g.state === s.RESULT ? "DOWN / 終了" : g.downCooldown > 0 ? `DOWN / ${cooldownText} s` : airborne ? "DOWN / READY" : "DOWN / 空中で使用可能");
    set("contact-status", `CONTACT / ${g.contact?.label || "—"}`);
    const contactTag = document.getElementById("contact-tag");
    contactTag.hidden = !g.contact;
    contactTag.textContent = g.contact?.label || "";
    contactTag.style.color = this.objectColor(g.contact?.label);
    this.downAction.hidden = g.state !== s.FLYING;
    this.downAction.disabled = !!g.special || !airborne || g.downCooldown > 0;
    this.downAction.textContent = g.downCooldown > 0 ? `DOWN ${cooldownText} s` : "DOWN ↓";
    this.action.disabled = g.state === s.FLYING && !g.special && (!airborne || g.upRemaining === 0);
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
    document.getElementById("overlay-title").textContent = g.state === s.RESULT ? `${g.finalDistance.toFixed(1)} m` : "遠くへ、もう一跳び。";
    document.getElementById("overlay-detail").textContent = g.state === s.RESULT ? `${g.body.bounces} 回の地面接触 · 角度 ${g.angle.toFixed(1)}° · パワー ${Math.round(g.power * 100)}%` : "角度とパワーを決めて、飛距離に挑戦。";
    this.overlayAction.textContent = g.state === s.RESULT ? "RETRY ↗" : "START →";
    document.getElementById("result-stats").hidden = g.state !== s.RESULT;
    if (g.state === s.RESULT) {
      document.getElementById("record-status").textContent = g.debugUsed ? "DEBUG PLAY / 記録対象外" : g.newRecords.length ? "NEW RECORD!" : "FLIGHT RECORD";
      document.getElementById("contact-totals").textContent = `接触総数 ${g.history.length} / SPECIAL発生 ${g.specialCount} / 成功 ${g.specialSuccesses}`;
      document.getElementById("type-counts").textContent = Object.entries(g.counts).map(([type, count]) => `${type} ${count}`).join(" · ");
      document.getElementById("best-comparison").textContent = [
        `DISTANCE 今回 ${g.finalDistance.toFixed(1)} m / BEST ${g.best.distance.toFixed(1)} m`,
        `HEIGHT 今回 ${(g.maxHeight / c.pixelsPerMeter).toFixed(1)} m / BEST ${g.best.height.toFixed(1)} m`,
        `SPEED 今回 ${(g.maxSpeed / c.pixelsPerMeter).toFixed(1)} m/s / BEST ${g.best.speed.toFixed(1)} m/s`
      ].join("\n");
      document.getElementById("storage-status").textContent = g.debugUsed ? "このDEBUGプレイは自己ベストを更新・保存していません。" : g.storageAvailable ? "自己ベストはこのブラウザに保存されます。" : "保存領域を使用できません。自己ベストは今回の起動中のみ保持します。";
    }
  }
  objectColor(type) { return ({ BOOST: "#ccf873", BOUNCE: "#8dd7ff", BRAKE: "#ff8585", ANGLE: "#ffe381", DASH: "#ffab54", GUARD: "#ce9bff", STOPPER: "#bd3d54" })[type] || "#edf3f4"; }
  draw() {
    const g = this.game, c = Hop.CONFIG, ctx = this.ctx;
    const ground = c.groundY + g.cameraY;
    const sx = x => c.launchX + x - g.cameraX;
    const sy = y => ground - c.playerRadius - y;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#182b34"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#26404a"; ctx.lineWidth = 1;
    for (let x = -(g.cameraX * 0.25 % 100); x < c.width; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
    }
    for (let y = (g.cameraY * 0.25 % 100); y < c.height; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
    }
    ctx.fillStyle = "#223b3d"; ctx.fillRect(0, ground, c.width, Math.max(0, c.height - ground));
    ctx.strokeStyle = "#7caa8a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(c.width, ground); ctx.stroke();
    // Draw only visible world markers, regardless of total distance travelled.
    const spacing = c.markerMeters * c.pixelsPerMeter;
    const first = Math.max(0, Math.floor((g.cameraX - c.launchX) / spacing));
    ctx.font = "18px system-ui";
    for (let i = first; sx(i * spacing) < c.width; i++) {
      const x = sx(i * spacing);
      ctx.strokeStyle = "#7caa8a"; ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x, ground + 22); ctx.stroke();
      ctx.fillStyle = "#aec8bb"; ctx.fillText(`${i * c.markerMeters} m`, x + 8, ground + 47);
    }
    for (const object of g.objects) {
      const ox = sx(object.x);
      if (ox < -100 || ox > c.width + 100) continue;
      ctx.globalAlpha = object.used ? 0.22 : 1;
      ctx.fillStyle = this.objectColor(object.type);
      ctx.fillRect(ox - c.objectWidth / 2, ground - c.objectHeight, c.objectWidth, c.objectHeight);
      ctx.textAlign = "center"; ctx.font = "bold 20px system-ui";
      ctx.fillText(object.type, ox, ground - c.objectHeight - 14);
    }
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
    g.trail.forEach((point, i) => {
      ctx.globalAlpha = (i / g.trail.length) * (g.specialTrail > 0 ? 0.8 : 0.3);
      ctx.fillStyle = "#ccf873"; ctx.beginPath(); ctx.arc(sx(point.x), sy(point.y), 4 + i / 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,240,180,${0.22 * g.flash / c.specialFlashDuration})`; ctx.fillRect(0, 0, c.width, c.height); }
    const x = sx(g.body.x), y = sy(g.body.y);
    if (g.effect) {
      const progress = 1 - g.effect.remaining / c.effectDuration;
      ctx.save(); ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = g.effect.label.endsWith("UP") ? "#ccf873" : "#8dd7ff";
      ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 25 + progress * 65, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = "bold 22px system-ui";
      ctx.fillText(g.effect.label, x + 30, y - 35); ctx.restore();
    }
    if (g.state === Hop.STATES.AIM_ANGLE || g.state === Hop.STATES.AIM_POWER || g.state === Hop.STATES.READY) {
      const a = -g.angle * Math.PI / 180;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = "#ccf873"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(32, 0); ctx.lineTo(145, 0); ctx.lineTo(127, -12); ctx.moveTo(145, 0); ctx.lineTo(127, 12); ctx.stroke(); ctx.restore();
      ctx.fillStyle = "#edf3f4"; ctx.font = "bold 28px system-ui";
      ctx.fillText(`${g.angle.toFixed(1)}°`, x - 25, y - 165);
    }
    // Original geometric placeholder: a lime rounded square with two eyes.
    ctx.save(); ctx.translate(x, y);
    if (g.state === Hop.STATES.FLYING) ctx.rotate(g.body.x / 110);
    ctx.fillStyle = "#ccf873"; ctx.beginPath(); ctx.roundRect(-18, -18, 36, 36, 10); ctx.fill();
    ctx.fillStyle = "#182b34"; ctx.fillRect(-8, -6, 5, 8); ctx.fillRect(4, -6, 5, 8); ctx.restore();
    if (g.state === Hop.STATES.AIM_ANGLE || g.state === Hop.STATES.AIM_POWER) {
      ctx.fillStyle = "#edf3f4"; ctx.textAlign = "center"; ctx.font = "bold 32px system-ui";
      ctx.fillText(g.state === Hop.STATES.AIM_ANGLE ? "01 / ANGLE" : "02 / POWER", 640, 130);
      if (g.state === Hop.STATES.AIM_POWER) {
        ctx.fillStyle = "#0f2028"; ctx.fillRect(420, 162, 440, 32);
        ctx.fillStyle = "#ccf873"; ctx.fillRect(420, 162, 440 * g.power, 32);
        ctx.fillStyle = "#edf3f4"; ctx.font = "24px system-ui"; ctx.fillText(`${Math.round(g.power * 100)}%`, 640, 230);
      }
      ctx.textAlign = "left";
    }
  }
};
