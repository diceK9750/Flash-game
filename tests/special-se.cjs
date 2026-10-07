// Per-SPECIAL synthesized SE (WebAudio only, no files). Mock AudioContext: each kind builds its own
// node graph / frequencies, summed peaks stay under the cap, mute / no context / errors never break play.
const assert = require('node:assert/strict');
const { scope, launch } = require('./phase2.cjs');
const H = scope.Hop, A = H.Audio, c = H.CONFIG;
let cases = 0;
const KINDS = ['SPECIAL_BOOST', 'SPECIAL_BOUNCE', 'SPECIAL_DASH', 'SPECIAL_STOPPER', 'SPECIAL_BRAKE', 'SPECIAL_ANGLE', 'SPECIAL_GUARD', 'SPECIAL_MERCHANT'];

// 1) game.js: every SPECIAL success emits its own event; merchant -> SPECIAL_MERCHANT; MISS emits nothing.
{
  const flying = () => { const g = launch(); g.objects = []; g.nextObjectX = g.nextBoundaryX = Infinity; return g; };
  const arm = (g, type, merchantType = null) => { g.special = { type, merchantType, partner: null, remaining: c.specialWindow, entry: { type, label: type }, guardAtContact: 0, velocity: { vx: g.body.vx, vy: g.body.vy } }; };
  const seen = [];
  for (const type of ['BOOST', 'BOUNCE', 'DASH', 'STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) {
    const g = flying(); Object.assign(g.body, { y: 150, stopped: false }); arm(g, type); g.soundEvent = null; g.resolveSpecial(true);
    assert.equal(g.soundEvent, 'SPECIAL_' + type); seen.push(g.soundEvent);
    const m = flying(); arm(m, type); m.soundEvent = null; m.resolveSpecial(false); assert.equal(m.soundEvent, null, type + ' MISS is silent');
  }
  const g = flying(); arm(g, 'DASH', 'B'); g.soundEvent = null; g.resolveSpecial(true); assert.equal(g.soundEvent, 'SPECIAL_MERCHANT'); seen.push(g.soundEvent);
  assert.deepEqual(seen, KINDS); assert.equal(new Set(seen).size, 8);
  cases++;
}

// Mock AudioContext that records the node graph.
function mockContext() {
  const log = [], param = (node, name) => ({ setValueAtTime(v, t) { log.push([node.kind, name, 'set', v, t]); },
    linearRampToValueAtTime(v, t) { log.push([node.kind, name, 'lin', v, t]); }, exponentialRampToValueAtTime(v, t) { assert(v > 0, 'exp ramp > 0'); log.push([node.kind, name, 'exp', v, t]); } });
  const base = kind => { const n = { kind, connect(to) { log.push([kind, 'connect', to.kind || 'destination']); }, disconnect() {} }; return n; };
  const sources = [];
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 8000, destination: { kind: 'destination' }, log, sources,
    createGain() { const n = base('gain'); n.gain = param(n, 'gain'); return n; },
    createOscillator() { const n = base('osc'); n.frequency = param(n, 'frequency'); n.start = t => log.push(['osc', 'start', t]); n.stop = t => { log.push(['osc', 'stop', t]); sources.push(n); }; Object.defineProperty(n, 'type', { set(v) { log.push(['osc', 'type', v]); } }); return n; },
    createBiquadFilter() { const n = base('filter'); n.frequency = param(n, 'frequency'); n.Q = param(n, 'Q'); Object.defineProperty(n, 'type', { set(v) { log.push(['filter', 'type', v]); } }); return n; },
    createBufferSource() { const n = base('noise'); n.start = t => log.push(['noise', 'start', t]); n.stop = t => { log.push(['noise', 'stop', t]); sources.push(n); }; return n; },
    createBuffer(ch, len, rate) { const data = new Float32Array(len); return { length: len, sampleRate: rate, getChannelData: () => data }; }
  };
  return ctx;
}

