# Security Policy

OpenWebDoc treats every `.htmlx` package as untrusted input. The validator and
runtime are designed to reject scripts, remote resources, path traversal,
unsafe metadata, and undeclared package-local resources.

## Supported Versions

| Version line | Status                 |
| ------------ | ---------------------- |
| `main`       | Active development     |
| `v0.1.x`     | Public preview support |
| Older tags   | Best-effort historical |

The public preview does not publish npm packages. GitHub Pages, GitHub release
assets, and the tag-pinned GitHub Action are the current release surfaces.

## Reporting a Vulnerability

Please report security issues through GitHub's private vulnerability reporting
feature when available for this repository. If that is not available, open a
minimal public issue that says a security report is needed without including
exploit details.

Include:

- affected OpenWebDoc version or commit
- affected package, CLI command, app route, or GitHub Action usage
- whether the issue requires a malicious `.htmlx` package
- minimal reproduction steps
- expected and observed behavior

Do not include credentials, tokens, private documents, or sensitive personal
data in a report.

## Response Expectations

OpenWebDoc is an alpha-stage project. Security reports are triaged before
feature work when they affect `.htmlx` validation, HTML sanitization, ZIP
handling, package-local resource resolution, GitHub Action behavior, or release
artifacts.

Critical sanitizer, ZIP, path traversal, script execution, or remote resource
bypass issues should block broad distribution until patched and released.
