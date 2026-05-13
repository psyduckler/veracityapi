#!/usr/bin/env bash
set -euo pipefail
[[ $# -ge 2 ]] || { echo "Usage: $0 input-video output-prefix" >&2; exit 2; }
INPUT="$1"; PREFIX="$2"; OUT_JPG="${PREFIX}.jpg"; OUT_JSON="${PREFIX}.metadata.json"
[[ -f "$INPUT" ]] || { echo "Input video not found: $INPUT" >&2; exit 2; }
DURATION=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$INPUT")
STEP=$(python3 - <<PY
D=float(${DURATION}); print(max(D/6,0.1))
PY
)
ffmpeg -y -hide_banner -loglevel error -i "$INPUT" -frames:v 6 -vf "fps=1/${STEP},scale=320:-1,tile=3x2" -q:v 3 "$OUT_JPG"
ffprobe -v error -show_format -show_streams -of json "$INPUT" | python3 -c 'import json,sys; raw=json.load(sys.stdin); streams=raw.get("streams") or []; v=next((s for s in streams if s.get("codec_type")=="video"),{}); f=raw.get("format") or {}; print(json.dumps({"duration_seconds":round(float(v.get("duration") or f.get("duration") or 0),2),"width":int(v.get("width") or 0),"height":int(v.get("height") or 0),"format_name":str(f.get("format_name") or "")[:80],"codec_name":str(v.get("codec_name") or "")[:80],"size_bytes":int(f.get("size") or 0),"has_audio":any(s.get("codec_type")=="audio" for s in streams)},indent=2,sort_keys=True))' > "$OUT_JSON"
echo "Wrote $OUT_JPG and $OUT_JSON"
