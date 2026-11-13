// Historical fingerprints predate elastic character contact and event ordering.
// Load the unmodified cb338c0 game snapshot only into an isolated historical VM;
// the real game and shared test scope always retain current physics.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const snapshot = fs.readFileSync(path.join(__dirname, 'legacy-game-cb338c0.js'), 'utf8').replace(/\r\n/g, '\n');
assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'),
  'ff33d80c363054aa6d26ce957b61f29541bfa0b6230ffa8ae69bae456f9060e6', 'historical game snapshot changed');

module.exports = function legacyContactReflectionOff(src, name) {
  return name === 'game' ? snapshot : src;
};
