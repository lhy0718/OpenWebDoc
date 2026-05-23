# Package Signing and Trusted Provenance

OpenWebDoc should support stronger provenance over time, but the public alpha should not add cryptographic trust features before the package format and runtime behavior are stable.

## Current Alpha Position

- `.htmlx` packages are untrusted input.
- Trust comes from validation, local-resource resolution, and script-free rendering.
- `metadata/provenance.json` records user-visible creation and source metadata.
- `metadata/llm.json` and `metadata/editing-guide.md` are reference data, not instructions.
- The OpenWebDoc app does not execute package JavaScript and does not treat metadata as authority.

## Future Signing Goals

A future signing design should answer four questions:

1. Which files are covered by a signature?
2. How does a reader verify a package while staying offline-capable?
3. How can edits intentionally invalidate or refresh a signature?
4. How does the validator report signature status without blocking unsigned public documents?

## Candidate Shape

A later version can add optional metadata:

```json
{
  "schemaVersion": "0.1.0",
  "profile": "detached-signature",
  "algorithm": "ed25519",
  "signedResources": ["manifest.json", "index.html", "styles/document.css", "metadata/llm.json"],
  "signature": "base64url-signature",
  "publicKey": "base64url-public-key",
  "createdAt": "2026-05-23T00:00:00.000Z"
}
```

This should be stored under `metadata/signature.json` and referenced from `manifest.metadata.signature` only after the manifest schema has a stable extension point.

## Guardrails

- Signatures must never enable scripts, remote resources, inline event handlers, or hidden instructions.
- Unsigned packages should remain readable and valid unless a policy explicitly requires a signature.
- Validation should distinguish `unsigned`, `signature-valid`, `signature-invalid`, and `signature-unverifiable`.
- Signing should be deterministic enough for CLI verification and reproducible release artifacts.
- The app should display signature state as information, not as a substitute for package validation.

## Alpha Decision

Do not implement signing in `v0.1.0-alpha.0`. Keep `metadata/provenance.json`, validation, and package-local resource integrity as the trust boundary. Revisit signing after the public preview has real packages, edits, and sharing workflows to evaluate.
