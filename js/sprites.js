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
        src: "assets/sprites/hero/hero_flight_comic_v1/hero_flight_loop_sheet_384x288.png",
        metadata: "assets/sprites/hero/hero_flight_comic_v1/hero_flight_loop.json",
        animation: "FLIGHT_LOOP", fps: 8, loop: true, scale: 1.25
      },
      // One-shot poses shown after a successful AERIAL, then FLIGHT_LOOP resumes.
      // HD comic stills (8 identical cells, 288 high; DOWN uses a 384-wide cell for the dive).
      // The 96 v1 bundles are kept in hero_aerial_{up,down}_v1_bundle/.
      AERIAL_UP: {
        src: "assets/sprites/hero/hero_aerial_up_comic_v1/hero_aerial_up_sheet_384x288.png",
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
        src: "assets/sprites/hero/hero_ground_bounce_comic_v1/hero_ground_bounce_sheet_384x288.png",
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
        IDLE: { id: "BOOST", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", enabled: true,
          src: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_idle_sheet_288x288.png", metadata: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_idle.json" },
        // HD comic idle (288 cell) and used pose (384x288 cell for the wide stance); the 96 r1 stills are
        // kept in boost_witch/.
        USED: { id: "BOOST", animation: "USED", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", pose: 1, enabled: true, hotspot: { x: 87, y: 38 },
          src: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_used_sheet_384x288.png", metadata: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_used.json" },
        // Combo-scene only (comboPose; never the roadside still): chanting with the staff raised.
        CAST: { id: "BOOST", animation: "CAST", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", comboPose: true, enabled: true, hotspot: { x: 100, y: 30 },
          src: "assets/sprites/cast/boost_witch_combo_v1/boost_witch_cast_sheet_288x288.png", metadata: "assets/sprites/cast/boost_witch_combo_v1/boost_witch_cast.json" },
        CUTIN_FACE: { id: "BOOST", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/boost_witch_cutin_face_v2/boost_witch_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/boost_witch_cutin_face_v2/boost_witch_cutin_face.json" }
      },
      BOUNCE: { // 武闘家 (HD comic idle r1b + kick r1a; the kick points to the viewer's right like the Canvas pose, so not mirrored)
        IDLE: { id: "BOUNCE", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", enabled: true,
          src: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_idle_sheet_288x288.png", metadata: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_idle.json" },
        // HD comic idle (288 cell) and kick (384x288 cell for the high kick, standing foot on the pivot x);
        // the 96 r1 stills are kept in bounce_fighter/.
        KICK: { id: "BOUNCE", animation: "KICK", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "right", pose: 1, enabled: true,
          src: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_kick_sheet_384x288.png", metadata: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_kick.json" },
        // Combo-scene only (comboPose): rush punch and uppercut.
        PUNCH: { id: "BOUNCE", animation: "PUNCH", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "right", comboPose: true, enabled: true,
          src: "assets/sprites/cast/bounce_fighter_combo_v1/bounce_fighter_punch_sheet_384x288.png", metadata: "assets/sprites/cast/bounce_fighter_combo_v1/bounce_fighter_punch.json" },
        UPPER: { id: "BOUNCE", animation: "UPPER", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "right", comboPose: true, enabled: true, hotspot: { x: 192, y: 41 },
          src: "assets/sprites/cast/bounce_fighter_combo_v1/bounce_fighter_upper_sheet_288x288.png", metadata: "assets/sprites/cast/bounce_fighter_combo_v1/bounce_fighter_upper.json" },
        CUTIN_FACE: { id: "BOUNCE", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/bounce_fighter_cutin_face_v2/bounce_fighter_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/bounce_fighter_cutin_face_v2/bounce_fighter_cutin_face.json" }
      },
      BRAKE: { // 盗賊 (HD comic idle r1b + used r1a; idle hook on the viewer's right like the Canvas thief, used pose throws it toward the hero; not mirrored)
        IDLE: { id: "BRAKE", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_idle_sheet_288x288.png", metadata: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_idle.json" },
        // HD comic idle (288 cell) and used pose (384x288 cell for the thrown hook and chain); the 96 r2 idle
        // and r1 used stills are kept in brake_thief/.
        USED: { id: "BRAKE", animation: "USED", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, pose: 1, enabled: true,
          src: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_used_sheet_384x288.png", metadata: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_used.json" },
        // Grand-scene only (comboPose + grandPose; never roadside, loaded after the title sprites): 影すり抜け: shadow dash (dagger forward) -> slash through; both face the viewer's left like the idle, not mirrored.
        SHADOW: { id: "BRAKE", animation: "SHADOW", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 26, y: 155 },
          src: "assets/sprites/cast/brake_thief_special_v1/brake_thief_shadow_sheet_288x288.png", metadata: "assets/sprites/cast/brake_thief_special_v1/brake_thief_shadow.json" },
        SLASH: { id: "BRAKE", animation: "SLASH", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 9, y: 135 },
          src: "assets/sprites/cast/brake_thief_special_v1/brake_thief_slash_sheet_288x288.png", metadata: "assets/sprites/cast/brake_thief_special_v1/brake_thief_slash.json" },
        CUTIN_FACE: { id: "BRAKE", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/brake_thief_cutin_face_v2/brake_thief_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/brake_thief_cutin_face_v2/brake_thief_cutin_face.json" }
      },
      ANGLE: { // 遊び人 (HD comic idle r1a + used r1a; idle cane on the viewer's right like the Canvas jester's ball, used pose swings it up toward the hero; not mirrored)
        IDLE: { id: "ANGLE", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/angle_jester_comic_v1/angle_jester_idle_sheet_288x288.png", metadata: "assets/sprites/cast/angle_jester_comic_v1/angle_jester_idle.json" },
        // HD comic idle (288 cell) and used pose (384x288 cell for the raised cane and open hand, standing foot on
        // the pivot x); the 96 r1 stills are kept in angle_jester/.
        USED: { id: "ANGLE", animation: "USED", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, pose: 1, enabled: true,
          src: "assets/sprites/cast/angle_jester_comic_v1/angle_jester_used_sheet_384x288.png", metadata: "assets/sprites/cast/angle_jester_comic_v1/angle_jester_used.json" },
        // Grand-scene only (comboPose + grandPose; never roadside, loaded after the title sprites): 水平曲芸: one-hand handstand (pivot = palm) -> ta-da (front-facing, mirrored so the cane is on the viewer's right like the idle).
        HANDSTAND: { id: "ANGLE", animation: "HANDSTAND", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 238, y: 145 },
          src: "assets/sprites/cast/angle_jester_special_v1/angle_jester_handstand_sheet_288x288.png", metadata: "assets/sprites/cast/angle_jester_special_v1/angle_jester_handstand.json" },
        TADA: { id: "ANGLE", animation: "TADA", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, facing: "right", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 55, y: 10 },
          src: "assets/sprites/cast/angle_jester_special_v1/angle_jester_tada_sheet_288x288.png", metadata: "assets/sprites/cast/angle_jester_special_v1/angle_jester_tada.json" },
        CUTIN_FACE: { id: "ANGLE", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/angle_jester_cutin_face_v2/angle_jester_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/angle_jester_cutin_face_v2/angle_jester_cutin_face.json" }
      },
      DASH: { // 戦士 (HD comic idle r1b, drawn like the design sheet with the sword on the viewer's left; mirrored: sword on the viewer's right, shield on the left like the Canvas warrior; the 96 r1 still is kept in dash_warrior/)
        IDLE: { id: "DASH", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, enabled: true,
          src: "assets/sprites/cast/dash_warrior_comic_v1/dash_warrior_idle_sheet_288x288.png", metadata: "assets/sprites/cast/dash_warrior_comic_v1/dash_warrior_idle.json" },
        // Grand-scene only (comboPose + grandPose; never roadside, loaded after the title sprites): 戦陣突破: wind-up (sword already in the viewer-right hand, not mirrored) -> thrust -> finishing pose (both mirrored so the sword hand matches); FINISH is a 384x384 cell, feet pivot (192,380), unit 4 = same head.
        WINDUP: { id: "DASH", animation: "WINDUP", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 338, y: 228 },
          src: "assets/sprites/cast/dash_warrior_special_v1/dash_warrior_windup_sheet_384x288.png", metadata: "assets/sprites/cast/dash_warrior_special_v1/dash_warrior_windup.json" },
        THRUST: { id: "DASH", animation: "THRUST", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 14, y: 139 },
          src: "assets/sprites/cast/dash_warrior_special_v1/dash_warrior_thrust_sheet_384x288.png", metadata: "assets/sprites/cast/dash_warrior_special_v1/dash_warrior_thrust.json" },
        FINISH: { id: "DASH", animation: "FINISH", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 129, y: 6 },
          src: "assets/sprites/cast/dash_warrior_special_v1/dash_warrior_finish_sheet_384x384.png", metadata: "assets/sprites/cast/dash_warrior_special_v1/dash_warrior_finish.json" },
        CUTIN_FACE: { id: "DASH", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/dash_warrior_cutin_face_v2/dash_warrior_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/dash_warrior_cutin_face_v2/dash_warrior_cutin_face.json" }
      },
      GUARD: { // 賢者 (HD comic idle r1b, no hat by design, drawn like sage_r1b with the staff on the viewer's left; mirrored: staff on the viewer's right, book on the left like the Canvas sage; the 96 r1 still is kept in guard_sage/)
        IDLE: { id: "GUARD", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, enabled: true,
          src: "assets/sprites/cast/guard_sage_comic_v1/guard_sage_idle_sheet_288x288.png", metadata: "assets/sprites/cast/guard_sage_comic_v1/guard_sage_idle.json" },
        // Grand-scene only (comboPose + grandPose; never roadside, loaded after the title sprites): 聖護結界: chant -> barrier, mirrored like the idle (staff on the viewer's right).
        CHANT: { id: "GUARD", animation: "CHANT", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 77, y: 64 },
          src: "assets/sprites/cast/guard_sage_special_v1/guard_sage_chant_sheet_288x288.png", metadata: "assets/sprites/cast/guard_sage_special_v1/guard_sage_chant.json" },
        BARRIER: { id: "GUARD", animation: "BARRIER", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 76, y: 62 },
          src: "assets/sprites/cast/guard_sage_special_v1/guard_sage_barrier_sheet_288x288.png", metadata: "assets/sprites/cast/guard_sage_special_v1/guard_sage_barrier.json" },
        CUTIN_FACE: { id: "GUARD", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/guard_sage_cutin_face_v2/guard_sage_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/guard_sage_cutin_face_v2/guard_sage_cutin_face.json" }
      },
      STOPPER: { // 僧侶 (HD comic idle r1a, same facing as the r3 still: staff on the viewer's right like the Canvas cleric, so not mirrored; the 96 r3 still is kept in stopper_cleric/)
        IDLE: { id: "STOPPER", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, enabled: true,
          src: "assets/sprites/cast/stopper_cleric_comic_v1/stopper_cleric_idle_sheet_288x288.png", metadata: "assets/sprites/cast/stopper_cleric_comic_v1/stopper_cleric_idle.json" },
        // Grand-scene only (comboPose + grandPose; never roadside, loaded after the title sprites): 聖光反転: kneeling prayer (staff on the viewer's right like the idle) -> release (stored with the staff on the left, mirrored so the staff side matches).
        PRAY: { id: "STOPPER", animation: "PRAY", frames: 1, fps: 1, loop: false, scale: 1.25, flip: false, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 182, y: 66 },
          src: "assets/sprites/cast/stopper_cleric_special_v1/stopper_cleric_pray_sheet_288x288.png", metadata: "assets/sprites/cast/stopper_cleric_special_v1/stopper_cleric_pray.json" },
        RELEASE: { id: "STOPPER", animation: "RELEASE", frames: 1, fps: 1, loop: false, scale: 1.25, flip: true, facing: "left", comboPose: true, grandPose: true, enabled: true, hotspot: { x: 115, y: 12 },
          src: "assets/sprites/cast/stopper_cleric_special_v1/stopper_cleric_release_sheet_288x288.png", metadata: "assets/sprites/cast/stopper_cleric_special_v1/stopper_cleric_release.json" },
        CUTIN_FACE: { id: "STOPPER", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/stopper_cleric_cutin_face_v2/stopper_cleric_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/stopper_cleric_cutin_face_v2/stopper_cleric_cutin_face.json" }
      },
      SPECIAL_ONLY: { // 商人 (HD comic idle r1b, same facing as the r1 still: pouch in the viewer-left hand, bag on the viewer's right under the item orb like the Canvas box, facing the hero, so not flipped; MERCHANT SPECIAL overlay at the Canvas ratio 1.25/1.365; the 96 r1 still is kept in merchant/)
        IDLE: { id: "SPECIAL_ONLY", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25 * 1.25 / 1.365, flip: false, enabled: true,
          src: "assets/sprites/cast/merchant_comic_v1/merchant_idle_sheet_288x288.png", metadata: "assets/sprites/cast/merchant_comic_v1/merchant_idle.json" },
        CUTIN_FACE: { id: "SPECIAL_ONLY", animation: "CUTIN_FACE", frames: 1, fps: 1, loop: false, scale: 1, flip: false, enabled: true,
          src: "assets/sprites/cast/merchant_cutin_face_v2/merchant_cutin_face_sheet_640x320.png", metadata: "assets/sprites/cast/merchant_cutin_face_v2/merchant_cutin_face.json" }
      }
    },
    // Launch truck (display only; there is no truck in game.js / physics.js, so no hit box changes). One HD comic still
    // (r1b, side view facing right) for every state: READY / AIM_ANGLE / AIM_POWER / 0.5 s after launch; Graphics.draw
    // keeps choosing the x as before. 576x288 cell, pivot (352,264) = the Canvas truck origin (translate x, ground);
    // drawn scale 1.25*96/288 -> 167 x 102 px on screen, the same length and roof height as the Canvas truck.
    // Missing / broken asset -> drawTruck returns false and Graphics.truck draws the Canvas truck.
    WITCH_CAPE_BACK: { id: "BOOST", animation: "CAPE_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_cape_back_v1.png", metadata: "assets/sprites/cast/boost_witch_comic_v1/boost_witch_cape_back_v1.json" },
    FIGHTER_SCARF_BACK: { id: "BOUNCE", animation: "SCARF_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_scarf_back_v1.png", metadata: "assets/sprites/cast/bounce_fighter_comic_v1/bounce_fighter_scarf_back_v1.json" },
    THIEF_HAIR_BACK: { id: "BRAKE", animation: "HAIR_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_hair_back_v1.png", metadata: "assets/sprites/cast/brake_thief_comic_v1/brake_thief_hair_back_v1.json" },
    WARRIOR_CAPE_BACK: { id: "DASH", animation: "CAPE_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/dash_warrior_comic_v1/dash_warrior_cape_back_v1.png", metadata: "assets/sprites/cast/dash_warrior_comic_v1/dash_warrior_cape_back_v1.json" },
    SAGE_CAPE_BACK: { id: "GUARD", animation: "CAPE_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/guard_sage_comic_v1/guard_sage_cape_back_v1.png", metadata: "assets/sprites/cast/guard_sage_comic_v1/guard_sage_cape_back_v1.json" },
    CLERIC_HAIR_BACK: { id: "STOPPER", animation: "HAIR_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/stopper_cleric_comic_v1/stopper_cleric_hair_back_v1.png", metadata: "assets/sprites/cast/stopper_cleric_comic_v1/stopper_cleric_hair_back_v1.json" },
    MERCHANT_HAIR_BACK: { id: "SPECIAL_ONLY", animation: "HAIR_BACK", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/merchant_comic_v1/merchant_hair_back_v1.png", metadata: "assets/sprites/cast/merchant_comic_v1/merchant_hair_back_v1.json" },
    JESTER_IDLE_LOOP: { id: "ANGLE", animation: "IDLE_LOOP", frames: 8, fps: 5, loop: true, enabled: true,
      src: "assets/sprites/cast/angle_jester_comic_v1/angle_jester_idle_loop_v1.png", metadata: "assets/sprites/cast/angle_jester_comic_v1/angle_jester_idle_loop_v1.json" },
    TRUCK: {
      IDLE: { id: "TRUCK", animation: "IDLE", frames: 1, fps: 1, loop: false, scale: 1.25, enabled: true,
        src: "assets/sprites/truck/truck_comic_v1/truck_idle_sheet_576x288.png", metadata: "assets/sprites/truck/truck_comic_v1/truck_idle.json" }
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
      // Each slot declares its own frame count and playback contract.
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
  // Optional display-only flight cape cache. Only the free left tip is changed; the supplied
  // sprite, its pivot and every pixel outside the clipped rectangle stay untouched.
  buildFlightCapeCache(asset) {
    try {
      const image = asset?.image, d = asset?.data;
      if (!asset?.ready || !image?.complete || image.naturalWidth !== 384 * 8 || image.naturalHeight !== 288 ||
          d?.frameWidth !== 384 || d?.frameHeight !== 288 || d.frames !== 8 || d.fps !== 8 || d.loop !== true ||
          d.pivot?.x !== 192 || d.pivot?.y !== 264 || typeof document === "undefined") return null;
      const canvas = document.createElement?.("canvas"), ctx = canvas?.getContext?.("2d");
      if (!ctx) return null;
      canvas.width = 384 * 8; canvas.height = 288;
      ctx.imageSmoothingEnabled = false;
      for (let f = 0; f < 8; f++) {
        const sx = f * 384, angle = f * Math.PI / 4;
        ctx.drawImage(image, sx, 0, 384, 288, sx, 0, 384, 288);
        ctx.save();
        try {
          ctx.beginPath(); ctx.rect(sx, 145, 128, 82); ctx.clip();
          ctx.clearRect(sx, 145, 128, 82);
          for (let x = 0; x < 128; x++) {
            const weight = Math.max(0, Math.min(1, (128 - x) / 48));
            const shift = Math.round(3 * weight * Math.sin(angle));
            ctx.drawImage(image, sx + x, 145, 1, 82, sx + x, 145 + shift, 1, 82);
          }
        } finally { ctx.restore(); }
      }
      return { ready: true, image: canvas, data: d, canvasSource: true, sourceAsset: asset };
    } catch (_) { return null; }
  },
  scheduleFlightCapeCache(asset) {
    try {
      if (!asset?.ready || typeof document === "undefined" || !document.createElement) return;
      const build = () => {
        try { if (this.heroFlight === asset) this.flightCapeCache = this.buildFlightCapeCache(asset); } catch (_) { /* Original sprite remains available. */ }
      };
      if (typeof requestIdleCallback === "function") requestIdleCallback(build, { timeout: 1000 });
      else if (typeof setTimeout === "function") setTimeout(build, 0);
    } catch (_) { /* Cache is optional. */ }
  },
  // Optional witch CAST wind animation, generated once from the existing sprite. Work is split
  // into one frame per idle callback so image preparation never blocks the first interactive view.
  createWitchWindCache(asset) {
    try {
      const img = asset?.image, d = asset?.data;
      if (!asset?.ready || !img?.complete || img.naturalWidth !== 288 || img.naturalHeight !== 288 ||
          d?.frameWidth !== 288 || d.frameHeight !== 288 || d.frames !== 1 ||
          d.pivot?.x !== 144 || d.pivot?.y !== 278 || typeof document === "undefined") return null;
      // Four short strips avoid a 4608px-wide texture (too large for some mobile GPUs).
      const fps = 16 / 1.3, sheets = [];
      // Generated phases have their own timeline, independent of any source hold sequence.
      const motionData = frames => { const out = { ...d, frames, fps, loop: true }; delete out.sequence; return out; };
      for (let i = 0; i < 4; i++) {
        const canvas = document.createElement?.("canvas"), context = canvas?.getContext?.("2d");
        if (!context) return null;
        canvas.width = 288 * 4; canvas.height = 288;
        sheets.push({ ready: true, image: canvas, data: motionData(4), canvasSource: true, context });
      }
      return { ready: false, data: motionData(16), sheets, sourceAsset: asset, sourceImage: img, sourceData: d, sourcePivot: d.pivot,
        sourceSpec: { src: img.src, currentSrc: img.currentSrc, unit: d.unit, smooth: d.smooth, fps: d.fps, loop: d.loop,
          sequenceRef: d.sequence, sequence: Array.isArray(d.sequence) ? d.sequence.slice() : null }, nextFrame: 0 };
    } catch (_) { return null; }
  },
  witchWindSourceValid(cache) {
    try {
      const a = cache?.sourceAsset, img = cache?.sourceImage, d = cache?.sourceData, s = cache?.sourceSpec;
      return !!a?.ready && !!img?.complete && img.naturalWidth === 288 && img.naturalHeight === 288 &&
        a.image === img && a.data === d && !!d && !!s && d.pivot === cache.sourcePivot &&
        d.frameWidth === 288 && d.frameHeight === 288 && d.frames === 1 && d.pivot?.x === 144 && d.pivot?.y === 278 &&
        img.src === s.src && img.currentSrc === s.currentSrc && d.unit === s.unit && d.smooth === s.smooth && d.fps === s.fps && d.loop === s.loop &&
        d.sequence === s.sequenceRef && (!s.sequence || Array.isArray(d.sequence) && d.sequence.length === s.sequence.length && d.sequence.every((v, i) => v === s.sequence[i]));
    } catch (_) { return false; }
  },
  renderWitchWindFrame(cache) {
    const img = cache.sourceImage, f = cache.nextFrame, ctx = cache.sheets[Math.floor(f / 4)].context, ox = (f % 4) * 288;
    const phase = 2 * Math.PI * f / 16, amount = 12;
    // Blend only the five boundary phases toward the untouched source; the remaining phases retain their original path.
    const phaseWeight = [0, .44, .78, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, .78, .44][f];
    const edge = (x0, x1, y0, y1, seam, sign, p) => {
      ctx.save();
      try {
        ctx.beginPath(); ctx.rect(ox + x0, y0, x1 - x0, y1 - y0); ctx.clip();
        ctx.clearRect(ox + x0, y0, x1 - x0, y1 - y0); ctx.imageSmoothingEnabled = true;
        for (let x = x0; x < x1; x++) {
          const u = Math.max(0, Math.min(1, sign * (x - seam) / 35)), weight = u * u * (3 - 2 * u);
          const dx = sign * amount * weight * Math.sin(p) * phaseWeight, dy = amount * 0.4 * weight * Math.sin(p + 0.7) * phaseWeight;
          ctx.drawImage(img, Math.max(0, Math.min(286, x - dx)), y0, 1, y1 - y0, ox + x, y0 + dy, 1, y1 - y0);
        }
      } finally { ctx.restore(); }
    };
    ctx.drawImage(img, 0, 0, 288, 288, ox, 0, 288, 288);
    if (f !== 0) {
      edge(32, 100, 140, 240, 99, -1, phase);
      edge(215, 272, 156, 238, 221, 1, phase + 0.7);
    }
    cache.nextFrame++;
  },
  scheduleWitchWindCache(asset) {
    try {
      if (!asset?.ready || this.witchWindPending === asset || (this.witchWindCache?.sourceAsset === asset && this.witchWindSourceValid(this.witchWindCache))) return;
      const pending = this.createWitchWindCache(asset); if (!pending) return;
      const queue = typeof requestIdleCallback === "function" ? cb => requestIdleCallback(cb, { timeout: 1000 })
        : typeof setTimeout === "function" ? cb => setTimeout(cb, 0) : null;
      if (!queue) return;
      this.witchWindPending = asset;
      const step = () => {
        try {
          if (this.witchWindPending !== asset) return;
          if (this.castAssets?.BOOST?.CAST !== asset || !this.witchWindSourceValid(pending)) { this.witchWindPending = null; return; }
          this.renderWitchWindFrame(pending);
          if (this.castAssets?.BOOST?.CAST !== asset || !this.witchWindSourceValid(pending)) { this.witchWindPending = null; return; }
          if (pending.nextFrame < 16) queue(step);
          else { pending.ready = true; for (const sheet of pending.sheets) delete sheet.context; delete pending.nextFrame; this.witchWindCache = pending; this.witchWindPending = null; }
        } catch (_) { this.witchWindPending = null; /* Static source remains available. */ }
      };
      queue(step);
    } catch (_) { this.witchWindPending = null; }
  },
  // Optional UPPER wind animation: 16 logical phases share nine full frames. The two
  // temporary 288px canvases are used only while its idle-time cache is being prepared.
  createFighterWindCache(asset) {
    try {
      const img = asset?.image, d = asset?.data;
      if (!asset?.ready || !img?.complete || img.naturalWidth !== 288 || img.naturalHeight !== 288 ||
          d?.frameWidth !== 288 || d.frameHeight !== 288 || d.frames !== 1 ||
          d.pivot?.x !== 144 || d.pivot?.y !== 264 || typeof document === "undefined") return null;
      const fps = 16 / 0.7, sheets = [];
      // The source may legally provide a one-frame hold sequence. It must not override
      // the generated cache's independent 16-phase timeline or its four-cell strips.
      const motionData = frames => { const out = { ...d, frames, fps, loop: true }; delete out.sequence; return out; };
      for (const cells of [4, 4, 1]) {
        const canvas = document.createElement?.("canvas"), context = canvas?.getContext?.("2d");
        if (!context) return null;
        canvas.width = cells * 288; canvas.height = 288;
        sheets.push({ ready: true, image: canvas, data: motionData(cells), canvasSource: true, context });
      }
      const work = document.createElement?.("canvas"), mask = document.createElement?.("canvas");
      const workCtx = work?.getContext?.("2d"), maskCtx = mask?.getContext?.("2d");
      if (!workCtx || !maskCtx) return null;
      work.width = mask.width = 288; work.height = mask.height = 288;
      // Some canvases accept an unsupported composite assignment without throwing.
      for (const [ctx, mode] of [[workCtx, "destination-out"], [workCtx, "lighter"], [maskCtx, "destination-in"]]) {
        ctx.globalCompositeOperation = mode; if (ctx.globalCompositeOperation !== mode) return null;
      }
      workCtx.globalCompositeOperation = maskCtx.globalCompositeOperation = "source-over";
      return { ready: false, data: motionData(16), sheets, sourceAsset: asset,
        sourceImage: img, sourceData: d, sourcePivot: d.pivot,
        sourceSpec: { src: img.src, currentSrc: img.currentSrc, unit: d.unit, smooth: d.smooth, fps: d.fps, loop: d.loop,
          sequenceRef: d.sequence, sequence: Array.isArray(d.sequence) ? d.sequence.slice() : null },
        work, mask, workCtx, maskCtx, nextFrame: 0 };
    } catch (_) { return null; }
  },
  // A cache belongs to the exact, still-loaded image and metadata used for all its phases.
  fighterWindSourceValid(cache) {
    try {
      const a = cache?.sourceAsset, img = cache?.sourceImage, d = cache?.sourceData, s = cache?.sourceSpec;
      return !!a?.ready && !!img?.complete && img.naturalWidth === 288 && img.naturalHeight === 288 &&
        a.image === img && a.data === d && !!d && !!s && d.pivot === cache.sourcePivot &&
        d.frameWidth === 288 && d.frameHeight === 288 && d.frames === 1 && d.pivot?.x === 144 && d.pivot?.y === 264 &&
        img.src === s.src && img.currentSrc === s.currentSrc && d.unit === s.unit && d.smooth === s.smooth && d.fps === s.fps && d.loop === s.loop &&
        d.sequence === s.sequenceRef && (!s.sequence || Array.isArray(d.sequence) && d.sequence.length === s.sequence.length && d.sequence.every((v, i) => v === s.sequence[i]));
    } catch (_) { return false; }
  },
  renderFighterWindFrame(cache) {
    const img = cache.sourceImage, f = cache.nextFrame, sheet = cache.sheets[Math.floor(f / 4)], ox = (f % 4) * 288;
    // Symmetry is exact because hair and scarf use the same sin(phase) value.
    const phaseIndex = f <= 4 ? f : f + 4, phase = 2 * Math.PI * phaseIndex / 16;
    const work = cache.workCtx, mask = cache.maskCtx;
    work.clearRect(0, 0, 288, 288); work.drawImage(img, 0, 0);
    // Phase 0 is the untouched reference, including every translucent pixel.
    if (f !== 0) for (const r of [{ x0: 40, x1: 123, y0: 44, y1: 103, seam: 122, width: 32 },
      { x0: 55, x1: 120, y0: 103, y1: 132, seam: 119, width: 26 }]) {
      const h = r.y1 - r.y0, fade = Math.min(10, h / 3), grad = work.createLinearGradient(0, r.y0, 0, r.y1);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1 / h, "rgba(0,0,0,0)");
      grad.addColorStop((fade + 1) / h, "rgba(0,0,0,1)"); grad.addColorStop(1 - (fade + 1) / h, "rgba(0,0,0,1)");
      grad.addColorStop(1 - 1 / h, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      mask.clearRect(0, 0, 288, 288); mask.save();
      try {
        mask.beginPath(); mask.rect(r.x0, r.y0, r.x1 - r.x0, h); mask.clip(); mask.imageSmoothingEnabled = true;
        for (let x = r.x0; x < r.x1; x++) {
          const u = Math.max(0, Math.min(1, (r.seam - x) / r.width)), w = u * u * (3 - 2 * u);
          const dx = -12 * w * Math.sin(phase), dy = 12 * 0.35 * w * Math.sin(phase);
          mask.drawImage(img, Math.max(0, Math.min(286, x - dx)), r.y0, 1, h, x, r.y0 + dy, 1, h);
        }
        mask.globalCompositeOperation = "destination-in"; mask.fillStyle = grad; mask.fillRect(r.x0, r.y0, r.x1 - r.x0, h);
      } finally { mask.restore(); }
      work.save();
      try {
        work.beginPath(); work.rect(r.x0, r.y0, r.x1 - r.x0, h); work.clip();
        work.globalCompositeOperation = "destination-out"; work.fillStyle = grad; work.fillRect(r.x0, r.y0, r.x1 - r.x0, h);
        work.globalCompositeOperation = "lighter"; work.drawImage(cache.mask, 0, 0);
      } finally { work.restore(); }
    }
    sheet.context.drawImage(cache.work, 0, 0, 288, 288, ox, 0, 288, 288); cache.nextFrame++;
  },
  scheduleFighterWindCache(asset) {
    try {
      if (!asset?.ready || this.fighterWindPending === asset ||
          (this.fighterWindCache?.sourceAsset === asset && this.fighterWindSourceValid(this.fighterWindCache))) return;
      const pending = this.createFighterWindCache(asset); if (!pending) return;
      const queue = typeof requestIdleCallback === "function" ? cb => requestIdleCallback(cb, { timeout: 1000 })
        : typeof setTimeout === "function" ? cb => setTimeout(cb, 0) : null;
      if (!queue) return;
      this.fighterWindPending = asset;
      const step = () => {
        try {
          if (this.fighterWindPending !== asset) return;
          if (this.castAssets?.BOUNCE?.UPPER !== asset || !this.fighterWindSourceValid(pending)) { this.fighterWindPending = null; return; }
          this.renderFighterWindFrame(pending);
          if (this.castAssets?.BOUNCE?.UPPER !== asset || !this.fighterWindSourceValid(pending)) { this.fighterWindPending = null; return; }
          if (pending.nextFrame < 9) queue(step);
          else {
            pending.ready = true;
            for (const sheet of pending.sheets) delete sheet.context;
            try { pending.work.width = pending.work.height = pending.mask.width = pending.mask.height = 1; } catch (_) { /* Optional cleanup. */ }
            delete pending.work; delete pending.mask; delete pending.workCtx; delete pending.maskCtx; delete pending.nextFrame;
            this.fighterWindCache = pending; this.fighterWindPending = null;
          }
        } catch (_) { this.fighterWindPending = null; /* Static source remains available. */ }
      };
      queue(step);
    } catch (_) { this.fighterWindPending = null; }
  },
  drawFlightCape(ctx, asset, time, x, feet, scale) {
    try {
      const cache = this.flightCapeCache;
      if (asset?.ready && cache?.sourceAsset === asset && this.draw(ctx, cache, time, x, feet, scale)) return true;
    } catch (_) { /* Drawing the original is always the fallback. */ }
    return this.draw(ctx, asset, time, x, feet, scale);
  },
  // view (optional) = { x0, y0, x1, y1 } in the current coords: the cell is cropped to it (source and destination
  // rect cut alike, same pixels inside), so a caller can skip a clip (cycle 54 launch cut-in bands). Empty -> true.
  // asset.opaque (optional, opaqueBoxes) crops each cell to its pixels the same way (cycle 55): a transparent texel
  // costs as much to sample as an opaque one (the launch cut-in hero stills are ~2/3 empty cell).
  draw(ctx, asset, time, x, feet, scale, view = null) {
    const imageReady = asset?.canvasSource === true
      ? !!asset.image && typeof asset.image.getContext === "function" && asset.image.width > 0 && asset.image.height > 0
      : !!asset?.image?.complete && !!asset.image.naturalWidth;
    if (!asset?.ready || !imageReady || !asset.data?.pivot) return false;
    const d = asset.data;
    const frame = this.frameAt(d, time);
    scale /= d.unit > 0 ? d.unit : 1; // HD cells: same on-screen size as the 96 version
    // Sakuga silhouette frames (impact flash, pose smear) set ctx.filter to brightness(0) [+ invert(1)]. A filtered
    // drawImage makes the canvas rasterize a filter layer per draw (~100 ms frames on a throttled phone CPU), so the
    // same black / white silhouette of this cell is drawn from a small cached copy instead, filter off (cycle 51,
    // display only; same pixels within rounding). No canvas available (tests) -> the filtered draw as before.
    const tint = this.silhouetteTint(ctx), sil = tint && this.silhouette(asset, frame, tint);
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = !!d.smooth;
      if (d.smooth) ctx.imageSmoothingQuality = "high";
      if (sil) ctx.filter = "none";
      let sx = sil ? 0 : frame * d.frameWidth, sy = 0, sw = d.frameWidth, sh = d.frameHeight;
      let dx = x - d.pivot.x * scale, dy = feet - d.pivot.y * scale, dw = d.frameWidth * scale, dh = d.frameHeight * scale;
      // opaque box (cycle 55): only the part of the cell that has pixels (+ a transparent margin) is sampled
      const ob = asset.opaque?.[frame];
      if (view || ob) {
        let x0 = dx, y0 = dy, x1 = dx + dw, y1 = dy + dh;
        if (ob) { x0 = dx + ob.x0 * scale; y0 = dy + ob.y0 * scale; x1 = dx + ob.x1 * scale; y1 = dy + ob.y1 * scale; }
        if (view) { x0 = Math.max(x0, view.x0); y0 = Math.max(y0, view.y0); x1 = Math.min(x1, view.x1); y1 = Math.min(y1, view.y1); }
        if (!(x1 > x0 && y1 > y0)) return true;
        const kx = sw / dw, ky = sh / dh;
        sx += (x0 - dx) * kx; sy += (y0 - dy) * ky; sw = (x1 - x0) * kx; sh = (y1 - y0) * ky;
        dx = x0; dy = y0; dw = x1 - x0; dh = y1 - y0;
      }
      ctx.drawImage(sil || asset.image, sx, sy, sw, sh, dx, dy, dw, dh);
      return true;
    } catch (_) { return false; }
    finally { ctx.restore(); }
  },
  // Per-cell opaque box of a loaded sheet (2026-11-05 auto cycle 55, display only): { x0, y0, x1, y1 } in cell px,
  // the alpha bounding box grown by OPAQUE_MARGIN fully transparent px (bilinear / mipmap taps beyond it read only
  // alpha 0, so the cropped draw puts the same pixels on screen), clamped to the cell; null for a cell that would
  // barely shrink (> OPAQUE_MIN_GAIN of its area). Read once at load (one getImageData of the sheet); returns null
  // (no crop) without a canvas or when the image cannot be read (e.g. a file:// taint).
  OPAQUE_MARGIN: 4, OPAQUE_MIN_GAIN: 0.9,
  opaqueBoxes(asset) {
    try {
      const d = asset?.data, img = asset?.image, doc = typeof document !== "undefined" ? document : null;
      if (!asset?.ready || !d || !img?.naturalWidth) return null;
      const cv = doc?.createElement?.("canvas"), c2 = cv?.getContext?.("2d", { willReadFrequently: true });
      if (!c2 || typeof c2.getImageData !== "function") return null;
      const W = d.frameWidth * d.frames, H = d.frameHeight; cv.width = W; cv.height = H;
      c2.drawImage(img, 0, 0);
      const px = c2.getImageData(0, 0, W, H)?.data; if (!px || px.length !== W * H * 4) return null;
      const out = [];
      for (let f = 0; f < d.frames; f++) {
        let x0 = d.frameWidth, y0 = H, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0, i = (y * W + f * d.frameWidth) * 4 + 3; x < d.frameWidth; x++, i += 4) {
          if (px[i]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        const m = this.OPAQUE_MARGIN;
        const box = x1 < 0 ? { x0: 0, y0: 0, x1: 0, y1: 0 }
          : { x0: Math.max(0, x0 - m), y0: Math.max(0, y0 - m), x1: Math.min(d.frameWidth, x1 + 1 + m), y1: Math.min(H, y1 + 1 + m) };
        out.push((box.x1 - box.x0) * (box.y1 - box.y0) > this.OPAQUE_MIN_GAIN * d.frameWidth * H ? null : box);
      }
      cv.width = cv.height = 1;
      return out;
    } catch (_) { return null; }
  },
  SILHOUETTE_FILTERS: Object.freeze({ "brightness(0)": "#000000", "brightness(0) invert(1)": "#ffffff" }),
  silhouetteTint(ctx) { const f = ctx?.filter; return typeof f === "string" && f !== "none" ? this.SILHOUETTE_FILTERS[f] || null : null; },
  // One cell of a sheet as a solid-colour silhouette (alpha kept), cached per asset / frame / colour; null without canvas.
  silhouette(asset, frame, tint) {
    const key = frame + tint, cache = asset.silhouettes ||= new Map();
    if (cache.has(key)) return cache.get(key);
    let out = null;
    try {
      const d = asset.data, doc = typeof document !== "undefined" ? document : null;
      const cv = doc?.createElement?.("canvas"), c2 = cv?.getContext?.("2d");
      if (c2 && typeof c2.drawImage === "function") {
        cv.width = d.frameWidth; cv.height = d.frameHeight;
        c2.drawImage(asset.image, frame * d.frameWidth, 0, d.frameWidth, d.frameHeight, 0, 0, d.frameWidth, d.frameHeight);
        c2.globalCompositeOperation = "source-in"; c2.fillStyle = tint; c2.fillRect(0, 0, d.frameWidth, d.frameHeight);
        out = cv;
      }
    } catch (_) { out = null; }
    cache.set(key, out);
    return out;
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
  // SPECIAL cut-in face plate (pure). CUTIN_FACE v2: wide 640x320 close-up (v1 256 plates kept in *_cutin_face/);
  // Graphics sizes it from the band height. null -> caller falls back.
  cutinFaceLayer(id) {
    const slots = this.castAssets?.[id], def = this.definitions.CAST?.[id]?.CUTIN_FACE;
    const asset = slots?.CUTIN_FACE;
    if (!def || def.enabled === false || !asset?.ready) return null;
    return { asset, scale: def.scale, flip: !!def.flip };
  },
  // Draw the truck still with its origin at (x, ground) (the Canvas truck's translate point); false -> Canvas truck.
  drawTruck(ctx, x, ground, view = null) {
    const def = this.definitions.TRUCK?.IDLE, asset = this.truckIdle;
    if (!def || def.enabled === false || !asset?.ready) return false;
    return this.draw(ctx, asset, 0, x, ground, def.scale, view);
  },
  // Decorative road-truck wheel hubs only; the already-drawn truck stays visible on any failure.
  // Centers and radius are source-image pixels, transformed with the same pivot and scale as IDLE.
  drawTruckHubs(ctx, x, ground, phaseTime) {
    let saved = false;
    try {
      const def = this.definitions.TRUCK?.IDLE, asset = this.truckIdle, d = asset?.data;
      if (!def || def.enabled === false || !asset?.ready || !asset.image?.complete || !asset.image.naturalWidth ||
          d?.frameWidth !== 576 || d?.frameHeight !== 288 || d.pivot?.x !== 352 || d.pivot?.y !== 264) return;
      const scale = def.scale / (d.unit > 0 ? d.unit : 1), angle = (Number.isFinite(phaseTime) ? phaseTime : 0) * 14;
      ctx.save(); saved = true; ctx.imageSmoothingEnabled = !!d.smooth;
      if (d.smooth) ctx.imageSmoothingQuality = "high";
      ctx.translate(x, ground); ctx.scale(scale, scale); ctx.translate(-d.pivot.x, -d.pivot.y);
      for (const cx of [130, 351]) {
        let wheelSaved = false;
        try {
          ctx.save(); wheelSaved = true; ctx.beginPath(); ctx.arc(cx, 228, 21, 0, Math.PI * 2); ctx.clip();
          ctx.translate(cx, 228); ctx.rotate(angle); ctx.drawImage(asset.image, -cx, -228);
        } catch (_) { /* Optional hub drawing must not interrupt the game. */ }
        finally { if (wheelSaved) try { ctx.restore(); } catch (_) {} }
      }
    } catch (_) { /* The original truck is already drawn. */ }
    finally { if (saved) try { ctx.restore(); } catch (_) {} }
  },
  // Compose one back-detail frame and its original character offscreen before drawing either to
  // the game. A failed front draw cannot leave a stray back detail on the game canvas. One small
  // canvas is reused per character and refreshed only when the 5fps frame or source assets change.
  castComposite(id, base, back, time) {
    try {
      const b = base?.data, d = back?.data;
      if (typeof document === "undefined" || !document.createElement || !base?.ready || !back?.ready ||
          !base.image?.complete || base.image.naturalWidth !== 288 || base.image.naturalHeight !== 288 ||
          !back.image?.complete || back.image.naturalWidth !== 288 * 8 || back.image.naturalHeight !== 288 ||
          b?.frameWidth !== 288 || b?.frameHeight !== 288 || b.frames !== 1 || b.pivot?.x !== 144 || b.pivot?.y !== 264 ||
          d?.frameWidth !== 288 || d?.frameHeight !== 288 || d.frames !== 8 || d.pivot?.x !== 144 || d.pivot?.y !== 264) return null;
      const entries = this.castCompositeCache ||= new Map();
      let entry = entries.get(id);
      if (!entry || entry.base !== base || entry.back !== back) {
        const canvas = document.createElement("canvas");
        canvas.width = 288; canvas.height = 288;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        entry = { base, back, canvas, ctx, frame: -1, asset: { ready: true, image: canvas, data: b, canvasSource: true } };
        entries.set(id, entry);
      }
      const frame = this.frameAt(d, time);
      if (entry.frame !== frame) {
        entry.frame = -1; // a failed draw must never expose a partially composed frame
        entry.ctx.clearRect(0, 0, 288, 288);
        entry.ctx.drawImage(back.image, frame * 288, 0, 288, 288, 0, 0, 288, 288);
        entry.ctx.drawImage(base.image, 0, 0, 288, 288, 0, 0, 288, 288);
        entry.frame = frame;
      }
      return entry.asset;
    } catch (_) { return null; }
  },
  // Draw a CAST still with its feet at (x, feet); false -> caller draws the Canvas figure.
  drawCast(ctx, id, x, feet, pose = 0, time = 0, reducedMotion = false) {
    const layer = this.castLayer(id, pose);
    if (!layer) return false;
    // The optional jester loop replaces only the unused roadside idle. The original remains the
    // fallback and reduced-motion still. Time 0 is a valid first animation frame, including pauses.
    const idleLoop = this.jesterIdleLoop, loopData = idleLoop?.data;
    if (id === "ANGLE" && !pose && !reducedMotion && !layer.flip && this.definitions.JESTER_IDLE_LOOP?.enabled !== false &&
        idleLoop?.ready && loopData?.frameWidth === 288 && loopData?.frameHeight === 288 && loopData.pivot?.x === 144 && loopData.pivot?.y === 264 &&
        this.draw(ctx, idleLoop, time, x, feet, layer.scale)) return true;
    // Optional transparent detail behind the approved original idle. The complete character is drawn
    // over it, keeping face, equipment and feet unchanged. No extra detail for USED or reduced motion.
    const back = id === "BOOST" ? this.witchCapeBack : id === "BOUNCE" ? this.fighterScarfBack : id === "BRAKE" ? this.thiefHairBack : id === "DASH" ? this.warriorCapeBack : id === "GUARD" ? this.sageCapeBack : id === "STOPPER" ? this.clericHairBack : id === "SPECIAL_ONLY" ? this.merchantHairBack : null;
    const backDef = id === "BOOST" ? this.definitions.WITCH_CAPE_BACK : id === "BOUNCE" ? this.definitions.FIGHTER_SCARF_BACK : id === "BRAKE" ? this.definitions.THIEF_HAIR_BACK : id === "DASH" ? this.definitions.WARRIOR_CAPE_BACK : id === "GUARD" ? this.definitions.SAGE_CAPE_BACK : id === "STOPPER" ? this.definitions.CLERIC_HAIR_BACK : id === "SPECIAL_ONLY" ? this.definitions.MERCHANT_HAIR_BACK : null;
    const d = back?.data, base = layer.asset;
    const showBack = backDef && backDef.enabled !== false && !pose && !reducedMotion && time > 0 &&
        base.image?.complete && base.image.naturalWidth && base.data?.pivot && back?.ready && d?.frameWidth === 288 && d?.frameHeight === 288 && d.pivot?.x === 144 && d.pivot?.y === 264;
    const composed = showBack ? this.castComposite(id, base, back, time) : null;
    const drawAt = px => (composed && this.draw(ctx, composed, 0, px, feet, layer.scale)) || this.draw(ctx, base, 0, px, feet, layer.scale);
    if (!layer.flip) return drawAt(x);
    ctx.save();
    try {
      ctx.translate(x, 0); ctx.scale(-1, 1);
      return drawAt(0);
    }
    finally { ctx.restore(); }
  },
  // Combo scenes (display only): a CAST still with uniform scale `mul` (x and y alike, so the 5-head proportions
  // never change), feet fixed at (x, feet), optional mirror (XOR the slot's flip), rotation about the feet point
  // and alpha. Returns the drawn rect in canvas px (or null -> caller draws the Canvas figure).
  // Combo scene slot (pure): pose = slot name (PUNCH / UPPER / CAST / IDLE / KICK / USED) or 0 / 1 like castLayer.
  // A missing / not loaded named slot falls back to the pose-1 still (KICK / USED), IDLE for "IDLE".
  comboLayer(id, pose = 0) {
    if (typeof pose !== "string") return this.castLayer(id, pose);
    const def = this.definitions.CAST?.[id]?.[pose], asset = this.castAssets?.[id]?.[pose];
    if (def && def.animation !== "CUTIN_FACE" && asset?.ready) return { name: pose, asset, scale: def.scale, flip: !!def.flip, facing: def.facing || "left" };
    const fallback = this.castLayer(id, pose === "IDLE" ? 0 : 1);
    return fallback && { ...fallback, facing: this.definitions.CAST[id][fallback.name]?.facing || "left" };
  },
  // Combo scenes: uniform scale `mul` about the feet (x, feet), optional rotation about the feet. opts.face
  // ("left" / "right") mirrors the slot when its drawn facing differs (mirrored about the feet, so the feet stay);
  // without face, opts.flip toggles the definition flip. Returns { w, h, left, top, scale, name, flipped } or null.
  drawCastScaled(ctx, id, x, feet, pose = 0, mul = 1, opts = {}) {
    const gate = id === "BOUNCE" && pose === "UPPER" && Number.isFinite(opts.windTime) ? opts.fighterWindGate : null;
    const witchGate = id === "BOOST" && pose === "CAST" && Number.isFinite(opts.windTime) ? opts.witchWindGate : null;
    let layer;
    try { layer = this.comboLayer(id, pose); } catch (_) { if (gate) gate.allowed = false; if (witchGate) witchGate.allowed = false; return null; }
    if (!layer || !layer.asset?.data) { if (gate) gate.allowed = false; if (witchGate) witchGate.allowed = false; return null; }
    if (gate && layer.name !== "UPPER") gate.allowed = false;
    if (witchGate && layer.name !== "CAST") witchGate.allowed = false;
    const d = layer.asset.data, scale = layer.scale * mul / (d.unit > 0 ? d.unit : 1);
    // facing = the stored image's facing, so the total mirror is simply face !== facing.
    const flip = opts.face ? opts.face !== (layer.facing || "left") : !!layer.flip !== !!opts.flip;
    ctx.save();
    try {
      if (Number.isFinite(opts.alpha)) ctx.globalAlpha *= Math.max(0, Math.min(1, opts.alpha));
      ctx.translate(x, feet);
      if (opts.rotate) ctx.rotate(opts.rotate);
      if (flip) ctx.scale(-1, 1);
      let drawn = false;
      const windAlpha = Number.isFinite(opts.windAlpha) ? Math.max(0, Math.min(1, opts.windAlpha)) : 1;
      const fighterWind = this.fighterWindCache;
      const fighterCandidate = id === "BOUNCE" && layer.name === "UPPER" && Number.isFinite(opts.windTime) && (!gate || gate.allowed);
      const fighterValid = fighterWind?.ready && fighterWind.sourceAsset === layer.asset && this.fighterWindSourceValid(fighterWind) &&
        fighterWind.data?.frames === 16 && fighterWind.data.fps > 0 && Array.isArray(fighterWind.sheets) && (!gate || gate.cache === fighterWind);
      if (fighterCandidate && !fighterValid && gate) gate.allowed = false;
      if (fighterCandidate && fighterValid && windAlpha >= 1) {
        const logical = this.frameAt(fighterWind.data, opts.windTime), stored = [0,1,2,3,4,3,2,1,0,5,6,7,8,7,6,5][logical];
        const sheet = fighterWind.sheets[Math.floor(stored / 4)], localTime = (stored % 4 + 0.5) / fighterWind.data.fps;
        if (sheet) drawn = this.draw(ctx, sheet, localTime, 0, 0, layer.scale * mul);
        if (!drawn && gate) gate.allowed = false; // latch failure for every later draw in this scene
      }
      const wind = this.witchWindCache;
      const witchCandidate = id === "BOOST" && layer.name === "CAST" && Number.isFinite(opts.windTime) && (!witchGate || witchGate.allowed);
      const witchValid = wind?.ready && wind.sourceAsset === layer.asset && this.witchWindSourceValid(wind) &&
        wind.data?.frames === 16 && wind.data.fps > 0 && Array.isArray(wind.sheets) && (!witchGate || witchGate.cache === wind);
      if (witchCandidate && !witchValid && witchGate) witchGate.allowed = false;
      if (witchCandidate && witchValid) {
        const frame = this.frameAt(wind.data, opts.windTime), sheet = wind.sheets?.[Math.floor(frame / 4)], localTime = (frame % 4 + 0.5) / wind.data.fps;
        // The first cached frame is the original image, so a single blit preserves translucent pixels.
        if (sheet) drawn = this.draw(ctx, sheet, localTime, 0, 0, layer.scale * mul);
        if (!drawn && witchGate) witchGate.allowed = false;
      }
      if (!drawn && !this.draw(ctx, layer.asset, 0, 0, 0, layer.scale * mul)) return null;
      const left = flip ? x - (d.frameWidth - d.pivot.x) * scale : x - d.pivot.x * scale;
      return { w: d.frameWidth * scale, h: d.frameHeight * scale, left, top: feet - d.pivot.y * scale, scale, name: layer.name, flipped: flip };
    } finally { ctx.restore(); }
  },
  // Grand scenes (cycle 36, pure): the direction a slot shows when drawn as adopted (stored facing, mirrored when the
  // slot's flip is set). The scene picks one mirror parity per scene, so every pose keeps the same weapon hand.
  grandFace(id, pose) {
    const slots = this.definitions.CAST?.[id], def = slots?.[pose] || slots?.IDLE, f = def?.facing || "left";
    return def?.flip ? (f === "left" ? "right" : "left") : f;
  },
  // Screen point of a slot's hotspot (sword / dagger tip, staff orb, cane top) for the drawn placement (same maths as
  // drawCastScaled: uniform scale about the feet, mirror, rotation). null when that slot is not the one drawn.
  castPoint(id, x, feet, pose, mul = 1, opts = {}) {
    const layer = this.comboLayer(id, pose), def = this.definitions.CAST?.[id]?.[pose];
    if (!layer || layer.name !== pose || !def?.hotspot) return null;
    const d = layer.asset.data, scale = layer.scale * mul / (d.unit > 0 ? d.unit : 1), flip = opts.face ? opts.face !== (layer.facing || "left") : !!layer.flip;
    let dx = (def.hotspot.x - d.pivot.x) * scale * (flip ? -1 : 1), dy = (def.hotspot.y - d.pivot.y) * scale; const r = opts.rotate || 0;
    if (r) [dx, dy] = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
    return { x: x + dx, y: feet + dy };
  },
  // Hero HIT (HD Rumiko knockback) still for the combo scenes; false -> caller keeps the normal layers.
  drawHeroHit(ctx, x, feet) {
    const asset = this.heroHit, def = this.definitions.HERO.HIT;
    if (!asset?.ready || def?.enabled === false) return false;
    return this.draw(ctx, asset, 0, x, feet, def.scale);
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
  Hop.Sprites.flightCapeCache = null;
  // Optional CPU work waits for the title's hero and truck assets to settle.
  Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.scheduleFlightCapeCache(asset)).catch(() => {});
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
  asset.opaque = Hop.Sprites.opaqueBoxes(asset); // launch cut-in / roadside stills sample only their pixels (cycle 55)
  Hop.Sprites.heroHit = asset;
  return asset;
});
Hop.Sprites.specialReactionReady = Hop.Sprites.load(Hop.Sprites.definitions.HERO.SPECIAL_REACTION).then(asset => {
  Hop.Sprites.heroSpecialReaction = asset;
  return asset;
});
Hop.Sprites.truckReady = Hop.Sprites.load(Hop.Sprites.definitions.TRUCK.IDLE).then(asset => {
  asset.opaque = Hop.Sprites.opaqueBoxes(asset); // launch cut-in / roadside stills sample only their pixels (cycle 55)
  Hop.Sprites.truckIdle = asset;
  return asset;
});
// Decorative flight/cast assets never compete with the two assets shown on the title screen.
Hop.Sprites.titleAssetsReady = Promise.all([Hop.Sprites.truckReady, Hop.Sprites.idleReady].map(p => p.catch(() => null)));
Hop.Sprites.witchCapeBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.WITCH_CAPE_BACK)).then(asset => {
  Hop.Sprites.witchCapeBack = asset;
  return asset;
});
Hop.Sprites.fighterScarfBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.FIGHTER_SCARF_BACK)).then(asset => {
  Hop.Sprites.fighterScarfBack = asset;
  return asset;
});
Hop.Sprites.thiefHairBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.THIEF_HAIR_BACK)).then(asset => {
  Hop.Sprites.thiefHairBack = asset;
  return asset;
});
Hop.Sprites.warriorCapeBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.WARRIOR_CAPE_BACK)).then(asset => {
  Hop.Sprites.warriorCapeBack = asset;
  return asset;
});
Hop.Sprites.sageCapeBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.SAGE_CAPE_BACK)).then(asset => {
  Hop.Sprites.sageCapeBack = asset;
  return asset;
});
Hop.Sprites.clericHairBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.CLERIC_HAIR_BACK)).then(asset => {
  Hop.Sprites.clericHairBack = asset;
  return asset;
});
Hop.Sprites.merchantHairBackReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.MERCHANT_HAIR_BACK)).then(asset => {
  Hop.Sprites.merchantHairBack = asset;
  return asset;
});
Hop.Sprites.jesterIdleLoopReady = Hop.Sprites.titleAssetsReady.then(() => Hop.Sprites.load(Hop.Sprites.definitions.JESTER_IDLE_LOOP)).then(asset => {
  Hop.Sprites.jesterIdleLoop = asset;
  return asset;
});
Hop.Sprites.castAssets = {};
// Load order (2026-10-17 cycle 19): the eight CUTIN_FACE plates (~2.3 MB, 51% of first-load bytes) are only drawn
// inside a SPECIAL cut-in, so they start after the truck + hero IDLE (title screen) are ready instead of competing
// with them. Same files, same drawing; castReady still resolves only when every slot (plates included) settled.
// Until a plate is ready the cut-in already falls back to the cast body layer (cutinFaceLayer -> null).
// Grand-scene poses (grandPose, ~0.8 MB, cycle 36) are only drawn inside a SPECIAL scene: deferred with the plates; until
// one is ready the scene draws the IDLE / USED still in its place (comboLayer fallback).
Hop.Sprites.castLoad = (pick) => Object.entries(Hop.Sprites.definitions.CAST).flatMap(([id, slots]) =>
  Object.entries(slots).filter(([name, definition]) => pick(name, definition)).map(([name, definition]) => Hop.Sprites.load(definition).then(asset => {
    (Hop.Sprites.castAssets[id] ||= {})[name] = asset;
    return asset;
  })));
