// HERO launch voice is isolated from game progression; async load errors must remain harmless.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { scope, element, launch } = require('./phase2.cjs');

// The UI transition hook fires once per launch, never during aim or repeated frames.
{
  const game = new scope.Hop.Game(), ui = new scope.Hop.UI(game, element('canvas'));
  const original = scope.Hop.Voice.play, originalStop = scope.Hop.Voice.stop, heard = [], stopped = [];
  scope.Hop.Voice.play = (id, debug, event) => heard.push([id, debug, event]);
  scope.Hop.Voice.stop = () => stopped.push(true);
  game.act(); ui.update(); assert.equal(game.state, 'AIM_ANGLE'); assert.equal(heard.length, 0);
  game.act(); ui.update(); assert.equal(game.state, 'AIM_POWER'); assert.equal(heard.length, 0);
  game.act(); ui.update(); ui.update(); assert.equal(game.state, 'FLYING'); assert.deepEqual(heard, [['hero_launch', false, 'AIM_POWER_TO_FLYING']]);
  game.finish(); ui.update(); assert.equal(stopped.length, 1, 'RESULT stops current voice before the result line');
  assert.deepEqual(heard.at(-1), ['hero_stop', false, 'FLYING_TO_RESULT']);
  game.act(); ui.update(); game.act(); ui.update(); game.act(); ui.update();
  assert.equal(heard.filter(([id]) => id === 'hero_launch').length, 2, 'RETRY permits one new launch voice');
  game.finish(); game.act(); ui.update();
  assert.equal(stopped.length, 3, 'RETRY stops active voice even when RESULT is skipped between frames');
  scope.Hop.Voice.play = original;
  scope.Hop.Voice.stop = originalStop;
}

