const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), tool = path.join(root, 'scripts/accept_voice_assets.cjs');
const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' });

// All committed tracks must be structurally readable; technical PASS must never imply authenticity.
{
  const result = run();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.files, 20); assert.equal(report.technicalStatus, 'PASS');
  assert.equal(report.authenticity, 'UNVERIFIED');
  assert(report.results.every(item => item.technicalStatus === 'PASS' && item.authenticity === 'UNVERIFIED'));
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/voices/manifest.json'), 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/voices/voice-registry.json'), 'utf8'));
  assert.equal(registry.authenticityStatus, 'per-entry', 'registry-wide review is never granted; per-entry gate');
  assert.deepEqual(Object.keys(registry.assets).sort(), sourceManifest.map(item => item.key).sort());
  const REVIEWED = new Set(['hero_launch', 'hero_stop']);
  for (const [id, entry] of Object.entries(registry.assets)) {
    assert.equal(entry.file, `assets/audio/voices/dist/${id}.mp3`);
    assert(['connected', 'unconnected'].includes(entry.connectionStatus));
    if (entry.connectionStatus === 'connected') { assert.equal(typeof entry.gameEvent, 'string'); assert(entry.gameEvent.length > 0); }
    else { assert.equal(entry.gameEvent, null); assert.equal(typeof entry.reason, 'string'); assert(entry.reason.length > 0); }
    // Per-entry review (registry "per-entry"): only the user-reviewed hero_launch/hero_stop may be playable.
    if (REVIEWED.has(id)) { assert.equal(registry.authenticityStatus, 'per-entry'); assert.equal(entry.authenticityStatus, 'reviewed'); assert.equal(entry.humanReviewed, true); assert(entry.sourceProvenance.trim()); assert.equal(entry.review.reviewer, 'だいす@大豆'); }
    else { assert.equal(entry.humanReviewed, false); assert.equal(entry.sourceProvenance, null); assert.notEqual(entry.authenticityStatus, 'reviewed'); }
  }
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-intake-'));
try {
  // Minimal, valid 1-second 8 kHz mono PCM WAV with a clean tone.
  const frames = 8000, wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI / 20) * 12000), 44 + i * 2);
  const wavPath = path.join(temp, 'tone.wav'); fs.writeFileSync(wavPath, wav);
  let result = run(wavPath); assert.equal(result.status, 0, result.stderr);
  let report = JSON.parse(result.stdout); assert.equal(report.results[0].format, 'wav-pcm'); assert.equal(report.results[0].durationSeconds, 1); assert.equal(report.authenticity, 'UNVERIFIED');

  // MPEG-1 Layer III 128 kbps, 44.1 kHz frames; then a truncated/corrupt frame.
  const frame = Buffer.from([0xff, 0xfb, 0x90, 0x64, ...Array(413).fill(0)]);
  const mp3Path = path.join(temp, 'sample.mp3'); fs.writeFileSync(mp3Path, Buffer.concat(Array(5).fill(frame)));
  result = run(mp3Path); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).results[0].format, 'mp3-mpeg-layer-iii');
  fs.writeFileSync(mp3Path, Buffer.from([0xff, 0xfb, 0x90]));
  result = run(mp3Path); assert.notEqual(result.status, 0, 'truncated MP3 must fail closed');
  fs.writeFileSync(wavPath, wav.subarray(0, 28));
  result = run(wavPath); assert.notEqual(result.status, 0, 'truncated WAV must fail closed');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

console.log('Voice acceptance PASS: 20 WAV/MP3 pairs, PCM metrics, MP3 framing, truncation rejection, only hero_launch/hero_stop reviewed (per-entry), the other 18 unverified.');
