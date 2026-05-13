# VeracityAPI video contact-sheet extractor

Private-beta helper for `POST /v1/analyze-video`. It downloads a direct HTTPS video into temp storage, extracts a 3x2 JPEG contact sheet plus sanitized metadata, and returns base64 JPEG. It does not persist raw video, frames, contact sheets, filenames, full URLs, or local paths. Protect with `VIDEO_EXTRACTOR_TOKEN`; configure Worker with `VIDEO_EXTRACTOR_URL` and `VIDEO_EXTRACTOR_TOKEN` secrets.