// 2) Each kind: distinct graph signature (node types + frequencies), durations 0.5..1.0 s, capped peak.
{
  const saved = A.context, wasMuted = A.muted; A.muted = false;
  const signatures = new Map();
  for (const kind of KINDS) {
    const ctx = mockContext(); A.context = ctx; A.noise = null; A.active.clear();
    A.play(kind);
    const log = ctx.log;
    const freqs = log.filter(e => e[1] === 'frequency' && e[2] === 'set').map(e => e[3]);
    const types = log.filter(e => e[1] === 'type').map(e => e[0] + ':' + e[2]);
    const sig = JSON.stringify({ types, freqs });
    assert(freqs.length >= 3, kind + ' has several voices');
    assert(!signatures.has(sig), kind + ' differs from ' + signatures.get(sig)); signatures.set(sig, kind);
    const stops = log.filter(e => e[1] === 'stop').map(e => e[2]);
    const length = Math.max(...stops);
    assert(length >= 0.5 && length <= 1.05, `${kind} lasts ${length.toFixed(2)} s (cut-in length)`);
    // Master gain x worst-case simultaneous voice peaks <= cap (no clipping), and not silent.
    const recipe = A.specialRecipes[kind], master = log.find(e => e[0] === 'gain' && e[1] === 'gain' && e[2] === 'set')[3];
    const worst = A.peakSum(recipe);
    assert(master * worst <= A.specialPeakCap + 1e-9 && master * worst >= 0.05, `${kind} peak ${(master * worst).toFixed(3)}`);
    assert(A.specialPeakCap <= 0.16 + 1e-9);
    // Every source is tracked for mute and connects through a gain to the master -> destination.
    assert.equal(A.active.size, recipe.length, kind + ' sources tracked');
    assert(log.some(e => e[0] === 'gain' && e[1] === 'connect' && e[2] === 'destination'));
    for (const s of ctx.sources) s.onended(); assert.equal(A.active.size, 0, kind + ' cleaned up on end');
  }
  // Content checks (the sound matches the SPECIAL): noise in explosive / strike / wind kinds; chords for STOPPER.
  const kindsOf = k => A.specialRecipes[k].map(v => v[0]);
  for (const k of ['SPECIAL_BOOST', 'SPECIAL_BOUNCE', 'SPECIAL_DASH', 'SPECIAL_BRAKE', 'SPECIAL_ANGLE', 'SPECIAL_MERCHANT']) assert(kindsOf(k).includes('noise'), k + ' uses noise');
  assert(A.specialRecipes.SPECIAL_BOOST.some(v => v[0] === 'tone' && v[6] > v[5] * 4), 'BOOST rising sweep');
  assert.equal(A.specialRecipes.SPECIAL_BOUNCE.filter(v => v[0] === 'noise').length, 3, 'BOUNCE three strikes');
  assert(A.specialRecipes.SPECIAL_BRAKE.some(v => v[0] === 'noise' && v[6] < v[5] / 4), 'BRAKE falling whoosh');
  assert(A.specialRecipes.SPECIAL_STOPPER.filter(v => v[0] === 'tone').length >= 8, 'STOPPER chord + sparkles (grander than the old 3 notes)');
  assert(A.specialRecipes.SPECIAL_ANGLE.filter(v => v[0] === 'noise').length >= 8, 'ANGLE drum roll');
  assert(A.specialRecipes.SPECIAL_MERCHANT.some(v => v[0] === 'tone' && v[5] > 2000), 'MERCHANT bright coin');
  A.context = saved; A.muted = wasMuted; A.noise = null;
  cases++;
}

// 3) Mute, no context, suspended context, broken context: silent and never throws.
{
  const saved = A.context, wasMuted = A.muted;
  A.muted = true; A.context = { get state() { throw Error('muted must not touch audio'); } };
  for (const k of KINDS) A.play(k);
  A.muted = false; A.context = null; for (const k of KINDS) A.play(k);
  const sus = mockContext(); sus.state = 'suspended'; A.context = sus; for (const k of KINDS) A.play(k); assert.equal(sus.log.length, 0, 'suspended = silent');
  A.context = { state: 'running', currentTime: 0, createGain() { throw Error('boom'); } }; for (const k of KINDS) A.play(k);
  // Muting stops SPECIAL voices already playing.
  const live = mockContext(); A.context = live; A.active.clear(); A.play('SPECIAL_STOPPER'); const n = A.active.size; assert(n > 0);
  let stopped = 0; for (const s of A.active) { const orig = s.stop; s.stop = () => { stopped++; }; }
  A.setMuted(true); assert.equal(stopped, n, 'mute stops every SPECIAL voice');
  A.setMuted(wasMuted); A.active.clear(); A.context = saved; A.noise = null;
  cases++;
}

// 4) The noise buffer is deterministic (same SE every time). Legacy SPECIAL / STOPPER / GUARD notes stay covered by controls.cjs.
{
  const ctx = mockContext(); const b1 = A.noiseBuffer(ctx).getChannelData(0).slice(0, 16); A.noise = null;
  const b2 = A.noiseBuffer(ctx).getChannelData(0).slice(0, 16); assert.deepEqual(Array.from(b1), Array.from(b2));
  assert(Array.from(b1).every(v => v >= -1 && v <= 1)); A.noise = null;
  cases++;
}

console.log(JSON.stringify({ specialSe: 'PASS', cases }));
