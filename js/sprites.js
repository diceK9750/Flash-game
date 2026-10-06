"use strict";
// Optional presentation assets. A failed load never blocks the game loop.
Hop.Sprites = {
  definitions: {
    HERO: {
      // HD comic standing still for READY / AIM (display only; previous idle kept in hero/idle/). 288 cell; drawn scale = 1.25*96/288 so
      // on-screen size and feet match FLIGHT_LOOP. Other animations stay on the 96 sheets for now.
      IDLE: {
        src: "assets/sprites/hero/hero_idle_comic_v1/hero_idle_sheet_288x288.png",
        metadata: "assets/sprites/hero/hero_idle_comic_v1/hero_idle.json",
        animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, enabled: true
      },
      FLIGHT_LOOP: {
        src: "assets/sprites/hero/hero_flight_comic_v1/hero_flight_loop_sheet_288x288.png",
        metadata: "assets/sprites/hero/hero_flight_comic_v1/hero_flight_loop.json",
        animation: "FLIGHT_LOOP", fps: 8, loop: true, scale: 1.25
      },
      // One-shot poses shown after a successful AERIAL, then FLIGHT_LOOP resumes.
      // HD comic stills (8 identical cells, 288 high; DOWN uses a 384-wide cell for the dive).
      // The 96 v1 bundles are kept in hero_aerial_{up,down}_v1_bundle/.
      AERIAL_UP: {
        src: "assets/sprites/hero/hero_aerial_up_comic_v1/hero_aerial_up_sheet_288x288.png",
        metadata: "assets/sprites/hero/hero_aerial_up_comic_v1/hero_aerial_up.json",
        animation: "AERIAL_UP", fps: 12, loop: false, scale: 1.25
      },
      AERIAL_DOWN: {
        src: "assets/sprites/hero/hero_aerial_down_comic_v1/hero_aerial_down_sheet_384x288.png",
        metadata: "assets/sprites/hero/hero_aerial_down_comic_v1/hero_aerial_down.json",
        animation: "AERIAL_DOWN", fps: 12, loop: false, scale: 1.25
      },
      // Normal ground bounce one-shot (merchant Type D BOUND BOOST excluded).
      // enabled:false = asset not delivered yet: never requested, so no 404 in the console.
      // HD comic crouch delivered (288 cell; 96 v1 kept in hero_ground_bounce_v1_bundle/): enabled.
      // tests/sprites-ground-bounce.cjs enforces flag == files present.
      GROUND_BOUNCE: {
        src: "assets/sprites/hero/hero_ground_bounce_comic_v1/hero_ground_bounce_sheet_288x288.png",
        metadata: "assets/sprites/hero/hero_ground_bounce_comic_v1/hero_ground_bounce.json",
        animation: "GROUND_BOUNCE", fps: 12, loop: false, scale: 1.25, enabled: true,
        // Display tuning (no game effect). Detection happens after the rebound, so the JSON
        // "sequence" starts at the deepest squash. Tilt is suppressed while it plays and eases
        // back over tiltEase s. A new bounce restarts it only after minRestartInterval s, and
        // tiny hops (predicted airtime 2*vy/gravity < minHopTime s) never start it.
        suppressTilt: true, tiltEase: 0.12, minRestartInterval: 0.3, minHopTime: 0.25
      },
      // Truck impact at launch (AIM_POWER -> FLYING): comedic "blown away" one-shot with the
      // rotation baked into the frames, then FLIGHT_LOOP. A later AERIAL / GROUND_BOUNCE replaces
      // it after minShow (see oneShotPriority). vy tilt is suppressed while it plays (baked rotation) and eases back.
      // Reduced motion shows one representative frame (stillTime; v2 = sheet 4, the stiff pose) for the same duration.
      HIT: {
        // HD Rumiko knockback still (70% of idle on-screen height). 288 cell, 8 identical
        // frames; timing/suppressTilt unchanged. Drawn scale = 1.25*96/288.
        src: "assets/sprites/hero/hero_hit_hd_v1/hero_hit_sheet_288x288.png",
        metadata: "assets/sprites/hero/hero_hit_hd_v1/hero_hit.json",
        animation: "HIT", fps: 12, loop: false, scale: 1.25, enabled: true,
        suppressTilt: true, tiltEase: 0.12, stillTime: 5.5 / 12
      },
      // SPECIAL success one-shot (resolveSpecial true / specialSuccesses++), then FLIGHT_LOOP.
      // v1 bundle delivered (special_reaction_v1b): enabled. tests/sprites-special-reaction.cjs
      // enforces flag == files present. Priority 2 (oneShotPriority): HIT / AERIAL / GROUND_BOUNCE
      // never cut it; it replaces them. Also played for a MERCHANT SPECIAL success. suppressTilt with
      // tiltIn: the vy tilt eases out over 0.12 s at the start instead of snapping upright.
      // Reduced motion shows one representative frame (stillTime -> sheet 7, the proud hold).
      // HD comic sword-raise still (8 identical 384x288 cells, same sequence/fps); the 96 v1 bundle
      // is kept in hero_special_reaction_v1_bundle/.
      SPECIAL_REACTION: {
        src: "assets/sprites/hero/hero_special_reaction_comic_v1/hero_special_reaction_sheet_384x288.png",
        metadata: "assets/sprites/hero/hero_special_reaction_comic_v1/hero_special_reaction.json",
        animation: "SPECIAL_REACTION", fps: 12, loop: false, scale: 1.25, enabled: true,
        suppressTilt: true, tiltEase: 0.12, tiltIn: 0.12, stillTime: 7.5 / 12
      },
      // Played once when the hero has come to a full stop on the ground (body.stopped, FLYING
      // or RESULT), then the last frame is held until RETRY. Same flag pattern as GROUND_BOUNCE.
      // A stop above the ground (STOPPER contact in mid-air) keeps the previous drawing.
      STOP_RESULT: {
        // HD comic victory pose (384 cell, pivot 192,372 for the raised sword); 96 v1 kept in
        // hero_stop_result_v1_bundle/.
        src: "assets/sprites/hero/hero_stop_result_comic_v1/hero_stop_result_sheet_384x384.png",
        metadata: "assets/sprites/hero/hero_stop_result_comic_v1/hero_stop_result.json",
        animation: "STOP_RESULT", fps: 12, loop: false, scale: 1.25, enabled: true, maxGroundY: 0.5,
        // RESULT overlay (display only): transparent while STOP_RESULT plays, then fades in over
        // overlayFade s. Only when the animation really plays; input/RETRY timing is unchanged.
        overlayFade: 0.2
      }
    },
    // Phase C: roadside characters (g.objects) and the merchant overlay (SPECIAL_ONLY). One still
    // per slot (1-frame 96x96 sheet, pivot 48,88, or an HD cell; see normalizeCell) drawn in place of the Canvas figure with its feet
    // at the same point; the caller keeps the name label and the 35% used opacity. enabled:false =
    // asset not delivered yet: never requested (no 404), Canvas figure as before;
    // tests/sprites-cast.cjs enforces flag == files present. scale = sprite px -> canvas px (1.25 =
    // the hero's pixel size; the merchant overlay keeps its Canvas ratio 1.25/1.365 of the
    // roadside figures). flip mirrors a still that faces the wrong way. A slot with pose: 1 is the
    // used (post-contact) pose, drawn instead of IDLE once the hero has touched the figure (the same
    // object.used flag that already sets the 35% opacity / the Canvas fighter's raised leg); one per
    // character at most. A missing / broken pose-1 still falls back to IDLE. BOUNCE.KICK,
    // BOOST.USED, BRAKE.USED and ANGLE.USED have one.
    CAST: {
      BOOST: { // 魔法使い (HD comic idle r1a + used r1a; idle staff on the viewer's right like the Canvas witch, used pose thrusts it toward the hero; not mirrored)
        IDLE: { id: "BOOST", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_idle_sheet_288x288.png", metadata: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_idle.json" },
        // HD comic idle (288 cell) and used pose (384x288 cell for the wide stance); the 96 r1 stills are
        // kept in boost_witch/.
        USED: { id: "BOOST", animation: "USED", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, pose: 1, enabled: true,
          src: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_used_sheet_384x288.png", metadata: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_used.json" }
      },
      BOUNCE: { // 武闘家 (HD comic idle r1b + kick r1a; the kick points to the viewer's right like the Canvas pose, so not mirrored)
        IDLE: { id: "BOUNCE", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_idle_sheet_288x288.png", metadata: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_idle.json" },
        // HD comic idle (288 cell) and kick (384x288 cell for the high kick, standing foot on the pivot x);
        // the 96 r1 stills are kept in bounce_fighter/.
        KICK: { id: "BOUNCE", animation: "KICK", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, pose: 1, enabled: true,
          src: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_kick_sheet_384x288.png", metadata: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_kick.json" }
      },
      BRAKE: { // 盗賊 (HD comic idle r1b + used r1a; idle hook on the viewer's right like the Canvas thief, used pose throws it toward the hero; not mirrored)
        IDLE: { id: "BRAKE", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_idle_sheet_288x288.png", metadata: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_idle.json" },
        // HD comic idle (288 cell) and used pose (384x288 cell for the thrown hook and chain); the 96 r2 idle
        // and r1 used stills are kept in brake_thief/.
        USED: { id: "BRAKE", animation: "USED", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, pose: 1, enabled: true,
          src: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_used_sheet_384x288.png", metadata: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_used.json" }
      },
      ANGLE: { // 遊び人 (redesign r1 idle + used stills from the design sheet: enabled; idle cane already on the viewer's right like the Canvas jester's ball, used pose raises it toward the hero; not mirrored)
        IDLE: { id: "ANGLE", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/angle_jester/angle_jester_idle_sheet_96x96.png", metadata: "assets/sprites/cast/angle_jester/angle_jester_idle.json" },
        USED: { id: "ANGLE", animation: "USED", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, pose: 1, enabled: true,
          src: "assets/sprites/cast/angle_jester/angle_jester_used_sheet_96x96.png", metadata: "assets/sprites/cast/angle_jester/angle_jester_used.json" }
      },
      DASH: { // 戦士 (redesign r1 still from the design sheet: enabled, mirrored: sword on the viewer's right, shield on the left like the Canvas warrior)
        IDLE: { id: "DASH", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, enabled: true,
          src: "assets/sprites/cast/dash_warrior/dash_warrior_idle_sheet_96x96.png", metadata: "assets/sprites/cast/dash_warrior/dash_warrior_idle.json" }
      },
      GUARD: { // 賢者 (redesign r1 still from the design sheet, no hat: enabled, mirrored: staff on the viewer's right, book on the left like the Canvas sage)
        IDLE: { id: "GUARD", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, enabled: true,
          src: "assets/sprites/cast/guard_sage/guard_sage_idle_sheet_96x96.png", metadata: "assets/sprites/cast/guard_sage/guard_sage_idle.json" }
      },
      STOPPER: { // 僧侶 (redesign r3 still from the design sheet: enabled; staff on the viewer's right like the Canvas cleric, so not mirrored)
        IDLE: { id: "STOPPER", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/stopper_cleric/stopper_cleric_idle_sheet_96x96.png", metadata: "assets/sprites/cast/stopper_cleric/stopper_cleric_idle.json" }
      },
      SPECIAL_ONLY: { // 商人 (redesign r1 still from the design sheet: enabled; bag on the viewer's right under the item orb like the Canvas box, facing the hero, so not flipped)
        IDLE: { id: "SPECIAL_ONLY", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25 * 1.25 / 1.365, flip: false, enabled: true,
          src: "assets/sprites/cast/merchant/merchant_idle_sheet_96x96.png", metadata: "assets/sprites/cast/merchant/merchant_idle.json" }
      }
    }
  },
  // visual.oneShot.animation -> loaded asset key.
  oneShots: { AERIAL_UP: "heroAerialUp", AERIAL_DOWN: "heroAerialDown", GROUND_BOUNCE: "heroGroundBounce", HIT: "heroHit", SPECIAL_REACTION: "heroSpecialReaction" },
  // Display-only one-shot priority (Phase B). While a one-shot plays, a new event replaces it
  // only with a higher priority, or with the same priority once the current one has been shown
  // for minShow s (one sheet frame; avoids 1-3 frame flashes). A finished / missing one-shot never
  // blocks. A blocked event changes only the drawing: its physics / effect line already happened.
  oneShotPriority: { HIT: 1, GROUND_BOUNCE: 1, AERIAL_UP: 1, AERIAL_DOWN: 1, SPECIAL_REACTION: 2 },
  minShow: 1 / 12,
  oneShotAllowed(visual, name, phaseTime) {
    const shot = visual?.oneShot, active = shot?.animation;
    if (!active || !Object.prototype.hasOwnProperty.call(this.oneShots, active)) return true;
    const asset = this[this.oneShots[active]], age = phaseTime - shot.at;
    if (!asset?.ready || !asset.data || !(age >= 0) || age >= this.duration(asset.data)) return true;
    const p = this.oneShotPriority, next = p[name] || 0, current = p[active] || 0;
    return next > current || (next === current && age >= this.minShow);
  },
  // Start a one-shot if its asset is loaded (a missing one never cuts the current drawing) and the
  // priority table allows it. tiltFrom records the tilt weight at the
  // hand-off so tiltWeight can ease from it instead of popping. Returns true when started.
  startOneShot(visual, name, phaseTime) {
    const asset = this[this.oneShots[name]];
    if (!visual || !asset?.ready || !asset.data || !this.oneShotAllowed(visual, name, phaseTime)) return false;
    visual.oneShot = { animation: name, at: phaseTime, tiltFrom: this.tiltWeight(visual, phaseTime) };
    return true;
  },
  async load(definition) {
    const asset = { ready: false, image: null, data: null };
    if (definition?.enabled === false) return asset;
    try {
      const response = await fetch(definition.metadata);
      if (!response.ok) return asset;
      const data = await response.json();
      // HERO animations stay 8 frames; CAST stills declare id and frames: 1.
      if (data.id !== (definition.id || "HERO") || data.animation !== definition.animation ||
          data.frames !== (definition.frames || 8) || data.fps !== definition.fps || data.loop !== definition.loop) return asset;
      if (!this.normalizeCell(data)) return asset;
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
  // Cell contract (display only). Legacy pixel sheets: 96x96 cells, pivot (48,88), nearest-neighbour.
  // HD sheets declare cellW / cellH (or frameHeight > 96): cellH 96..1024,
  // cellW cellH/2..2*cellH (wide poses may use a wider cell), optional pivot inside the cell (default
  // (cellW/2, cellH*88/96)), drawn with high-quality smoothing (smoothing: false opts out). The
  // definition scale stays in legacy 96-cell units: drawn scale = scale * 96 / cellH, so an HD
  // sheet drawn with the same proportions has the same on-screen size and feet point as its 96
  // version. Normalizes data in place (frameWidth / frameHeight / pivot / unit / smooth); false = reject.
  normalizeCell(data) {
    const int = v => Number.isInteger(v);
    const hd = data.cellW !== undefined || data.cellH !== undefined || data.frameHeight > 96;
    if (!hd) {
      if (data.frameWidth !== 96 || data.frameHeight !== 96 || data.pivot?.x !== 48 || data.pivot?.y !== 88) return false;
      return Object.assign(data, { unit: 1, smooth: data.smoothing === true });
    }
    const w = data.cellW ?? data.frameWidth, h = data.cellH ?? data.frameHeight;
    if (data.frameWidth !== undefined && data.frameWidth !== w || data.frameHeight !== undefined && data.frameHeight !== h) return false;
    if (!int(w) || !int(h) || h < 96 || h > 1024 || w * 2 < h || w > h * 2) return false;
    const pivot = data.pivot === undefined ? { x: w / 2, y: h * 88 / 96 } : data.pivot;
    if (!Number.isFinite(pivot?.x) || !Number.isFinite(pivot?.y) || pivot.x < 0 || pivot.x > w || pivot.y < 0 || pivot.y > h) return false;
    if (data.smoothing !== undefined && typeof data.smoothing !== "boolean") return false;
    return Object.assign(data, { frameWidth: w, frameHeight: h, pivot: { x: pivot.x, y: pivot.y }, unit: h / 96, smooth: data.smoothing !== false });
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
    scale /= d.unit > 0 ? d.unit : 1; // HD cells: same on-screen size as the 96 version
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = !!d.smooth;
      if (d.smooth) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(asset.image, frame * d.frameWidth, 0, d.frameWidth, d.frameHeight,
        x - d.pivot.x * scale, feet - d.pivot.y * scale, d.frameWidth * scale, d.frameHeight * scale);
      return true;
    } catch (_) { return false; }
    finally { ctx.restore(); }
  },
  // CAST still for a roadside character / merchant (pure lookup): { asset, scale, flip } or null.
  // pose 1 = used (post-contact): the character's pose-1 slot (BOUNCE KICK, BOOST / BRAKE / ANGLE USED) when
  // loaded, otherwise IDLE.
  castLayer(id, pose = 0) {
    const slots = this.castAssets?.[id], defs = this.definitions.CAST?.[id];
    if (!slots || !defs) return null;
    const used = pose ? Object.keys(defs).find(n => defs[n].pose === 1 && slots[n]?.ready) : null;
    const name = used || "IDLE", asset = slots[name];
    return asset?.ready ? { name, asset, scale: defs[name].scale, flip: !!defs[name].flip } : null;
  },
  // Draw a CAST still with its feet at (x, feet); false -> caller draws the Canvas figure.
  drawCast(ctx, id, x, feet, pose = 0) {
    const layer = this.castLayer(id, pose);
    if (!layer) return false;
    if (!layer.flip) return this.draw(ctx, layer.asset, 0, x, feet, layer.scale);
    ctx.save();
    try { ctx.translate(x, 0); ctx.scale(-1, 1); return this.draw(ctx, layer.asset, 0, 0, feet, layer.scale); }
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
  // SPECIAL_REACTION) plays, then eases back to 1 over its tiltEase. Hand-offs ease from the weight
  // at the switch (shot.tiltFrom): a non-suppressing one-shot (AERIAL) after a suppressing one eases
  // up instead of snapping, and a one-shot with tiltIn (SPECIAL_REACTION) eases down into its
  // upright pose. GROUND_BOUNCE / HIT keep snapping upright (the bounce / launch already jumps).
  tiltWeight(visual, phaseTime) {
    const shot = visual?.oneShot, name = shot?.animation;
    if (!name || !Object.prototype.hasOwnProperty.call(this.oneShots, name)) return 1;
    const def = this.definitions.HERO[name], asset = this[this.oneShots[name]];
    const from = Number.isFinite(shot.tiltFrom) ? Math.max(0, Math.min(1, shot.tiltFrom)) : 1;
    const time = phaseTime - shot.at;
    if (!def?.suppressTilt || !asset?.ready || !asset.data) return from >= 1 || !(time >= 0) ? from : Math.min(1, from + time / this.tiltEase);
    const end = this.duration(asset.data);
    if (!(time >= 0)) return from;
    if (time < end) return def.tiltIn > 0 ? Math.max(0, from * (1 - time / def.tiltIn)) : 0;
    return def.tiltEase > 0 ? Math.min(1, (time - end) / def.tiltEase) : 1;
  },
  tiltEase: 0.12,
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
  // READY / AIM standing still (pure). Empty when the asset is missing -> Canvas HERO.
  idleLayers() {
    const asset = this.heroIdle, def = this.definitions.HERO.IDLE;
    if (!asset?.ready || !asset.data || def?.enabled === false) return [];
    return [{ name: "IDLE", asset, time: 0, scale: def.scale }];
  },
  // Ordered FLYING candidates (pure): active one-shot (AERIAL / GROUND_BOUNCE), then FLIGHT_LOOP.
  // The caller falls back to the Canvas HERO when every candidate fails to draw. RESULT without a
  // STOP_RESULT (mid-air STOPPER stop, missing asset) keeps FLIGHT_LOOP frozen at visual.frozenAt
  // (the RESULT entry) instead of switching to the Canvas HERO.
  heroLayers(visual, phaseTime, state) {
    const d = this.definitions.HERO, layers = [], still = !!visual?.reducedMotion;
    const shot = state === Hop.STATES?.RESULT ? null : visual?.oneShot, name = shot?.animation;
    if (name && Object.prototype.hasOwnProperty.call(this.oneShots, name)) {
      const asset = this[this.oneShots[name]], time = phaseTime - shot.at;
      if (asset?.ready && asset.data && time >= 0 && time < this.duration(asset.data)) {
        layers.push({ name, asset, time: still ? (d[name].stillTime || 0) : time, scale: d[name].scale });
      }
    }
    const now = Number.isFinite(visual?.frozenAt) ? Math.min(phaseTime, visual.frozenAt) : phaseTime;
    const flightTime = Number.isFinite(visual?.launchAt) ? now - visual.launchAt : now;
    layers.push({ name: "FLIGHT_LOOP", asset: this.heroFlight, time: still ? 0 : flightTime, scale: d.FLIGHT_LOOP.scale });
    return layers;
  }
};
Hop.Sprites.idleReady = Hop.Sprites.load(Hop.Sprites.definitions.HERO.IDLE).then(asset => {
  Hop.Sprites.heroIdle = asset;
  return asset;
});
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
Hop.Sprites.castAssets = {};
Hop.Sprites.castReady = Promise.all(Object.entries(Hop.Sprites.definitions.CAST).flatMap(([id, slots]) =>
  Object.entries(slots).map(([name, definition]) => Hop.Sprites.load(definition).then(asset => {
    (Hop.Sprites.castAssets[id] ||= {})[name] = asset;
    return asset;
  }))));
