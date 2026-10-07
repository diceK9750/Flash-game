"use strict";
const assert = require("node:assert");

// Setup minimal browser-like mocks for Node environment
global.window = global;
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
  clear() { this.data = {}; }
};

// WebAudio Mock
class MockAudioNode {
  constructor(ctx) {
    this.context = ctx;
    this.connected = [];
    this.gain = {
      value: 1,
      setValueAtTime(v, t) { this.value = v; },
      linearRampToValueAtTime(v, t) { this.value = v; },
      exponentialRampToValueAtTime(v, t) { this.value = v; },
      cancelScheduledValues(t) {}
    };
    this.frequency = {
      value: 440,
      setValueAtTime(v, t) { this.value = v; },
      exponentialRampToValueAtTime(v, t) { this.value = v; }
    };
    this.Q = {
      value: 1,
      setValueAtTime(v, t) { this.value = v; }
    };
  }
  connect(dest) { this.connected.push(dest); }
  disconnect() { this.connected = []; }
}

class MockBufferSource extends MockAudioNode {
  constructor(ctx) {
    super(ctx);
    this.buffer = null;
    this.started = false;
    this.stopped = false;
    this.onended = null;
  }
  start(t) { this.started = true; }
  stop(t) {
    this.stopped = true;
    if (this.onended) {
      const cb = this.onended;
      this.onended = null;
      cb();
    }
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = new MockAudioNode(this);
    this.sampleRate = 24000;
  }
  createGain() { return new MockAudioNode(this); }
  createBufferSource() { return new MockBufferSource(this); }
  createBiquadFilter() { return new MockAudioNode(this); }
  createOscillator() {
    const osc = new MockAudioNode(this);
    osc.start = () => {};
    osc.stop = () => {};
    return osc;
  }
  createBuffer(channels, length, rate) {
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => new Float32Array(length) };
  }
  resume() { this.state = "running"; return Promise.resolve(); }
}

global.AudioContext = MockAudioContext;

// Load game code
require("../js/config.js");
require("../js/audio.js");

console.log("=== Testing Character Voice & Audio System (tests/audio-voice.cjs) ===");

const Audio = Hop.Audio;
Audio.ensureContext();

// Test 1: Initialization & LocalStorage
{
  console.log("Test 1: Default configuration and volume clamping");
  assert.strictEqual(Audio.muted, false);
  assert.strictEqual(Audio.voiceMuted, false);
  assert.strictEqual(Audio.voiceVolume, 0.9);

  Audio.setVoiceVolume(0.5);
  assert.strictEqual(Audio.voiceVolume, 0.5);
  assert.strictEqual(localStorage.getItem(Audio.voiceVolumeKey), "0.5");

  Audio.setVoiceVolume(1.5); // Clamp max
  assert.strictEqual(Audio.voiceVolume, 1.0);

  Audio.setVoiceVolume(-0.2); // Clamp min
  assert.strictEqual(Audio.voiceVolume, 0.0);

  // Restore
  Audio.setVoiceVolume(0.9);
  console.log("  [PASS] Volume clamping and storage verified.");
}

// Test 2: Mute Interlocking
{
  console.log("Test 2: Mute interlocking (Master mute vs Voice mute)");
  Audio.setVoiceMuted(true);
  assert.strictEqual(Audio.voiceMuted, true);
  assert.strictEqual(localStorage.getItem(Audio.voiceStorageKey), "true");

  // Attempt voice play while voiceMuted
  assert.strictEqual(Audio.playVoice("HERO_LAUNCH"), null);

  // Voice unmuted
  Audio.setVoiceMuted(false);
  assert.strictEqual(Audio.voiceMuted, false);

  // Master mute shuts down all voices
  Audio.setMuted(true);
  assert.strictEqual(Audio.muted, true);
  assert.strictEqual(Audio.playVoice("HERO_LAUNCH"), null);

  Audio.setMuted(false);
  console.log("  [PASS] Mute states and guards verified.");
}

