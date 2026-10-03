"use strict";
// Optional presentation assets. A failed load never blocks the game loop.
Hop.Sprites = {
  definitions: {
    HERO: {
      FLIGHT_LOOP: {
        src: "assets/sprites/hero/flight_loop/hero_flight_loop_sheet_96x96.png",
        metadata: "assets/sprites/hero/flight_loop/hero_flight_loop.json",
        animation: "FLIGHT_LOOP", fps: 8, loop: true, scale: 1.25
      },
      // One-shot poses shown after a successful AERIAL, then FLIGHT_LOOP resumes.
      AERIAL_UP: {
        src: "assets/sprites/hero/hero_aerial_up_v1_bundle/hero_aerial_up_sheet_96x96.png",
        metadata: "assets/sprites/hero/hero_aerial_up_v1_bundle/hero_aerial_up.json",
        animation: "AERIAL_UP", fps: 12, loop: false, scale: 1.25
      },
      AERIAL_DOWN: {
        src: "assets/sprites/hero/hero_aerial_down_v1_bundle/hero_aerial_down_sheet_96x96.png",
        metadata: "assets/sprites/hero/hero_aerial_down_v1_bundle/hero_aerial_down.json",
        animation: "AERIAL_DOWN", fps: 12, loop: false, scale: 1.25
      },
      // Normal ground bounce one-shot (merchant Type D BOUND BOOST excluded).
      // enabled:false = asset not delivered yet: never requested, so no 404 in the console.
      // v1 bundle delivered: enabled. tests/sprites-ground-bounce.cjs enforces flag == files present.
      GROUND_BOUNCE: {
        src: "assets/sprites/hero/hero_ground_bounce_v1_bundle/hero_ground_bounce_sheet_96x96.png",
        metadata: "assets/sprites/hero/hero_ground_bounce_v1_bundle/hero_ground_bounce.json",
        animation: "GROUND_BOUNCE", fps: 12, loop: false, scale: 1.25, enabled: true,
        // Display tuning (no game effect). Detection happens after the rebound, so the JSON
        // "sequence" starts at the deepest squash. Tilt is suppressed while it plays and eases
        // back over tiltEase s. A new bounce restarts it only after minRestartInterval s, and
        // tiny hops (predicted airtime 2*vy/gravity < minHopTime s) never start it.
        suppressTilt: true, tiltEase: 0.12, minRestartInterval: 0.3, minHopTime: 0.25
      },
      // Truck impact at launch (AIM_POWER -> FLYING): comedic "blown away" one-shot with the
      // rotation baked into the frames, then FLIGHT_LOOP. Any later AERIAL / GROUND_BOUNCE replaces
      // it (newest wins). vy tilt is suppressed while it plays (baked rotation) and eases back.
      // Reduced motion shows one representative frame (stillTime; v2 = sheet 4, the stiff pose) for the same duration.
      HIT: {
        src: "assets/sprites/hero/hero_hit_v1_bundle/hero_hit_sheet_96x96.png",
        metadata: "assets/sprites/hero/hero_hit_v1_bundle/hero_hit.json",
        animation: "HIT", fps: 12, loop: false, scale: 1.25, enabled: true,
        suppressTilt: true, tiltEase: 0.12, stillTime: 5.5 / 12
      },
      // SPECIAL success one-shot (resolveSpecial true / specialSuccesses++), then FLIGHT_LOOP.
      // enabled:false = asset not delivered yet: never requested, so no 404 in the console.
      // tests/sprites-special-reaction.cjs enforces flag == files present. Newest one-shot wins
      // vs HIT / AERIAL / GROUND_BOUNCE. Proud pose: suppressTilt kept for consistency with HIT/GB.
      // Reduced motion shows one representative frame (stillTime; sheet ~5 until the real asset).
      SPECIAL_REACTION: {
        src: "assets/sprites/hero/hero_special_reaction_v1_bundle/hero_special_reaction_sheet_96x96.png",
        metadata: "assets/sprites/hero/hero_special_reaction_v1_bundle/hero_special_reaction.json",
        animation: "SPECIAL_REACTION", fps: 12, loop: false, scale: 1.25, enabled: false,
        suppressTilt: true, tiltEase: 0.12, stillTime: 5.5 / 12
      },
      // Played once when the hero has come to a full stop on the ground (body.stopped, FLYING
      // or RESULT), then the last frame is held until RETRY. Same flag pattern as GROUND_BOUNCE.
      // A stop above the ground (STOPPER contact in mid-air) keeps the previous drawing.
      STOP_RESULT: {
        src: "assets/sprites/hero/hero_stop_result_v1_bundle/hero_stop_result_sheet_96x96.png",
        metadata: "assets/sprites/hero/hero_stop_result_v1_bundle/hero_stop_result.json",
        animation: "STOP_RESULT", fps: 12, loop: false, scale: 1.25, enabled: true, maxGroundY: 0.5,
        // RESULT overlay (display only): transparent while STOP_RESULT plays, then fades in over
        // overlayFade s. Only when the animation really plays; input/RETRY timing is unchanged.
        overlayFade: 0.2
      }
    }
  },
  // visual.oneShot.animation -> loaded asset key. Later events restart/replace the one-shot.
  oneShots: { AERIAL_UP: "heroAerialUp", AERIAL_DOWN: "heroAerialDown", GROUND_BOUNCE: "heroGroundBounce", HIT: "heroHit", SPECIAL_REACTION: "heroSpecialReaction" },
  async load(definition) {
    const asset = { ready: false, image: null, data: null };
    if (definition?.enabled === false) return asset;
    try {
      const response = await fetch(definition.metadata);
      if (!response.ok) return asset;
      const data = await response.json();
      if (data.id !== "HERO" || data.animation !== definition.animation ||
          data.frameWidth !== 96 || data.frameHeight !== 96 || data.frames !== 8 ||
          data.fps !== definition.fps || data.loop !== definition.loop ||
          data.pivot?.x !== 48 || data.pivot?.y !== 88) return asset;
      // Optional playback order: sheet column indices, played at fps (duration = length / fps).
      if (data.sequence !== undefined && !(Array.isArray(data.sequence) && data.sequence.length >= 1 && data.sequence.length <= 64 &&
          data.sequence.every(i => Number.isInteger(i) && i >= 0 && i < data.frames))) return asset;
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = definition.src;
      });
      if (image.naturalWidth !== data.frameWidth * data.frames || image.naturalHeight !== data.frameHeight) return asset;
      Object.assign(asset, { ready: true, image, data });
    } catch (_) { /* Missing/blocked assets retain the next fallback. */ }
    return asset;
  },
  // Time-based frame index: identical for any refresh rate. One-shots hold the last frame.
  frameAt(data, time) {
    const index = Math.floor(Math.max(0, Number.isFinite(time) ? time : 0) * data.fps);
    const sequence = Array.isArray(data.sequence) ? data.sequence : null, count = sequence ? sequence.length : data.frames;
    const step = data.loop === false ? Math.min(index, count - 1) : index % count;
    return sequence ? sequence[step] : step;
  },
  duration(data) { return (Array.isArray(data.sequence) ? data.sequence.length : data.frames) / data.fps; },
  draw(ctx, asset, time, x, feet, scale) {
    if (!asset?.ready || !asset.image?.complete || !asset.image.naturalWidth || !asset.data?.pivot) return false;
    const d = asset.data;
    const frame = this.frameAt(d, time);
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(asset.image, frame * d.frameWidth, 0, d.frameWidth, d.frameHeight,
        x - d.pivot.x * scale, feet - d.pivot.y * scale, d.frameWidth * scale, d.frameHeight * scale);
      return true;
    } catch (_) { return false; }
    finally { ctx.restore(); }
  },
  // Display-only GROUND_BOUNCE gating for a detected normal bounce (pure; vy = rebound speed).
  groundBounceAllowed(visual, phaseTime, vy) {
    const def = this.definitions.HERO.GROUND_BOUNCE, asset = this.heroGroundBounce;
    if (!asset?.ready || !asset.data) return false;
    const gravity = Hop.CONFIG?.gravity;
    if (def.minHopTime > 0 && gravity > 0 && 2 * Math.max(0, vy) / gravity < def.minHopTime) return false;
    const shot = visual?.oneShot;
    if (shot?.animation === "GROUND_BOUNCE" && def.minRestartInterval > 0 && phaseTime - shot.at < def.minRestartInterval) return false;
    return true;
  },
  // Multiplier for the FLYING vy tilt (pure): 0 while a suppressTilt one-shot (GROUND_BOUNCE, HIT,
  // SPECIAL_REACTION) plays, then eases back to 1 over its tiltEase.
  tiltWeight(visual, phaseTime) {
    const shot = visual?.oneShot, name = shot?.animation;
    if (!name || !Object.prototype.hasOwnProperty.call(this.oneShots, name)) return 1;
    const def = this.definitions.HERO[name], asset = this[this.oneShots[name]];
    if (!def?.suppressTilt || !asset?.ready || !asset.data) return 1;
    const time = phaseTime - shot.at, end = this.duration(asset.data);
    if (!(time >= 0)) return 1;
    if (time < end) return 0;
    return def.tiltEase > 0 ? Math.min(1, (time - end) / def.tiltEase) : 1;
  },
  // Display-only: should a STOP_RESULT play for this game state? (pure)
  stopResultEligible(game) {
    const def = this.definitions.HERO.STOP_RESULT, b = game?.body, s = Hop.STATES;
    return !!b?.stopped && b.y <= def.maxGroundY && (game.state === s?.FLYING || game.state === s?.RESULT);
  },
  // STOP_RESULT candidate (pure): [] when not stopped or the asset is missing. Holds the last
  // frame after playing; reduced motion shows that final frame immediately.
  stopLayers(visual, phaseTime) {
    const asset = this.heroStopResult, at = visual?.stopAt;
    if (!asset?.ready || !asset.data || !Number.isFinite(at)) return [];
    const end = this.duration(asset.data);
    const time = visual.reducedMotion ? end : Math.max(0, phaseTime - at);
    return [{ name: "STOP_RESULT", asset, time, scale: this.definitions.HERO.STOP_RESULT.scale }];
  },
  // RESULT overlay opacity (pure): 1 = current behaviour. 0 while STOP_RESULT plays, then a
  // linear fade to 1. Mid-air stops (no stopAt), missing asset and reduced motion stay at 1.
  resultOverlayAlpha(visual, phaseTime, state) {
    const asset = this.heroStopResult, at = visual?.stopAt, fade = this.definitions.HERO.STOP_RESULT.overlayFade;
    if (state !== Hop.STATES?.RESULT || visual?.reducedMotion || !asset?.ready || !asset.data || !Number.isFinite(at)) return 1;
    const t = phaseTime - at - this.duration(asset.data);
    if (!(t >= 0)) return 0;
    return fade > 0 ? Math.min(1, t / fade) : 1;
  },
  // Ordered FLYING candidates (pure): active one-shot (AERIAL / GROUND_BOUNCE), then FLIGHT_LOOP.
  // The caller falls back to the Canvas HERO when every candidate fails to draw.
  heroLayers(visual, phaseTime) {
    const d = this.definitions.HERO, layers = [], still = !!visual?.reducedMotion;
    const shot = visual?.oneShot, name = shot?.animation;
    if (name && Object.prototype.hasOwnProperty.call(this.oneShots, name)) {
      const asset = this[this.oneShots[name]], time = phaseTime - shot.at;
      if (asset?.ready && asset.data && time >= 0 && time < this.duration(asset.data)) {
        layers.push({ name, asset, time: still ? (d[name].stillTime || 0) : time, scale: d[name].scale });
      }
    }
    const flightTime = Number.isFinite(visual?.launchAt) ? phaseTime - visual.launchAt : phaseTime;
    layers.push({ name: "FLIGHT_LOOP", asset: this.heroFlight, time: still ? 0 : flightTime, scale: d.FLIGHT_LOOP.scale });
    return layers;
  }
};
Hop.Sprites.ready = Hop.Sprites.load(Hop.Sprites.definitions.HERO.FLIGHT_LOOP).then(asset => {
  Hop.Sprites.heroFlight = asset;
  return asset;
});
Hop.Sprites.aerialReady = Promise.all([["UP", "heroAerialUp"], ["DOWN", "heroAerialDown"]].map(([direction, key]) =>
  Hop.Sprites.load(Hop.Sprites.definitions.HERO["AERIAL_" + direction]).then(asset => {
    Hop.Sprites[key] = asset;
    return asset;
  })));
Hop.Sprites.groundBounceReady = Hop.Sprites.load(Hop.Sprites.definitions.HERO.GROUND_BOUNCE).then(asset => {
  Hop.Sprites.heroGroundBounce = asset;
  return asset;
});
Hop.Sprites.stopResultReady = Hop.Sprites.load(Hop.Sprites.definitions.HERO.STOP_RESULT).then(asset => {
  Hop.Sprites.heroStopResult = asset;
  return asset;
});
Hop.Sprites.hitReady = Hop.Sprites.load(Hop.Sprites.definitions.HERO.HIT).then(asset => {
  Hop.Sprites.heroHit = asset;
  return asset;
});
Hop.Sprites.specialReactionReady = Hop.Sprites.load(Hop.Sprites.definitions.HERO.SPECIAL_REACTION).then(asset => {
  Hop.Sprites.heroSpecialReaction = asset;
  return asset;
});
