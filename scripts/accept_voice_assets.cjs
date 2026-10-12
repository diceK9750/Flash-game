#!/usr/bin/env node
"use strict";

// Dependency-free technical intake checks. Passing these checks says nothing about
// who/what generated the recording; authenticity always remains unverified here.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const { checkVoiceGender } = require("./voice_gender.cjs");
const manifestPath = path.join(root, "assets/audio/voices/manifest.json");
const RATE = [44100, 48000, 32000];
const MPEG1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

function fail(message) { throw new Error(message); }
function inspectWav(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") fail("invalid or truncated RIFF/WAVE");
  let offset = 12, fmt = null, data = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) fail(`truncated ${id} chunk`);
    if (id === "fmt ") {
      if (size < 16) fail("short fmt chunk");
      fmt = { code: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2), rate: bytes.readUInt32LE(start + 4), byteRate: bytes.readUInt32LE(start + 8), align: bytes.readUInt16LE(start + 12), bits: bytes.readUInt16LE(start + 14) };
    } else if (id === "data") data = bytes.subarray(start, start + size);
    offset = start + size + (size & 1);
  }
  if (!fmt || !data || fmt.code !== 1) fail("missing PCM fmt/data or unsupported WAV encoding");
  if (![1, 2].includes(fmt.channels) || ![8, 16, 24, 32].includes(fmt.bits) || !fmt.rate) fail("unsupported channel count, bit depth, or sample rate");
  const bytesPerSample = fmt.bits / 8;
  if (fmt.align !== fmt.channels * bytesPerSample || data.length % fmt.align || fmt.byteRate !== fmt.rate * fmt.align) fail("inconsistent PCM frame metadata");
  const sampleCount = data.length / bytesPerSample, fullScale = 2 ** (fmt.bits - 1), signed8 = fmt.bits === 8;
  let sum = 0, squares = 0, peak = 0, clipped = 0, silent = 0;
  for (let i = 0; i < sampleCount; i++) {
    let value;
    if (fmt.bits === 8) value = data.readUInt8(i) - 128;
    else if (fmt.bits === 16) value = data.readInt16LE(i * 2);
    else if (fmt.bits === 24) { const p = i * 3; value = data[p] | (data[p + 1] << 8) | (data[p + 2] << 16); if (value & 0x800000) value |= 0xff000000; }
    else value = data.readInt32LE(i * 4);
    const normalized = value / fullScale, abs = Math.abs(normalized);
    sum += normalized; squares += normalized * normalized; peak = Math.max(peak, abs);
    if (abs >= 0.999) clipped++;
    if (abs < 0.01) silent++;
  }
  const rms = Math.sqrt(squares / sampleCount), db = n => n ? 20 * Math.log10(n) : -Infinity;
  const duration = data.length / fmt.byteRate;
  if (!sampleCount || duration <= 0) fail("empty PCM audio");
  return { format: "wav-pcm", channels: fmt.channels, sampleRate: fmt.rate, bitsPerSample: fmt.bits, durationSeconds: duration, peakDbfs: db(peak), rmsDbfs: db(rms), silenceRatio: silent / sampleCount, clippingSamples: clipped, dcOffset: sum / sampleCount };
}

