// HERO sprite transitions in the real game loop (test-only, display-only checks).
// Seeded headless runs drive Game + UI + Graphics with real assets/JSON (fake Image/fetch read the
// repo files), tap like a player (aim, AERIAL, SPECIAL, RETRY) at 30/60/120/144 Hz, record which
// HERO layer is drawn every frame and assert: exactly one hero per frame, one-shots only inside
// their window with the right frame, priority (SPECIAL_REACTION is not cut by GROUND_BOUNCE /
// AERIAL / HIT), no flicker, no stuck one-shot, no tilt pops from one-shot hand-offs, no stale
// sprite after RESULT/RETRY, reduced motion = representative still, missing assets = fallback.
// node tests/hero-transitions.cjs [--runs N] [--log file.csv] [--json stats.json]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const KEYS = { heroIdle: 'IDLE', heroFlight: 'FLIGHT_LOOP', heroAerialUp: 'AERIAL_UP', heroAerialDown: 'AERIAL_DOWN', heroGroundBounce: 'GROUND_BOUNCE', heroHit: 'HIT', heroSpecialReaction: 'SPECIAL_REACTION', heroStopResult: 'STOP_RESULT' };

function context({ offline = false } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { id, setAttribute(k, v) { this[k] = v; }, textContent: '', hidden: false, className: '', value: 0, style: {}, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }, getContext: () => recorder() });
    return elements.get(id);
  };
  class Image {
    set src(value) {
      this._src = value;
      setImmediate(() => {
        try { const png = fs.readFileSync(path.join(root, value)); this.naturalWidth = png.readUInt32BE(16); this.naturalHeight = png.readUInt32BE(20); this.complete = true; this.onload(); }
        catch (e) { this.onerror(e); }
      });
    }
    get src() { return this._src; }
  }
  const fetch = async url => {
    if (offline) return { ok: false, json: async () => ({}) };
    const file = path.join(root, url);
    if (!fs.existsSync(file)) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
  };
  const scope = { document: { getElementById: element, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } }, requestAnimationFrame() {}, Image, fetch, console, Date };
  scope.window = scope;
  vm.createContext(scope);
  for (const name of ['config', 'physics', 'game', 'sprites', 'graphics', 'ui', 'audio', 'input']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8'), scope, { filename: name });
  }
  return { scope, element };
}

// Canvas stub that tracks the rotation stack and reports HERO draws to `rec`.
let rec = null;
function recorder() {
  let rot = 0; const stack = [];
  const dummy = new Proxy(function () {}, { get: (o, k) => k === 'width' ? 0 : dummy, apply: () => dummy });
  const impl = {
    save() { stack.push(rot); }, restore() { rot = stack.length ? stack.pop() : 0; },
    rotate(a) { rot += a; }, measureText: () => ({ width: 0 }),
    drawImage(image, sx) { if (rec) rec.draws.push({ src: image._src || image.src, sx, rot }); },
    get rotation() { return rot; }
  };
  return new Proxy({}, { get: (o, k) => k in impl ? impl[k] : k in o ? o[k] : () => dummy, set: (o, k, v) => (o[k] = v, true) });
}

function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }

