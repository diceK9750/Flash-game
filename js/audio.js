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
    // 巨神昇天拳 (武闘家): three quick strikes, then two springy rising hops
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
      ["tone", 0.26, 0.4, 0.03, "sine", 3136, 3136, 0.002], ["tone", 0.26, 0.25, 0.01, "sine", 7526, 7526, 0.002],
      // 2026-10-16 grander merchant: low fanfare swell + coin cascade + long shimmer (scaled to specialPeakCap)
      ["tone", 0.02, 0.9, 0.035, "triangle", 523.25, 523.25, 0.02], ["tone", 0.02, 0.9, 0.025, "triangle", 783.99, 783.99, 0.02],
      ...[2349.3, 2793.8, 3520, 2637, 3951, 3136, 4186].map((f, i) => ["tone", 0.4 + i * 0.07, 0.16, 0.02, "square", f, f, 0.002]),
      ["noise", 0.4, 0.9, 0.012, "highpass", 7000, 11000, 0.7], ["tone", 0.9, 0.7, 0.025, "sine", 3136, 3200, 0.01]]
  },
  // Combo SPECIAL scene tracks (display-synced, times from the success; the scene starts at S = 0.77 s, when the
  // cut-in begins its fade). Same voice format and peak cap. Skip stops the whole track (stopCombo).
  comboRecipes: (() => {
    const S = 0.77, hit = t => [["noise", t, 0.05, 0.06, "bandpass", 1500, 800, 1.4], ["tone", t, 0.07, 0.05, "sine", 190, 70, 0.002]];
    const witch = [["noise", S, 0.3, 0.05, "bandpass", 700, 2600, 1.1]]                                    // dash whoosh
      .concat([["tone", S + 0.15, 1.45, 0.03, "sine", 220, 330, 0.25], ["tone", S + 0.15, 1.45, 0.018, "triangle", 331, 497, 0.25], // chant drone
        ["noise", S + 0.4, 1.2, 0.012, "highpass", 5000, 8000, 0.7]])                                     // gathering sparkle hiss
      .concat(Array.from({ length: 14 }, (_, i) => hit(S + 0.30 + i * 0.093)).flat())                       // rush x14
      .concat([["tone", S + 1.60, 0.28, 0.08, "sine", 130, 40, 0.003], ["noise", S + 1.60, 0.3, 0.07, "lowpass", 2600, 300, 0.9], // finisher
        ["noise", S + 1.64, 0.3, 0.04, "bandpass", 500, 3000, 1.0],                                       // launch whoosh up
        ["tone", S + 1.90, 0.26, 0.04, "sawtooth", 200, 1100, 0.02],                                      // fireball charge
        ["noise", S + 2.15, 0.95, 0.11, "lowpass", 3200, 140, 0.8], ["tone", S + 2.15, 0.7, 0.08, "sine", 95, 28, 0.004], // big explosion
        ["noise", S + 2.15, 0.12, 0.05, "highpass", 3000, 3000, 0.7]]);
    // Fighter SPECIAL (2026-10-13 upper): buff -> crouch -> drop into the ground -> rumble -> whoosh up -> massive impact.
    const fighter = [["noise", S, 0.35, 0.04, "bandpass", 600, 2000, 1.0]]                                 // witch runs in
      .concat([["tone", S + 0.40, 0.45, 0.04, "triangle", 300, 1200, 0.03]]                                  // buff spell rising
        .concat([1568, 2093, 2637].map((f, i) => ["tone", S + 0.45 + i * 0.12, 0.2, 0.018, "sine", f, f * 1.02, 0.004])))
      .concat([["tone", S + 0.85, 0.22, 0.03, "triangle", 180, 360, 0.05],                                  // crouch (charge)
        ["noise", S + 1.05, 0.2, 0.05, "bandpass", 2600, 400, 1.0],                                         // whoosh down
        ["tone", S + 1.22, 0.18, 0.07, "sine", 95, 38, 0.004], ["noise", S + 1.22, 0.2, 0.05, "lowpass", 900, 150, 0.8], // thud into the ground
        ["noise", S + 1.25, 0.5, 0.05, "lowpass", 120, 260, 0.9], ["tone", S + 1.25, 0.5, 0.045, "sine", 42, 58, 0.15], // rumble (ゴゴゴ…)
        ["noise", S + 1.70, 0.22, 0.06, "bandpass", 400, 3400, 1.1],                                        // whoosh up
        ["tone", S + 1.90, 0.85, 0.12, "sine", 110, 26, 0.003], ["noise", S + 1.90, 0.9, 0.1, "lowpass", 3000, 100, 0.8], // massive impact
        ["noise", S + 1.90, 0.08, 0.06, "highpass", 2500, 2500, 0.7], ["tone", S + 1.90, 0.3, 0.04, "sawtooth", 70, 40, 0.003],
        ["noise", S + 2.02, 0.35, 0.045, "bandpass", 500, 3000, 1.0]]);                                     // hero launched up
    // Grand solo SPECIAL scenes (2026-10-17 cycle 34): times from the success, scene from S; climax = config grandClimax.
    const boom = (t, k = 1) => [["tone", t, 0.8 * k, 0.11, "sine", 105, 28, 0.003], ["noise", t, 0.85 * k, 0.1, "lowpass", 3000, 110, 0.8], ["noise", t, 0.09, 0.05, "highpass", 2600, 2600, 0.7]];
    const chime = (t, fs, gap = 0.08, g = 0.02) => fs.map((f, i) => ["tone", t + i * gap, 0.35, g, "sine", f, f, 0.004]);
    const grand = {
      // 戦士: rumbling charge -> dash whoosh -> shockwave impact -> debris rattle
      DASH: [["noise", S, 0.55, 0.04, "lowpass", 160, 420, 0.9], ["tone", S, 0.7, 0.04, "sawtooth", 60, 140, 0.2], ["tone", S + 0.1, 0.6, 0.02, "triangle", 180, 520, 0.2],
        ["noise", S + 0.72, 0.25, 0.07, "bandpass", 500, 4200, 1.2]].concat(boom(S + 0.95, 1.1),
        [["tone", S + 0.95, 0.35, 0.05, "sawtooth", 90, 45, 0.003]], [0, 1, 2, 3, 4].map(i => ["noise", S + 1.05 + i * 0.07, 0.06, 0.03, "bandpass", 1800 - i * 200, 900, 1.4])),
      // 僧侶: choir pad -> descending shimmer (pillar) -> reversal bell + upward whoosh
      STOPPER: [["tone", S, 1.2, 0.025, "triangle", 392, 392, 0.3], ["tone", S, 1.2, 0.02, "triangle", 493.9, 493.9, 0.3], ["tone", S, 1.2, 0.018, "triangle", 587.3, 587.3, 0.3],
        ["noise", S + 0.3, 0.75, 0.025, "highpass", 9000, 4000, 0.7]].concat(chime(S + 0.35, [3136, 2637, 2349, 1976, 1568], 0.12, 0.015), boom(S + 1.15, 0.9),
        [["noise", S + 1.15, 0.45, 0.06, "bandpass", 400, 5000, 1.0], ["tone", S + 1.15, 1.1, 0.04, "sine", 1046.5, 1046.5, 0.005], ["tone", S + 1.15, 1.1, 0.025, "sine", 1568, 1568, 0.005]],
        chime(S + 1.3, [1568, 2093, 2637, 3136], 0.07, 0.016)),
      // 盗賊: dark swell -> four shadow swishes -> final cross slash + vanish puff
      BRAKE: [["tone", S, 0.9, 0.03, "sine", 70, 55, 0.2], ["noise", S, 0.4, 0.02, "lowpass", 300, 200, 0.9]]
        .concat([0, 1, 2, 3].map(i => ["noise", S + 0.2 + i * 0.2, 0.18, 0.05, "bandpass", 3000 - i * 300, 900, 1.3]),
          [["noise", S + 1.2, 0.08, 0.07, "highpass", 4000, 4000, 0.8], ["noise", S + 1.27, 0.08, 0.06, "highpass", 5000, 5000, 0.8], ["tone", S + 1.2, 0.4, 0.04, "sawtooth", 880, 220, 0.003]],
          boom(S + 1.2, 0.7), [["noise", S + 1.35, 0.5, 0.025, "lowpass", 1200, 300, 0.8]]),
      // 遊び人: comic pipe run while spinning -> pop + confetti crackle + whistle
      ANGLE: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ["tone", S + 0.3 + i * 0.11, 0.1, 0.022, "square", [523.3, 659.3, 784, 1046.5, 784, 659.3, 784, 1046.5][i], [523.3, 659.3, 784, 1046.5, 784, 659.3, 784, 1046.5][i], 0.003])
        .concat([["tone", S + 0.3, 0.9, 0.02, "triangle", 300, 900, 0.05]], boom(S + 1.2, 0.6),
          [["tone", S + 1.2, 0.5, 0.03, "sine", 1400, 2800, 0.01]], Array.from({ length: 10 }, (_, i) => ["noise", S + 1.25 + i * 0.05, 0.04, 0.02, "highpass", 6000 + i * 300, 6000, 0.7])),
      // 賢者: magic circle arpeggio -> barrier hum -> crystal impact
      GUARD: [["tone", S + 0.1, 1.0, 0.025, "sine", 220, 220, 0.3], ["tone", S + 0.1, 1.0, 0.018, "sine", 330, 330, 0.3]]
        .concat(chime(S + 0.15, [880, 1108.7, 1318.5, 1760, 2217.5, 2637], 0.13, 0.016), boom(S + 1.0, 0.8),
          [["tone", S + 1.0, 1.2, 0.035, "triangle", 440, 446, 0.02], ["tone", S + 1.0, 1.2, 0.025, "sine", 1760, 1772, 0.01]], chime(S + 1.05, [3520, 2960, 4186], 0.06, 0.014))
    };
    // afterglow tail (rings out through the end of the scene, like the combo explosions)
    const tail = (t, f) => [["tone", t, 1.7, 0.016, "sine", f, f * 1.01, 0.08], ["noise", t, 1.2, 0.012, "lowpass", 1400, 200, 0.7]];
    grand.DASH.push(...tail(S + 1.45, 196)); grand.STOPPER.push(...tail(S + 1.65, 784)); grand.BRAKE.push(...tail(S + 1.7, 147));
    grand.ANGLE.push(...tail(S + 1.7, 523.3)); grand.GUARD.push(...tail(S + 1.5, 659.3));
    const R = 0.4; // reducedMotion short version: scene from the still cut-in end
    return {
      GRAND_DASH: grand.DASH, GRAND_STOPPER: grand.STOPPER, GRAND_BRAKE: grand.BRAKE, GRAND_ANGLE: grand.ANGLE, GRAND_GUARD: grand.GUARD,
      GRAND_SHORT: [["tone", R, 0.4, 0.03, "triangle", 330, 660, 0.03], ["noise", R + 0.05, 0.4, 0.05, "lowpass", 2400, 160, 0.8]],
      COMBO_WITCH: witch, COMBO_FIGHTER: fighter,
      COMBO_WITCH_SHORT: [["tone", R, 0.3, 0.025, "sine", 220, 330, 0.08]].concat(hit(R + 0.05)).concat([["noise", R + 0.3, 0.45, 0.06, "lowpass", 2000, 160, 0.8]]),
      COMBO_FIGHTER_SHORT: [["tone", R, 0.25, 0.03, "triangle", 300, 900, 0.03], ["tone", R + 0.3, 0.4, 0.07, "sine", 105, 34, 0.003], ["noise", R + 0.3, 0.4, 0.06, "lowpass", 2200, 120, 0.8]]
    };
  })(),
  // Launch cut-in impact (truck x hero): sub thump + crunch + debris crackle + whoosh; MAX adds a deeper boom and ring.
  launchRecipes: (() => {
    const base = [["tone", 0, 0.42, 0.11, "sine", 120, 32, 0.002], ["noise", 0, 0.5, 0.10, "lowpass", 3800, 180, 0.8],
      ["noise", 0, 0.09, 0.06, "highpass", 2600, 2600, 0.7], ["tone", 0.005, 0.12, 0.04, "square", 260, 90, 0.002],
      ["noise", 0.06, 0.32, 0.03, "bandpass", 4200, 1800, 1.6], ["noise", 0.14, 0.55, 0.05, "bandpass", 600, 3200, 1.0]];
    return {
      LAUNCH_IMPACT: base,
      LAUNCH_IMPACT_MAX: base.concat([["tone", 0, 0.7, 0.09, "sine", 80, 24, 0.003], ["noise", 0.02, 0.8, 0.06, "lowpass", 1800, 90, 0.9],
        ["tone", 0.1, 0.5, 0.02, "triangle", 1568, 1520, 0.004], ["tone", 0.1, 0.5, 0.015, "triangle", 2349, 2290, 0.004]])
    };
  })(),
  // Tempo feedback SE (same voice format; no files, no voices). CHAIN / MILESTONE are pitched per event (opts.pitch).
  fxRecipes: {
    // hit chain "2HIT! 3HIT!": a punchy tick + a bright blip whose pitch climbs with the chain (opts.pitch)
    CHAIN: [["noise", 0, 0.05, 0.05, "bandpass", 2200, 1400, 1.2], ["tone", 0, 0.14, 0.06, "square", 660, 990, 0.003], ["tone", 0.05, 0.16, 0.035, "sine", 1320, 1320, 0.004]],
    // every 100 m: a light two-note chime
    MILESTONE: [["tone", 0, 0.12, 0.04, "triangle", 1046.5, 1046.5, 0.004], ["tone", 0.07, 0.18, 0.04, "triangle", 1568, 1568, 0.004]],
    // every 500 m: rising fanfare arpeggio + shimmer
    MILESTONE_BIG: [523.25, 659.25, 783.99, 1046.5].map((f, i) => ["tone", i * 0.07, 0.35 - i * 0.04, 0.04, "square", f, f, 0.005])
      .concat([["noise", 0.2, 0.4, 0.015, "highpass", 6000, 9000, 0.7], ["tone", 0.28, 0.4, 0.03, "sine", 2093, 2093, 0.01]]),
    // passing the best distance in flight
    NEW_RECORD: [783.99, 987.77, 1174.66, 1567.98].map((f, i) => ["tone", i * 0.09, 0.3, 0.045, "triangle", f, f * 1.005, 0.006])
      .concat([["noise", 0.3, 0.6, 0.02, "highpass", 5000, 8000, 0.7], ["tone", 0.3, 0.6, 0.03, "sine", 3136, 3200, 0.01]]),
    // JUST! launch: a crisp two-note "ching" (bright square + sine octave) with a short sparkle
    JUST: [["tone", 0, 0.09, 0.05, "square", 1760, 1760, 0.002], ["tone", 0.05, 0.28, 0.05, "square", 2637, 2637, 0.002],
      ["tone", 0.05, 0.3, 0.03, "sine", 5274, 5274, 0.003], ["noise", 0.04, 0.18, 0.02, "highpass", 7000, 10000, 0.7]],
    // RESULT rank stamp: a thud + paper slap (S adds a ring)
    // Final slide stop (2026-10-16 cycle 14): soft low thud + short scrape, quieter than RANK_STAMP.
    // Landing impact (2026-10-17 cycle 15): soft dull tap / hard low thud + grit; both quieter than RANK_STAMP.
    LAND_SOFT: [["tone", 0, 0.09, 0.03, "sine", 170, 90, 0.002], ["noise", 0, 0.06, 0.02, "lowpass", 900, 300, 0.7]],
    LAND_HARD: [["tone", 0, 0.2, 0.06, "sine", 110, 42, 0.002], ["noise", 0, 0.14, 0.04, "lowpass", 1600, 260, 0.8]],
    // AERIAL DOWN dive (2026-10-17 cycle 17): falling band-passed whoosh + low falling tone, quieter than RANK_STAMP.
    AERIAL_DIVE: [["noise", 0, 0.22, 0.04, "bandpass", 2600, 500, 1.4], ["tone", 0, 0.2, 0.03, "triangle", 660, 180, 0.004]],
    // AERIAL UP (2026-10-17 cycle 18): short rising chirp + airy puff, quieter than RANK_STAMP.
    AERIAL_RISE: [["tone", 0, 0.18, 0.03, "triangle", 330, 990, 0.004], ["noise", 0, 0.12, 0.025, "bandpass", 900, 2600, 1.2]],
    // AERIAL ↓ READY (2026-10-17 cycle 27): soft two-note "pin-pon" falling a fourth, quieter than RANK_STAMP.
    DOWN_READY: [["tone", 0, 0.1, 0.028, "triangle", 1318.5, 1318.5, 0.003], ["tone", 0.08, 0.18, 0.024, "triangle", 987.8, 987.8, 0.003]],
    // GUARD SPECIAL end (2026-10-17 cycle 29): soft falling shimmer (bell partials gliding down), quieter than RANK_STAMP.
    GUARD_END: [["tone", 0, 0.32, 0.03, "sine", 1975.5, 1318.5, 0.004], ["tone", 0.04, 0.3, 0.015, "sine", 3951, 2637, 0.004],
      ["tone", 0, 0.28, 0.025, "triangle", 440, 220, 0.01]],
    // SPECIAL window open (2026-10-17 cycle 31): two quick rising bright blips ("pi-pin!"), quieter than RANK_STAMP.
    SPECIAL_OPEN: [["tone", 0, 0.07, 0.035, "square", 1174.7, 1174.7, 0.002], ["tone", 0.07, 0.12, 0.035, "square", 1760, 1760, 0.002],
      ["tone", 0.07, 0.14, 0.015, "sine", 3520, 3520, 0.003]],
    SLIDE_STOP: [["tone", 0, 0.16, 0.05, "sine", 120, 60, 0.002], ["noise", 0, 0.14, 0.035, "lowpass", 1100, 250, 0.7]],
    RANK_STAMP: [["tone", 0, 0.22, 0.09, "sine", 150, 50, 0.002], ["noise", 0, 0.12, 0.06, "lowpass", 2400, 400, 0.8]],
    RANK_STAMP_S: [["tone", 0, 0.3, 0.1, "sine", 150, 45, 0.002], ["noise", 0, 0.14, 0.07, "lowpass", 2600, 400, 0.8],
      ["tone", 0.06, 0.7, 0.03, "triangle", 1318.5, 1318.5, 0.004], ["tone", 0.06, 0.7, 0.02, "triangle", 1975.5, 1975.5, 0.004], ["noise", 0.08, 0.5, 0.015, "highpass", 6000, 9000, 0.7]],
    // SS / SSS: the S stamp plus a rising major arpeggio and a longer shimmer (same format, scaled by specialPeakCap)
    RANK_STAMP_SS: [["tone", 0, 0.32, 0.1, "sine", 150, 42, 0.002], ["noise", 0, 0.16, 0.07, "lowpass", 2800, 400, 0.8],
      ...[1318.5, 1661.2, 1975.5, 2637].map((f, i) => ["tone", 0.06 + i * 0.07, 0.8 - i * 0.08, 0.025, "triangle", f, f, 0.004]),
      ["noise", 0.1, 0.8, 0.015, "highpass", 6000, 10000, 0.7]]
  },
  // Pitch for the n-th chain hit: +2 semitones per hit from 2HIT, capped at +16.
  chainPitch(n) { return 2 ** (Math.min(16, Math.max(0, (n - 2) * 2)) / 12); },
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
  // opts.pitch multiplies every frequency (tones and filters); opts.rate > 1 plays the timeline faster (repeat combos).
  render(ctx, kind, at = ctx.currentTime, opts = null) {
    const recipe = this.specialRecipes[kind] || this.comboRecipes[kind] || this.launchRecipes[kind] || this.fxRecipes[kind];
    const pitch = opts?.pitch > 0 ? opts.pitch : 1, rate = opts?.rate > 0 ? opts.rate : 1;
    const voices = recipe && (pitch === 1 && rate === 1 ? recipe : recipe.map(([type, t, dur, peak, a, b, c, d]) =>
      [type, t / rate, dur / rate, peak, a, b * pitch, c * pitch, type === "tone" ? d / rate : d]));
    if (!voices) return null;
    const master = ctx.createGain(), sources = [];
    master.sources = sources;
    master.gain.setValueAtTime(Math.min(1, this.specialPeakCap / this.peakSum(voices)), at); // level from the whole recipe
    // opts.from (cycle 30): resume a track part-way: only voices that start at or after `from` s are scheduled.
    const from = opts?.from > 0 ? opts.from : 0;
    master.connect(ctx.destination);
    const done = (source, nodes) => () => {
      this.active.delete(source);
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      if (--open === 0) { try { master.disconnect(); } catch {} }
    };
    const play = from ? voices.filter(v => v[1] >= from - 1e-9) : voices;
    if (!play.length) { try { master.disconnect(); } catch {} return master; }
    let open = play.length;
    for (const [type, delay, duration, peak, a, b, c, d] of play) {
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
      this.active.add(source); sources.push(source);
      source.start(start); source.stop(end + 0.02);
    }
    return master;
  },
  // Combo scene track: kind = COMBO_WITCH / COMBO_FIGHTER (+ _SHORT). offset = seconds already elapsed since the
  // success. Only one track at a time; stopCombo (skip / RETRY) stops every voice still pending or sounding.
  playCombo(kind, offset = 0, rate = 1) {
    this.stopCombo();
    if (this.muted) return null;
    try {
      const ctx = this.context;
      if (!ctx || ctx.state !== "running" || !this.comboRecipes[kind]) return null;
      this.comboTrack = this.render(ctx, kind, ctx.currentTime - Math.max(0, Math.min(0.5, (offset || 0) / (rate || 1))), rate !== 1 ? { rate } : null);
      return this.comboTrack;
    } catch { return null; }
  },
  // Unmute during a combo scene (cycle 30): continue the scene SE from `offset` (seconds since the success, scene
  // time) without replaying anything already past. Same track slot as playCombo, so skip / RETRY still stop it.
  resumeCombo(kind, offset = 0, rate = 1) {
    this.stopCombo();
    if (this.muted) return null;
    try {
      const ctx = this.context, r = rate > 0 ? rate : 1, from = Math.max(0, (offset || 0) / r);
      if (!ctx || ctx.state !== "running" || !this.comboRecipes[kind]) return null;
      this.comboTrack = this.render(ctx, kind, ctx.currentTime - from, r !== 1 ? { rate: r, from } : { from });
      return this.comboTrack;
    } catch { return null; }
  },
  stopCombo() {
    const track = this.comboTrack; this.comboTrack = null;
    if (!track?.sources) return;
    for (const source of track.sources) { try { source.stop(); } catch {} }
  },
  play(kind, opts = null) {
    if (this.muted) return;
    try {
      const ctx = this.context;
      if (!ctx || ctx.state !== "running") return;
      if (this.specialRecipes[kind] || this.launchRecipes[kind] || this.fxRecipes[kind]) { this.render(ctx, kind, ctx.currentTime, opts); return; }
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

// Hidden tab (2026-10-17 cycle 24): the game clock stops while hidden (rAF pauses, main.js skips the gap), so
// pause the SE clock too. Suspending keeps every scheduled voice (incl. a combo scene track) in step with the
// frozen scene; it resumes where it left off on return. If the browser refuses the resume, the next tap's
// unlock() resumes it. Foreground playback is unchanged.
Hop.Audio.onVisibility = function (hidden) {
  const ctx = this.context;
  if (!ctx) return;
  try {
    // Serialized: a quick hide/show must not let a pending suspend land after the resume.
    const queue = op => { this.visibilityOp = Promise.resolve(this.visibilityOp).then(op).catch(() => {}); };
    if (hidden) { if (ctx.state === "running" && !this.pausedByHide) { this.pausedByHide = true; queue(() => ctx.suspend()); } }
    else if (this.pausedByHide) { this.pausedByHide = false; if (!this.muted) queue(() => ctx.resume()); }
  } catch { /* Audio failure must never stop play. */ }
};
try {
  document?.addEventListener?.("visibilitychange", () => Hop.Audio.onVisibility(!!document.hidden));
} catch { /* Visibility handling is optional in constrained environments. */ }
