# OpenWebDoc Security Model

Every `.htmlx` file is treated as untrusted input.

## MVP Controls

- Reject path traversal, absolute paths, Windows drive paths, null bytes, and backslashes.
- Enforce package entry and uncompressed-size limits.
- Require valid `manifest.json`.
- Reject scripts, inline event handlers, `javascript:` URLs, remote resources, iframes, and forms.
- Reject document-local `src` and `href` references that are missing from the package or absent from `manifest.resources`.
- Resolve resources from package-local files only and render them through temporary browser object URLs.
- Reject stylesheet `@import`, remote `url(...)`, `file:` URLs, and `javascript:` references.
- Treat LLM metadata as user-visible reference data, never as system instructions.
- Validate external agent workspaces before accepting edits back into `.htmlx` packages.

The CLI refuses to unpack invalid packages and does not include an unsafe bypass flag in MVP.