async function simulate({ runs = 60, seed0 = 1, log = null } = {}) {
  const { scope, element } = context();
  const H = scope.Hop, S = H.Sprites, ST = H.STATES;
  await Promise.all([S.idleReady, S.ready, S.aerialReady, S.groundBounceReady, S.stopResultReady, S.hitReady, S.specialReactionReady]);
  for (const key of Object.keys(KEYS)) assert(S[key]?.ready, key + ' loads from the real files');
  const real = Object.fromEntries(Object.keys(KEYS).map(k => [k, S[k]]));
  const bySrc = Object.fromEntries(Object.keys(KEYS).map(k => [real[k].image._src, k]));
  const origChar = H.Graphics.character;
  H.Graphics.character = function (ctx, id, ...rest) { if (id === 'HERO' && rec) rec.draws.push({ src: 'CANVAS', rot: ctx.rotation }); return origChar.call(this, ctx, id, ...rest); };
  const stats = { runs: 0, flights: 0, frames: 0, byHz: {}, shown: {}, starts: {}, completed: {}, interrupted: {}, transitions: {}, blocked: {}, canvasEdges: {}, shortLoopGaps: {}, shortOneShots: {}, resultEntry: {}, specialSuccessEdges: 0, srStarts: 0, reducedFrames: 0, missingRuns: 0, issues: [] };
  const issue = (kind, info) => { stats.issues.push({ kind, ...info }); };
  const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const out = log ? fs.createWriteStream(log) : null;
  if (out) out.write('run,flight,hz,t,state,layer,frame,rot,shot\n');
  for (let run = 0; run < runs; run++) {
    const seed = seed0 + run, R = rng(seed * 7919 + 3);
    const hz = [30, 60, 120, 144][run % 4]; inc(stats.byHz, hz);
    const reduced = R() < 0.15, debug = R() < 0.3, mash = R() < 0.35;
    // Missing-asset runs: drop one or all optional assets (FLIGHT_LOOP included) for this run.
    const keys = Object.keys(KEYS); const missing = R() < 0.2 ? (R() < 0.25 ? keys : [keys[Math.floor(R() * keys.length)]]) : [];
    for (const k of Object.keys(KEYS)) S[k] = missing.includes(k) ? { ready: false, image: null, data: null } : real[k];
    if (missing.length) stats.missingRuns++;
    const game = new H.Game(rng(seed)), ui = new H.UI(game, element('canvas'));
    ui.visual.reducedMotion = reduced;
    if (debug) game.toggleDebug();
    let wait = 0.3 + R(), pendingSpecial = null, flight = 0, prev = null, lastSpecialMsg = null, history = [];
    const tap = () => { game.act(); ui.update(); };
    const maxFlights = 3;
    let t = 0;
    while (flight <= maxFlights && t < 400) {
      const dt = 1 / hz * (R() < 0.02 ? 3 : 1); t += dt;
      const s0 = game.state;
      // Player policy.
      if (s0 === ST.READY || s0 === ST.AIM_ANGLE || s0 === ST.AIM_POWER || s0 === ST.RESULT) {
        wait -= dt;
        if (wait <= 0) {
          if (s0 === ST.RESULT || s0 === ST.READY) flight++;
          if (flight > maxFlights) break;
          tap(); wait = s0 === ST.AIM_ANGLE ? 0.2 + R() * 1.7 : 0.2 + R() * 2.2;
        }
      } else if (s0 === ST.FLYING) {
        if (game.special && !pendingSpecial) pendingSpecial = { at: game.phaseTime + 0.05 + R() * (R() < 0.85 ? 0.8 : 1.4), sp: game.special };
        if (pendingSpecial && game.special === pendingSpecial.sp && game.phaseTime >= pendingSpecial.at) { tap(); if (mash) wait = -(0.08 + R() * 0.5); pendingSpecial = null; }
        else if (!game.special) {
          pendingSpecial = null;
          if (wait < 0) { wait += dt; if (wait >= 0) tap(); }
          else if (R() < 0.6 * dt) tap();
        }
        if (game.phaseTime > 120 && !game.body.stopped) { game.finish(); }
      }
      game.update(dt); ui.update();
      rec = { draws: [] }; ui.draw(); const draws = rec.draws; rec = null;
      const g = game, v = ui.visual, st = g.state;
      if (st === ST.RESULT && s0 !== ST.RESULT) { wait = 0.3 + R() * 1.8; inc(stats.resultEntry, !g.body.stopped ? 'not stopped (test time cap)' : g.body.y <= S.definitions.HERO.STOP_RESULT.maxGroundY ? 'stopped on ground' : 'stopped mid-air (STOPPER)'); }
      // --- per-frame record ---
      const heroDraws = draws.filter(d => d.src === 'CANVAS' || bySrc[d.src]);
      if (heroDraws.length !== 1) issue('hero-count', { seed, t, st, n: heroDraws.length });
      const d = heroDraws[0] || {};
      const key = d.src === 'CANVAS' ? null : bySrc[d.src];
      const layer = key ? KEYS[key] : 'CANVAS';
      const frame = key ? Math.round(d.sx / (S[key].data?.frameWidth || 96)) : -1;
      const shot = v.oneShot?.animation || '';
      stats.frames++; inc(stats.shown, layer); if (reduced) stats.reducedFrames++;
      if (out) out.write(`${run},${flight},${hz},${g.phaseTime.toFixed(4)},${st},${layer},${frame},${(d.rot || 0).toFixed(3)},${shot}\n`);
      // Expected layer (independent model of the documented rules).
      let expect = 'CANVAS';
      const stopOk = S.heroStopResult.ready && S.stopResultEligible(g);
      const prelaunch = st === ST.READY || st === ST.AIM_ANGLE || st === ST.AIM_POWER;
      if (stopOk) expect = 'STOP_RESULT';
      else if (st === ST.FLYING) {
        const name = v.oneShot?.animation, asset = name && S[S.oneShots[name]];
        const age = name ? g.phaseTime - v.oneShot.at : -1;
        expect = name && asset?.ready && age >= 0 && age < S.duration(asset.data) ? name : S.heroFlight.ready ? 'FLIGHT_LOOP' : 'CANVAS';
      } else if (st === ST.RESULT && S.heroFlight.ready) expect = 'FLIGHT_LOOP'; // frozen (Phase B)
      else if (prelaunch && S.heroIdle?.ready) expect = 'IDLE';
      if (layer !== expect) issue('layer', { seed, t, st, layer, expect });
      if (st === ST.RESULT && prev?.run === run && prev.st === ST.RESULT && layer === 'FLIGHT_LOOP' && prev.layer === layer && frame !== prev.frame) issue('result-not-frozen', { seed });
      if (prelaunch && layer !== expect) issue('sprite-before-launch', { seed, st, layer, expect });
      if (reduced && key && layer !== 'STOP_RESULT') {
        const still = layer === 'FLIGHT_LOOP' ? 0 : S.frameAt(S[key].data, S.definitions.HERO[layer].stillTime || 0);
        if (frame !== still) issue('reduced-frame', { seed, layer, frame, still });
        if (Math.abs(d.rot || 0) > 1e-9) issue('reduced-rot', { seed, layer });
      }
      if (reduced && layer === 'STOP_RESULT' && frame !== S.frameAt(S.heroStopResult.data, 99)) issue('reduced-stop', { seed, frame });
      // Transition bookkeeping.
      if (prev && prev.run === run) {
        if (prev.layer !== layer) {
          inc(stats.transitions, prev.layer + '>' + layer); if (layer === 'CANVAS' || prev.layer === 'CANVAS') inc(stats.canvasEdges, prev.st + ':' + prev.layer + '>' + st + ':' + layer + (missing.length ? ' (missing ' + (missing.length > 1 ? 'all' : missing[0]) + ')' : ''));
          history.push({ layer, t: g.phaseTime, st });
          // Flicker: A -> B -> A within 3 frames (STOP_RESULT/RESULT edges excluded).
          const h = history.slice(-3);
          // Flicker: a one-shot replaced before it was shown for minShow (minus one frame), or an
          // A -> B -> A bounce of a non-FLIGHT_LOOP layer. Short FLIGHT_LOOP gaps between two
          // one-shots (one ended, the next event came right after) are natural and only counted.
          if (h.length === 3 && h[0].layer === h[2].layer && h[2].t - h[1].t < S.minShow - 1 / hz - 1e-9 && h[1].st === st) {
            if (h[1].layer === 'FLIGHT_LOOP' || h[1].layer === 'CANVAS') inc(stats.shortLoopGaps, h.map(x => x.layer).join('>'));
            else inc(stats.shortOneShots, h.map(x => x.layer).join('>'));
          }
        }
        // One-shot frame order: inside one shot instance the sequence step never goes back.
        if (key && v.oneShot && layer === prev.layer && prev.shotAt === v.oneShot.at && layer !== 'FLIGHT_LOOP' && layer !== 'STOP_RESULT' && layer !== 'IDLE' && !reduced) {
          const seq = S[key].data.sequence || [...Array(8).keys()];
          const step = Math.min(seq.length - 1, Math.floor((g.phaseTime - v.oneShot.at) * 12));
          if (seq[step] !== frame) issue('frame', { seed, layer, frame, want: seq[step] });
        }
        // Tilt pops: rotation jump not explained by a velocity jump (bounce / contact / special).
        // The tilt weight (display) must change no faster than its 0.12 s ease; a velocity impulse
        // (bounce, contact, AERIAL, SPECIAL) may rotate at once, a one-shot hand-off may not.
        // GROUND_BOUNCE / HIT snap upright by design (they start on a bounce / at launch).
        const w = S.tiltWeight(v, g.phaseTime), dRot = Math.abs((d.rot || 0) - prev.rot);
        const snapByDesign = v.oneShot && v.oneShot !== prev.shotObj && ['GROUND_BOUNCE', 'HIT'].includes(v.oneShot.animation);
        if (st === ST.FLYING && prev.st === ST.FLYING && !reduced && !snapByDesign && Math.abs(w - prev.w) > dt / 0.12 + 0.02 && dRot > 0.03) issue('tilt-pop', { seed, t: g.phaseTime, dW: +(w - prev.w).toFixed(3), dRot: +dRot.toFixed(3), layer, prevLayer: prev.layer, shot });
        stats.maxTiltRate = Math.max(stats.maxTiltRate || 0, st === ST.FLYING && prev.st === ST.FLYING && !snapByDesign ? Math.abs(w - prev.w) / dt : 0);
      }
      // One-shot lifecycle (from visual.oneShot changes).
      const prevShot = prev && prev.run === run ? prev.shotObj : null;
      if (v.oneShot && v.oneShot !== prevShot) {
        inc(stats.starts, v.oneShot.animation);
        if (prevShot && st === ST.FLYING) {
          const pa = S[S.oneShots[prevShot.animation]];
          if (pa?.ready && g.phaseTime - prevShot.at < S.duration(pa.data) - 1e-9) {
            inc(stats.interrupted, prevShot.animation + '<-' + v.oneShot.animation);
            const P = S.oneShotPriority, age = g.phaseTime - prevShot.at;
            if (age < S.minShow - 1e-9 && (P[v.oneShot.animation] || 0) <= (P[prevShot.animation] || 0)) issue('flicker', { seed, seq: prevShot.animation + '>' + v.oneShot.animation, ageMs: Math.round(age * 1000) });
            if (prevShot.animation === 'SPECIAL_REACTION' && v.oneShot.animation !== 'SPECIAL_REACTION') issue('special-cut', { seed, by: v.oneShot.animation, age: +(g.phaseTime - prevShot.at).toFixed(3) });
          }
        }
      }
      if (prevShot && prevShot === v.oneShot) {
        const pa = S[S.oneShots[prevShot.animation]];
        if (pa?.ready && prev.layer === prevShot.animation && layer !== prevShot.animation && st === ST.FLYING && !stopOk) inc(stats.completed, prevShot.animation);
      }
      // Blocked AERIAL sprites (priority / minShow): the AERIAL itself (physics, effect line) happened.
      if (prev && prev.run === run && st === ST.FLYING && g.effect && g.effect !== prev.effect && /^AERIAL /.test(g.effect.label)) {
        const want = g.effect.label.replace(' ', '_');
        if (v.oneShot?.animation !== want && S[S.oneShots[want]]?.ready) inc(stats.blocked, want + ' (during ' + (prev.shotObj?.animation || '?') + ')');
      }
      // SPECIAL SUCCESS panel edges vs SPECIAL_REACTION starts.
      if (st === ST.FLYING && g.specialMessage && g.specialMessage !== lastSpecialMsg && g.specialMessage.label === 'SPECIAL SUCCESS') {
        stats.specialSuccessEdges++;
        if (S.heroSpecialReaction.ready && v.oneShot?.animation !== 'SPECIAL_REACTION') issue('special-no-reaction', { seed, detail: g.specialMessage.detail, merchant: !!g.merchantStats.lastType });
        else if (S.heroSpecialReaction.ready) stats.srStarts++;
      }
      lastSpecialMsg = g.specialMessage;
      // Stuck one-shot: drawn longer than its duration + one frame.
      if (key && !['FLIGHT_LOOP', 'STOP_RESULT'].includes(layer) && v.oneShot && g.phaseTime - v.oneShot.at > S.duration(S[key].data) + 1 / hz + 1e-6) issue('stuck', { seed, layer });
      // After RETRY no stale one-shot / stop clock.
      if (st !== ST.FLYING && st !== ST.RESULT && (v.oneShot || Number.isFinite(v.stopAt))) issue('stale-after-retry', { seed, st });
      if (st === ST.FLYING && s0 === ST.AIM_POWER) stats.flights++;
      prev = { run, frame, effect: g.effect, layer, rot: d.rot || 0, vy: g.body.vy, w: H.Sprites.tiltWeight(v, g.phaseTime), st, shotObj: v.oneShot, shotAt: v.oneShot?.at };
    }
    stats.runs++;
  }
  for (const k of Object.keys(KEYS)) S[k] = real[k];
  H.Graphics.character = origChar;
  if (out) await new Promise(r => out.end(r));
  return stats;
}

