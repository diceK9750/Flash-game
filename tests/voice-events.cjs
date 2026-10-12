const assert = require('node:assert/strict');
const { scope, element } = require('./phase2.cjs');
const registry = require('../assets/audio/voices/voice-registry.json');
const originalVoice = scope.Hop.Voice, originalPlay = scope.Hop.Audio.play, originalCombo = scope.Hop.Audio.playCombo, originalStopCombo = scope.Hop.Audio.stopCombo;
const heard = [], stopped = [];
scope.Hop.Voice = { play: (id, debug, event) => heard.push({ id, event }), stop: () => stopped.push(true) };
scope.Hop.Audio.play = () => {}; scope.Hop.Audio.playCombo = () => {}; scope.Hop.Audio.stopCombo = () => {};

function fixture() {
  const game = new scope.Hop.Game(), ui = new scope.Hop.UI(game, element('canvas'));
  game.state = scope.Hop.STATES.FLYING; ui.update(); heard.length = 0; stopped.length = 0;
  return { game, ui };
}

try {
  // All seven successful SPECIAL sound events map once; a displayed frame cannot retrigger one.
  for (const kind of ['BOOST', 'BOUNCE', 'DASH', 'STOPPER', 'BRAKE', 'ANGLE', 'GUARD']) {
    const { game, ui } = fixture(); game.soundEvent = `SPECIAL_${kind}`;
    ui.update(); ui.update();
    assert.deepEqual(heard, [{ id: `special_${kind.toLowerCase()}`, event: `SPECIAL_${kind}` }], kind);
    assert.equal(game.soundEvent, null); heard.length = 0;
  }

  // Merchant voice uses the successful merchant type; the generic merchant SE alone has no type.
  for (const type of ['A', 'B', 'C', 'D']) {
    const { game, ui } = fixture(); game.soundEvent = 'SPECIAL_MERCHANT'; game.specialCutin = { merchantType: type };
    ui.update(); ui.update();
    assert.deepEqual(heard, [{ id: `special_merchant_${type.toLowerCase()}`, event: `MERCHANT_SUCCESS_${type}` }], type);
    heard.length = 0;
  }
  {
    const { game, ui } = fixture(); game.soundEvent = 'SPECIAL_MERCHANT'; game.specialCutin = { merchantType: null };
    ui.update(); assert.equal(heard.length, 0, 'unknown merchant type is not guessed');
  }

  // First successful AERIAL per play emits one discrete hero_flight line; repeat AERIALs stay quiet and RETRY resets it.
  {
    const game = new scope.Hop.Game(), ui = new scope.Hop.UI(game, element('canvas'));
    game.act(); ui.update(); game.act(); ui.update(); game.act(); ui.update();
    game.update(1 / 60); ui.update(); assert.equal(game.aerial('UP'), true);
    let stateBefore = JSON.stringify(game); ui.update(); assert.equal(JSON.stringify(game), stateBefore, 'voice hook leaves game model unchanged');
    ui.update(); assert.equal(JSON.stringify(game), stateBefore);
    const flightCalls = () => heard.filter(call => call.id === 'hero_flight');
    assert.deepEqual(flightCalls(), [{ id: 'hero_flight', event: 'AERIAL_SUCCESS_FIRST_PER_RUN' }]);
    game.downCharge = 1; assert.equal(game.aerial('DOWN'), true); stateBefore = JSON.stringify(game); ui.update(); assert.equal(JSON.stringify(game), stateBefore);
    assert.equal(flightCalls().length, 1, 'a second AERIAL does not repeat the line');
    game.finish(); ui.update(); game.act(); ui.update(); game.act(); ui.update(); game.act(); ui.update();
    game.update(1 / 60); ui.update(); assert.equal(game.aerial('UP'), true); stateBefore = JSON.stringify(game); ui.update(); assert.equal(JSON.stringify(game), stateBefore);
    assert.equal(flightCalls().length, 2, 'RETRY resets the per-play gate');
    heard.length = 0;
  }

  // Combo start and one threshold crossing are discrete; short variants replace both long lines.
  for (const [type, kind, threshold, startId, finishId] of [
    ['BOOST', 'WITCH', 2.15, 'combo_witch_call', 'combo_witch_blast'],
    ['BOUNCE', 'FIGHTER', 1.6, 'combo_fighter_call', 'combo_fighter_upper']
  ]) {
    const { game, ui } = fixture(); game.combo = { type, short: false, elapsed: 0, skipped: false };
    ui.update(); ui.update(); assert.deepEqual(heard, [{ id: startId, event: `COMBO_${kind}_START` }]);
    game.combo.elapsed = threshold - 0.01; ui.update(); assert.equal(heard.length, 1);
    game.combo.elapsed = threshold + 0.01; ui.update(); ui.update();
    assert.deepEqual(heard, [{ id: startId, event: `COMBO_${kind}_START` }, { id: finishId, event: `COMBO_${kind}_FINISH` }]);
    game.combo = null; ui.update(); assert.equal(stopped.length, 0, 'natural combo end does not cut its finisher');
    heard.length = 0;
  }
  for (const [type, kind, id] of [['BOOST', 'WITCH', 'combo_witch_short'], ['BOUNCE', 'FIGHTER', 'combo_fighter_short']]) {
    const { game, ui } = fixture(); game.combo = { type, short: true, elapsed: 0, skipped: false };
    ui.update(); game.combo.elapsed = 2.2; ui.update();
    assert.deepEqual(heard, [{ id, event: `COMBO_${kind}_REDUCED_MOTION` }]); heard.length = 0;
  }

  // Tap-to-skip and leaving FLYING stop active voice; RESULT -> RETRY stops the result line.
  {
    const { game, ui } = fixture(); game.combo = { type: 'BOOST', short: false, elapsed: 0, skipped: false };
    ui.update(); game.combo.skipped = true; game.combo = null; ui.update();
    assert.equal(stopped.length, 1); assert.equal(heard.length, 1, 'one combo start, no voice replay on skip');
  }
  {
    const game = new scope.Hop.Game(), ui = new scope.Hop.UI(game, element('canvas'));
    game.state = scope.Hop.STATES.FLYING; ui.update(); game.finish(); ui.update();
    assert.equal(heard.at(-1).id, 'hero_stop'); assert.equal(heard.at(-1).event, 'FLYING_TO_RESULT');
    const stopsBeforeRetry = stopped.length; game.act(); ui.update();
    assert.equal(stopped.length, stopsBeforeRetry + 1);
  }

  // Human-review gates all 20 connected ids; the event and rationale for hero_flight are explicit.
  const connected = Object.entries(registry.assets).filter(([, entry]) => entry.connectionStatus === 'connected').map(([id]) => id).sort();
  assert.equal(connected.length, 20); assert.equal(registry.assets.hero_flight.connectionStatus, 'connected');
  assert.equal(registry.assets.hero_flight.gameEvent, 'AERIAL_SUCCESS_FIRST_PER_RUN');
  assert(registry.assets.hero_flight.reason.includes('first successful AERIAL UP or DOWN'));
  const reviewedIds = Object.entries(registry.assets).filter(([, entry]) => entry.humanReviewed).map(([id]) => id).sort();
  assert.deepEqual(reviewedIds, ['hero_launch', 'hero_stop'], 'only the two user-reviewed hero lines are reviewed');
  assert(Object.entries(registry.assets).every(([id, entry]) => reviewedIds.includes(id) ? entry.authenticityStatus === 'reviewed' && entry.sourceProvenance.trim() : !entry.humanReviewed && entry.sourceProvenance === null));
  console.log('Voice event wiring PASS: 7 SPECIAL, 4 merchant, 6 combo variants, launch/first-AERIAL/result, skip/retry, event dedupe, 20 connected; only hero_launch/hero_stop reviewed, the other 18 remain unverified.');
} finally {
  scope.Hop.Voice = originalVoice; scope.Hop.Audio.play = originalPlay;
  scope.Hop.Audio.playCombo = originalCombo; scope.Hop.Audio.stopCombo = originalStopCombo;
}
