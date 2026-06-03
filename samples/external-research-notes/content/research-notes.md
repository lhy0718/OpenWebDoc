# Research Notes

HTMLX keeps research notes browser-readable while preserving a validation boundary for agent edits.

## Why this repository uses HTMLX

- Notes open as ordinary documents in the OpenWebDoc app.
- A coding agent can revise source text and regenerate the package.
- Pull requests fail when package validation fails.

## Review checklist

1. Confirm the source note reflects the intended claim.
2. Regenerate the `.htmlx` package.
3. Run `htmlx validate`.
4. Review the rendered package before merge.
