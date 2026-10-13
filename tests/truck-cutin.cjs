// Launch cut-in (truck x hero, display only): timing, skip, freeze, physics identical to the pre-cut-in
// baseline (fixtures/anim-physics-baseline.json, also asserted unchanged at main 0f722c2 by anim.cjs),
// reduced-motion path, SE / voice hooks (no error when the voice is not approved).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { scope, element } = require('./phase2.cjs');
const H = scope.Hop, c = H.CONFIG, G = H.Graphics;
const ctx = new Proxy({}, { get: (o, k) => o[k] || (() => ({ addColorStop() {} })), set: (o, k, v) => (o[k] = v, true) });
const step = 1 / 60;
let checks = 0;
const rng = seed => { let s = seed; const f = () => { f.calls++; return ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }; f.calls = 0; return f; };
function launched(seed = 1, { angle = 40, power = 1, reduced = false, views = 0, enabled = true } = {}) {
  const r = rng(seed), g = new H.Game(r);
  g.launchCutinEnabled = enabled; g.launchCutinReduced = reduced; g.launchCutinViews = views;
  g.act(); g.angle = angle; g.act(); g.power = power; g.act();
  return { g, r };
}

// Config and beat times.
assert.equal(c.launchCutinEnabled, true);
assert.deepEqual([c.launchCutinDuration, c.launchCutinRepeatDuration, c.launchCutinReducedDuration], [1.5, 0.8, 0.45]);
assert(c.launchCutinDuration >= 1.2 && c.launchCutinDuration <= 1.8 && c.launchCutinReducedDuration <= 0.5);
const T = G.launchCutinTimes({ mode: 'full', total: 1.5 });
assert(Math.abs(T.impact - 0.45) < 1e-9 && Math.abs(T.launch - 0.87) < 1e-9 && Math.abs(T.fade - 1.29) < 1e-9);
const R = G.launchCutinTimes({ mode: 'repeat', total: 0.8 });
assert(R.impact < R.launch && R.launch < R.fade && R.fade < 0.8); checks++;

