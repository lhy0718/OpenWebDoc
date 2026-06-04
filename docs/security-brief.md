# HTMLX Security Brief

Every `.htmlx` file is untrusted input.

HTMLX does not try to make arbitrary HTML safe by executing it in a larger sandbox. The public-alpha security model narrows the package surface instead: script-free documents, package-local resources, declared manifests, metadata guards, and validation before unpacking, sharing, or exporting.

## What Validation Blocks

| Risk                                | Control                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| ZIP path traversal                  | reject traversal, absolute paths, Windows drive paths, backslashes, null bytes, duplicate entries  |
| ZIP bomb-style input                | enforce package entry and uncompressed-size limits                                                 |
| Script execution                    | reject `<script>`, inline event handlers, `javascript:` URLs, iframes, and forms                   |
| Remote tracking or dependency drift | reject remote `src`, `href`, stylesheet `@import`, remote `url(...)`, and `file:` URLs             |
| Missing package assets              | require local resources referenced by HTML or CSS to exist and be declared in `manifest.resources` |
| Resource tampering                  | verify resource integrity when manifest integrity is declared                                      |
| Prompt-injection-style metadata     | treat LLM metadata and editing guides as user-visible reference data, not authority                |
| Stale agent metadata                | check `metadata/llm.json` with `htmlx refresh-metadata --check --json`                             |

## What Validation Does Not Prove

Validation does not prove who authored a document, whether the source claims are true, whether a package is endorsed by OpenWebDoc, or whether future cryptographic signatures are valid. A valid package is structurally safe to process under the HTMLX contract; it is not automatically a trusted-author document.

## Recommended Safe Workflow

```sh
htmlx unpack input.htmlx ./work --json
htmlx refresh-metadata ./work --check --json
htmlx validate ./work --json
htmlx pack ./work edited.htmlx --json
htmlx validate edited.htmlx --json
```

External agents should edit package-local files directly: `index.html`, `styles/*`, `metadata/*`, and declared `assets/*`. The browser app should not hold provider API keys, create hidden prompts, or run arbitrary package JavaScript.

## Public Trust Assets

OpenWebDoc should ship the following trust assets with public releases:

- valid and invalid conformance fixtures
- expected validator issue codes
- `security-invalid.htmlx` as an expected-failure package
- GitHub Action validation example
- release checklist with dependency audit, private path scanning, and metadata freshness checks
- provenance and signing roadmap that does not replace validation

For the full model, see [Security Model](security-model.md).
