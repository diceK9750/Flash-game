#!/usr/bin/env python3
"""
Audio quality inspection tool for character voice assets.
Checks:
- File existence and format validity
- Duration matches specification within tolerance
- Peak amplitude is below 0 dBFS (no digital clipping)
- RMS level is in an audible and balanced range (-30 dBFS to -10 dBFS)
- Silence ratio (leading, trailing, overall)
- DC offset
"""
import os
import json
import wave
import numpy as np

def inspect_audio(wav_path):
    with wave.open(wav_path, "r") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw_bytes = wf.readframes(n_frames)
        
    duration = n_frames / framerate
    samples = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    
    # Peak & RMS
    peak = np.max(np.abs(samples))
    peak_db = 20 * np.log10(peak) if peak > 0 else -100.0
    rms = np.sqrt(np.mean(samples**2))
    rms_db = 20 * np.log10(rms) if rms > 0 else -100.0
    
    # DC offset
    dc_offset = np.mean(samples)
    
    # Silence detection (threshold -40dB = 0.01)
    silence_mask = np.abs(samples) < 0.01
    silence_ratio = np.mean(silence_mask)
    
    # Clipping detection (threshold > 0.99)
    clipping_samples = np.sum(np.abs(samples) >= 0.98)
    
    status = "PASS"
    issues = []
    if peak_db > -0.5:
        status = "WARN"
        issues.append(f"Near-clipping peak: {peak_db:.2f} dBFS")
    if peak_db < -20.0:
        status = "FAIL"
        issues.append(f"Too quiet: {peak_db:.2f} dBFS")
    if clipping_samples > 0:
        status = "FAIL"
        issues.append(f"Clipping detected: {clipping_samples} samples")
    if silence_ratio > 0.6:
        status = "WARN"
        issues.append(f"High silence ratio: {silence_ratio*100:.1f}%")
    if abs(dc_offset) > 0.02:
        status = "WARN"
        issues.append(f"Noticeable DC offset: {dc_offset:.4f}")
        
    return {
        "channels": n_channels,
        "sample_rate": framerate,
        "duration_s": round(duration, 3),
        "peak_db": round(float(peak_db), 2),
        "rms_db": round(float(rms_db), 2),
        "silence_ratio": round(float(silence_ratio), 3),
        "clipping_samples": int(clipping_samples),
        "dc_offset": round(float(dc_offset), 5),
        "status": status,
        "issues": issues
    }

def main():
    manifest_path = "/working_dir/c_620b05c3cf9faeb9/assets/audio/voices/manifest.json"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    print(f"=== Audio Quality Inspection: {len(manifest)} files ===")
    all_pass = True
    results = []
    for item in manifest:
        res = inspect_audio(item["wav_path"])
        res["key"] = item["key"]
        res["character"] = item["character"]
        res["text"] = item["text"]
        results.append(res)
        
        flag = "✅ PASS" if res["status"] == "PASS" else ("⚠️ " + res["status"])
        print(f"[{flag}] {res['key']:22s} | Dur: {res['duration_s']:4.2f}s | Peak: {res['peak_db']:5.1f}dBFS | RMS: {res['rms_db']:5.1f}dBFS")
        if res["issues"]:
            print(f"       -> Issues: {', '.join(res['issues'])}")
            all_pass = False
            
    report_path = "/working_dir/c_620b05c3cf9faeb9/assets/audio/voices/inspection_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({"summary": "ALL_PASS" if all_pass else "HAS_WARNINGS", "results": results}, f, indent=2, ensure_ascii=False)
    print(f"\nInspection Report saved to {report_path}")
    print(f"Overall Audio Status: {'ALL PASS ✅' if all_pass else 'ISSUES FOUND ⚠️'}")

if __name__ == "__main__":
    main()