const reviewedRegistry = { authenticityStatus: 'reviewed', assets: { hero_launch: {
  file: 'assets/audio/voices/dist/hero_launch.mp3', gameEvent: 'AIM_POWER_TO_FLYING', connectionStatus: 'connected', priority: 45,
  sourceProvenance: 'human-reviewed source record', humanReviewed: true
} } };
function routeFetch({ registry = reviewedRegistry, audio = { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }, registryError, audioError, counts = { registry: 0, audio: 0 } } = {}) {
  return async url => {
    if (url === 'assets/audio/voices/voice-registry.json') {
      counts.registry++;
      if (registryError) throw registryError;
      return { ok: true, json: async () => registry };
    }
    counts.audio++;
    if (audioError) throw audioError;
    return audio;
  };
}
function harness({ fetchImpl, decode = () => Promise.resolve({ decoded: true }), state = 'running', context = true } = {}) {
  const sources = [], warnings = [], document = { hidden: false, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const audioContext = context ? {
    state, destination: {}, decodeAudioData: decode,
    createBufferSource() { const source = { buffer: null, stopped: 0, connected: false, connect() { this.connected = true; }, start() { this.started = true; }, stop() { this.stopped++; }, disconnect() { this.connected = false; }, onended: null }; sources.push(source); return source; }
  } : null;
  const testScope = { Hop: { Audio: { muted: false, context: audioContext } }, document, fetch: fetchImpl,
    console: { warn: (...args) => warnings.push(args) } };
  vm.createContext(testScope); vm.runInContext(fs.readFileSync(path.join(root, 'js/voice.js'), 'utf8'), testScope);
  return { voice: testScope.Hop.Voice, audio: testScope.Hop.Audio, sources, warnings, context: audioContext, document };
}
async function settle() { await new Promise(resolve => setImmediate(resolve)); }

(async () => {
  // Unreviewed files stay dormant even if present; quality or file existence never proves voice provenance.
  {
    const counts = { registry: 0, audio: 0 };
    const registry = { authenticityStatus: 'unverified', assets: { hero_launch: { file: 'assets/audio/voices/dist/hero_launch.mp3', humanReviewed: false } } };
    const h = harness({ fetchImpl: routeFetch({ registry, counts }) }); h.voice.unlock(); h.voice.unlock(); await settle();
    assert.equal(h.voice.buffer, null); assert.equal(counts.registry, 1); assert.equal(counts.audio, 0);
    assert.equal(h.voice.source, null);
  }
  // Reviewed asset load shares caller context; double unlock coalesces and older onended cannot clear newer playback.
  {
    const counts = { registry: 0, audio: 0 };
    const h = harness({ fetchImpl: routeFetch({ counts }) }); h.voice.unlock(); h.voice.unlock(); await settle();
    assert.equal(h.voice.source, 'assets/audio/voices/dist/hero_launch.mp3');
    assert.equal(h.voice.context, h.context); assert(h.voice.buffer);
    assert.equal(counts.registry, 1); assert.equal(counts.audio, 1);
    h.voice.play('hero_launch', false, 'AIM_POWER_TO_FLYING'); assert.equal(h.sources.length, 1); assert(h.sources[0].started);
    const first = h.sources[0];
    h.voice.play('hero_launch', false, 'AIM_POWER_TO_FLYING');
    assert.equal(first.stopped, 0, "duplicate event does not interrupt/restart its active source");
    assert.equal(h.sources.length, 1); assert(h.sources[0].started); assert.equal(h.voice.active, h.sources[0]);
    h.audio.muted = true; h.voice.syncMute(); assert.equal(h.sources[0].stopped, 1); assert.equal(h.voice.active, null);
    h.voice.stop(); assert.equal(h.sources[0].stopped, 1, "stop is idempotent");
  }
  // Mock-only review fixture proves every connected ID loads, repeats coalesce, and priority interrupts work.
  {
    const registry = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/voices/voice-registry.json'), 'utf8'));
    registry.authenticityStatus = 'reviewed';
    for (const entry of Object.values(registry.assets)) if (entry.connectionStatus === 'connected') {
      entry.humanReviewed = true; entry.sourceProvenance = 'mock test fixture';
    }
    const counts = { registry: 0, audio: 0 }, h = harness({ fetchImpl: routeFetch({ registry, counts }) });
    h.voice.unlock(); await settle(); assert.equal(h.voice.buffers.size, 20); assert.equal(counts.audio, 20);
    h.voice.play('hero_launch', false, 'AIM_POWER_TO_FLYING'); h.voice.play('hero_launch', false, 'AIM_POWER_TO_FLYING');
    assert.equal(h.sources.length, 1, 'duplicate launch event does not restart its one-shot');
    h.voice.play('hero_launch', false, 'FLYING_TO_RESULT'); assert.equal(h.sources.length, 1, 'event mismatch is rejected');
    h.voice.play('hero_flight', false, 'AERIAL_SUCCESS_FIRST_PER_RUN');
    assert.equal(h.sources.length, 1, 'low-priority encouragement cannot interrupt the launch line');
    h.voice.play('special_boost', false, 'SPECIAL_BOOST'); assert.equal(h.sources.length, 2); assert.equal(h.sources[0].stopped, 1);
    h.sources[0].onended(); assert.equal(h.voice.active, h.sources[1], 'old onended cannot clear the interrupting voice');
    h.voice.play('hero_launch', false, 'AIM_POWER_TO_FLYING'); assert.equal(h.sources.length, 2, 'lower priority cannot cut higher priority');
    h.voice.play('combo_witch_call', false, 'COMBO_WITCH_START'); assert.equal(h.sources.length, 3); assert.equal(h.sources[1].stopped, 1);
    h.voice.play('combo_witch_blast', false, 'COMBO_WITCH_FINISH'); assert.equal(h.sources.length, 4); assert.equal(h.sources[2].stopped, 1);
    h.voice.play('hero_stop', false, 'FLYING_TO_RESULT'); assert.equal(h.sources.length, 5); assert.equal(h.sources[3].stopped, 1);
    h.voice.play('hero_stop', false, 'FLYING_TO_RESULT'); assert.equal(h.sources.length, 5, 'same result line is not restarted');
    h.voice.stop(); assert.equal(h.sources[4].stopped, 1);
  }
  // Fetch/404, decode, absent/suspended context and suspended playback all fail closed.
  for (const [label, options] of [
    ['404', { fetchImpl: routeFetch({ audio: { ok: false, status: 404 } }) }],
    ['fetch rejection', { fetchImpl: routeFetch({ audioError: Error('offline') }) }],
    ['registry rejection', { fetchImpl: routeFetch({ registryError: Error('offline') }) }],
    ['decode rejection', { fetchImpl: routeFetch({}), decode: async () => { throw Error('bad audio'); } }]
  ]) {
    const h = harness(options); h.voice.unlock(true); await settle();
    assert.equal(h.voice.buffer, null, label); assert(h.warnings.length > 0, label + ' is diagnosable in DEBUG');
    assert.doesNotThrow(() => h.voice.play('hero_launch', true));
  }
  {
    const absent = harness({ context: false }); assert.doesNotThrow(() => absent.voice.unlock(true));
    const suspended = harness({ state: 'suspended' }); suspended.voice.buffer = {};
    assert.doesNotThrow(() => suspended.voice.play('hero_launch', true, 'AIM_POWER_TO_FLYING')); assert.equal(suspended.sources.length, 0);
  }
    // A rejected voice download does not block a full game launch/result transition.
  {
    const original = scope.Hop.Voice;
    const failed = harness({ fetchImpl: routeFetch({ audioError: Error('offline') }) });
    scope.Hop.Voice = failed.voice; failed.voice.unlock();
    const game = new scope.Hop.Game(), ui = new scope.Hop.UI(game, element('canvas'));
    game.act(); ui.update(); game.act(); ui.update(); game.act(); ui.update();
    assert.equal(game.state, 'FLYING');
    await settle();
    game.finish(); ui.update();
    assert.equal(game.state, 'RESULT');
    scope.Hop.Voice = original;
  }

  // A decode finishing after leave/RETRY is stale and cannot populate or autoplay a voice.
  {
    let resolveDecode, attempts = 0;
    const h = harness({ fetchImpl: routeFetch({}), decode: () => attempts++ === 0 ? new Promise(resolve => { resolveDecode = resolve; }) : Promise.resolve({ retry: true }) });
    h.voice.unlock(); await settle();
    assert.equal(typeof resolveDecode, 'function');
    h.voice.stop(); resolveDecode({ tooLate: true }); await settle();
    assert.equal(h.voice.buffer, null); assert.equal(h.voice.loading, false); assert.equal(h.sources.length, 0);
    h.voice.unlock(); await settle(); assert(h.voice.buffer, 'next user gesture can retry after stale completion');
  }

  // Mute cancels in-flight work; suspended/rejected resume and absent pre-gesture audio context remain harmless.
  {
    let resolveDecode;
    const h = harness({ fetchImpl: routeFetch({}), decode: () => new Promise(resolve => { resolveDecode = resolve; }) });
    h.voice.unlock(); await settle(); h.audio.muted = true; h.voice.syncMute(); resolveDecode({ tooLate: true }); await settle();
    assert.equal(h.voice.buffer, null); assert.equal(h.sources.length, 0);
    const absent = harness({ context: false, fetchImpl: routeFetch({}) });
    assert.doesNotThrow(() => absent.voice.unlock());
    const suspended = harness({ state: 'suspended', fetchImpl: routeFetch({}) });
    suspended.voice.buffer = {}; suspended.voice.context = suspended.context;
    assert.doesNotThrow(() => suspended.voice.play('hero_launch', false, 'AIM_POWER_TO_FLYING')); assert.equal(suspended.sources.length, 0);
  }

  // Hiding the document invalidates pending work and stops current playback.
  {
    let resolveDecode;
    const h = harness({ fetchImpl: routeFetch({}), decode: () => new Promise(resolve => { resolveDecode = resolve; }) });
    h.voice.unlock(); await settle();
    h.document.hidden = true; h.document.listeners.visibilitychange(); resolveDecode({ tooLate: true }); await settle();
    assert.equal(h.voice.buffer, null); assert.equal(h.voice.active, null);
  }

  // Voice errors and rejected audio resume do not alter deterministic game results/state transitions.
  {
    const baseline = launch(313, 45, 0.75);
    const summary = game => { let steps = 0; while (game.state === 'FLYING' && steps++ < 20000) game.update(1 / 60); return { state: game.state, distance: game.finalDistance, body: [game.body.x, game.body.y, game.body.vx, game.body.vy], score: game.score }; };
    const expected = summary(baseline);
    const audio = scope.Hop.Audio, originalContext = audio.context, originalCtor = scope.AudioContext;
    audio.context = null;
    scope.AudioContext = class { constructor() { this.state = 'suspended'; this.resume = () => Promise.reject(Error('blocked')); } };
    assert.doesNotThrow(() => audio.unlock()); await settle();
    const originalVoice = scope.Hop.Voice;
    const game = launch(313, 45, 0.75), ui = new scope.Hop.UI(game, element('canvas'));
    assert.doesNotThrow(() => { scope.Hop.Voice.unlock(); ui.update(); });
    assert.deepEqual(summary(game), expected);
    audio.context = originalContext; scope.AudioContext = originalCtor; scope.Hop.Voice = originalVoice;
  }

// Optional module absence remains harmless to a normal game input and launch.
  {
    const game = launch(); delete scope.Hop.Voice;
    assert.doesNotThrow(() => { const ui = new scope.Hop.UI(game, element('canvas')); ui.lastState = 'AIM_POWER'; ui.update(); });
    // Restore the module for other suites sharing phase2's VM.
    vm.runInContext(fs.readFileSync(path.join(root, 'js/voice.js'), 'utf8'), scope);
  }
  console.log('HERO voice PASS: one launch hook, retry, shared context, mute stop, 404/fetch/decode/context failures, optional module.');
})().catch(error => { console.error(error); process.exitCode = 1; });
