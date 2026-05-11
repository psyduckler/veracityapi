from __future__ import annotations

import json
import os
from typing import Any, Callable, Mapping, Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .types import AnalyzeResponse, Context

Transport = Callable[..., Any]


class VeracityAPIError(Exception):
    def __init__(self, message: str, *, status: int, body: Any = None, request_id: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.body = body
        self.request_id = request_id


class VeracityAPI:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        transport: Optional[Transport] = None,
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("VERACITY_API_KEY", "")
        self.base_url = (base_url or os.environ.get("VERACITY_API_BASE_URL") or "https://api.veracityapi.com").rstrip("/")
        self.timeout = timeout
        self.transport = transport or urlopen

    def analyze(self, payload: Mapping[str, Any]) -> AnalyzeResponse:
        body = dict(payload)
        body.setdefault("store_content", False)
        return self._post("/v1/analyze", body)

    def analyze_text(
        self,
        text: str,
        *,
        context: Optional[Context] = None,
        auto_revise: bool = False,
        store_content: bool = False,
    ) -> AnalyzeResponse:
        return self._post("/v1/analyze", _without_none({
            "type": "text",
            "content": text,
            "auto_revise": auto_revise,
            "context": context,
            "store_content": store_content,
        }))

    def analyze_image(
        self,
        image_url: str,
        *,
        context: Optional[Context] = None,
        store_content: bool = False,
    ) -> AnalyzeResponse:
        _ = store_content
        return self._post("/v1/analyze", _without_none({
            "type": "image",
            "content": image_url,
            "context": context,
            "store_content": False,
        }))

    def analyze_audio(
        self,
        audio_url: str,
        *,
        transcript: Optional[str] = None,
        context: Optional[Context] = None,
        store_content: bool = False,
    ) -> AnalyzeResponse:
        _ = store_content
        return self._post("/v1/analyze", _without_none({
            "type": "audio",
            "content": audio_url,
            "transcript": transcript,
            "context": context,
            "store_content": False,
        }))

    def analyze_batch(
        self,
        *,
        items: list[dict[str, str]],
        context: Optional[Context] = None,
        store_content: bool = False,
    ) -> dict[str, Any]:
        return self._post("/v1/analyze-batch", _without_none({
            "items": items,
            "context": context,
            "store_content": store_content,
        }))

    def get_balance(self) -> dict[str, Any]:
        return self._request("GET", "/v1/balance")

    def _post(self, path: str, body: Mapping[str, Any]) -> Any:
        return self._request("POST", path, body)

    def _request(self, method: str, path: str, body: Optional[Mapping[str, Any]] = None) -> Any:
        if not self.api_key:
            raise VeracityAPIError("VERACITY_API_KEY is required. Create an API key at https://veracityapi.com/account.", status=401)

        data = json.dumps(body).encode("utf-8") if method == "POST" else None
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if method == "POST":
            headers["Content-Type"] = "application/json"

        request = Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        try:
            response = self.transport(request, timeout=self.timeout)
            with response:
                payload = _parse_response(response.read(), getattr(response, "headers", {}))
                status = int(getattr(response, "status", response.getcode()))
        except HTTPError as error:
            raw = error.read()
            payload = _parse_response(raw, error.headers)
            raise VeracityAPIError(
                _error_message(error.code, payload),
                status=error.code,
                body=payload,
                request_id=_header(error.headers, "x-request-id"),
            ) from None

        if status < 200 or status >= 300:
            raise VeracityAPIError(_error_message(status, payload), status=status, body=payload, request_id=_header(getattr(response, "headers", {}), "x-request-id"))
        return payload


def _without_none(body: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in body.items() if value is not None}


def create_client(**options: Any) -> VeracityAPI:
    return VeracityAPI(**options)


def _parse_response(raw: bytes, headers: Mapping[str, str]) -> Any:
    if not raw:
        return {}
    text = raw.decode("utf-8", errors="replace")
    content_type = _header(headers, "content-type") or ""
    if "application/json" in content_type or text.lstrip().startswith(("{", "[")):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    return {"message": text[:500]}


def _error_message(status: int, body: Any) -> str:
    message = _body_message(body)
    if status == 400:
        return f"VeracityAPI bad request: {message}"
    if status == 401:
        return "VeracityAPI unauthorized: missing or invalid API key. Create an API key at https://veracityapi.com/account."
    if status == 402:
        return f"VeracityAPI insufficient balance: {message} Top up at https://veracityapi.com/account."
    if status == 429:
        return f"VeracityAPI rate limited: {message}. Retry later."
    if status == 503:
        return f"VeracityAPI scoring model unavailable: {message}. Retry shortly."
    return f"VeracityAPI returned HTTP {status}: {message}"


def _body_message(body: Any) -> str:
    if isinstance(body, dict):
        if isinstance(body.get("message"), str):
            return body["message"]
        if isinstance(body.get("error"), str):
            return body["error"]
    return "Request failed"


def _header(headers: Mapping[str, str], name: str) -> Optional[str]:
    lower = name.lower()
    for key, value in headers.items():
        if key.lower() == lower:
            return value
    return None
