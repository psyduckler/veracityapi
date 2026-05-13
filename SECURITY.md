# Security Policy

VeracityAPI is a beta content-verification API for agent workflows. Please report security issues privately so they can be fixed before public disclosure.

## Supported versions

| Version | Status |
| --- | --- |
| `v0.1.x` | Supported beta |

## Reporting a vulnerability

Email [hello@veracityapi.com](mailto:hello@veracityapi.com) with:

- affected endpoint, page, package, or integration
- steps to reproduce
- impact assessment
- any relevant request IDs, timestamps, or screenshots

Do **not** include API keys, bearer tokens, customer content, private media URLs, or other secrets in the report. If a proof of concept needs credentials, describe the setup and redact secrets.

## Scope

In scope:

- authentication or authorization bypass
- account/API-key leakage
- billing or credit-balance manipulation
- stored XSS or script injection on `veracityapi.com`
- raw text/media retention that contradicts documented `store_content:false` behavior
- package supply-chain issues in `packages/mcp`

Out of scope unless paired with a concrete exploit:

- generic model prompt-injection examples
- complaints about detector accuracy or false positives
- denial-of-service from extremely high request volume without a bypass
- social engineering against maintainers

## Privacy-sensitive reporting notes

VeracityAPI should not store image/audio/video bytes, base64 payloads, frames/contact sheets, or full media URLs by default. Text requests should avoid raw-text retention when `store_content:false` or legacy `privacy_mode:true` is used. Report any observed drift from that contract.

## Disclosure

We aim to acknowledge reports within 3 business days and provide a remediation plan or status update within 10 business days for valid issues.