function inspectMp3(file) {
  const bytes = fs.readFileSync(file);
  let pos = 0;
  if (bytes.toString("ascii", 0, 3) === "ID3") {
    if (bytes.length < 10 || [...bytes.subarray(6, 10)].some(x => x & 0x80)) fail("invalid ID3 header");
    const tagSize = bytes[6] * 0x200000 + bytes[7] * 0x4000 + bytes[8] * 0x80 + bytes[9];
    pos = 10 + tagSize + ((bytes[5] & 0x10) ? 10 : 0);
  }
  let frames = 0, seconds = 0;
  while (pos + 4 <= bytes.length) {
    if (bytes.toString("ascii", pos, pos + 3) === "TAG") { pos = bytes.length; break; }
    const h = bytes.readUInt32BE(pos), version = (h >>> 19) & 3, layer = (h >>> 17) & 3, bitrateIndex = (h >>> 12) & 15, rateIndex = (h >>> 10) & 3, padding = (h >>> 9) & 1;
    if ((h >>> 21) !== 0x7ff || version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) fail(`invalid MPEG audio frame at byte ${pos}`);
    const sampleRate = RATE[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const bitrate = (version === 3 ? MPEG1_L3 : MPEG2_L3)[bitrateIndex] * 1000;
    const frameLength = Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + padding;
    if (pos + frameLength > bytes.length) fail(`truncated MPEG audio frame at byte ${pos}`);
    frames++;
    seconds += (version === 3 ? 1152 : 576) / sampleRate;
    pos += frameLength;
  }
  if (!frames) fail("no MPEG Layer III frames found");
  if (pos !== bytes.length) fail("unexpected trailing bytes after MPEG audio");
  return { format: "mp3-mpeg-layer-iii", frames, durationSeconds: seconds };
}

function inspect(file) {
  const ext = path.extname(file).toLowerCase();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail("file is missing");
  if (ext === ".wav") return inspectWav(file);
  if (ext === ".mp3") return inspectMp3(file);
  fail("expected .wav or .mp3");
}

function qualityIssues(record) {
  const issues = [];
  if (record.durationSeconds < 0.1 || record.durationSeconds > 15) issues.push("duration outside voice-line range (0.1–15 s)");
  if (record.format === "wav-pcm") {
    if (record.peakDbfs > -0.5) issues.push("WAV peak is near clipping");
    if (record.peakDbfs < -20) issues.push("WAV peak is very quiet");
    if (record.clippingSamples) issues.push("WAV contains clipped samples");
    if (record.rmsDbfs < -35) issues.push("WAV RMS is very quiet");
    if (record.silenceRatio > 0.6) issues.push("WAV has a high silence ratio");
    if (Math.abs(record.dcOffset) > 0.02) issues.push("WAV has noticeable DC offset");
  }
  return issues;
}

function inspectManifest() {
  const items = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(items) || items.length === 0) fail("voice manifest must be a non-empty array");
  const seen = new Set();
  return items.map(item => {
    if (typeof item.key !== "string" || !/^[a-z0-9_-]+$/i.test(item.key) || seen.has(item.key)) fail(`missing, unsafe, or duplicate voice key: ${item.key}`);
    seen.add(item.key);
    const wav = path.join(root, "assets/audio/voices/original", `${item.key}.wav`);
    const mp3 = path.join(root, "assets/audio/voices/dist", `${item.key}.mp3`);
    const pcm = inspect(wav), encoded = inspect(mp3), issues = [...qualityIssues(pcm), ...qualityIssues(encoded)];
    if (item.duration_s && Math.abs(pcm.durationSeconds - item.duration_s) > 0.08) issues.push("WAV duration differs from manifest");
    if (Math.abs(encoded.durationSeconds - pcm.durationSeconds) > 0.15) issues.push("MP3/WAV durations differ");
    return { key: item.key, wav: { ...pcm, durationSeconds: +pcm.durationSeconds.toFixed(3) }, mp3: { ...encoded, durationSeconds: +encoded.durationSeconds.toFixed(3), decodeCheck: "NOT_TESTED" }, technicalStatus: issues.length ? "REVIEW" : "PASS", issues, authenticity: "UNVERIFIED" };
  });
}

try {
  const results = process.argv.length > 2 ? process.argv.slice(2).map(file => {
    const record = inspect(path.resolve(file));
    return { file, ...record, ...(record.format === "mp3-mpeg-layer-iii" ? { decodeCheck: "NOT_TESTED" } : {}), technicalStatus: qualityIssues(record).length ? "REVIEW" : "PASS", issues: qualityIssues(record), authenticity: "UNVERIFIED" };
  }) : inspectManifest();
  // Cast-gender check: unverified mismatches warn, reviewed entries must match the cast gender.
  const gender = checkVoiceGender(root);
  for (const warning of gender.warnings) process.stderr.write(`Voice gender warning: ${warning}\n`);
  for (const error of gender.errors) process.stderr.write(`Voice gender FAIL: ${error}\n`);
  const failed = results.some(item => item.technicalStatus === "REVIEW") || gender.errors.length > 0;
  const summary = { files: results.length, technicalStatus: failed ? "REVIEW" : "PASS", authenticity: "UNVERIFIED", genderCheck: { status: gender.errors.length ? "FAIL" : gender.warnings.length ? "WARN" : "PASS", errors: gender.errors, warnings: gender.warnings }, results };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  if (failed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Voice intake failed: ${error.message}\n`);
  process.exitCode = 1;
}
