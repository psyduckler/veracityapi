from __future__ import annotations

import base64
import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

import modal
import requests
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, HttpUrl

app = modal.App("veracity-video-contact-sheet-extractor")
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("fastapi", "pydantic", "requests")
)

web_app = FastAPI(title="VeracityAPI Video Contact Sheet Extractor")


class ExtractRequest(BaseModel):
    video_url: HttpUrl
    max_bytes: int = 25_000_000
    max_duration_seconds: int = 30


def check_auth(authorization: str | None):
    token = os.environ.get("VIDEO_EXTRACTOR_TOKEN")
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="unauthorized")


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, timeout=80, check=False)


def download(url: str, path: Path, max_bytes: int):
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="video_url must be HTTPS")
    with requests.get(url, stream=True, timeout=(10, 45), headers={"user-agent": "VeracityAPI-VideoExtractor/0.1"}) as res:
        if res.status_code >= 400:
            raise HTTPException(status_code=400, detail="video_url could not be downloaded")
        total = 0
        with path.open("wb") as fh:
            for chunk in res.iter_content(1024 * 1024):
                if not chunk:
                    continue
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(status_code=413, detail="video exceeds max_bytes")
                fh.write(chunk)


def probe(path: Path, max_duration: int):
    proc = run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)])
    if proc.returncode:
        raise HTTPException(status_code=400, detail="ffprobe could not read video")
    raw = json.loads(proc.stdout or "{}")
    streams = raw.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    fmt = raw.get("format") or {}
    duration = float(video.get("duration") or fmt.get("duration") or 0)
    if duration <= 0:
        raise HTTPException(status_code=400, detail="video duration unavailable")
    if duration > max_duration:
        raise HTTPException(status_code=413, detail=f"video duration exceeds {max_duration} seconds")

    def fps(rate: str | None) -> float:
        try:
            a, b = str(rate or "0/1").split("/")
            return round(float(a) / max(float(b), 1.0), 2)
        except Exception:
            return 0

    return {
        "duration_seconds": round(duration, 2),
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "fps": fps(video.get("avg_frame_rate") or video.get("r_frame_rate")),
        "format_name": str(fmt.get("format_name") or "")[:80],
        "codec_name": str(video.get("codec_name") or "")[:80],
        "size_bytes": int(fmt.get("size") or path.stat().st_size),
        "has_audio": any(s.get("codec_type") == "audio" for s in streams),
    }


def sheet(path: Path, out: Path, duration: float):
    stamps = [round(duration * p, 2) for p in (0.08, 0.24, 0.40, 0.56, 0.72, 0.88)]
    vf = f"fps=1/{max(duration / 6, 0.1)},scale=320:-1,tile=3x2"
    proc = run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(path), "-frames:v", "6", "-vf", vf, "-q:v", "3", str(out)])
    if proc.returncode or not out.exists():
        raise HTTPException(status_code=400, detail="ffmpeg could not extract contact sheet")
    return stamps


@web_app.post("/extract")
def extract(req: ExtractRequest, authorization: Annotated[str | None, Header()] = None):
    check_auth(authorization)
    with tempfile.TemporaryDirectory() as tmp:
        inp = Path(tmp) / "input.video"
        out = Path(tmp) / "contact-sheet.jpg"
        download(str(req.video_url), inp, min(req.max_bytes, 25_000_000))
        metadata = probe(inp, min(req.max_duration_seconds, 30))
        stamps = sheet(inp, out, float(metadata["duration_seconds"]))
        return {
            "contact_sheet_base64": base64.b64encode(out.read_bytes()).decode("ascii"),
            "metadata": metadata,
            "sampled_timestamps": stamps,
        }


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("veracity-video-extractor")],
    scaledown_window=60,
    timeout=120,
)
@modal.asgi_app()
def fastapi_app():
    return web_app
