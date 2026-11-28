#!/usr/bin/env python3
"""QalamAI's own Uzbek voice: a tiny HTTP service around tiny-voca.

tiny-voca (Inomjonov/tiny-voca-uzbek-navoiy, Apache-2.0) is a 4.5M-parameter Uzbek TTS model
trained on speech from Aisha's Navoiy TTS. It runs far faster than real time on a plain CPU,
so it needs no GPU and no paid service. It has one voice (a man, "M2"); the woman's voice is the
same model with the pitch raised.

    GET  /health                         → {"ok": true, "voices": ["m", "f"]}
    POST /speak {text, voice, speed}     → audio/wav (24 kHz, mono, 16-bit)

Only the API container talks to it (docker network); it is not published to the internet.
The Node API caches every answer, so each sentence is synthesized once.

Environment:
    TTS_MODEL_DIR     the model snapshot (inference.pt, src/, uzbek_normalize.py)
    TTS_PORT          8000
    TTS_THREADS       CPU threads for one synthesis (2)
    TTS_FEMALE_PITCH  log-F0 shift for the woman's voice (0.62 ≈ 11 semitones)
"""
import io
import json
import os
import sys
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MODEL_DIR = Path(os.environ.get("TTS_MODEL_DIR", "/model"))
sys.path.insert(0, str(MODEL_DIR / "src"))
sys.path.insert(1, str(MODEL_DIR))

import torch  # noqa: E402
from tiny_voca.infer import load_model, speak_text  # noqa: E402
from uzbek_normalize import normalize  # noqa: E402

torch.set_num_threads(int(os.environ.get("TTS_THREADS", "2")))
FEMALE_PITCH = float(os.environ.get("TTS_FEMALE_PITCH", "0.62"))
TEXT_MAX = 1200
MODEL = load_model(MODEL_DIR / "inference.pt", device="cpu")
RATE = MODEL.config.sample_rate
LOCK = threading.Lock()  # one synthesis at a time: the CPU is shared with the rest of the server


def synthesize(text, voice, speed):
    spoken = normalize(text, mode="infer")
    with LOCK, torch.inference_mode():
        audio, _ = speak_text(MODEL, spoken, "M2", speed=speed, pitch_shift=FEMALE_PITCH if voice == "f" else 0.0, seed=42)
    pcm = (audio.clamp(-1, 1) * 32767).to(torch.int16).numpy().tobytes()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    server_version = "qalam-tts/1"

    def log_message(self, fmt, *args):  # quiet: the API logs what matters
        pass

    def answer(self, status, body, kind="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", kind)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self.answer(200, {"ok": True, "voices": ["m", "f"], "sampleRate": RATE})
        self.answer(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/speak":
            return self.answer(404, {"error": "not found"})
        try:
            size = int(self.headers.get("content-length", "0"))
            if size <= 0 or size > 64_000:
                return self.answer(413, {"error": "body size"})
            body = json.loads(self.rfile.read(size))
            text = str(body.get("text", "")).strip()[:TEXT_MAX]
            voice = "f" if body.get("voice") == "f" else "m"
            speed = min(1.5, max(0.6, float(body.get("speed", 1.0))))
            if not text:
                return self.answer(400, {"error": "empty text"})
            self.answer(200, synthesize(text, voice, speed), "audio/wav")
        except Exception as err:  # a sentence the model can't read must not stop the service
            self.answer(422, {"error": type(err).__name__, "message": str(err)[:200]})


if __name__ == "__main__":
    port = int(os.environ.get("TTS_PORT", "8000"))
    print(f"qalam-tts on :{port} ({MODEL_DIR})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
