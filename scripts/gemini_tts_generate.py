#!/usr/bin/env python3
"""
Regenerate Character Voice Assets using official Google Gemini TTS API (gemini-3.8-flash-lite-tts).
Strictly adheres to official Google AI documentation (2026 specifications):
- Model: gemini-3.8-flash-lite-tts (or gemini-3.8-flash-tts)
- Endpoint: Google AI Studio / Gemini API generateContent or Interactions API
- Output format: 24kHz WAV (AUDIO_WAV) -> compressed to 96kbps MP3 via ffmpeg
- Zero hardcoded API keys: Reads strictly from GEMINI_API_KEY environment variable.

Usage:
  export GEMINI_API_KEY="your-api-key"
  python3 scripts/gemini_tts_generate.py [--force] [--keys key1,key2]
"""
import os
import sys
import json
import base64
import argparse
import subprocess
import urllib.request
import urllib.error

API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
DEFAULT_MODEL = "gemini-3.8-flash-lite-tts"

def load_manifest(manifest_path):
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)

def generate_tts_for_item(item, api_key, model=DEFAULT_MODEL):
    url = API_URL_TEMPLATE.format(model=model, api_key=api_key)
    
    # Official payload structure for Gemini TTS (GenerateContent API with speechConfig)
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": item["text"],
                        "speech_metadata": {
                            "speaker": item["character"],
                            "style": item["style"]
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": item["gemini_voice"]
                    }
                }
            }
        }
    }
    
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError(f"No candidates returned: {data}")
            parts = candidates[0].get("content", {}).get("parts", [])
            for p in parts:
                if "inlineData" in p and p["inlineData"].get("mimeType", "").startswith("audio/"):
                    audio_b64 = p["inlineData"]["data"]
                    return base64.b64decode(audio_b64)
            raise RuntimeError(f"No audio data found in response parts: {parts}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code}: {err_body}")

def main():
    parser = argparse.ArgumentParser(description="Regenerate voice assets with Gemini TTS")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Gemini TTS model name")
    parser.add_argument("--keys", help="Comma-separated keys to regenerate (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Print requests without calling API")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        print("[ERROR] GEMINI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Please export GEMINI_API_KEY='your-key' before running this script.", file=sys.stderr)
        sys.exit(1)

    manifest_path = os.path.join(os.path.dirname(__file__), "../assets/audio/voices/manifest.json")
    manifest = load_manifest(manifest_path)

    keys_filter = set(args.keys.split(",")) if args.keys else None

    print(f"Loaded {len(manifest)} voice specs from {manifest_path}")
    print(f"Target model: {args.model}")

    for item in manifest:
        if keys_filter and item["key"] not in keys_filter:
            continue
        print(f"\nProcessing [{item['key']}] ({item['character']}): '{item['text']}' using voice '{item['gemini_voice']}'...")
        if args.dry_run:
            print(f"  [DRY-RUN] Would request TTS with voice={item['gemini_voice']}, style={item['style']}")
            continue

        try:
            audio_bytes = generate_tts_for_item(item, api_key, model=args.model)
            wav_path = item["wav_path"]
            mp3_path = item["mp3_path"]
            
            with open(wav_path, "wb") as f:
                f.write(audio_bytes)
            print(f"  Saved WAV: {wav_path} ({len(audio_bytes)} bytes)")
            
            # Transcode to MP3
            cmd = ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "96k", "-ar", "24000", mp3_path]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            print(f"  Saved MP3: {mp3_path} ({os.path.getsize(mp3_path)} bytes)")
        except Exception as e:
            print(f"  [FAILED] {e}", file=sys.stderr)

    print("\nRegeneration routine complete.")

if __name__ == "__main__":
    main()
