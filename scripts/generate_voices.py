#!/usr/bin/env python3
"""
Generate placeholder Japanese character voice assets for Isekai Truck Crash!
Uses harmonic formant synthesis + speech-like envelope + pitched contours via numpy/scipy/wave,
and encodes to clean 24kHz WAV (matching Gemini TTS official output format) and MP3 via ffmpeg.
Also records full metadata, script, voice IDs, and audio measurements.
"""
import os
import json
import math
import wave
import struct
import subprocess
import numpy as np

SAMPLE_RATE = 24000

# Voice definitions with metadata matching Gemini TTS Prebuilt Voices
VOICE_SPECS = {
    # 勇者
    "hero_launch": {
        "char": "勇者", "gemini_voice": "Puck", "category": "HERO",
        "text": "うおおおっ、ぶっ飛ぶぜー！", "reading": "うおおおっ、ぶっとぶぜー！",
        "duration": 0.9, "f0": 160, "formants": [750, 1200, 2600], "style": "excitable shouted launch"
    },
    "hero_flight": {
        "char": "勇者", "gemini_voice": "Puck", "category": "HERO",
        "text": "まだまだ行くぞー！", "reading": "まだまだいくぞー！",
        "duration": 0.7, "f0": 175, "formants": [700, 1150, 2500], "style": "cheerful airborne rally"
    },
    "hero_stop": {
        "char": "勇者", "gemini_voice": "Puck", "category": "HERO",
        "text": "ぐはっ…ここまでか…", "reading": "ぐはっ…ここまでか…",
        "duration": 0.85, "f0": 130, "formants": [650, 1100, 2400], "style": "exhausted defeat reaction"
    },
    # 7人パーティー技名
    "special_boost": {
        "char": "魔法使い", "gemini_voice": "Aoede", "category": "SPECIAL_BOOST",
        "text": "爆裂斜光", "reading": "ばくれつしゃこう",
        "duration": 1.1, "f0": 260, "formants": [850, 1700, 2900], "style": "high-pitched magical invocation"
    },
    "special_bounce": {
        "char": "武闘家", "gemini_voice": "Orus", "category": "SPECIAL_BOUNCE",
        "text": "巨神昇天拳", "reading": "きょしんしょうてんけん",
        "duration": 1.25, "f0": 140, "formants": [600, 1050, 2450], "style": "powerful martial arts shout"
    },
    "special_dash": {
        "char": "戦士", "gemini_voice": "Charon", "category": "SPECIAL_DASH",
        "text": "戦陣突破", "reading": "せんじんとっぱ",
        "duration": 1.05, "f0": 125, "formants": [550, 1000, 2400], "style": "disciplined warrior battle cry"
    },
    "special_stopper": {
        "char": "僧侶", "gemini_voice": "Kore", "category": "SPECIAL_STOPPER",
        "text": "聖光反転", "reading": "せいこうはんてん",
        "duration": 1.2, "f0": 240, "formants": [780, 1600, 2800], "style": "solemn holy miracle benediction"
    },
    "special_brake": {
        "char": "盗賊", "gemini_voice": "Umbriel", "category": "SPECIAL_BRAKE",
        "text": "影すり抜け", "reading": "かげすりぬけ",
        "duration": 0.95, "f0": 165, "formants": [620, 1300, 2600], "style": "light agile phantom whisper"
    },
    "special_angle": {
        "char": "遊び人", "gemini_voice": "Sadachbia", "category": "SPECIAL_ANGLE",
        "text": "水平曲芸", "reading": "すいへいきょくげい",
        "duration": 1.0, "f0": 220, "formants": [800, 1500, 2700], "style": "comical acrobatic banter"
    },
    "special_guard": {
        "char": "賢者", "gemini_voice": "Sadaltager", "category": "SPECIAL_GUARD",
        "text": "聖護結界", "reading": "せいごけっかい",
        "duration": 1.15, "f0": 200, "formants": [650, 1400, 2650], "style": "serene dignified barrier barrier spell"
    },
    # 商人A〜D（同一人物・演じ分け）
    "special_merchant_a": {
        "char": "商人（秘薬）", "gemini_voice": "Achird", "category": "SPECIAL_MERCHANT_A",
        "text": "倍化の秘薬", "reading": "ばいかのひやく",
        "duration": 1.05, "f0": 150, "formants": [680, 1250, 2550], "style": "shrewd alchemical merchant whisper"
    },
    "special_merchant_b": {
        "char": "商人（護符）", "gemini_voice": "Achird", "category": "SPECIAL_MERCHANT_B",
        "text": "蓄光の護符", "reading": "ちっこうのごふ",
        "duration": 1.0, "f0": 170, "formants": [660, 1200, 2500], "style": "reverent talisman salesman tone"
    },
    "special_merchant_c": {
        "char": "商人（絨毯）", "gemini_voice": "Achird", "category": "SPECIAL_MERCHANT_C",
        "text": "浮遊の絨毯", "reading": "ふゆうのじゅうたん",
        "duration": 1.1, "f0": 185, "formants": [720, 1350, 2600], "style": "airy cheerful carpet peddler"
    },
    "special_merchant_d": {
        "char": "商人（靴）", "gemini_voice": "Achird", "category": "SPECIAL_MERCHANT_D",
        "text": "弾跳の靴", "reading": "だんちょうのくつ",
        "duration": 0.95, "f0": 195, "formants": [750, 1400, 2700], "style": "bouncy fast-talking boots vendor"
    },
    # 合体技掛け合い
    "combo_witch_call": {
        "char": "武闘家", "gemini_voice": "Orus", "category": "COMBO_WITCH",
        "text": "合わせるぞ！", "reading": "あわせるぞ！",
        "duration": 0.65, "f0": 150, "formants": [620, 1100, 2450], "style": "urgent team-up call"
    },
    "combo_witch_blast": {
        "char": "魔法使い", "gemini_voice": "Aoede", "category": "COMBO_WITCH",
        "text": "一気に吹き飛びなさい！エクスプロージョン！", "reading": "いっきにふきとびなさい！えくすぷろーじょん！",
        "duration": 1.8, "f0": 270, "formants": [880, 1750, 2950], "style": "climactic spell blast scream"
    },
    "combo_fighter_call": {
        "char": "魔法使い", "gemini_voice": "Aoede", "category": "COMBO_FIGHTER",
        "text": "力、授けます！", "reading": "ちから、さずけます！",
        "duration": 0.65, "f0": 255, "formants": [820, 1650, 2850], "style": "supportive buff enchantment"
    },
    "combo_fighter_upper": {
        "char": "武闘家", "gemini_voice": "Orus", "category": "COMBO_FIGHTER",
        "text": "唸れ我が拳！昇天撃破ァ！", "reading": "うなれわがこぶし！しょうてんげきはぁ！",
        "duration": 1.6, "f0": 145, "formants": [580, 1050, 2400], "style": "explosive giant uppercut yell"
    },
    "combo_witch_short": {
        "char": "魔法使い", "gemini_voice": "Aoede", "category": "COMBO_WITCH_SHORT",
        "text": "吹き飛びなさい！", "reading": "ふきとびなさい！",
        "duration": 0.75, "f0": 265, "formants": [860, 1720, 2900], "style": "swift decisive spell release"
    },
    "combo_fighter_short": {
        "char": "武闘家", "gemini_voice": "Orus", "category": "COMBO_FIGHTER_SHORT",
        "text": "昇天撃破ァ！", "reading": "しょうてんげきはぁ！",
        "duration": 0.75, "f0": 145, "formants": [580, 1050, 2400], "style": "instant decisive uppercut roar"
    }
}

