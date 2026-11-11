// Phase C: CAST (roadside characters + merchant overlay) still sprites. Display-only checks with
// test-only mock assets; no art is created. Shipping state: every slot enabled:false (no asset).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js/sprites.js'), 'utf8');
const IDS = ['BOOST', 'BOUNCE', 'BRAKE', 'ANGLE', 'DASH', 'GUARD', 'STOPPER', 'SPECIAL_ONLY'];
// Shipped HD comic cast stills (the 96 originals are kept next to them).
const HD_CAST = {
  'BOOST.IDLE': { dir: 'assets/sprites/cast/boost_witch_comic_v1/', w: 288, legacy: ['assets/sprites/cast/boost_witch/boost_witch_idle_sheet_96x96.png', 'assets/sprites/cast/boost_witch/boost_witch_idle.json'] },
  'BOOST.USED': { dir: 'assets/sprites/cast/boost_witch_comic_v1/', w: 384, legacy: ['assets/sprites/cast/boost_witch/boost_witch_used_sheet_96x96.png', 'assets/sprites/cast/boost_witch/boost_witch_used.json'] },
  'BOUNCE.IDLE': { dir: 'assets/sprites/cast/bounce_fighter_comic_v1/', w: 288, legacy: ['assets/sprites/cast/bounce_fighter/bounce_fighter_idle_sheet_96x96.png', 'assets/sprites/cast/bounce_fighter/bounce_fighter_idle.json'] },
  'BOUNCE.KICK': { dir: 'assets/sprites/cast/bounce_fighter_comic_v1/', w: 384, legacy: ['assets/sprites/cast/bounce_fighter/bounce_fighter_kick_sheet_96x96.png', 'assets/sprites/cast/bounce_fighter/bounce_fighter_kick.json'] },
  'BRAKE.IDLE': { dir: 'assets/sprites/cast/brake_thief_comic_v1/', w: 288, legacy: ['assets/sprites/cast/brake_thief/brake_thief_idle_sheet_96x96.png', 'assets/sprites/cast/brake_thief/brake_thief_idle.json'] },
  'BRAKE.USED': { dir: 'assets/sprites/cast/brake_thief_comic_v1/', w: 384, legacy: ['assets/sprites/cast/brake_thief/brake_thief_used_sheet_96x96.png', 'assets/sprites/cast/brake_thief/brake_thief_used.json'] },
  'ANGLE.IDLE': { dir: 'assets/sprites/cast/angle_jester_comic_v1/', w: 288, legacy: ['assets/sprites/cast/angle_jester/angle_jester_idle_sheet_96x96.png', 'assets/sprites/cast/angle_jester/angle_jester_idle.json'] },
  'ANGLE.USED': { dir: 'assets/sprites/cast/angle_jester_comic_v1/', w: 384, legacy: ['assets/sprites/cast/angle_jester/angle_jester_used_sheet_96x96.png', 'assets/sprites/cast/angle_jester/angle_jester_used.json'] },
  'DASH.IDLE': { dir: 'assets/sprites/cast/dash_warrior_comic_v1/', w: 288, legacy: ['assets/sprites/cast/dash_warrior/dash_warrior_idle_sheet_96x96.png', 'assets/sprites/cast/dash_warrior/dash_warrior_idle.json'] },
  'GUARD.IDLE': { dir: 'assets/sprites/cast/guard_sage_comic_v1/', w: 288, legacy: ['assets/sprites/cast/guard_sage/guard_sage_idle_sheet_96x96.png', 'assets/sprites/cast/guard_sage/guard_sage_idle.json'] },
  'STOPPER.IDLE': { dir: 'assets/sprites/cast/stopper_cleric_comic_v1/', w: 288, legacy: ['assets/sprites/cast/stopper_cleric/stopper_cleric_idle_sheet_96x96.png', 'assets/sprites/cast/stopper_cleric/stopper_cleric_idle.json'] },
  'SPECIAL_ONLY.IDLE': { dir: 'assets/sprites/cast/merchant_comic_v1/', w: 288, legacy: ['assets/sprites/cast/merchant/merchant_idle_sheet_96x96.png', 'assets/sprites/cast/merchant/merchant_idle.json'] },
  'BOOST.CUTIN_FACE': { dir: 'assets/sprites/cast/boost_witch_cutin_face_v2/', w: 640 },
  'BOUNCE.CUTIN_FACE': { dir: 'assets/sprites/cast/bounce_fighter_cutin_face_v2/', w: 640 },
  'BRAKE.CUTIN_FACE': { dir: 'assets/sprites/cast/brake_thief_cutin_face_v2/', w: 640 },
  'ANGLE.CUTIN_FACE': { dir: 'assets/sprites/cast/angle_jester_cutin_face_v2/', w: 640 },
  'DASH.CUTIN_FACE': { dir: 'assets/sprites/cast/dash_warrior_cutin_face_v2/', w: 640 },
  'GUARD.CUTIN_FACE': { dir: 'assets/sprites/cast/guard_sage_cutin_face_v2/', w: 640 },
  'STOPPER.CUTIN_FACE': { dir: 'assets/sprites/cast/stopper_cleric_cutin_face_v2/', w: 640 },
  'SPECIAL_ONLY.CUTIN_FACE': { dir: 'assets/sprites/cast/merchant_cutin_face_v2/', w: 640 }
};
// Combo-scene poses (drawn only by the combo SPECIAL scenes): HD comic stills, unit 3, head = HD idle head, 頭身 4.75..5.25.
const COMBO_POSE = {
  'BOOST.CAST': { dir: 'assets/sprites/cast/boost_witch_combo_v1/', w: 288, pivot: { x: 144, y: 278 }, facing: 'left', ratio: 'value' },
  'BOUNCE.PUNCH': { dir: 'assets/sprites/cast/bounce_fighter_combo_v1/', w: 384, pivot: { x: 192, y: 264 }, facing: 'right', ratio: 'standing' },
  'BOUNCE.UPPER': { dir: 'assets/sprites/cast/bounce_fighter_combo_v1/', w: 288, pivot: { x: 144, y: 264 }, facing: 'right', ratio: 'value' }
};
// Grand-scene poses (cycle 36, drawn only by the solo SPECIAL scenes; adopted art in *_special_v1/): cell, feet / palm
// pivot, stored facing, adoption mirror (flip) and the effect hotspot. 頭身 4.75..5.25, deferred load (grandPose).
const GRAND_POSE = {
  'DASH.WINDUP': { dir: 'assets/sprites/cast/dash_warrior_special_v1/', w: 384, h: 288, pivot: { x: 192, y: 264 }, facing: 'left', flip: false },
  'DASH.THRUST': { dir: 'assets/sprites/cast/dash_warrior_special_v1/', w: 384, h: 288, pivot: { x: 192, y: 264 }, facing: 'left', flip: true },
  'DASH.FINISH': { dir: 'assets/sprites/cast/dash_warrior_special_v1/', w: 384, h: 384, pivot: { x: 192, y: 380 }, facing: 'left', flip: true },
  'STOPPER.PRAY': { dir: 'assets/sprites/cast/stopper_cleric_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: false },
  'STOPPER.RELEASE': { dir: 'assets/sprites/cast/stopper_cleric_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: true },
  'BRAKE.SHADOW': { dir: 'assets/sprites/cast/brake_thief_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: false },
  'BRAKE.SLASH': { dir: 'assets/sprites/cast/brake_thief_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: false },
  'ANGLE.HANDSTAND': { dir: 'assets/sprites/cast/angle_jester_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: false },
  'ANGLE.TADA': { dir: 'assets/sprites/cast/angle_jester_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'right', flip: true },
  'GUARD.CHANT': { dir: 'assets/sprites/cast/guard_sage_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: true },
  'GUARD.BARRIER': { dir: 'assets/sprites/cast/guard_sage_special_v1/', w: 288, h: 288, pivot: { x: 144, y: 264 }, facing: 'left', flip: true }
};
const GRAND_KEYS = { DASH: ['WINDUP', 'THRUST', 'FINISH'], STOPPER: ['PRAY', 'RELEASE'], BRAKE: ['SHADOW', 'SLASH'], ANGLE: ['HANDSTAND', 'TADA'], GUARD: ['CHANT', 'BARRIER'] };
const USED_POSE = { BOUNCE: 'KICK', BOOST: 'USED', BRAKE: 'USED', ANGLE: 'USED' }; // shipped pose-1 (used / post-contact) slots
// Minimal PNG decoder (8-bit RGBA, non-interlaced) -> alpha channel; test-only.
function pngAlpha(buf) {
  const zlib = require('node:zlib'); const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert(buf[24] === 8 && buf[25] === 6 && buf[28] === 0, 'RGBA8 non-interlaced');
  const parts = []; for (let o = 8; o < buf.length;) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8); if (type === 'IDAT') parts.push(buf.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(parts)), stride = w * 4, out = Buffer.alloc(h * stride), alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[y * stride + i - 4] : 0, b = y ? out[(y - 1) * stride + i] : 0, c = y && i >= 4 ? out[(y - 1) * stride + i - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      out[y * stride + i] = (row[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
    for (let x = 0; x < w; x++) alpha[y * w + x] = out[y * stride + x * 4 + 3];
  }
  return { w, h, alpha };
}
const still = (id, animation, extra) => ({ id, animation, frameWidth: 96, frameHeight: 96, frames: 1, fps: 1, loop: false, pivot: { x: 48, y: 88 }, ...extra });
if (process.argv.includes('--loader')) {
  (async () => {
    let mode = 'ok', width = 96; const requested = [];
    class Image {
      constructor() { this.complete = true; this.naturalHeight = 96; }
      set src(value) { requested.push(value); this.naturalWidth = width; if (mode === 'image-error') this.onerror(new Error('missing')); else this.onload(); }
    }
    let meta = null;
    const scope = { Hop: {}, Image, fetch: async url => { requested.push(url); if (mode === 'network') throw new Error('offline');
      return { ok: mode !== '404', json: async () => { if (mode === 'json') throw new SyntaxError('bad'); return meta(url); } }; } };
    // Hero URLs answer valid 8-frame hero metadata so the startup loads behave as in the game.
    meta = url => {
      if (url.includes('/cast/')) return still('BOOST', 'IDLE');
      if (url.includes('/idle/') || url.includes('hero_idle')) return { id: 'HERO', animation: 'IDLE', cellW: 288, cellH: 288, frames: 1, fps: 1, loop: false, pivot: { x: 144, y: 264 } };
      return { id: 'HERO', animation: url.includes('aerial_up') ? 'AERIAL_UP' : url.includes('aerial_down') ? 'AERIAL_DOWN' : url.includes('hit') ? 'HIT' : url.includes('ground_bounce') ? 'GROUND_BOUNCE' : url.includes('stop_result') ? 'STOP_RESULT' : url.includes('special') ? 'SPECIAL_REACTION' : 'FLIGHT_LOOP',
        frameWidth: 96, frameHeight: 96, frames: 8, fps: url.includes('flight_loop') ? 8 : 12, loop: url.includes('flight_loop'), pivot: { x: 48, y: 88 } };
    };
    width = 768;
    vm.createContext(scope); vm.runInContext(code, scope);
    const s = scope.Hop.Sprites, C = s.definitions.CAST;
    await s.castReady;
    for (const id of IDS) for (const [name, def] of Object.entries(C[id])) {
      assert.equal(s.castAssets[id][name].ready, false, id + name);
      if (def.enabled === false) assert(!requested.includes(def.metadata) && !requested.includes(def.src), 'disabled = never requested (no 404)');
    }
    const def = { ...C.BOOST.IDLE, enabled: true };
    width = 96; mode = 'ok';
    assert.equal((await s.load(def)).ready, true, '1-frame still accepted for CAST');
    const n = requested.length; assert.equal((await s.load({ ...def, enabled: false })).ready, false); assert.equal(requested.length, n);
    for (mode of ['image-error', 'network', '404', 'json']) assert.equal((await s.load(def)).ready, false, mode);
    mode = 'ok';
    const bad = [['wrong id', still('BOUNCE', 'IDLE')], ['wrong animation', still('BOOST', 'KICK')], ['8 frames', still('BOOST', 'IDLE', { frames: 8 })],
      ['fps', still('BOOST', 'IDLE', { fps: 12 })], ['loop', still('BOOST', 'IDLE', { loop: true })], ['pivot', still('BOOST', 'IDLE', { pivot: { x: 48, y: 80 } })],
      ['size', still('BOOST', 'IDLE', { frameWidth: 64 })]];
    for (const [label, m] of bad) { meta = () => m; assert.equal((await s.load(def)).ready, false, label); }
    meta = () => still('BOOST', 'IDLE'); width = 768; assert.equal((await s.load(def)).ready, false, 'sheet width must be 96 x 1');
    width = 96; assert.equal((await s.load(def)).ready, true, 'recovery');
    // The optional back-cloth declares its own eight-frame loop; bad dimensions or metadata fail closed.
    const animated = { ...s.definitions.WITCH_CAPE_BACK, enabled: true };
    const beforeDisabled = requested.length;
    assert.equal((await s.load({ ...animated, enabled: false })).ready, false);
    assert.equal(requested.length, beforeDisabled, 'disabled cape never requests assets');
    meta = () => still('BOOST', 'CAPE_BACK', { frames: 8, fps: 5, loop: true }); width = 768;
    assert.equal((await s.load(animated)).ready, true, '8-frame witch loop accepted');
    width = 96; assert.equal((await s.load(animated)).ready, false, 'witch loop rejects truncated sheet');
    width = 768; meta = () => still('BOOST', 'CAPE_BACK', { frames: 8, fps: 5, loop: false });
    assert.equal((await s.load(animated)).ready, false, 'witch loop rejects incompatible metadata');
    const scarf = { ...s.definitions.FIGHTER_SCARF_BACK, enabled: true };
    meta = () => still('BOUNCE', 'SCARF_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(scarf)).ready, true, '8-frame fighter scarf accepted');
    width = 96; assert.equal((await s.load(scarf)).ready, false, 'fighter scarf rejects truncated sheet');
    width = 768; meta = () => still('BOOST', 'SCARF_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(scarf)).ready, false, 'fighter scarf rejects wrong character');
    const hair = { ...s.definitions.THIEF_HAIR_BACK, enabled: true };
    meta = () => still('BRAKE', 'HAIR_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(hair)).ready, true, '8-frame thief hair accepted');
    width = 96; assert.equal((await s.load(hair)).ready, false, 'thief hair rejects truncated sheet');
    width = 768; meta = () => still('BOOST', 'HAIR_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(hair)).ready, false, 'thief hair rejects wrong character');
    const warriorCape = { ...s.definitions.WARRIOR_CAPE_BACK, enabled: true };
    meta = () => still('DASH', 'CAPE_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(warriorCape)).ready, true, '8-frame warrior cape accepted');
    width = 96; assert.equal((await s.load(warriorCape)).ready, false, 'warrior cape rejects truncated sheet');
    width = 768; meta = () => still('BOOST', 'CAPE_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(warriorCape)).ready, false, 'warrior cape rejects wrong character');
    const sageCape = { ...s.definitions.SAGE_CAPE_BACK, enabled: true };
    meta = () => still('GUARD', 'CAPE_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(sageCape)).ready, true, '8-frame sage cape accepted');
    width = 96; assert.equal((await s.load(sageCape)).ready, false, 'sage cape rejects truncated sheet');
    width = 768; meta = () => still('BOOST', 'CAPE_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(sageCape)).ready, false, 'sage cape rejects wrong character');
    const clericHair = { ...s.definitions.CLERIC_HAIR_BACK, enabled: true };
    meta = () => still('STOPPER', 'HAIR_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(clericHair)).ready, true, '8-frame cleric hair accepted');
    width = 96; assert.equal((await s.load(clericHair)).ready, false, 'cleric hair rejects truncated sheet');
    width = 768; meta = () => still('BRAKE', 'HAIR_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(clericHair)).ready, false, 'cleric hair rejects wrong character');
    const merchantHair = { ...s.definitions.MERCHANT_HAIR_BACK, enabled: true };
    meta = () => still('SPECIAL_ONLY', 'HAIR_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(merchantHair)).ready, true, '8-frame merchant hair accepted');
    width = 96; assert.equal((await s.load(merchantHair)).ready, false, 'merchant hair rejects truncated sheet');
    width = 768; meta = () => still('STOPPER', 'HAIR_BACK', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(merchantHair)).ready, false, 'merchant hair rejects wrong character');
    const jesterLoop = { ...s.definitions.JESTER_IDLE_LOOP, enabled: true };
    meta = () => still('ANGLE', 'IDLE_LOOP', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(jesterLoop)).ready, true, '8-frame jester loop accepted');
    width = 96; assert.equal((await s.load(jesterLoop)).ready, false, 'jester loop rejects truncated sheet');
    width = 768; meta = () => still('BOOST', 'IDLE_LOOP', { frames: 8, fps: 5, loop: true });
    assert.equal((await s.load(jesterLoop)).ready, false, 'jester loop rejects wrong character');
    // HERO keeps its 8-frame requirement: a 1-frame HERO sheet is rejected.
    meta = () => ({ ...still('HERO', 'FLIGHT_LOOP'), fps: 8, loop: true }); width = 96;
    assert.equal((await s.load(s.definitions.HERO.FLIGHT_LOOP)).ready, false, 'HERO still needs 8 frames');
    meta = () => ({ ...still('HERO', 'FLIGHT_LOOP'), frames: 8, fps: 8, loop: true }); width = 768;
    assert.equal((await s.load(s.definitions.HERO.FLIGHT_LOOP)).ready, true);
    console.log('Cast loader PASS: disabled = no request, 1-frame CAST stills, id/animation/frames/fps/loop/pivot/size/network/404/JSON errors, recovery, HERO stays 8 frames.');
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--loader'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); process.stdout.write(child.stdout);
  const { scope, element, launch } = require('./phase2.cjs');
  const H = scope.Hop, s = H.Sprites, C = s.definitions.CAST, c = H.CONFIG;
  // Manifest: relative paths under the Pages subpath, 1-frame stills, flag == files present.
  assert.deepEqual(Object.keys(C), IDS);
  for (const id of IDS) {
    assert(H.CAST[id], id + ' is a CAST id');
    const expectedKeys = id === 'BOUNCE' ? ['IDLE', 'KICK', 'PUNCH', 'UPPER', 'CUTIN_FACE'] : id === 'BOOST' ? ['IDLE', 'USED', 'CAST', 'CUTIN_FACE'] : [...(USED_POSE[id] ? ['IDLE', USED_POSE[id]] : ['IDLE']), ...(GRAND_KEYS[id] || []), 'CUTIN_FACE'];
    assert.deepEqual(Object.keys(C[id]), expectedKeys);
    // Generic used (post-contact) pose: at most one pose: 1 slot per character, never IDLE.
    assert(Object.values(C[id]).filter(d => d.pose === 1).length <= 1, id + ': one pose-1 slot at most');
    assert.notEqual(C[id].IDLE.pose, 1, id + ': IDLE is the pose-0 still');
    assert.deepEqual(Object.entries(C[id]).filter(([, d]) => d.pose === 1).map(([n]) => n), USED_POSE[id] ? [USED_POSE[id]] : []);
    for (const [name, def] of Object.entries(C[id])) {
      if (name === 'CUTIN_FACE') {
        assert.deepEqual([def.id, def.animation, def.frames, def.fps, def.loop, def.flip], [id, 'CUTIN_FACE', 1, 1, false, false]);
        assert.equal(def.scale, 1);
      } else {
        assert.deepEqual([def.id, def.animation, def.frames, def.fps, def.loop, def.flip], [id, name, 1, 1, false, GRAND_POSE[id + '.' + name] ? GRAND_POSE[id + '.' + name].flip : id === 'DASH' || id === 'GUARD']); // grand poses: the adoption mirror; mirrored: the warrior (sword right, shield left) and the redesigned sage (staff right, book left), like the Canvas figures; the redesigned fighter kick, thief and jester already face the Canvas way
        assert.equal(def.scale, id === 'SPECIAL_ONLY' ? 1.25 * 1.25 / 1.365 : 1.25);
      }
      for (const ref of [def.src, def.metadata]) {
        assert(!/^(?:\/|[a-z]+:)/i.test(ref) && ref.startsWith('assets/sprites/cast/'));
        assert(new URL(ref, 'https://example.test/Flash-game/').pathname.startsWith('/Flash-game/assets/sprites/cast/'));
      }
      const present = fs.existsSync(path.join(root, def.src)) && fs.existsSync(path.join(root, def.metadata));
      // heldBack: files present but deliberately not loaded. Only for a legacy 96 used (pose 1) still whose
      // IDLE is already HD (the used figure then shows the HD idle at 35% until its HD pose exists).
      if (def.heldBack) {
        assert(def.pose === 1 && HD_CAST[id + '.IDLE'] && !HD_CAST[id + '.' + name], `${id}.${name}: heldBack only on a 96 used still next to an HD idle`);
        assert(present, 'held-back files kept'); assert.equal(def.enabled, false, 'held back = not loaded');
      }
      else assert.equal(def.enabled !== false, present, `${id}.${name}: ` + (present ? 'bundle found: set enabled: true' : 'enabled but bundle missing'));
      if (present) {
        const m = JSON.parse(fs.readFileSync(path.join(root, def.metadata)));
        const hd = HD_CAST[id + '.' + name], png = fs.readFileSync(path.join(root, def.src)), combo = COMBO_POSE[id + '.' + name];
        const grand = GRAND_POSE[id + '.' + name];
        if (grand) {
          // Grand-scene pose: own *_special_v1 folder, scene-only (comboPose + grandPose, no pose: 1), JSON = slot, feet pivot.
          assert(def.comboPose === true && def.grandPose === true && def.pose === undefined && def.enabled !== false, id + '.' + name + ' grand-only slot');
          assert(def.src.startsWith(grand.dir) && def.metadata.startsWith(grand.dir), id + '.' + name + ' grand dir');
          assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot, smoothing: m.smoothing },
            { id, animation: name, w: grand.w, h: grand.h, frames: 1, fps: 1, loop: false, pivot: grand.pivot, smoothing: true });
          assert(s.normalizeCell({ ...m }), id + '.' + name + ' cell contract'); assert.equal(m.displayScale, def.scale); assert.equal(s.normalizeCell({ ...m }).unit, grand.h / 96);
          assert.equal(m.facing, grand.facing); assert.equal(def.facing, grand.facing); assert.equal(m.mirrorInScene, grand.flip);
          assert.deepEqual([m.hotspot.x, m.hotspot.y], [def.hotspot.x, def.hotspot.y]); assert(def.hotspot.x >= 0 && def.hotspot.x < grand.w && def.hotspot.y >= 0 && def.hotspot.y < grand.h);
          const ratio = m.heightRatio.value; assert(ratio >= 4.75 && ratio <= 5.25 && /頭身/.test(m.notes), `${id}.${name} 頭身 ${ratio}`); assert.deepEqual(m.heightRatio.pass, [4.75, 5.25]);
          assert.equal(png.readUInt32BE(16), grand.w); assert.equal(png.readUInt32BE(20), grand.h); assert.equal(png[25], 6, 'RGBA PNG');
          const { w: pw, h: ph, alpha } = pngAlpha(png); let lowest = -1, top = ph, edge = false;
          for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (alpha[y * pw + x] > 128) { lowest = y; top = Math.min(top, y); if (x === 0 || x === pw - 1 || y === 0) edge = true; }
          assert(Math.abs(lowest + 1 - grand.pivot.y) <= 1, `${id}.${name} sole on pivot y (${lowest + 1} vs ${grand.pivot.y})`);
          assert(!edge && top > 0, id + '.' + name + ' not clipped');
          assert(alpha[def.hotspot.y * pw + def.hotspot.x] > 0 || alpha[(def.hotspot.y + 2) * pw + def.hotspot.x] > 0 || alpha[def.hotspot.y * pw + def.hotspot.x + 2] > 0, id + '.' + name + ' hotspot on the figure');
        } else if (combo) {
          // Combo pose: own folder, never a roadside pose (no pose: 1), facing recorded, 頭身 in range, feet pivot.
          assert(def.comboPose === true && def.pose === undefined && def.enabled !== false, id + '.' + name + ' combo-only slot');
          assert(def.src.startsWith(combo.dir) && def.metadata.startsWith(combo.dir), id + '.' + name + ' combo dir');
          assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot, smoothing: m.smoothing },
            { id, animation: name, w: combo.w, h: 288, frames: 1, fps: 1, loop: false, pivot: combo.pivot, smoothing: true });
          assert(s.normalizeCell({ ...m }), id + '.' + name + ' cell contract'); assert.equal(m.displayScale, def.scale);
          assert.equal(m.facing, combo.facing); assert.equal(def.facing, combo.facing);
          const ratio = m.heightRatio[combo.ratio]; assert(ratio >= 4.75 && ratio <= 5.25 && /頭身/.test(m.notes), `${id}.${name} 頭身 ${ratio}`);
          assert.deepEqual(m.heightRatio.pass, [4.75, 5.25]);
          assert.equal(png.readUInt32BE(16), combo.w); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
          // Feet on the pivot: the lowest opaque row of the sheet sits on pivot.y; nothing clipped at the cell edges.
          const { w: pw, h: ph, alpha } = pngAlpha(png); let lowest = -1, top = ph, edge = false;
          for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (alpha[y * pw + x] > 128) { lowest = y; top = Math.min(top, y); if (x === 0 || x === pw - 1 || y === 0) edge = true; }
          assert(Math.abs(lowest + 1 - combo.pivot.y) <= 1, `${id}.${name} sole on pivot y (${lowest + 1} vs ${combo.pivot.y})`);
          assert(!edge && top > 0, id + '.' + name + ' not clipped');
        } else if (hd && name === 'CUTIN_FACE') {
          // Face close-up plate v2: 640x320 (2:1 = widest allowed cell), center pivot, smoothed (Lanczos source).
          assert(def.src.startsWith(hd.dir) && def.metadata.startsWith(hd.dir), id + ' face dir');
          assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot, smoothing: m.smoothing },
            { id, animation: 'CUTIN_FACE', w: 640, h: 320, frames: 1, fps: 1, loop: false, pivot: { x: 320, y: 160 }, smoothing: true });
          assert(s.normalizeCell({ ...m }), id + ' face cell contract');
          assert.equal(png.readUInt32BE(16), 640); assert.equal(png.readUInt32BE(20), 320); assert.equal(png[25], 6, 'RGBA PNG');
          // v1 256 plate kept next to it (not deleted).
          const v1 = hd.dir.replace('_cutin_face_v2/', '_cutin_face/');
          assert(fs.readdirSync(path.join(root, v1)).some(f => f.endsWith('_sheet_256x256.png')), id + ' v1 face plate kept');
        } else if (hd) {
          // HD comic still: 288 high (unit 3), pivot (cellW/2,264) = the 96 feet point, smoothing on.
          assert(def.src.startsWith(hd.dir) && def.metadata.startsWith(hd.dir), id + ' HD dir');
          assert.deepEqual({ id: m.id, animation: m.animation, w: m.cellW, h: m.cellH, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot, smoothing: m.smoothing },
            { id, animation: name, w: hd.w, h: 288, frames: 1, fps: 1, loop: false, pivot: { x: hd.w / 2, y: 264 }, smoothing: true });
          assert(s.normalizeCell({ ...m }), id + ' HD cell contract'); assert.equal(m.displayScale, def.scale);
          assert.equal(png.readUInt32BE(16), hd.w); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
          for (const f of hd.legacy) assert(fs.existsSync(path.join(root, f)), 'legacy kept ' + f);
        } else {
          assert.deepEqual({ id: m.id, animation: m.animation, w: m.frameWidth, h: m.frameHeight, frames: m.frames, fps: m.fps, loop: m.loop, pivot: m.pivot },
            { id, animation: name, w: 96, h: 96, frames: 1, fps: 1, loop: false, pivot: { x: 48, y: 88 } });
          assert.equal(png.readUInt32BE(16), 96); assert.equal(png.readUInt32BE(20), 96); assert.equal(png[25], 6, 'RGBA PNG');
        }
      }
    }
  }
  // Exact feet-geometry contract below is checked with the display-only motion off (Hop.Anim.enabled = false);
  // the motion itself (bounds, whole-sprite scale, determinism, no physics change) is covered by tests/anim.cjs.
  H.Anim.enabled = false;
  // Rendering: recording context. drawImage records the sprite, character() records Canvas figures.
  const fake = (id, animation) => ({ ready: true, image: { complete: true, naturalWidth: 96, id, animation }, data: still(id, animation) });
  const fakeHD = (id, animation) => ({ ready: true, image: { complete: true, naturalWidth: 288, naturalHeight: 288, id, animation },
    data: s.normalizeCell({ id, animation, cellW: 288, cellH: 288, frames: 1, fps: 1, loop: false, pivot: { x: 144, y: 264 }, smoothing: true }) });
  const graphics = H.Graphics, origChar = graphics.character;
  let log = [];
  graphics.character = function (ctx, id, x, feet, scale, pose) { log.push({ kind: 'canvas', id, x, feet, scale, pose, alpha: ctx.globalAlpha }); return origChar.apply(this, arguments); };
  const ctx = () => {
    const stack = []; let state = { globalAlpha: 1, tx: 0, sx: 1 };
    const o = { save() { stack.push({ ...state }); }, restore() { state = stack.pop() || state; },
      translate(x) { state.tx += x * state.sx; }, scale(x) { state.sx *= x; }, rotate() {},
      drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { if (img.id) log.push({ kind: 'sprite', id: img.id, animation: img.animation, srcX: sx, srcY: sy, srcW: sw, srcH: sh, dx: state.tx + dx * state.sx, dy, dw: dw * state.sx, dh, alpha: state.globalAlpha, smoothing: o.imageSmoothingEnabled }); },
      measureText: () => ({ width: 0 }), fillText(t) { log.push({ kind: 'text', t }); } };
    const dummy = new Proxy(function () {}, { get: () => dummy, apply: () => dummy });
    return new Proxy(o, { get: (t, k) => k === 'globalAlpha' ? state.globalAlpha : k in t ? t[k] : () => dummy, set: (t, k, v) => { if (k === 'globalAlpha') state.globalAlpha = v; else t[k] = v; return true; } });
  };
  const install = assets => { for (const id of IDS) s.castAssets[id] = { IDLE: { ready: false }, ...(USED_POSE[id] ? { [USED_POSE[id]]: { ready: false } } : {}), ...(assets?.[id] || {}) }; };
  const scene = () => {
    const game = launch(3), ui = new H.UI(game, element('canvas'));
    game.objects = IDS.slice(0, 7).map((type, i) => ({ x: game.body.x + 150 + i * 120, type, used: i % 2 === 1 }));
    game.nextObjectX = 1e12; game.nextBoundaryX = 1e12;
    return { game, ui };
  };
  const render = (game, ui) => { log = []; const before = JSON.stringify(game); graphics.draw(ctx(), game, ui.visual); assert.equal(JSON.stringify(game), before, 'drawing never mutates game state'); return log; };
  const ground = c.groundY, sxOf = (game, o) => c.launchX + o.x - game.cameraX;
  // Test-only canvas records atomic offscreen composition separately from the single on-screen draw.
  const oldCreateElement = scope.document.createElement, stages = [];
  scope.document.createElement = () => {
    const canvas = { width: 0, height: 0, id: 'COMPOSITE', animation: 'IDLE' };
    const scratch = { clearRect() {}, drawImage(image, sx) { stages.push({ id: image.id, sx }); if (IDS.includes(image.id)) { canvas.id = image.id; canvas.animation = image.animation; } } };
    canvas.getContext = () => scratch;
    return canvas;
  };
  // Optional witch back-cloth: the approved character is always drawn over it.
  {
    const def = s.definitions.WITCH_CAPE_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['BOOST', 'CAPE_BACK', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.witchCapeBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'CAPE_BACK', animation: 'CAPE_BACK' }, data };
    install({ BOOST: { IDLE: fakeHD('BOOST', 'IDLE'), USED: fake('BOOST', 'USED') } });
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'BOOST', used: false }];
    game.phaseTime = 0.375; H.Anim.enabled = true; ui.visual.reducedMotion = false;
    let sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['BOOST'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['CAPE_BACK', 288], ['BOOST', 0]], 'cloth is behind original character');
    game.phaseTime = 1.8; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.equal(stages.at(-2).sx, 288, 'loop wraps after eight frames');
    ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.witchCapeBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST'], 'unavailable cloth keeps original');
    s.witchCapeBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'CAPE_BACK' }, data };
    game.objects[0].used = true;
    sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['BOOST']); assert.equal(sprites[0].animation, 'USED', 'contact still takes priority');
    game.objects[0].type = 'BOUNCE'; game.objects[0].used = false;
    install({ BOUNCE: { IDLE: fake('BOUNCE', 'IDLE') } });
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOUNCE'], 'other cast unaffected');
    s.witchCapeBack = null;
    H.Anim.enabled = false;
  }
  // Fighter back-scarf follows the same timing and fallback rules without affecting KICK or the witch.
  {
    const def = s.definitions.FIGHTER_SCARF_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['BOUNCE', 'SCARF_BACK', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.fighterScarfBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'SCARF_BACK', animation: 'SCARF_BACK' }, data };
    install({ BOUNCE: { IDLE: fakeHD('BOUNCE', 'IDLE'), KICK: fake('BOUNCE', 'KICK') }, BOOST: { IDLE: fake('BOOST', 'IDLE') } });
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'BOUNCE', used: false }];
    game.phaseTime = 0.375; H.Anim.enabled = true; ui.visual.reducedMotion = false;
    let sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['BOUNCE'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['SCARF_BACK', 288], ['BOUNCE', 0]], 'scarf behind original fighter');
    game.phaseTime = 1.8; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.equal(stages.at(-2).sx, 288, 'scarf loop wraps');
    ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOUNCE'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.fighterScarfBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOUNCE'], 'missing scarf keeps original');
    s.fighterScarfBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'SCARF_BACK' }, data };
    game.objects[0].used = true; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['BOUNCE']); assert.equal(sprites[0].animation, 'KICK');
    game.objects[0].type = 'BOOST'; game.objects[0].used = false;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST'], 'witch never gets fighter scarf');
    s.fighterScarfBack = null; H.Anim.enabled = false;
  }
  // Thief hair is also behind the original, and appears only for an unused roadside IDLE.
  {
    const def = s.definitions.THIEF_HAIR_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['BRAKE', 'HAIR_BACK', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.thiefHairBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'HAIR_BACK', animation: 'HAIR_BACK' }, data };
    install({ BRAKE: { IDLE: fakeHD('BRAKE', 'IDLE'), USED: fake('BRAKE', 'USED') }, BOOST: { IDLE: fake('BOOST', 'IDLE') }, BOUNCE: { IDLE: fake('BOUNCE', 'IDLE') } });
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'BRAKE', used: false }];
    game.phaseTime = 0.375; H.Anim.enabled = true; ui.visual.reducedMotion = false;
    let sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['BRAKE'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['HAIR_BACK', 288], ['BRAKE', 0]], 'hair behind original thief');
    game.phaseTime = 1.8; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.equal(stages.at(-2).sx, 288, 'hair loop wraps');
    ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BRAKE'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.thiefHairBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BRAKE'], 'missing hair keeps original');
    s.thiefHairBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'HAIR_BACK' }, data };
    log = []; assert(s.drawCastScaled(ctx(), 'BRAKE', 100, 500, 'IDLE'));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['BRAKE'], 'scene rendering does not add roadside hair');
    game.objects[0].used = true; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['BRAKE']); assert.equal(sprites[0].animation, 'USED');
    for (const type of ['BOOST', 'BOUNCE']) {
      game.objects[0].type = type; game.objects[0].used = false;
      assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), [type], 'other cast never gets thief hair');
    }
    s.thiefHairBack = null; H.Anim.enabled = false;
  }
  // Warrior is mirrored: the cape and the original use the same transformed pivot and remain independent of scenes.
  {
    const def = s.definitions.WARRIOR_CAPE_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['DASH', 'CAPE_BACK', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.warriorCapeBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'WARRIOR_CAPE', animation: 'CAPE_BACK' }, data };
    install({ DASH: { IDLE: fakeHD('DASH', 'IDLE') }, BOOST: { IDLE: fake('BOOST', 'IDLE') } });
    log = []; assert(s.drawCast(ctx(), 'DASH', 300, 500, 0, 0.375));
    let sprites = log.filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['DASH'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['WARRIOR_CAPE', 288], ['DASH', 0]], 'cape is behind the original');
    for (const sprite of sprites) {
      assert.equal(sprite.dx, 360); assert.equal(sprite.dy, 390);
      assert.equal(sprite.dw, -120); assert.equal(sprite.dh, 120);
    }
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'DASH', used: false }];
    game.phaseTime = 0.375; H.Anim.enabled = true; ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['DASH'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.warriorCapeBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['DASH'], 'missing cape keeps original');
    s.warriorCapeBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'WARRIOR_CAPE' }, data };
    game.objects[0].used = true; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['DASH']); assert.equal(sprites[0].alpha, 0.35, 'used IDLE remains faded without cape');
    log = []; assert(s.drawCastScaled(ctx(), 'DASH', 100, 500, 'IDLE'));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['DASH'], 'SPECIAL scene has no roadside cape');
    game.objects[0].type = 'BOOST'; game.objects[0].used = false;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST'], 'other cast never gets warrior cape');
    s.warriorCapeBack = null; H.Anim.enabled = false;
  }
  // Sage is mirrored like the warrior; the original and the optional cloak share one foot anchor.
  {
    const def = s.definitions.SAGE_CAPE_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['GUARD', 'CAPE_BACK', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.sageCapeBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'SAGE_CAPE', animation: 'CAPE_BACK' }, data };
    install(Object.fromEntries(['GUARD', 'BOOST', 'BOUNCE', 'BRAKE', 'DASH'].map(id => [id, { IDLE: id === 'GUARD' ? fakeHD(id, 'IDLE') : fake(id, 'IDLE') }])));
    log = []; assert(s.drawCast(ctx(), 'GUARD', 300, 500, 0, 0.375));
    let sprites = log.filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['GUARD'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['SAGE_CAPE', 288], ['GUARD', 0]], 'cloak behind original sage');
    for (const sprite of sprites) {
      assert.equal(sprite.dx, 360); assert.equal(sprite.dy, 390);
      assert.equal(sprite.dw, -120); assert.equal(sprite.dh, 120);
    }
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'GUARD', used: false }];
    game.phaseTime = 0.375; H.Anim.enabled = true; ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['GUARD'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.sageCapeBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['GUARD'], 'missing cloak keeps original');
    s.sageCapeBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'SAGE_CAPE' }, data };
    game.objects[0].used = true; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['GUARD']); assert.equal(sprites[0].alpha, 0.35, 'used IDLE remains faded without cloak');
    log = []; assert(s.drawCastScaled(ctx(), 'GUARD', 100, 500, 'IDLE'));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['GUARD'], 'SPECIAL scene has no roadside cloak');
    for (const type of ['BOOST', 'BOUNCE', 'BRAKE', 'DASH']) {
      game.objects[0].type = type; game.objects[0].used = false;
      assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), [type], 'other cast never gets sage cloak');
    }
    s.sageCapeBack = null; H.Anim.enabled = false;
  }
  // Cleric hair remains behind the unchanged original and stays out of SPECIAL scenes.
  {
    const def = s.definitions.CLERIC_HAIR_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['STOPPER', 'HAIR_BACK', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.clericHairBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'CLERIC_HAIR', animation: 'HAIR_BACK' }, data };
    install(Object.fromEntries(['STOPPER', 'BOOST', 'BOUNCE', 'BRAKE', 'DASH', 'GUARD'].map(id => [id, { IDLE: id === 'STOPPER' ? fakeHD(id, 'IDLE') : fake(id, 'IDLE') }])));
    log = []; assert(s.drawCast(ctx(), 'STOPPER', 300, 500, 0, 0.375));
    let sprites = log.filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['STOPPER'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['CLERIC_HAIR', 288], ['STOPPER', 0]], 'hair behind original cleric');
    for (const sprite of sprites) {
      assert.equal(sprite.dx, 240); assert.equal(sprite.dy, 390);
      assert.equal(sprite.dw, 120); assert.equal(sprite.dh, 120);
    }
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'STOPPER', used: false }];
    game.phaseTime = 0.375; H.Anim.enabled = true; ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['STOPPER'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.clericHairBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['STOPPER'], 'missing hair keeps original');
    s.clericHairBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'CLERIC_HAIR' }, data };
    game.objects[0].used = true; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['STOPPER']); assert.equal(sprites[0].alpha, 0.35, 'used IDLE remains faded without hair');
    log = []; assert(s.drawCastScaled(ctx(), 'STOPPER', 100, 500, 'IDLE'));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['STOPPER'], 'SPECIAL scene has no roadside hair');
    for (const type of ['BOOST', 'BOUNCE', 'BRAKE', 'DASH', 'GUARD']) {
      game.objects[0].type = type; game.objects[0].used = false;
      assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), [type], 'other cast never gets cleric hair');
    }
    s.clericHairBack = null; H.Anim.enabled = false;
  }
  // The merchant only appears as a SPECIAL overlay, at its own scale; no game timers are changed by drawing.
  {
    const def = s.definitions.MERCHANT_HAIR_BACK;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['SPECIAL_ONLY', 'HAIR_BACK', 288, 288, 8, 5, true, 144, 264]);
    assert.equal(metadata.displayScale, C.SPECIAL_ONLY.IDLE.scale);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    s.merchantHairBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'MERCHANT_HAIR', animation: 'HAIR_BACK' }, data };
    install({ SPECIAL_ONLY: { IDLE: fakeHD('SPECIAL_ONLY', 'IDLE') }, BOOST: { IDLE: fake('BOOST', 'IDLE') } });
    log = []; assert(s.drawCast(ctx(), 'SPECIAL_ONLY', 300, 500, 0, 0.375));
    let sprites = log.filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['SPECIAL_ONLY'], 'one atomic composed draw');
    assert.deepEqual(stages.slice(-2).map(e => [e.id, e.sx]), [['MERCHANT_HAIR', 288], ['SPECIAL_ONLY', 0]], 'hair behind original merchant');
    for (const sprite of sprites) {
      assert(Math.abs(sprite.dx - (300 - 48 * C.SPECIAL_ONLY.IDLE.scale)) < 1e-9);
      assert(Math.abs(sprite.dy - (500 - 88 * C.SPECIAL_ONLY.IDLE.scale)) < 1e-9);
      assert(Math.abs(sprite.dw - 96 * C.SPECIAL_ONLY.IDLE.scale) < 1e-9);
      assert(Math.abs(sprite.dh - 96 * C.SPECIAL_ONLY.IDLE.scale) < 1e-9);
    }
    const { game, ui } = scene(); game.objects = []; game.phaseTime = 0.375;
    H.Anim.enabled = true; ui.visual.reducedMotion = false;
    for (const type of ['A', 'B', 'C', 'D']) {
      game.merchantVisual = { type, remaining: 0.6 };
      sprites = render(game, ui).filter(e => e.kind === 'sprite');
      assert.deepEqual(sprites.map(e => e.id), ['SPECIAL_ONLY'], 'merchant type ' + type);
      assert.deepEqual(stages.slice(-2).map(e => e.id), ['MERCHANT_HAIR', 'SPECIAL_ONLY'], 'composed merchant hair behind original');
      assert.equal(game.merchantVisual.remaining, 0.6, 'drawing does not change merchant timer');
    }
    ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['SPECIAL_ONLY'], 'reduced motion draws original only');
    ui.visual.reducedMotion = false; s.merchantHairBack = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['SPECIAL_ONLY'], 'missing hair keeps original');
    s.merchantHairBack = { ready: true, image: { complete: true, naturalWidth: 2304, naturalHeight: 288, id: 'MERCHANT_HAIR' }, data };
    game.merchantVisual = null; game.objects = [{ x: game.body.x + 150, type: 'BOOST', used: false }];
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST'], 'other cast never gets merchant hair');
    log = []; assert(s.drawCastScaled(ctx(), 'SPECIAL_ONLY', 100, 500, 'IDLE'));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['SPECIAL_ONLY'], 'scene and cut-in fallback stay unchanged');
    s.merchantHairBack = null; H.Anim.enabled = false;
  }
  if (oldCreateElement === undefined) delete scope.document.createElement;
  else scope.document.createElement = oldCreateElement;
  s.castCompositeCache = null;
  // Jester uses only generated loop frames in ordinary roadside idle, including at time zero.
  {
    const def = s.definitions.JESTER_IDLE_LOOP;
    const metadata = JSON.parse(fs.readFileSync(path.join(root, def.metadata), 'utf8'));
    assert.deepEqual([metadata.id, metadata.animation, metadata.cellW, metadata.cellH, metadata.frames, metadata.fps, metadata.loop, metadata.pivot.x, metadata.pivot.y],
      ['ANGLE', 'IDLE_LOOP', 288, 288, 8, 5, true, 144, 264]);
    const png = fs.readFileSync(path.join(root, def.src));
    assert.equal(png.readUInt32BE(16), 288 * 8); assert.equal(png.readUInt32BE(20), 288); assert.equal(png[25], 6, 'RGBA PNG');
    const data = s.normalizeCell({ ...metadata });
    const loop = { ready: true, image: { complete: true, naturalWidth: 2304, id: 'JESTER_LOOP', animation: 'IDLE_LOOP' }, data };
    s.jesterIdleLoop = loop;
    install(Object.fromEntries(IDS.map(id => [id, { IDLE: fake(id, 'IDLE'), ...(id === 'ANGLE' ? { USED: fake('ANGLE', 'USED') } : {}) }])));
    const { game, ui } = scene(); game.objects = [{ x: game.body.x + 150, type: 'ANGLE', used: false }];
    H.Anim.enabled = true; ui.visual.reducedMotion = false;
    game.phaseTime = 0;
    let sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['JESTER_LOOP'], 'time zero uses loop frame zero, not original');
    assert.equal(sprites[0].srcX, 0);
    game.phaseTime = 0.4; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['JESTER_LOOP']); assert.equal(sprites[0].srcX, 2 * 288);
    game.phaseTime = 1.6; sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.equal(sprites[0].srcX, 0, 'loop wraps to generated frame zero');
    ui.visual.reducedMotion = true;
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['ANGLE'], 'reduced motion uses original');
    ui.visual.reducedMotion = false; s.jesterIdleLoop = { ready: false };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['ANGLE'], 'missing loop uses original');
    s.jesterIdleLoop = { ...loop, data: { ...data, pivot: { x: 100, y: 264 } } };
    assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), ['ANGLE'], 'invalid pivot uses original');
    s.jesterIdleLoop = loop;
    const badLoopCtx = ctx(), originalDraw = badLoopCtx.drawImage;
    badLoopCtx.drawImage = (image, ...args) => { if (image.id === 'JESTER_LOOP') throw Error('decode lost'); return originalDraw(image, ...args); };
    log = []; assert(s.drawCast(badLoopCtx, 'ANGLE', 300, 500, 0, 0.4));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['ANGLE'], 'failed loop drawing falls back to original');
    game.objects[0].used = true;
    sprites = render(game, ui).filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), ['ANGLE']); assert.equal(sprites[0].animation, 'USED'); assert.equal(sprites[0].alpha, 0.35);
    log = []; assert(s.drawCastScaled(ctx(), 'ANGLE', 100, 500, 'IDLE'));
    assert.deepEqual(log.filter(e => e.kind === 'sprite').map(e => e.id), ['ANGLE'], 'SPECIAL scenes retain original');
    for (const type of IDS.filter(id => id !== 'ANGLE' && id !== 'SPECIAL_ONLY')) {
      game.objects[0].type = type; game.objects[0].used = false;
      assert.deepEqual(render(game, ui).filter(e => e.kind === 'sprite').map(e => e.id), [type], 'other cast never gets jester loop');
    }
    s.jesterIdleLoop = null; H.Anim.enabled = false;
  }
  // 1) All disabled (shipping): exactly today's Canvas calls (same id, position, scale, pose, alpha).
  install();
  {
    const { game, ui } = scene(); const out = render(game, ui).filter(e => e.kind === 'canvas' && e.id !== 'HERO');
    assert.deepEqual(out.map(e => [e.id, e.x, e.feet, e.scale, e.pose, e.alpha]), game.objects.map(o => [o.type, sxOf(game, o), ground, 1.365, o.used ? 1 : 0, o.used ? 0.35 : 1]));
    assert.equal(log.filter(e => e.kind === 'sprite').length, 0);
  }
  // 2) All loaded: sprites replace the Canvas figures at the same feet point; labels and alpha kept.
  const all = Object.fromEntries(IDS.map(id => [id, { IDLE: fake(id, 'IDLE'), ...(USED_POSE[id] ? { [USED_POSE[id]]: fake(id, USED_POSE[id]) } : {}) }]));
  install(all);
  {
    const { game, ui } = scene(); const out = render(game, ui);
    assert.equal(out.filter(e => e.kind === 'canvas' && e.id !== 'HERO').length, 0, 'no Canvas figure when the still is loaded');
    const sprites = out.filter(e => e.kind === 'sprite');
    assert.deepEqual(sprites.map(e => e.id), game.objects.map(o => o.type));
    for (const [i, o] of game.objects.entries()) {
      const e = sprites[i];
      // The DASH and GUARD IDLE stills are mirrored (flip:true; the redesigned BRAKE hook, BOUNCE KICK and ANGLE cane already point to the viewer's right): the 96px cell is centred on the pivot x, so the feet point stays at ox.
      const flip = o.type === 'DASH' || o.type === 'GUARD';
      assert.equal(!!C[o.type][o.used && USED_POSE[o.type] || 'IDLE'].flip, flip, 'manifest flip as expected');
      assert.equal(e.dx, sxOf(game, o) + (flip ? 48 : -48) * 1.25); assert.equal(e.dy, ground - 88 * 1.25); assert.equal(e.dw, (flip ? -96 : 96) * 1.25);
      assert.equal(e.dx + e.dw / 2, sxOf(game, o), 'feet x unchanged (mirrored or not)');
      assert.equal(e.alpha, o.used ? 0.35 : 1, 'used opacity kept'); assert.equal(e.smoothing, false);
      assert.equal(e.animation, o.used && USED_POSE[o.type] || 'IDLE', 'used pose after contact (fighter KICK, witch USED), IDLE otherwise');
      assert(out.some(t => t.kind === 'text' && t.t === H.CAST[o.type].name), 'name label kept');
    }
  }
  // 3) Fighter: KICK missing -> IDLE after contact; IDLE missing -> Canvas (with its kick pose).
  install({ BOUNCE: { IDLE: fake('BOUNCE', 'IDLE') } });
  assert.equal(s.castLayer('BOUNCE', 1).name, 'IDLE'); assert.equal(s.castLayer('BOUNCE', 0).name, 'IDLE');
  install({ BOUNCE: { KICK: fake('BOUNCE', 'KICK') } });
  assert.equal(s.castLayer('BOUNCE', 1).name, 'KICK'); assert.equal(s.castLayer('BOUNCE', 0), null, 'unused fighter without IDLE -> Canvas');
  // 3b) Generic pose-1 mechanism: the witch's USED replaces IDLE only when used (same object.used
  // flag as the opacity), falls back to IDLE, and any character gains a used pose by adding a
  // pose: 1 slot (test-only slot on STOPPER), with no per-character code.
  install(all);
  assert.equal(s.castLayer('BOOST', 0).name, 'IDLE'); assert.equal(s.castLayer('BOOST', 1).name, 'USED');
  assert.equal(s.castLayer('BOUNCE', 0).name, 'IDLE'); assert.equal(s.castLayer('BOUNCE', 1).name, 'KICK');
  assert.equal(s.castLayer('BRAKE', 0).name, 'IDLE'); assert.deepEqual([s.castLayer('BRAKE', 1).name, s.castLayer('BRAKE', 1).flip], ['USED', false], 'thief: USED after contact, hook toward the hero, not mirrored');
  assert.equal(s.castLayer('ANGLE', 0).name, 'IDLE'); assert.deepEqual([s.castLayer('ANGLE', 1).name, s.castLayer('ANGLE', 1).flip], ['USED', false], 'jester: USED after contact, cane toward the hero, not mirrored');
  for (const id of ['DASH', 'GUARD', 'STOPPER', 'SPECIAL_ONLY']) assert.equal(s.castLayer(id, 1).name, 'IDLE', id + ' has no used pose yet');
  install({ BOOST: { IDLE: fake('BOOST', 'IDLE') } }); assert.equal(s.castLayer('BOOST', 1).name, 'IDLE', 'USED missing -> IDLE');
  install({ BOOST: { IDLE: fake('BOOST', 'IDLE'), USED: { ready: false } } }); assert.equal(s.castLayer('BOOST', 1).name, 'IDLE', 'USED broken -> IDLE');
  install({ BRAKE: { IDLE: fake('BRAKE', 'IDLE') } }); assert.equal(s.castLayer('BRAKE', 1).name, 'IDLE', 'thief USED missing -> IDLE');
  install({ BRAKE: { IDLE: fake('BRAKE', 'IDLE'), USED: { ready: false } } }); assert.equal(s.castLayer('BRAKE', 1).name, 'IDLE', 'thief USED broken -> IDLE');
  install({ ANGLE: { IDLE: fake('ANGLE', 'IDLE') } }); assert.equal(s.castLayer('ANGLE', 1).name, 'IDLE', 'jester USED missing -> IDLE');
  install({ ANGLE: { IDLE: fake('ANGLE', 'IDLE'), USED: { ready: false } } }); assert.equal(s.castLayer('ANGLE', 1).name, 'IDLE', 'jester USED broken -> IDLE');
  install({ BOOST: { USED: fake('BOOST', 'USED') } }); assert.equal(s.castLayer('BOOST', 1).name, 'USED'); assert.equal(s.castLayer('BOOST', 0), null, 'unused witch without IDLE -> Canvas');
  {
    install(all);
    const { game, ui } = scene(); game.objects.forEach(o => { o.type = 'BOOST'; });
    const out = render(game, ui).filter(e => e.kind === 'sprite' && e.id === 'BOOST');
    assert.deepEqual(out.map(e => [e.animation, e.alpha]), game.objects.map(o => [o.used ? 'USED' : 'IDLE', o.used ? 0.35 : 1]), 'witch: USED after contact at 35%, IDLE before');
    for (const [i, o] of game.objects.entries()) { assert.equal(out[i].dx, sxOf(game, o) - 48 * 1.25); assert.equal(out[i].dy, ground - 88 * 1.25); }
  }
  {
    install(all);
    for (const type of ['BRAKE', 'ANGLE']) {
    const { game, ui } = scene(); game.objects.forEach(o => { o.type = type; });
    const out = render(game, ui).filter(e => e.kind === 'sprite' && e.id === type);
    assert.deepEqual(out.map(e => [e.animation, e.alpha]), game.objects.map(o => [o.used ? 'USED' : 'IDLE', o.used ? 0.35 : 1]), type + ': USED after contact at 35%, IDLE before');
    for (const [i, o] of game.objects.entries()) { assert.equal(out[i].dx, sxOf(game, o) - 48 * 1.25); assert.equal(out[i].dw, 96 * 1.25); assert.equal(out[i].dy, ground - 88 * 1.25); }
    }
  }
  {
    C.STOPPER.WAVE = { ...C.STOPPER.IDLE, animation: 'WAVE', pose: 1, flip: true };
    install({ ...all, STOPPER: { IDLE: fake('STOPPER', 'IDLE'), WAVE: fake('STOPPER', 'WAVE') } });
    assert.equal(s.castLayer('STOPPER', 0).name, 'IDLE'); assert.deepEqual([s.castLayer('STOPPER', 1).name, s.castLayer('STOPPER', 1).flip], ['WAVE', true], 'pose-1 slot picked generically, with its own flip');
    delete C.STOPPER.WAVE;
  }
  // 4) Mixed / failure: one loaded, others Canvas; a throwing drawImage falls back to Canvas.
  install({ BOOST: { IDLE: fake('BOOST', 'IDLE') } });
  {
    const { game, ui } = scene(); const out = render(game, ui);
    assert.deepEqual(out.filter(e => e.kind === 'sprite').map(e => e.id), ['BOOST']);
    assert.deepEqual(out.filter(e => e.kind === 'canvas' && e.id !== 'HERO').map(e => e.id), IDS.slice(1, 7));
    let threw = 0;
    const failCtx = new Proxy({}, { get: (o, k) => k === 'drawImage' ? () => { threw++; throw new Error('decode lost'); } : () => {}, set: () => true });
    assert.equal(s.drawCast(failCtx, 'BOOST', 100, 500, 0), false); assert.equal(threw, 1);
    s.castAssets.BOOST.IDLE.image = { complete: false, naturalWidth: 96 }; assert.equal(s.drawCast(failCtx, 'BOOST', 100, 500, 0), false, 'not decoded yet');
    assert.equal(s.drawCast(failCtx, 'NOPE', 100, 500, 0), false);
  }
  // 5) flip mirrors around the feet x.
  install(all); assert.equal(C.BRAKE.IDLE.flip, false, 'redesigned thief: hook already on the viewer\'s right, not mirrored');
  assert.equal(C.ANGLE.IDLE.flip, false, 'redesigned jester: cane already on the viewer\'s right, not mirrored');
  assert.equal(C.DASH.IDLE.flip, true, 'warrior still is mirrored (sword right, shield left like the Canvas warrior)');
  { log = []; s.drawCast(ctx(), 'DASH', 300, 500, 0); const e = log[0]; assert.equal(e.dx, 300 + 48 * 1.25); assert.equal(e.dw, -96 * 1.25); }
  C.DASH.IDLE.flip = false;
  { log = []; s.drawCast(ctx(), 'DASH', 300, 500, 0); const e = log[0]; assert.equal(e.dx, 300 - 48 * 1.25); assert.equal(e.dw, 96 * 1.25); }
  C.DASH.IDLE.flip = true;
  // 6) Merchant overlay: SPECIAL_ONLY still at the overlay point and its smaller scale; Canvas when missing.
  for (const loaded of [true, false]) {
    install(loaded ? all : undefined);
    const { game, ui } = scene(); game.objects = []; game.merchantVisual = { type: 'A', remaining: 1 };
    const out = render(game, ui);
    const hx = c.launchX + game.body.x - game.cameraX, hy = ground - c.playerRadius - game.body.y;
    const mx = Math.max(90, Math.min(c.width - 100, hx + 105));
    if (loaded) { const e = out.find(x => x.kind === 'sprite' && x.id === 'SPECIAL_ONLY'); assert(e); assert(Math.abs(e.dx - (mx - 48 * C.SPECIAL_ONLY.IDLE.scale)) < 1e-9); assert(Math.abs(e.dy - (hy + 20 - 88 * C.SPECIAL_ONLY.IDLE.scale)) < 1e-9); assert(!out.some(x => x.kind === 'canvas' && x.id === 'SPECIAL_ONLY')); }
    else assert.deepEqual(out.filter(x => x.kind === 'canvas' && x.id === 'SPECIAL_ONLY').map(x => [x.x, x.feet, x.scale]), [[mx, hy + 20, 1.25]]);
  }
  // 7) Reduced motion does not change CAST drawing (stills); physics identical with and without sprites.
  install(all);
  {
    const a = scene(), b = scene(); b.ui.visual.reducedMotion = true;
    const strip = l => l.filter(e => e.kind === 'sprite' && e.id !== 'HERO').map(e => [e.id, e.dx, e.dy, e.alpha, e.animation]);
    assert.deepEqual(strip(render(b.game, b.ui)), strip(render(a.game, a.ui)));
    const run = assets => { install(assets); const { game, ui } = scene(); for (let i = 0; i < 400; i++) { game.update(1 / 60); ui.update(); render(game, ui); } return JSON.stringify({ body: game.body, objects: game.objects, state: game.state, history: game.history }); };
    assert.equal(run(all), run(undefined), 'physics / contacts unchanged by CAST sprites');
  }
  install(); graphics.character = origChar;
  console.log('Cast sprites PASS: manifest (8 ids, pose-1 used slots BOUNCE KICK + BOOST/BRAKE/ANGLE USED), flag == files, disabled = identical Canvas calls, sprite at the same feet point / 1.25, labels + 35% used opacity, generic used pose (fighter KICK, witch + thief + jester USED, test slot) -> IDLE fallback, merchant overlay, flip, draw failure -> Canvas, reduced motion, physics unchanged.');
}
