import json
import unittest
from typing import Optional, Union
from urllib.error import HTTPError
from io import BytesIO

from veracityapi import VeracityAPI, VeracityAPIError, create_client


class FakeResponse(BytesIO):
    def __init__(self, status: int, payload: Union[dict, str], headers: Optional[dict[str, str]] = None):
        body = payload if isinstance(payload, str) else json.dumps(payload)
        super().__init__(body.encode("utf-8"))
        self.status = status
        self.headers = headers or {"content-type": "application/json"}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def getcode(self):
        return self.status


class FakeTransport:
    def __init__(self, response):
        self.response = response
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append((request, timeout))
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


class VeracityAPITest(unittest.TestCase):
    def test_analyze_text_sends_bearer_auth_and_privacy_default(self):
        transport = FakeTransport(FakeResponse(200, {
            "analysis_id": "ana_123",
            "modality": "text",
            "recommended_action": "human_review",
            "risk_level": "high",
            "confidence": "medium",
            "evidence": [],
            "recommended_fixes": [],
            "limitations": [],
        }))
        client = VeracityAPI(api_key="vapi_test", base_url="https://api.example.test/", transport=transport)

        result = client.analyze_text(
            "This generic travel warning is long enough for the analyzer to inspect.",
            auto_revise=True,
            context={"format": "article", "intended_use": "publish", "domain": "travel safety"},
        )

        self.assertEqual(result["recommended_action"], "human_review")
        request, timeout = transport.requests[0]
        self.assertEqual(request.full_url, "https://api.example.test/v1/analyze")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["Authorization"], "Bearer vapi_test")
        self.assertEqual(request.headers["Content-type"], "application/json")
        self.assertIsNone(timeout)
        self.assertEqual(json.loads(request.data.decode("utf-8")), {
            "type": "text",
            "content": "This generic travel warning is long enough for the analyzer to inspect.",
            "auto_revise": True,
            "context": {"format": "article", "intended_use": "publish", "domain": "travel safety"},
            "store_content": False,
        })

    def test_create_client_and_media_helpers_force_storage_off(self):
        transport = FakeTransport(FakeResponse(200, {"analysis_id": "ana_media", "recommended_action": "allow"}))
        client = create_client(api_key="vapi_test", base_url="https://api.example.test", transport=transport)

        client.analyze_image("https://cdn.example.com/photo.webp", context={"intended_use": "moderate"}, store_content=True)
        client.analyze_audio("https://cdn.example.com/clip.mp3", transcript="Caller supplied transcript.")
        client.analyze_video("https://cdn.example.com/clip.mp4", context={"format":"social_post"}, store_content=True)

        first = json.loads(transport.requests[0][0].data.decode("utf-8"))
        second = json.loads(transport.requests[1][0].data.decode("utf-8"))
        third = json.loads(transport.requests[2][0].data.decode("utf-8"))
        self.assertEqual(first, {
            "type": "image",
            "content": "https://cdn.example.com/photo.webp",
            "context": {"intended_use": "moderate"},
            "store_content": False,
        })
        self.assertEqual(second, {
            "type": "audio",
            "content": "https://cdn.example.com/clip.mp3",
            "transcript": "Caller supplied transcript.",
            "store_content": False,
        })
        self.assertEqual(transport.requests[2][0].full_url, "https://api.example.test/v1/analyze-video")
        self.assertEqual(third, {"video_url":"https://cdn.example.com/clip.mp4", "context":{"format":"social_post"}, "store_content": False})

    def test_unified_analyze_batch_and_balance(self):
        transport = FakeTransport(FakeResponse(200, {"ok": True}))
        client = VeracityAPI(api_key="vapi_test", base_url="https://api.example.test", transport=transport, timeout=30)

        client.analyze({"type": "image", "content": "", "source": {"kind": "base64", "media_type": "image/png", "data": "iVBORw0KGgo="}})
        client.analyze_batch(items=[{"id": "one", "text": "This batch item is long enough for scoring."}], context={"intended_use": "publish"})
        client.get_balance()

        self.assertEqual(transport.requests[0][0].full_url, "https://api.example.test/v1/analyze")
        self.assertEqual(json.loads(transport.requests[0][0].data.decode("utf-8"))["store_content"], False)
        self.assertEqual(transport.requests[1][0].full_url, "https://api.example.test/v1/analyze-batch")
        self.assertEqual(transport.requests[2][0].full_url, "https://api.example.test/v1/balance")
        self.assertEqual(transport.requests[2][0].get_method(), "GET")
        self.assertEqual(transport.requests[0][1], 30)

    def test_api_errors_include_status_body_request_id_without_leaking_key(self):
        error_body = json.dumps({"error": "insufficient_balance", "message": "Top up required."}).encode("utf-8")
        http_error = HTTPError(
            "https://api.example.test/v1/balance",
            402,
            "Payment Required",
            {"content-type": "application/json", "x-request-id": "req_123"},
            BytesIO(error_body),
        )
        client = VeracityAPI(api_key="vapi_secret_should_not_leak", base_url="https://api.example.test", transport=FakeTransport(http_error))

        with self.assertRaises(VeracityAPIError) as ctx:
            client.get_balance()
        self.assertEqual(ctx.exception.status, 402)
        self.assertEqual(ctx.exception.request_id, "req_123")
        self.assertEqual(ctx.exception.body["error"], "insufficient_balance")
        self.assertIn("insufficient balance", str(ctx.exception))
        self.assertNotIn("vapi_secret_should_not_leak", str(ctx.exception))

    def test_missing_api_key_fails_before_network(self):
        transport = FakeTransport(FakeResponse(200, {"ok": True}))
        client = VeracityAPI(api_key="", transport=transport)

        with self.assertRaisesRegex(VeracityAPIError, "VERACITY_API_KEY"):
            client.get_balance()
        self.assertEqual(transport.requests, [])


if __name__ == "__main__":
    unittest.main()