// Headless default: no cut-in (immediate flight exactly as before).
{ const { g } = launched(1, { enabled: false }); assert.equal(g.launchCutin, null); }
// main.js switches it on for the browser game.
assert(/launchCutinEnabled = true/.test(fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8')));

// Modes: 1st view full, then repeat (per session, kept across RETRY), reduced motion wins.
{
  const { g } = launched(3);
  assert.equal(g.launchCutin.mode, 'full'); assert.equal(g.launchCutin.total, 1.5);
  g.skipLaunchCutin(); g.state = 'RESULT'; g.act(); g.act(); g.act();
  assert.equal(g.state, 'FLYING'); assert.equal(g.launchCutin.mode, 'repeat'); assert.equal(g.launchCutin.total, 0.8);
  assert.equal(g.launchCutinViews, 2);
  const red = launched(3, { reduced: true }).g; assert.equal(red.launchCutin.mode, 'reduced'); assert.equal(red.launchCutin.total, 0.45);
  checks++;
}
// Intensity tiers follow power.
assert.equal(H.Game.launchCutinIntensity(c.powerMin).tier, 'NORMAL');
assert.equal(H.Game.launchCutinIntensity(0.7).tier, 'STRONG');
assert.equal(H.Game.launchCutinIntensity(1).tier, 'MAX');
assert.equal(H.Game.launchCutinIntensity(1).intensity, 1); checks++;

// Deterministic timing + full freeze (body, camera, RNG) for each mode.
for (const [opts, frames] of [[{}, 90], [{ views: 1 }, 48], [{ reduced: true }, 27]]) {
  const { g, r } = launched(5, opts), body = JSON.stringify(g.body), calls = r.calls, objs = JSON.stringify(g.objects);
  let n = 0;
  while (g.launchCutin) { g.update(step); n++; if (g.launchCutin) { assert.equal(JSON.stringify(g.body), body); assert.equal(r.calls, calls); } }
  assert.equal(n, frames, JSON.stringify(opts)); assert.equal(JSON.stringify(g.objects), objs);
  assert.equal(g.state, 'FLYING'); checks++;
}

// Skip: a tap ends it at once, flight continues from the same launch state; the next tap is a normal AERIAL.
{
  const { g } = launched(7); for (let i = 0; i < 10; i++) g.update(step);
  const body = JSON.stringify(g.body), cut = g.launchCutin; g.act();
  assert.equal(g.launchCutin, null); assert.equal(cut.skipped, true); assert.equal(JSON.stringify(g.body), body);
  assert.equal(g.upRemaining, c.aerialUpUses, 'the skip tap is not an AERIAL'); checks++;
}

// Style: reduced = no shake / flash, ≤ 0.5 s; full = flash + hit-stop + shake at impact; MAX shakes harder.
const peak = (k, mode = 'full', rm = false) => {
  const total = mode === 'reduced' ? 0.45 : mode === 'repeat' ? 0.8 : 1.5; let shake = 0, flash = 0, hit = 0; const beats = new Set();
  for (let t = 0; t < total; t += 1 / 240) { const s = G.launchCutinStyle({ mode, total, elapsed: t, intensity: k }, rm); shake = Math.max(shake, Math.hypot(s.shakeX, s.shakeY)); flash = Math.max(flash, s.flash); if (s.hitStop) hit++; beats.add(s.beat); }
  return { shake, flash, hit, beats: [...beats] };
};
{
  const red = peak(1, 'reduced'); assert.equal(red.shake, 0); assert.equal(red.flash, 0); assert.deepEqual(red.beats, ['still']);
  const rmFull = peak(1, 'full', true); assert.equal(rmFull.shake, 0); assert.equal(rmFull.flash, 0);
  const max = peak(1), low = peak(0);
  assert.deepEqual(max.beats, ['approach', 'impact', 'launch', 'fade']);
  assert(max.flash >= 0.8 && max.hit > 0 && max.shake > low.shake * 1.8, JSON.stringify([max, low]));
  assert.deepEqual(peak(0.6, 'repeat').beats, ['approach', 'impact', 'launch', 'fade']);
  assert.equal(G.launchCutinStyle({ mode: 'full', total: 1.5, elapsed: 1.5, intensity: 1 }).visible, false);
  assert.deepEqual(G.launchCutinStyle({ mode: 'full', total: 1.5, elapsed: 0.6, intensity: 0.7 }), G.launchCutinStyle({ mode: 'full', total: 1.5, elapsed: 0.6, intensity: 0.7 }));
  checks++;
}

// Physics / distance identical to the baseline over fixed seeds (same runs as anim.cjs), with the cut-in drawn
// every frame (full / repeat / reduced, played out or skipped) before the baseline input sequence starts.
{
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'anim-physics-baseline.json'), 'utf8'));
  for (const variant of ['play', 'skip']) {
    const out = [];
    for (let seed = 1; seed <= 24; seed++) {
      let s = seed; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
      const g = new H.Game(rnd); g.launchCutinEnabled = true; g.launchCutinReduced = seed % 3 === 0; g.launchCutinViews = seed % 4 === 1 ? 1 : 0;
      g.act(); g.angle = 20 + seed * 2; g.act(); g.power = 0.5 + (seed % 5) / 10; g.act();
      assert(g.launchCutin);
      const visual = { launchAt: -Infinity, contactAt: -Infinity, reducedMotion: seed % 3 === 0, readyTargets: [] };
      for (let i = 0; g.launchCutin; i++) { g.update(step); G.draw(ctx, g, visual); if (variant === 'skip' && i === 5 + seed % 7 && g.launchCutin) g.act(); }
      visual.launchAt = g.phaseTime;
      for (let i = 0; i < 20000 && g.state === 'FLYING'; i++) { g.update(1 / 60); if (seed % 2 && i % 37 === 0) g.act(); G.draw(ctx, g, visual); }
      out.push([g.state, g.finalDistance, g.body.x, g.body.bounces, g.specialSuccesses]);
    }
    assert.deepEqual(out, baseline, variant); checks++;
  }
}