// Test 3: Voice Priority Queue & Overlap Prevention
{
  console.log("Test 3: Voice priority queue and single speaker enforcement");
  
  // Register mock buffers into cache
  const dummyBuffer = Audio.context.createBuffer(1, 2400, 24000);
  Audio.voiceBuffers.set("HERO_LAUNCH", dummyBuffer);
  Audio.voiceBuffers.set("SPECIAL_BOOST", dummyBuffer);
  Audio.voiceBuffers.set("HERO_FLIGHT", dummyBuffer);

  // Play normal priority voice (HERO_LAUNCH: PRIORITY 5)
  const v1 = Audio.playVoice("HERO_LAUNCH", Audio.PRIORITY.NORMAL, 0);
  assert.ok(v1, "v1 should start playing");
  assert.strictEqual(Audio.currentVoice.key, "HERO_LAUNCH");
  assert.strictEqual(Audio.isDucking, true, "Ducking should activate when voice starts");

  // Attempt lower priority voice (HERO_FLIGHT: PRIORITY 1) -> must be discarded!
  const vLow = Audio.playVoice("HERO_FLIGHT", Audio.PRIORITY.LOW, 0);
  assert.strictEqual(vLow, null, "Lower priority voice must be rejected while higher plays");
  assert.strictEqual(Audio.currentVoice.key, "HERO_LAUNCH");

  // Play higher priority voice (SPECIAL_BOOST: PRIORITY 10) -> must preempt v1!
  const vHigh = Audio.playVoice("SPECIAL_BOOST", Audio.PRIORITY.HIGH, 0);
  assert.ok(vHigh, "Higher priority voice must start");
  assert.strictEqual(v1.source.stopped, true, "Previous lower priority voice must be stopped");
  assert.strictEqual(Audio.currentVoice.key, "SPECIAL_BOOST");

  // Voice ends naturally -> ducking restored
  vHigh.source.stop();
  assert.strictEqual(Audio.currentVoice, null);
  assert.strictEqual(Audio.isDucking, false, "Ducking should restore to false when voice ends");

  console.log("  [PASS] Priority preempting and ducking verified.");
}

// Test 4: Cooldown Prevention
{
  console.log("Test 4: Cooldown enforcement against audio spam");
  Audio.context.currentTime = 10.0;
  const dummyBuffer = Audio.context.createBuffer(1, 2400, 24000);
  Audio.voiceBuffers.set("HERO_LAUNCH", dummyBuffer);

  const first = Audio.playVoice("HERO_LAUNCH", Audio.PRIORITY.NORMAL, 0.5);
  assert.ok(first, "First call should succeed");
  first.source.stop();

  // Call immediately after (same time 10.0, cooldown 0.5s)
  const spam = Audio.playVoice("HERO_LAUNCH", Audio.PRIORITY.NORMAL, 0.5);
  assert.strictEqual(spam, null, "Immediate repeat should be blocked by cooldown");

  // Advance time past cooldown
  Audio.context.currentTime = 10.6;
  const afterCooldown = Audio.playVoice("HERO_LAUNCH", Audio.PRIORITY.NORMAL, 0.5);
  assert.ok(afterCooldown, "Call after cooldown should succeed");
  afterCooldown.source.stop();

  console.log("  [PASS] Cooldown gating verified.");
}

// Test 5: Clean Stop on Skip / Retry
{
  console.log("Test 5: Clean stop on Skip / Retry / Scene transitions");
  const dummyBuffer = Audio.context.createBuffer(1, 2400, 24000);
  Audio.voiceBuffers.set("COMBO_WITCH_CALL", dummyBuffer);

  // Schedule combo dialogue
  Audio.playComboVoices("BOOST", false, 0);
  assert.ok(Audio.comboVoiceTimers.length > 0, "Combo dialogue timers should be queued");

  // Trigger stopAllVoices (simulating SKIP / RETRY)
  Audio.stopAllVoices();
  assert.strictEqual(Audio.comboVoiceTimers.length, 0, "All combo timers must be cleared");
  assert.strictEqual(Audio.currentVoice, null, "Current voice must be stopped");
  assert.strictEqual(Audio.isDucking, false, "Ducking must be reset");

  console.log("  [PASS] Skip and retry cleanup verified.");
}

// Test 6: Merchant A-D Routing
{
  console.log("Test 6: Merchant A-D voice routing and distinction");
  let playedKey = null;
  const origPlayVoice = Audio.playVoice;
  Audio.playVoice = function(key, prio) { playedKey = key; return { source: { stop() {} } }; };

  Audio.play("SPECIAL_MERCHANT", "A");
  assert.strictEqual(playedKey, "SPECIAL_MERCHANT_A");

  Audio.play("SPECIAL_MERCHANT", "B");
  assert.strictEqual(playedKey, "SPECIAL_MERCHANT_B");

  Audio.play("SPECIAL_MERCHANT", "C");
  assert.strictEqual(playedKey, "SPECIAL_MERCHANT_C");

  Audio.play("SPECIAL_MERCHANT", "D");
  assert.strictEqual(playedKey, "SPECIAL_MERCHANT_D");

  Audio.playVoice = origPlayVoice;
  console.log("  [PASS] Merchant A-D voice routing verified.");
}

// Test 7: Missing Asset / Fetch Failure Robustness
{
  console.log("Test 7: Zero-crash resilience on missing assets / offline");
  const res = Audio.playVoice("NON_EXISTENT_KEY");
  assert.strictEqual(res, null, "Non-existent voice should safely return null without throwing");

  assert.doesNotThrow(() => {
    Audio.play("UNKNOWN_SPECIAL_KEY");
  }, "Unknown audio event should never throw or crash");

  console.log("  [PASS] Resilience against missing assets verified.");
}

console.log("\nALL AUDIO & CHARACTER VOICE TESTS PASSED! ✅\n");
