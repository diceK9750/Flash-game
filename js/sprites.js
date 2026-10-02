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
      }
    }
  },
  async load(definition) {
    const asset = { ready: false, image: null, data: null };
    try {
      const response = await fetch(definition.metadata);
      if (!response.ok) return asset;
      const data = await response.json();
      if (data.id !== "HERO" || data.animation !== definition.animation ||
          data.frameWidth !== 96 || data.frameHeight !== 96 || data.frames !== 8 ||
          data.fps !== definition.fps || data.loop !== definition.loop ||
          data.pivot?.x !== 48 || data.pivot?.y !== 88) return asset;
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
    return data.loop === false ? Math.min(index, data.frames - 1) : index % data.frames;
  },
  duration(data) { return data.frames / data.fps; },
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
  // Ordered FLYING candidates (pure): active AERIAL one-shot, then FLIGHT_LOOP.
  // The caller falls back to the Canvas HERO when every candidate fails to draw.
  heroLayers(visual, phaseTime) {
    const d = this.definitions.HERO, layers = [], still = !!visual?.reducedMotion;
    const aerial = visual?.aerial;
    if (aerial && (aerial.direction === "UP" || aerial.direction === "DOWN")) {
      const asset = aerial.direction === "UP" ? this.heroAerialUp : this.heroAerialDown;
      const time = phaseTime - aerial.at;
      if (asset?.ready && asset.data && time >= 0 && time < this.duration(asset.data)) {
        layers.push({ name: "AERIAL_" + aerial.direction, asset, time: still ? 0 : time, scale: d["AERIAL_" + aerial.direction].scale });
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
