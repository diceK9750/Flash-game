"use strict";
// Hop.Audio: Synthesized WebAudio SE + Google Gemini TTS Voice playback system.
// Fully backward compatible with existing synthesis while adding robust voice management:
// - Ducking (SE automatically dims while voice plays)
// - Priority queue & cooldown (Special > Action > Ambient, prevents audio overlap)
// - Single speaker channel + dedicated combo dialogues
// - Safe cleanup on skip / retry / mute / visibilitychange
// - iOS Safari gesture unlock & zero-crash fallback if voice assets are delayed or missing.

Hop.Audio = {
  context: null,
  muted: false,
  voiceMuted: false,
  voiceVolume: 0.9,
  seVolume: 1.0,
  active: new Set(),
  storageKey: "truck-crash-se-muted-v1",
  voiceStorageKey: "truck-crash-voice-muted-v1",
  voiceVolumeKey: "truck-crash-voice-volume-v1",
  
  // Voice buffer cache and priority state
  voiceBuffers: new Map(),
  voiceLoading: new Map(),
  currentVoice: null,
  lastVoiceTimes: new Map(),
  comboVoiceTimers: [],
  seMasterGain: null,
  voiceMasterGain: null,
  isDucking: false,

  // Voice priority constants
  PRIORITY: {
    LOW: 1,
    NORMAL: 5,
    HIGH: 10,
    CRITICAL: 20
  },

  // Voice asset paths (distributable lightweight MP3s, with fallback to WAV)
  voiceMap: {
    HERO_LAUNCH: "assets/audio/voices/dist/hero_launch.mp3",
    HERO_FLIGHT: "assets/audio/voices/dist/hero_flight.mp3",
    HERO_STOP: "assets/audio/voices/dist/hero_stop.mp3",
    SPECIAL_BOOST: "assets/audio/voices/dist/special_boost.mp3",
    SPECIAL_BOUNCE: "assets/audio/voices/dist/special_bounce.mp3",
    SPECIAL_DASH: "assets/audio/voices/dist/special_dash.mp3",
    SPECIAL_STOPPER: "assets/audio/voices/dist/special_stopper.mp3",
    SPECIAL_BRAKE: "assets/audio/voices/dist/special_brake.mp3",
    SPECIAL_ANGLE: "assets/audio/voices/dist/special_angle.mp3",
    SPECIAL_GUARD: "assets/audio/voices/dist/special_guard.mp3",
    SPECIAL_MERCHANT_A: "assets/audio/voices/dist/special_merchant_a.mp3",
    SPECIAL_MERCHANT_B: "assets/audio/voices/dist/special_merchant_b.mp3",
    SPECIAL_MERCHANT_C: "assets/audio/voices/dist/special_merchant_c.mp3",
    SPECIAL_MERCHANT_D: "assets/audio/voices/dist/special_merchant_d.mp3",
    COMBO_WITCH_CALL: "assets/audio/voices/dist/combo_witch_call.mp3",
    COMBO_WITCH_BLAST: "assets/audio/voices/dist/combo_witch_blast.mp3",
    COMBO_FIGHTER_CALL: "assets/audio/voices/dist/combo_fighter_call.mp3",
    COMBO_FIGHTER_UPPER: "assets/audio/voices/dist/combo_fighter_upper.mp3",
    COMBO_WITCH_SHORT: "assets/audio/voices/dist/combo_witch_short.mp3",
    COMBO_FIGHTER_SHORT: "assets/audio/voices/dist/combo_fighter_short.mp3"
  },

  loadMute() {
    try {
      this.muted = window.localStorage.getItem(this.storageKey) === "true";
      this.voiceMuted = window.localStorage.getItem(this.voiceStorageKey) === "true";
      const vol = parseFloat(window.localStorage.getItem(this.voiceVolumeKey));
      if (Number.isFinite(vol) && vol >= 0 && vol <= 1) this.voiceVolume = vol;
    } catch { /* Keep session preference if storage is blocked */ }
  },

  setMuted(muted) {
    this.muted = !!muted;
    if (this.muted) {
      this.stopAll();
    }
    try { window.localStorage.setItem(this.storageKey, String(this.muted)); } catch {}
  },

  setVoiceMuted(muted) {
    this.voiceMuted = !!muted;
    if (this.voiceMuted) {
      this.stopAllVoices();
    }
    try { window.localStorage.setItem(this.voiceStorageKey, String(this.voiceMuted)); } catch {}
  },

  setVoiceVolume(vol) {
    this.voiceVolume = Math.max(0, Math.min(1, vol));
    if (this.voiceMasterGain && this.context) {
      this.voiceMasterGain.gain.setValueAtTime(this.voiceVolume, this.context.currentTime);
    }
    try { window.localStorage.setItem(this.voiceVolumeKey, String(this.voiceVolume)); } catch {}
  },

  ensureContext() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      try {
        this.context = new Context();
        this.seMasterGain = this.context.createGain();
        this.seMasterGain.gain.setValueAtTime(this.seVolume, this.context.currentTime);
        this.seMasterGain.connect(this.context.destination);

        this.voiceMasterGain = this.context.createGain();
        this.voiceMasterGain.gain.setValueAtTime(this.voiceVolume, this.context.currentTime);
        this.voiceMasterGain.connect(this.context.destination);
      } catch {
        this.context = null;
        return null;
      }
    }
    return this.context;
  },

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume()?.catch(() => {});
    }
    // Safari iOS unlock: play a tiny silent buffer on user gesture
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {}

    this.preloadVoices();
  },

  preloadVoices() {
    const ctx = this.ensureContext();
    if (!ctx || typeof fetch !== "function") return;
    for (const [key, url] of Object.entries(this.voiceMap)) {
      if (this.voiceBuffers.has(key) || this.voiceLoading.has(key)) continue;
      this.loadVoice(key, url);
    }
  },

  loadVoice(key, url) {
    const k = String(key).toUpperCase();
    const ctx = this.ensureContext();
    if (!ctx || typeof fetch !== "function") return Promise.resolve(null);
    if (this.voiceBuffers.has(k)) return Promise.resolve(this.voiceBuffers.get(k));
    if (this.voiceLoading.has(k)) return this.voiceLoading.get(k);

    const promise = fetch(url)
      .then(resp => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.arrayBuffer();
      })
      .then(ab => ctx.decodeAudioData(ab))
      .then(buffer => {
        this.voiceBuffers.set(k, buffer);
        this.voiceLoading.delete(k);
        return buffer;
      })
      .catch(() => {
        this.voiceLoading.delete(k);
        return null;
      });

    this.voiceLoading.set(k, promise);
    return promise;
  },

  startDucking() {
    if (this.isDucking || !this.seMasterGain || !this.context) return;
    this.isDucking = true;
    const now = this.context.currentTime;
    this.seMasterGain.gain.cancelScheduledValues(now);
    this.seMasterGain.gain.setValueAtTime(this.seMasterGain.gain.value, now);
    this.seMasterGain.gain.linearRampToValueAtTime(0.65, now + 0.05);
  },

  stopDucking() {
    if (!this.isDucking || !this.seMasterGain || !this.context) return;
    this.isDucking = false;
    const now = this.context.currentTime;
    this.seMasterGain.gain.cancelScheduledValues(now);
    this.seMasterGain.gain.setValueAtTime(this.seMasterGain.gain.value, now);
    this.seMasterGain.gain.linearRampToValueAtTime(1.0, now + 0.12);
  },

  playVoice(voiceKey, priority = this.PRIORITY.NORMAL, cooldownSec = 0.35) {
    if (this.muted || this.voiceMuted) return null;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== "running") return null;

    const k = String(voiceKey).toUpperCase();
    const now = ctx.currentTime;
    const lastTime = this.lastVoiceTimes.get(k) || -Infinity;
    if (now - lastTime < cooldownSec) {
      return null;
    }

    if (this.currentVoice) {
      if (priority < this.currentVoice.priority) {
        return null;
      }
      try {
        this.currentVoice.source.stop();
      } catch {}
      this.currentVoice = null;
    }

    const buffer = this.voiceBuffers.get(k);
    if (!buffer) {
      const url = this.voiceMap[k];
      if (url) this.loadVoice(k, url);
      return null;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.0, now);

      source.connect(gain);
      gain.connect(this.voiceMasterGain || ctx.destination);

      const voiceInfo = { source, gain, priority, key: k };
      this.currentVoice = voiceInfo;
      this.lastVoiceTimes.set(k, now);
      this.startDucking();

      source.onended = () => {
        if (this.currentVoice === voiceInfo) {
          this.currentVoice = null;
          this.stopDucking();
        }
        try { source.disconnect(); gain.disconnect(); } catch {}
      };

      source.start(now);
      return voiceInfo;
    } catch {
      this.stopDucking();
      return null;
    }
  },

  stopAllVoices() {
    for (const timer of this.comboVoiceTimers) {
      clearTimeout(timer);
    }
    this.comboVoiceTimers = [];

    if (this.currentVoice) {
      try { this.currentVoice.source.stop(); } catch {}
      this.currentVoice = null;
    }
    this.stopDucking();
  },

  stopAll() {
    this.stopCombo();
    this.stopAllVoices();
    for (const node of this.active) {
      try { node.stop(); } catch {}
    }
    this.active.clear();
  },

  playComboVoices(comboType, isShort = false, offset = 0) {
    this.stopAllVoices();
    if (this.muted || this.voiceMuted) return;

    const S = 0.77;
    const schedule = (sec, voiceKey) => {
      const delayMs = Math.max(0, (sec - offset) * 1000);
      const timer = setTimeout(() => {
        this.playVoice(voiceKey, this.PRIORITY.CRITICAL, 0.1);
      }, delayMs);
      this.comboVoiceTimers.push(timer);
    };

    if (comboType === "BOOST") {
      if (isShort) {
        schedule(0.1, "COMBO_WITCH_SHORT");
      } else {
        schedule(S + 0.30, "COMBO_WITCH_CALL");
        schedule(S + 1.60, "COMBO_WITCH_BLAST");
      }
    } else if (comboType === "BOUNCE") {
      if (isShort) {
        schedule(0.1, "COMBO_FIGHTER_SHORT");
      } else {
        schedule(S + 0.40, "COMBO_FIGHTER_CALL");
        schedule(S + 1.40, "COMBO_FIGHTER_UPPER");
      }
    }
  },

  specialPeakCap: 0.16,
  specialRecipes: {
    SPECIAL_BOOST: [["noise", 0, 0.45, 0.09, "lowpass", 2400, 260, 0.9], ["tone", 0, 0.16, 0.06, "sine", 140, 45, 0.004],
      ["tone", 0.06, 0.55, 0.045, "sawtooth", 180, 1500, 0.03], ["tone", 0.46, 0.3, 0.03, "sine", 1760, 2350, 0.01]],
    SPECIAL_BOUNCE: [0, 0.09, 0.18].flatMap(t => [["noise", t, 0.06, 0.07, "bandpass", 1100, 700, 1.2], ["tone", t, 0.09, 0.06, "sine", 170, 60, 0.003]])
      .concat([["tone", 0.3, 0.26, 0.035, "square", 300, 900, 0.01], ["tone", 0.46, 0.3, 0.035, "square", 450, 1350, 0.01]]),
    SPECIAL_DASH: [["tone", 0, 0.55, 0.03, "triangle", 220, 214, 0.002], ["tone", 0, 0.5, 0.025, "square", 331, 322, 0.002],
      ["tone", 0.42, 0.02, "triangle", 587, 575, 0.002], ["tone", 0.26, 0.08, "sine", 95, 38, 0.003],
      ["noise", 0.08, 0.62, 0.06, "bandpass", 380, 3200, 0.8]],
    SPECIAL_STOPPER: [["tone", 0, 0.95, 0.035, "sine", 130.81, 130.81, 0.06]]
      .concat([523.25, 659.25, 783.99, 1046.5].map((f, i) => ["tone", i * 0.05, 0.9 - i * 0.05, 0.028, "triangle", f, f, 0.04]))
      .concat([2093, 2637, 3136, 2349, 3520, 4186].map((f, i) => ["tone", 0.18 + i * 0.1, 0.16, 0.018, "sine", f, f * 1.01, 0.005]))
      .concat([["noise", 0.15, 0.7, 0.012, "highpass", 6000, 9000, 0.7]]),
    SPECIAL_BRAKE: [["noise", 0, 0.5, 0.07, "bandpass", 2600, 240, 2.2], ["tone", 0, 0.46, 0.05, "sine", 720, 105, 0.02],
      ["tone", 0.5, 0.06, 0.03, "square", 150, 120, 0.002]],
    SPECIAL_ANGLE: Array.from({ length: 8 }, (_, i) => ["noise", i * 0.04, 0.035, 0.03 + i * 0.004, "highpass", 1500, 1500, 0.7])
      .concat([["tone", 0.36, 0.14, 0.055, "sine", 400, 1200, 0.005], ["tone", 0.52, 0.16, 0.055, "sine", 600, 1800, 0.005],
      ["noise", 0.7, 0.25, 0.03, "highpass", 5000, 7000, 0.7]]),
    SPECIAL_GUARD: [["tone", 0, 0.75, 0.055, "sine", 110, 220, 0.05], ["tone", 0, 0.75, 0.025, "triangle", 223, 446, 0.05],
      ["tone", 0.15, 0.6, 0.03, "sine", 1318.5, 1318.5, 0.003], ["tone", 0.15, 0.45, 0.012, "sine", 3639, 3639, 0.003],
      ["tone", 0.3, 0.6, 0.03, "sine", 1975.5, 1975.5, 0.003], ["tone", 0.3, 0.45, 0.012, "sine", 5452, 5452, 0.003]],
    SPECIAL_MERCHANT: [["noise", 0, 0.03, 0.03, "highpass", 6000, 6000, 0.7], ["tone", 0, 0.12, 0.045, "square", 1975.5, 1975.5, 0.002],
      ["tone", 0.08, 0.5, 0.05, "sine", 2637, 2637, 0.002], ["tone", 0.08, 0.35, 0.015, "sine", 6330, 6330, 0.002],
      ["tone", 0.26, 0.4, 0.03, "sine", 3136, 3136, 0.002], ["tone", 0.26, 0.25, 0.01, "sine", 7526, 7526, 0.002]]
  },

  comboRecipes: (() => {
    const S = 0.77, hit = t => [["noise", t, 0.05, 0.06, "bandpass", 1500, 800, 1.4], ["tone", t, 0.07, 0.05, "sine", 190, 70, 0.002]];
    const witch = [["noise", S, 0.3, 0.05, "bandpass", 700, 2600, 1.1]]
      .concat([["tone", S + 0.15, 1.45, 0.03, "sine", 220, 330, 0.25], ["tone", S + 0.15, 1.45, 0.018, "triangle", 331, 497, 0.25],
      ["noise", S + 0.4, 1.2, 0.012, "highpass", 5000, 8000, 0.7]])
      .concat(Array.from({ length: 14 }, (_, i) => hit(S + 0.30 + i * 0.093)).flat())
      .concat([["tone", S + 1.60, 0.28, 0.08, "sine", 130, 40, 0.003], ["noise", S + 1.60, 0.3, 0.07, "lowpass", 2600, 300, 0.9],
      ["noise", S + 1.64, 0.3, 0.04, "bandpass", 500, 3000, 1.0],
      ["tone", S + 1.90, 0.26, 0.04, "sawtooth", 200, 1100, 0.02],
      ["noise", S + 2.15, 0.95, 0.11, "lowpass", 3200, 140, 0.8], ["tone", S + 2.15, 0.7, 0.08, "sine", 95, 28, 0.004],
      ["noise", S + 2.15, 0.12, 0.05, "highpass", 3000, 3000, 0.7]]);
    const fighter = [["noise", S, 0.35, 0.04, "bandpass", 600, 2000, 1.0]]
      .concat([["tone", S + 0.40, 0.45, 0.04, "triangle", 300, 1200, 0.03]])
      .concat([1568, 2093, 2637].map((f, i) => ["tone", S + 0.45 + i * 0.12, 0.2, 0.018, "sine", f, f * 1.02, 0.004]))
      .concat([0, 1, 2].map(i => ["tone", S + 0.85 + i * 0.165, 0.2, 0.06, "sine", 150 - i * 25, 70 - i * 12, 0.01]))
      .concat([["noise", S + 1.35, 0.25, 0.035, "lowpass", 300, 600, 0.8],
      ["tone", S + 1.60, 0.55, 0.1, "sine", 105, 32, 0.003], ["noise", S + 1.60, 0.6, 0.09, "lowpass", 2600, 110, 0.8],
      ["noise", S + 1.60, 0.07, 0.05, "highpass", 2500, 2500, 0.7], ["noise", S + 1.72, 0.3, 0.04, "bandpass", 500, 2800, 1.0]]);
    const R = 0.4;
    return {
      COMBO_WITCH: witch, COMBO_FIGHTER: fighter,
      COMBO_WITCH_SHORT: [["tone", R, 0.3, 0.025, "sine", 220, 330, 0.08]].concat(hit(R + 0.05)).concat([["noise", R + 0.3, 0.45, 0.06, "lowpass", 2000, 160, 0.8]]),
      COMBO_FIGHTER_SHORT: [["tone", R, 0.25, 0.03, "triangle", 300, 900, 0.03], ["tone", R + 0.3, 0.4, 0.07, "sine", 105, 34, 0.003], ["noise", R + 0.3, 0.4, 0.06, "lowpass", 2200, 120, 0.8]]
    };
  })(),

  peakSum(voices) {
    return Math.max(...voices.map(([, t]) => voices.reduce((sum, v) => sum + (v[1] <= t && t < v[1] + v[2] ? v[3] : 0), 0)));
  },

  noiseBuffer(ctx) {
    if (this.noise?.ctx === ctx) return this.noise.buffer;
    const length = Math.max(1, Math.floor((ctx.sampleRate || 44100) * 1.0));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate || 44100), data = buffer.getChannelData(0);
    let seed = 0x2f6b1d;
    for (let i = 0; i < length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    this.noise = { ctx, buffer };
    return buffer;
  },

  render(ctx, kind, at = ctx.currentTime) {
    const voices = this.specialRecipes[kind] || this.comboRecipes[kind];
    if (!voices) return null;
    const master = ctx.createGain(), sources = [];
    master.sources = sources;
    master.gain.setValueAtTime(Math.min(1, this.specialPeakCap / this.peakSum(voices)), at);
    master.connect(this.seMasterGain || ctx.destination);
    let open = voices.length;
    const done = (source, nodes) => () => {
      this.active.delete(source);
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      if (--open === 0) { try { master.disconnect(); } catch {} }
    };
    for (const [type, delay, duration, peak, a, b, c, d] of voices) {
      const start = at + delay, end = start + duration, gain = ctx.createGain();
      gain.gain.setValueAtTime(0, at);
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
      this.active.add(source); sources.push(source);
      source.start(start); source.stop(end + 0.02);
    }
    return master;
  },

  playCombo(kind, offset = 0) {
    this.stopCombo();
    if (this.muted) return null;
    try {
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== "running" || !this.comboRecipes[kind]) return null;
      this.comboTrack = this.render(ctx, kind, ctx.currentTime - Math.max(0, Math.min(0.5, offset || 0)));
      return this.comboTrack;
    } catch { return null; }
  },

  stopCombo() {
    const track = this.comboTrack; this.comboTrack = null;
    if (!track?.sources) return;
    for (const source of track.sources) { try { source.stop(); } catch {} }
  },

  play(kind, meta = null) {
    if (this.muted) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== "running") return;
      if (this.specialRecipes[kind]) {
        this.render(ctx, kind);
        // Map SPECIAL to voice key (handling merchant A-D distinction)
        let voiceKey = kind;
        if (kind === "SPECIAL_MERCHANT") {
          const type = (meta || "A").toUpperCase();
          voiceKey = `SPECIAL_MERCHANT_${type}`;
        }
        this.playVoice(voiceKey, this.PRIORITY.HIGH);
        return;
      }
      const notes = kind === "STOPPER" ? [[100, 0, 0.16], [520, 0.12, 0.16], [1100, 0.24, 0.28]] :
        kind === "GUARD" ? [[660, 0, 0.22], [990, 0.08, 0.25]] : [[520, 0, 0.10], [780, 0.08, 0.16]];
      for (const [frequency, delay, duration] of notes) {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + delay;
        oscillator.type = kind === "STOPPER" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.055, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain); gain.connect(this.seMasterGain || ctx.destination);
        oscillator.onended = () => { this.active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        this.active.add(oscillator);
        oscillator.start(start); oscillator.stop(start + duration);
      }
    } catch { /* Audio failure must never stop play */ }
  }
};