// UI hooks: impact SE + hero_launch voice once at the IMPACT beat; flight clock starts after the cut-in.
const originalVoice = H.Voice, originalPlay = H.Audio.play;
try {
  const run = (voice, opts = {}) => {
    const se = [];
    H.Audio.play = kind => se.push(kind); H.Voice = voice;
    const g = new H.Game(rng(9)), ui = new H.UI(g, element('canvas'));
    g.launchCutinEnabled = true; ui.visual.reducedMotion = !!opts.reduced; ui.update();
    g.act(); ui.update(); g.act(); ui.update(); g.power = opts.power ?? 1; g.act(); ui.update();
    assert(g.launchCutin); assert.equal(g.launchCutin.mode, opts.reduced ? 'reduced' : 'full');
    assert.equal(ui.visual.launchAt, -Infinity, 'flight clock waits for the cut-in');
    const impact = G.launchCutinTimes(g.launchCutin).impact; let seAt = null, frames = 0;
    while (g.launchCutin) {
      if (opts.skipAt === frames) { g.act(); ui.update(); break; }
      g.update(step); ui.update(); ui.draw(); frames++;
      if (se.length && seAt === null) seAt = frames * step;
    }
    ui.update(); ui.draw();
    assert(Number.isFinite(ui.visual.launchAt), 'flight clock starts at the end');
    for (let i = 0; i < 30; i++) { g.update(step); ui.update(); ui.draw(); }
    return { se, seAt, impact };
  };
  const heard = [], launches = () => heard.filter(h => h[0] === 'hero_launch');
  const ok = run({ play: (id, d, e) => heard.push([id, e]), stop() {}, unlock() {} });
  assert.deepEqual(ok.se, ['LAUNCH_IMPACT_MAX']); assert.deepEqual(launches(), [['hero_launch', 'AIM_POWER_TO_FLYING']]);
  assert(ok.seAt >= ok.impact - 1e-9 && ok.seAt < ok.impact + 2 * step, JSON.stringify(ok));
  heard.length = 0;
  const low = run({ play: (id, d, e) => heard.push([id, e]), stop() {} }, { power: c.powerMin });
  assert.deepEqual(low.se, ['LAUNCH_IMPACT']); assert.equal(launches().length, 1);
  heard.length = 0;
  const skipped = run({ play: (id, d, e) => heard.push([id, e]), stop() {} }, { skipAt: 3 });
  assert.deepEqual(skipped.se, ['LAUNCH_IMPACT_MAX'], 'skip still lands the hit'); assert.equal(launches().length, 1);
  // Voice not approved / throwing / missing: never an error.
  run({ play() { throw new Error('not approved'); }, stop() { throw new Error('x'); } });
  run(undefined, { reduced: true });
  run(originalVoice);
  checks++;
} finally { H.Voice = originalVoice; H.Audio.play = originalPlay; }

// Impact SE recipes exist, stay under the shared peak cap, and do not change the SPECIAL / combo tables.
for (const kind of ['LAUNCH_IMPACT', 'LAUNCH_IMPACT_MAX']) {
  const v = H.Audio.launchRecipes[kind]; assert(v.length >= 6); assert(!H.Audio.specialRecipes[kind] && !H.Audio.comboRecipes[kind]);
  for (const [type, t, d, p] of v) assert((type === 'tone' || type === 'noise') && t >= 0 && d > 0 && p > 0);
}
assert(!/[A-Za-z0-9_]+\.(?:png|jpe?g|webp|mp3|wav|ogg)/.test(fs.readFileSync(path.join(__dirname, '..', 'js', 'graphics.js'), 'utf8').match(/launchCutinTimes[\s\S]*?\n  launchCutin\(ctx[\s\S]*?\n  },/)[0]), 'no new assets');
checks++;
console.log(`truck-cutin PASS (${checks} groups: timing, modes, freeze, skip, style, baseline x2, UI hooks, SE)`);
