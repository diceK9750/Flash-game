"use strict";
// Optional synthesis only: no assets and no audio work before a gesture.
Hop.Audio = {
  context: null,
  muted: false,
  active: new Set(),
  storageKey: "truck-crash-se-muted-v1",
  loadMute() {
    try { this.muted = window.localStorage.getItem(this.storageKey) === "true"; }
    catch { /* Keep the session preference if storage is unavailable. */ }
  },
  setMuted(muted) {
    this.muted = !!muted;
    if (this.muted) for (const node of this.active) { try { node.stop(); } catch {} }
    try { window.localStorage.setItem(this.storageKey, String(this.muted)); } catch {}
  },
  unlock() {
    if (this.muted) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context ||= new Context();
      if (this.context.state === "suspended") this.context.resume()?.catch(() => {});
    } catch { this.context = null; }
  },
  play(kind) {
    if (this.muted) return;
    try {
      const ctx = this.context;
      if (!ctx || ctx.state !== "running") return;
      const notes = kind === "STOPPER" ? [[100, 0, 0.16], [520, 0.12, 0.16], [1100, 0.24, 0.28]] :
        kind === "GUARD" ? [[660, 0, 0.22], [990, 0.08, 0.25]] : [[520, 0, 0.10], [780, 0.08, 0.16]];
      for (const [frequency, delay, duration] of notes) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + delay;
        oscillator.type = kind === "STOPPER" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.055, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        this.active.add(oscillator);
        oscillator.start(start); oscillator.stop(start + duration);
      }
    } catch { /* Audio failure must never stop play. */ }
  }
};

Hop.Audio.loadMute();
