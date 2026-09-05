#!/usr/bin/env python3
"""
OmniVoice HTTP TTS Server — wrapper cho pipeline VideAuto.

Nhận POST /tts { "text": "..." } → trả audio/mpeg (MP3 bytes).
Chạy OmniVoice model trên Apple M1 (MPS backend).

Usage:
    cd /Users/macbook/VSCode/AI_Gen/OmniVoice
    source venv/bin/activate
    python /path/to/VideAuto/scripts/omnivoice-server.py

Server sẽ chạy tại http://127.0.0.1:8123
"""

import io
import logging
import subprocess
import tempfile
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

import torch
# pyrefly: ignore [missing-import]
import soundfile as sf
import numpy as np

# pyrefly: ignore [missing-import]
from omnivoice import OmniVoice

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("omnivoice-server")

# ── Load model once at startup ──────────────────────────────────────────────
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
log.info(f"Loading OmniVoice model on {DEVICE}...")

model = OmniVoice.from_pretrained(
    "k2-fsa/OmniVoice",
    device_map=DEVICE,
    dtype=torch.float16 if DEVICE != "cpu" else torch.float32,
)
SAMPLE_RATE = model.sampling_rate  # 24000 Hz
log.info(f"Model loaded. Sample rate: {SAMPLE_RATE} Hz")


def wav_to_mp3(wav_bytes: bytes) -> bytes:
    """Convert WAV bytes to MP3 using ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wf:
        wf.write(wav_bytes)
        wav_path = wf.name
    mp3_path = wav_path.replace(".wav", ".mp3")
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", wav_path,
                "-c:a", "libmp3lame", "-b:a", "192k",
                "-ar", "44100", mp3_path,
            ],
            capture_output=True,
            check=True,
        )
        with open(mp3_path, "rb") as f:
            return f.read()
    finally:
        for p in (wav_path, mp3_path):
            try:
                os.unlink(p)
            except OSError:
                pass


class TTSHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/tts":
            self.send_error(404, "Not Found")
            return

        # Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            text = data.get("text", "").strip()
        except (json.JSONDecodeError, AttributeError):
            self.send_error(400, "Invalid JSON")
            return

        if not text:
            self.send_error(400, "Missing 'text' field")
            return

        log.info(f"TTS request: {text[:80]}{'...' if len(text) > 80 else ''}")

        try:
            seed = data.get("seed")
            instruct = data.get("instruct")
            ref_audio = data.get("ref_audio")
            ref_text = data.get("ref_text")

            if seed is not None:
                import random
                seed_val = int(seed)
                random.seed(seed_val)
                np.random.seed(seed_val)
                torch.manual_seed(seed_val)
                if torch.backends.mps.is_available():
                    torch.mps.manual_seed(seed_val)
                log.info(f"Using seed: {seed_val}")
                
            kwargs = {"text": text, "language": "Vietnamese"}
            if instruct:
                kwargs["instruct"] = instruct
                log.info(f"Using instruct: {instruct}")
            if ref_audio and ref_text:
                kwargs["ref_audio"] = ref_audio
                kwargs["ref_text"] = ref_text
                log.info(f"Using ref_audio: {ref_audio}")

            audios = model.generate(**kwargs)
            audio_np = audios[0]  # shape (T,) at SAMPLE_RATE Hz

            # Write to WAV buffer
            wav_buf = io.BytesIO()
            sf.write(wav_buf, audio_np, SAMPLE_RATE, format="WAV")
            wav_bytes = wav_buf.getvalue()

            # Convert to MP3
            mp3_bytes = wav_to_mp3(wav_bytes)

            log.info(f"Generated {len(mp3_bytes)} bytes MP3 "
                     f"({len(audio_np) / SAMPLE_RATE:.2f}s)")

            # Send response
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(mp3_bytes)))
            self.end_headers()
            self.wfile.write(mp3_bytes)

        except Exception as e:
            log.error(f"TTS generation failed: {e}", exc_info=True)
            self.send_error(500, f"TTS error: {e}")

    def do_GET(self):
        """Health check."""
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "device": DEVICE}).encode())
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        """Suppress default access logs — we use our own logger."""
        pass


def main():
    host = "127.0.0.1"
    port = 8123
    server = HTTPServer((host, port), TTSHandler)
    log.info(f"OmniVoice TTS server running at http://{host}:{port}")
    log.info("Endpoints: POST /tts (body: {\"text\": \"...\"}), GET /health")
    log.info("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down...")
        server.server_close()


if __name__ == "__main__":
    main()
