// Long scene noise must not run out of PCM before its scheduled envelope ends.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const scope = { Hop: {}, window: { localStorage: { getItem: () => null, setItem() {} } }, document: { addEventListener() {} } };
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8'), scope);
const A = scope.Hop.Audio;
function context(sampleRate = 8000) {
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true; }, gain: param(), frequency: param(), Q: param() });
  const sources = [];
  const source = type => {
    const n = { ...node(), type, stops: [], start(at) { this.started = at; }, stop(at) { this.stops.push(at); } };
    sources.push(n); return n;
  };
  return { state: 'running', currentTime: 10, sampleRate, destination: {}, sources, allocations: 0,
    createGain: node, createBiquadFilter: node,
    createOscillator: () => source('tone'), createBufferSource: () => source('noise'),
    createBuffer(channels, length, rate) {
      this.allocations++;
      const data = new Float32Array(length);
      return { length, sampleRate: rate, duration: length / rate, getChannelData: () => data };
    }
  };
}
// Independent legacy generator: exact samples, not just matching seeds or a checksum.
for (const rate of [8000, 44100]) {
  const ctx = context(rate), expected = new Float32Array(rate);
  let seed = 0x2f6b1d;
  for (let i = 0; i < expected.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    expected[i] = seed / 2147483648 - 1;
  }
  const short = A.noiseBuffer(ctx, 0.1);
  assert.deepEqual(short.getChannelData(0), expected, 'short SE keeps every legacy sample');
  assert.equal(short.duration, 1, 'minimum one second');
  const long = A.noiseBuffer(ctx, 1.22);
  assert(long.duration >= 1.22);
  assert.deepEqual(long.getChannelData(0).slice(0, rate), expected, 'long buffer retains legacy prefix');
  assert.equal(A.noiseBuffer(ctx, 1.2), long, 'sufficient cached buffer reused');
  assert.equal(A.noiseBuffer(ctx, 0.5), long, 'shorter requests reuse cache');
  assert.equal(ctx.allocations, 2);
  const longer = A.noiseBuffer(ctx, 1.33333);
  assert.notEqual(longer, long); assert(longer.duration >= 1.33333, 'round up partial samples');
  const other = context(rate);
  assert.notEqual(A.noiseBuffer(other, 1.33333), longer, 'different context gets a fresh buffer');
  assert.equal(other.allocations, 1);
}
const kinds = ['COMBO_WITCH', 'GRAND_DASH', 'GRAND_STOPPER', 'GRAND_BRAKE', 'GRAND_ANGLE', 'GRAND_GUARD'];
let longVoices = 0;
for (const kind of kinds) for (const rate of [1, 1.5]) {
  const ctx = context(); A.context = ctx; A.active.clear(); A.noise = null;
  const track = A.render(ctx, kind, 10, { rate });
  assert.equal(track.sources.length, A.comboRecipes[kind].length);
  for (let i = 0; i < track.sources.length; i++) {
    const source = track.sources[i], voice = A.comboRecipes[kind][i], duration = voice[2] / rate;
    assert.equal(source.started, 10 + voice[1] / rate, 'schedule unchanged');
    assert.equal(source.stops[0], source.started + duration + 0.02, 'envelope end unchanged');
    if (voice[0] !== 'noise') continue;
    assert(source.buffer.duration >= duration + 0.02, kind + ' PCM covers scheduled stop');
    assert(!source.loop, 'no noise loop seam');
    if (voice[2] === 1.2) longVoices++;
  }
  assert.equal(A.active.size, track.sources.length);
  A.setMuted(true);
  assert(track.sources.every(source => source.stops.at(-1) === undefined), 'mute immediately stops all sources');
  const allocated = ctx.sources.length;
  A.play(kind); A.playCombo(kind);
  assert.equal(ctx.sources.length, allocated, 'muted playback creates no new sources');
  for (const source of track.sources) source.onended();
  assert.equal(A.active.size, 0, 'ended sources leave active set');
  assert(track.sources.every(source => source.disconnected), 'source graph cleaned up');
  assert(track.disconnected, 'master cleaned up');
  A.setMuted(false);
}
assert.equal(longVoices, 12, 'six long noise voices covered at both rates');
console.log('noise-duration PASS: six scenes x two rates, exact legacy PCM prefix, duration/cache/context/mute/cleanup');
