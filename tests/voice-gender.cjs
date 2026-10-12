"use strict";
const assert = require("node:assert/strict"), path = require("node:path");
const { checkVoiceGender, loadCast } = require("../scripts/voice_gender.cjs");
const root = path.resolve(__dirname, "..");

const result = checkVoiceGender(root);
assert.equal(result.rows.length, 20, "all 20 voice entries checked");
if (result.warnings.length) {
  console.log(`voice-gender WARNING: ${result.warnings.length} unverified entries whose current voice does not match the cast gender:`);
  for (const w of result.warnings) console.log("  - " + w);
}
assert.deepEqual(result.errors, [], "voice gender errors:\n" + result.errors.join("\n"));

// Policy self-test with synthetic registries: unverified mismatch warns, reviewed mismatch fails.
const cast = loadCast(root);
const entry = extra => ({ castId: "BOUNCE", character: "武闘家", gender: "female", voiceGender: "male", humanReviewed: false, ...extra });
let r = checkVoiceGender(root, { cast, registry: { authenticityStatus: "unverified", assets: { x: entry() } } });
assert.equal(r.errors.length, 0); assert.equal(r.warnings.length, 1);
r = checkVoiceGender(root, { cast, registry: { authenticityStatus: "unverified", assets: { x: entry({ humanReviewed: true }) } } });
assert.equal(r.errors.length, 1);
r = checkVoiceGender(root, { cast, registry: { authenticityStatus: "reviewed", assets: { x: entry() } } });
assert.equal(r.errors.length, 1);
r = checkVoiceGender(root, { cast, registry: { authenticityStatus: "reviewed", assets: { x: entry({ voiceGender: "female" }) } } });
assert.deepEqual([r.errors.length, r.warnings.length], [0, 0]);
r = checkVoiceGender(root, { cast, registry: { authenticityStatus: "unverified", assets: { x: entry({ gender: "male" }) } } });
assert.equal(r.errors.length, 1, "registry gender must equal spec cast gender");
console.log(`voice-gender PASS (${result.rows.length} entries, ${result.warnings.length} unverified mismatch warnings)`);
