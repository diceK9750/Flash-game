"use strict";
// Voice gender check (no dependencies). Per registry entry:
//  - castId/character/gender must equal the spec in js/graphics.js Hop.CAST -> error otherwise
//  - voiceGender (what the current audio sounds like) vs cast gender:
//      warning while the entry is unverified, error once it is reviewed
//      (registry authenticityStatus "reviewed" or entry humanReviewed:true).
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const GENDER = { "男": "male", "女": "female" };
const VOICE_GENDERS = new Set(["male", "female", "neutral", "unknown"]);

function loadCast(root) {
  const scope = { Hop: {} }; scope.window = scope; vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(root, "js/graphics.js"), "utf8"), scope, { filename: "graphics.js" });
  return scope.Hop.CAST;
}
function checkVoiceGender(root, options = {}) {
  const registry = options.registry || JSON.parse(fs.readFileSync(path.join(root, "assets/audio/voices/voice-registry.json"), "utf8"));
  const cast = options.cast || loadCast(root);
  const registryReviewed = registry?.authenticityStatus === "reviewed";
  const errors = [], warnings = [], rows = [];
  for (const [id, entry] of Object.entries(registry?.assets || {})) {
    const role = cast[entry.castId];
    if (!role) { errors.push(`${id}: unknown castId ${entry.castId}`); continue; }
    const castGender = GENDER[role.gender];
    if (entry.character !== role.name) errors.push(`${id}: character ${entry.character} != cast ${role.name}`);
    if (entry.gender !== castGender) errors.push(`${id}: gender ${entry.gender} != cast gender ${castGender} (${role.name})`);
    const voice = entry.voiceGender;
    if (!VOICE_GENDERS.has(voice)) errors.push(`${id}: voiceGender must be one of ${[...VOICE_GENDERS].join("/")}, got ${voice}`);
    const reviewed = registryReviewed || entry.humanReviewed === true, match = voice === castGender;
    rows.push({ id, character: role.name, castGender, voiceGender: voice, match, reviewed });
    if (!match) (reviewed ? errors : warnings).push(`${id}: ${role.name} cast ${castGender}, current voice ${voice}${reviewed ? " (reviewed: must match)" : " (unverified)"}`);
  }
  return { errors, warnings, rows };
}
module.exports = { checkVoiceGender, loadCast, GENDER };