Hop.Sprites.castDeferred = (name, definition) => name === "CUTIN_FACE" || definition?.grandPose === true;
Hop.Sprites.castBodyReady = Promise.all(Hop.Sprites.castLoad((name, d) => !Hop.Sprites.castDeferred(name, d)));
Hop.Sprites.cutinFaceReady = Promise.all([Hop.Sprites.truckReady, Hop.Sprites.idleReady].map(p => p.catch(() => null)))
  .then(() => Promise.all(Hop.Sprites.castLoad((name, d) => Hop.Sprites.castDeferred(name, d))));
Hop.Sprites.castReady = Promise.all([Hop.Sprites.castBodyReady, Hop.Sprites.cutinFaceReady]).then(([a, b]) => a.concat(b));
// Wait for the title-critical assets and CAST itself, then build only when the browser is idle.
Promise.all([Hop.Sprites.titleAssetsReady, Hop.Sprites.castBodyReady]).then(() => {
  Hop.Sprites.scheduleWitchWindCache(Hop.Sprites.castAssets?.BOOST?.CAST);
}).catch(() => {});
Promise.all([Hop.Sprites.titleAssetsReady, Hop.Sprites.castBodyReady]).then(() => {
  Hop.Sprites.scheduleFighterWindCache(Hop.Sprites.castAssets?.BOUNCE?.UPPER);
}).catch(() => {});