def synthesize_audio(spec):
    dur = spec["duration"]
    f0 = spec["f0"]
    n_samples = int(SAMPLE_RATE * dur)
    t = np.linspace(0, dur, n_samples, endpoint=False)
    
    # Fundamental frequency contour with expressive inflection
    # Slight rise at start, inflection peak, soft decay
    f_contour = f0 * (1.0 + 0.15 * np.sin(np.pi * (t / dur)**0.7) - 0.08 * (t / dur))
    phase = 2 * np.pi * np.cumsum(f_contour) / SAMPLE_RATE
    
    # Pulse train + harmonics
    signal = np.zeros(n_samples)
    formants = spec["formants"]
    
    # Multi-harmonic synthesis with formant filtering
    for h in range(1, 28):
        h_freq = f0 * h
        if h_freq >= SAMPLE_RATE / 2:
            break
        # Weight harmonic amplitude by proximity to formants
        f_weight = sum(np.exp(-((h_freq - fm) / (fm * 0.18))**2) for fm in formants)
        amp = (1.0 / (h ** 0.8)) * (0.2 + 0.8 * f_weight)
        signal += amp * np.sin(h * phase)
        
    # Apply natural envelope with soft attack and smooth release
    attack_samples = int(SAMPLE_RATE * 0.035)
    release_samples = int(SAMPLE_RATE * 0.065)
    env = np.ones(n_samples)
    if attack_samples > 0:
        env[:attack_samples] = np.linspace(0, 1, attack_samples)
    if release_samples > 0:
        env[-release_samples:] = np.linspace(1, 0, release_samples)
        
    # Add subtle syllable modulation (pseudo-speech envelope)
    syllable_count = max(2, int(dur * 4.5))
    syl_mod = 0.85 + 0.15 * np.sin(2 * np.pi * syllable_count * (t / dur))
    signal = signal * env * syl_mod
    
    # Normalize peak to -1.5 dB (approx 0.84) to strictly avoid clipping
    peak = np.max(np.abs(signal))
    if peak > 0:
        signal = signal / peak * 0.82
        
    return signal

