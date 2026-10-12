"use strict";
// Optional one-shot voice. It shares the existing SE AudioContext and mute preference;
// failures are contained here so a missing voice can never affect gameplay.
Hop.Voice = {
  registrySource: "assets/audio/voices/voice-registry.json",
  source: null,
  registry: null,
  context: null,
  buffer: null,
  buffers: new Map(),
  loading: false,
  generation: 0,
  muted: false,
  active: null,
  activeId: null,
  activePriority: -Infinity,
  debug: false,
  diagnose(message, error) {
    try { if (this.debug) console.warn("[voice] " + message, error || ""); } catch {}
  },
  // Gate: registry "reviewed" (all entries) or "per-entry" (only entries whose own authenticityStatus is "reviewed");
  // every playable entry still needs humanReviewed:true and a non-empty sourceProvenance.
  registryOpen(registry) { return registry?.authenticityStatus === "reviewed" || registry?.authenticityStatus === "per-entry"; },
  entryApproved(registry, entry) {
    if (!entry?.humanReviewed || typeof entry.sourceProvenance !== "string" || !entry.sourceProvenance.trim()) return false;
    return registry?.authenticityStatus === "reviewed" || (registry?.authenticityStatus === "per-entry" && entry.authenticityStatus === "reviewed");
  },
  unlock(debug = false) {
    try {
      this.debug = !!debug;
      if (Hop.Audio?.muted) { this.syncMute(); return; }
      const context = Hop.Audio?.context;
      if (!context) { this.diagnose("AudioContext unavailable"); return; }
      if (context.state === "suspended") this.diagnose("AudioContext suspended");
      if (this.context && this.context !== context) {
        this.stop(); this.buffers.clear(); this.buffer = null; this.registry = null; this.source = null;
      }
      this.context = context;
      if (this.loading || this.registry?.authenticityStatus !== undefined && !this.registryOpen(this.registry)) return;
      const known = Object.entries(this.registry?.assets || {});
      const approved = known.filter(([, entry]) => entry?.connectionStatus === "connected" && this.entryApproved(this.registry, entry));
      if (this.registryOpen(this.registry) && approved.every(([id]) => this.buffers.has(id))) return;
      this.loading = true;
      const generation = ++this.generation;
      Promise.resolve().then(async () => {
        try {
          if (typeof fetch !== "function") throw new Error("fetch unavailable");
          let registry = this.registry;
          if (!registry) {
            const registryResponse = await fetch(this.registrySource);
            if (!registryResponse?.ok) throw new Error("voice registry request failed: " + (registryResponse?.status ?? "no response"));
            registry = await registryResponse.json();
          }
          if (generation !== this.generation || Hop.Audio?.muted || this.context !== context) return;
          this.registry = registry;
          if (!this.registryOpen(registry) || !registry.assets || typeof registry.assets !== "object") {
            this.diagnose("voice registry is not authenticity-reviewed"); return;
          }
          await Promise.all(Object.entries(registry.assets).map(async ([id, entry]) => {
            if (this.buffers.has(id) || entry?.connectionStatus !== "connected" || !this.entryApproved(registry, entry) ||
                typeof entry.file !== "string" || !/^assets\/audio\/voices\/dist\/[a-z0-9_-]+\.mp3$/i.test(entry.file)) return;
            try {
              const response = await fetch(entry.file);
              if (!response?.ok) throw new Error("voice request failed: " + (response?.status ?? "no response"));
              if (generation !== this.generation || Hop.Audio?.muted || this.context !== context) return;
              const data = await response.arrayBuffer();
              if (generation !== this.generation || Hop.Audio?.muted || this.context !== context) return;
              const decoded = await context.decodeAudioData(data);
              if (generation === this.generation && this.context === context && !Hop.Audio?.muted) {
                this.buffers.set(id, decoded);
                if (id === "hero_launch") { this.buffer = decoded; this.source = entry.file; }
              }
            } catch (error) { this.diagnose("voice load/decode failed: " + id, error); }
          }));
        } catch (error) { this.diagnose("voice load/decode failed", error); }
        finally { if (generation === this.generation && this.context === context) this.loading = false; }
      }).catch(error => this.diagnose("voice loader failed", error));
    } catch (error) { this.diagnose("unlock failed", error); }
  },
  play(id, debug = false, event = null) {
    try {
      this.debug = !!debug;
      if (Hop.Audio?.muted || this.muted) { this.syncMute(); return; }
      const context = Hop.Audio?.context;
      if (!context) { this.diagnose("AudioContext unavailable"); return; }
      if (context.state !== "running") { this.diagnose("AudioContext suspended"); return; }
      const entry = this.registryOpen(this.registry) ? this.registry.assets?.[id] : null;
      if (!entry || entry.connectionStatus !== "connected" || !this.entryApproved(this.registry, entry) || entry.gameEvent !== event) {
        this.diagnose("voice event is not reviewed/connected: " + id); return;
      }
      const buffer = this.buffers.get(id) || (id === "hero_launch" ? this.buffer : null);
      if (!buffer || this.context !== context) { this.diagnose(id + " skipped: voice not ready"); return; }
      if (this.active && this.activeId === id) return; // same one-shot is never restarted by repeated UI frames
      const priority = Number.isFinite(entry.priority) ? entry.priority : 0;
      if (this.active && priority < this.activePriority) return;
      this.stopActive();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        try { source.disconnect(); } catch {}
        if (this.active === source) { this.active = null; this.activeId = null; this.activePriority = -Infinity; }
      };
      this.active = source;
      this.activeId = id;
      this.activePriority = priority;
      try { source.start(); }
      catch (error) {
        if (this.active === source) { this.active = null; this.activeId = null; this.activePriority = -Infinity; }
        try { source.disconnect(); } catch {}
        throw error;
      }
    } catch (error) { this.diagnose("voice playback failed", error); }
  },
  stop() {
    this.generation++;
    this.loading = false;
    this.stopActive();
  },
  stopActive() {
    const source = this.active;
    this.active = null; this.activeId = null; this.activePriority = -Infinity;
    if (!source) return;
    try { source.stop(); } catch (error) { this.diagnose("voice stop failed", error); }
    try { source.disconnect(); } catch {}
  },

  syncMute() {
    try {
      this.muted = !!Hop.Audio?.muted;
      if (this.muted) this.stop();
    } catch (error) { this.diagnose("mute sync failed", error); }
  }
};

try {
  document?.addEventListener?.("visibilitychange", () => {
    try { if (document.hidden) Hop.Voice.stop(); } catch { /* Leaving the page cannot affect gameplay. */ }
  });
} catch { /* Visibility handling is optional in constrained environments. */ }