if (process.argv.includes('--sim')) {
  (async () => {
    const runs = +arg('--runs', 24);
    const stats = await simulate({ runs, log: arg('--log', null) });
    const byKind = {}; for (const i of stats.issues) byKind[i.kind] = (byKind[i.kind] || 0) + 1;
    stats.issueCounts = byKind;
    const json = arg('--json', null);
    if (json) fs.writeFileSync(json, JSON.stringify({ ...stats, issues: stats.issues.slice(0, 400) }, null, 1));
    if (process.argv.includes('--report')) { console.log(JSON.stringify({ ...stats, issues: stats.issues.slice(0, 30) }, null, 1)); return; }
    assert.deepEqual(byKind, {}, JSON.stringify(stats.issues.slice(0, 10)));
    assert(stats.flights >= runs * 2, 'enough flights');
    for (const name of ['FLIGHT_LOOP', 'HIT', 'AERIAL_UP', 'AERIAL_DOWN', 'GROUND_BOUNCE', 'SPECIAL_REACTION', 'STOP_RESULT', 'CANVAS']) assert(stats.shown[name] > 0, name + ' shown');
    assert(stats.srStarts > 0 && stats.reducedFrames > 0 && stats.missingRuns > 0);
    console.log(`Hero transitions PASS: ${stats.runs} seeded runs, ${stats.flights} flights, ${stats.frames} frames at 30/60/120/144Hz; ` +
      `${stats.srStarts} SPECIAL reactions, priority, frames, flicker, tilt, RESULT/RETRY, reduced motion, missing assets.`);
  })().catch(e => { console.error(e); process.exitCode = 1; });
} else {
  const child = require('node:child_process').spawnSync(process.execPath, [__filename, '--sim', '--runs', '24'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr + child.stdout); process.stdout.write(child.stdout);
}
module.exports = { context, simulate };