def main():
    orig_dir = "/working_dir/c_620b05c3cf9faeb9/assets/audio/voices/original"
    dist_dir = "/working_dir/c_620b05c3cf9faeb9/assets/audio/voices/dist"
    os.makedirs(orig_dir, exist_ok=True)
    os.makedirs(dist_dir, exist_ok=True)
    
    manifest = []
    
    print(f"Generating {len(VOICE_SPECS)} character voice assets...")
    for key, spec in VOICE_SPECS.items():
        signal = synthesize_audio(spec)
        wav_path = os.path.join(orig_dir, f"{key}.wav")
        mp3_path = os.path.join(dist_dir, f"{key}.mp3")
        
        # Write 24kHz 16-bit PCM WAV (Gemini TTS standard format)
        int16_data = (signal * 32767).astype(np.int16)
        with wave.open(wav_path, "w") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(int16_data.tobytes())
            
        # Convert to high-compatibility MP3 for browser distribution
        cmd = [
            "ffmpeg", "-y", "-i", wav_path,
            "-codec:a", "libmp3lame", "-b:a", "96k", "-ar", "24000",
            mp3_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        wav_size = os.path.getsize(wav_path)
        mp3_size = os.path.getsize(mp3_path) if os.path.exists(mp3_path) else 0
        
        # Audio measurements
        rms = np.sqrt(np.mean(signal**2))
        peak_amp = np.max(np.abs(signal))
        peak_db = 20 * math.log10(peak_amp) if peak_amp > 0 else -100
        rms_db = 20 * math.log10(rms) if rms > 0 else -100
        
        manifest.append({
            "key": key,
            "character": spec["char"],
            "gemini_voice": spec["gemini_voice"],
            "category": spec["category"],
            "text": spec["text"],
            "reading": spec["reading"],
            "style": spec["style"],
            "duration_s": round(spec["duration"], 2),
            "peak_db": round(peak_db, 2),
            "rms_db": round(rms_db, 2),
            "wav_path": wav_path,
            "mp3_path": mp3_path,
            "wav_bytes": wav_size,
            "mp3_bytes": mp3_size
        })
        print(f"  [OK] {key:22s} | {spec['char']:8s} | {spec['text']:20s} | Peak: {peak_db:.1f}dB, Dur: {spec['duration']}s")
        
    manifest_path = "/working_dir/c_620b05c3cf9faeb9/assets/audio/voices/manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        
    print(f"\nSaved manifest to {manifest_path}")

if __name__ == "__main__":
    main()
