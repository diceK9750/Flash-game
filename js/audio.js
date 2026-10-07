"use strict";
// Optional synthesis only: no assets and no audio work before a gesture. Each SPECIAL has its own SE.
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
  // Per-SPECIAL synthesized SE (no files). Voices: [kind, start s, duration s, peak, ...params].
  //   ["tone", t, dur, peak, wave, f0, f1, attack]           oscillator, exponential pitch glide f0 -> f1
  //   ["noise", t, dur, peak, filter, f0, f1, Q]              seeded noise through a swept biquad
  // The summed voice peaks are scaled down to specialPeakCap so stacked voices never clip.
  specialPeakCap: 0.16,
  specialRecipes: {
    // 爆裂斜光 (魔法使い): explosion burst + rising sweep + sparkle
    SPECIAL_BOOST: [["noise", 0, 0.45, 0.09, "lowpass", 2400, 260, 0.9], ["tone", 0, 0.16, 0.06, "sine", 140, 45, 0.004],
      ["tone", 0.06, 0.55, 0.045, "sawtooth", 180, 1500, 0.03], ["tone", 0.46, 0.3, 0.03, "sine", 1760, 2350, 0.01]],
    // 連天蹴り (武闘家): three quick strikes, then two springy rising hops
    SPECIAL_BOUNCE: [0, 0.09, 0.18].flatMap(t => [["noise", t, 0.06, 0.07, "bandpass", 1100, 700, 1.2], ["tone", t, 0.09, 0.06, "sine", 170, 60, 0.003]])
      .concat([["tone", 0.3, 0.26, 0.035, "square", 300, 900, 0.01], ["tone", 0.46, 0.3, 0.035, "square", 450, 1350, 0.01]]),
    // 戦陣突破 (戦士): heavy metallic clang (inharmonic partials) + low impact + wind rush
    SPECIAL_DASH: [["tone", 0, 0.55, 0.03, "triangle", 220, 214, 0.002], ["tone", 0, 0.5, 0.025, "square", 331, 322, 0.002],
      ["tone", 0, 0.42, 0.02, "triangle", 587, 575, 0.002], ["tone", 0, 0.26, 0.08, "sine", 95, 38, 0.003],
      ["noise", 0.08, 0.62, 0.06, "bandpass", 380, 3200, 0.8]],
    // 聖光反転 (僧侶): bright major chord with a low pad + twinkling sparkles (grander than the old STOPPER)
    SPECIAL_STOPPER: [["tone", 0, 0.95, 0.035, "sine", 130.81, 130.81, 0.06]]
      .concat([523.25, 659.25, 783.99, 1046.5].map((f, i) => ["tone", i * 0.05, 0.9 - i * 0.05, 0.028, "triangle", f, f, 0.04]))
      .concat([2093, 2637, 3136, 2349, 3520, 4186].map((f, i) => ["tone", 0.18 + i * 0.1, 0.16, 0.018, "sine", f, f * 1.01, 0.005]))
      .concat([["noise", 0.15, 0.7, 0.012, "highpass", 6000, 9000, 0.7]]),
    // 影すり抜け (盗賊): low "hyun" whoosh sliding down + a soft tick as the shadow passes
    SPECIAL_BRAKE: [["noise", 0, 0.5, 0.07, "bandpass", 2600, 240, 2.2], ["tone", 0, 0.46, 0.05, "sine", 720, 105, 0.02],
      ["tone", 0.5, 0.06, 0.03, "square", 150, 120, 0.002]],
    // 水平曲芸 (遊び人): snare-ish drum roll, two comic "pyon" boings, a light cymbal tap
    SPECIAL_ANGLE: Array.from({ length: 8 }, (_, i) => ["noise", i * 0.04, 0.035, 0.03 + i * 0.004, "highpass", 1500, 1500, 0.7])
      .concat([["tone", 0.36, 0.14, 0.055, "sine", 400, 1200, 0.005], ["tone", 0.52, 0.16, 0.055, "sine", 600, 1800, 0.005],
        ["noise", 0.7, 0.25, 0.03, "highpass", 5000, 7000, 0.7]]),
    // 聖護結界 (賢者): humming barrier "buun" (beating low drone rising) + two bell strikes with inharmonic partials
    SPECIAL_GUARD: [["tone", 0, 0.75, 0.055, "sine", 110, 220, 0.05], ["tone", 0, 0.75, 0.025, "triangle", 223, 446, 0.05],
      ["tone", 0.15, 0.6, 0.03, "sine", 1318.5, 1318.5, 0.003], ["tone", 0.15, 0.45, 0.012, "sine", 3639, 3639, 0.003],
      ["tone", 0.3, 0.6, 0.03, "sine", 1975.5, 1975.5, 0.003], ["tone", 0.3, 0.45, 0.012, "sine", 5452, 5452, 0.003]],
    // 商人: "chirin" coin — two bright strikes with metallic partials, a smaller second coin, a tiny click
    SPECIAL_MERCHANT: [["noise", 0, 0.03, 0.03, "highpass", 6000, 6000, 0.7], ["tone", 0, 0.12, 0.045, "square", 1975.5, 1975.5, 0.002],
      ["tone", 0.08, 0.5, 0.05, "sine", 2637, 2637, 0.002], ["tone", 0.08, 0.35, 0.015, "sine", 6330, 6330, 0.002],
      ["tone", 0.26, 0.4, 0.03, "sine", 3136, 3136, 0.002], ["tone", 0.26, 0.25, 0.01, "sine", 7526, 7526, 0.002]]
  },
  // Worst-case summed peak: the largest total of voice peaks that are sounding at the same moment.
  peakSum(voices) {
    return Math.max(...voices.map(([, t]) => voices.reduce((sum, v) => sum + (v[1] <= t && t < v[1] + v[2] ? v[3] : 0), 0)));
  },
  noiseBuffer(ctx) {
    if (this.noise?.ctx === ctx) return this.noise.buffer;
    const length = Math.max(1, Math.floor((ctx.sampleRate || 44100) * 1.0));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate || 44100), data = buffer.getChannelData(0);
    let seed = 0x2f6b1d; // deterministic noise (same sound every time; offline renders match)
    for (let i = 0; i < length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    this.noise = { ctx, buffer };
    return buffer;
  },
  // Schedule a special recipe on ctx at time `at` (also used for offline WAV renders). Returns the master gain.
  render(ctx, kind, at = ctx.currentTime) {
    const voices = this.specialRecipes[kind];
    if (!voices) return null;
    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.min(1, this.specialPeakCap / this.peakSum(voices)), at);
    master.connect(ctx.destination);
    let open = voices.length;
    const done = (source, nodes) => () => {
      this.active.delete(source);
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      if (--open === 0) { try { master.disconnect(); } catch {} }
    };
    for (const [type, delay, duration, peak, a, b, c, d] of voices) {
      const start = at + delay, end = start + duration, gain = ctx.createGain();
      gain.gain.setValueAtTime(0, at); // a GainNode defaults to 1: hold it at 0 so a sub-sample early start never clicks
      let source, nodes;
      if (type === "tone") {
        source = ctx.createOscillator(); source.type = a;
        source.frequency.setValueAtTime(b, start);
        if (c !== b) source.frequency.exponentialRampToValueAtTime(c, end);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(peak, start + d);
        nodes = [source, gain];
        source.connect(gain);
      } else {
        source = ctx.createBufferSource(); source.buffer = this.noiseBuffer(ctx);
        const filter = ctx.createBiquadFilter(); filter.type = a; filter.Q.setValueAtTime(d, start);
        filter.frequency.setValueAtTime(b, start);
        if (c !== b) filter.frequency.exponentialRampToValueAtTime(c, end);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(peak, start + 0.004);
        nodes = [source, filter, gain];
        source.connect(filter); filter.connect(gain);
      }
      gain.gain.exponentialRampToValueAtTime(0.0005, end);
      gain.connect(master);
      source.onended = done(source, nodes);
      this.active.add(source);
      source.start(start); source.stop(end + 0.02);
    }
    return master;
  },
  play(kind) {
    if (this.muted) return;
    try {
      const ctx = this.context;
      if (!ctx || ctx.state !== "running") return;
      if (this.specialRecipes[kind]) { this.render(ctx, kind); return; }
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
