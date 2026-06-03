# MIME and Extension Registration Strategy

The canonical extension is `.htmlx`.

The current internal media type candidate is:

```text
application/vnd.openwebdoc.htmlx+zip
```

This is a candidate for future registration, not an adoption prerequisite.

## Rationale

HTMLX is a ZIP-based document package, so a `+zip` structured suffix is the natural shape. The `vnd.openwebdoc` vendor tree keeps the early media type tied to the project while the conformance suite and independent implementation story mature.

## Registration Order

1. Keep `.htmlx`, `mimetype`, ZIP layout, `manifest.profile`, resource integrity, and metadata path contracts stable.
2. Publish a conformance suite with valid and invalid fixtures plus expected issue codes.
3. Publish a versioned format snapshot that separates HTMLX requirements from current OpenWebDoc app behavior.
4. Demonstrate external usage through GitHub Action validation, sample repositories, and at least one independent or embeddable implementation path.
5. Draft a vendor-tree media type registration packet for `application/vnd.openwebdoc.htmlx+zip`.
6. Consider standards-tree discussion only after partner implementations and conformance adoption exist.

## Non-Goals

- Do not use an unqualified type such as `application/htmlx` in the public alpha.
- Do not make OS file association the primary adoption path.
- Do not treat media type registration as proof of package safety.
- Do not freeze OpenWebDoc app behavior as the format standard.

## Current Distribution Surface

The public preview should rely on GitHub Pages, GitHub release assets, `.htmlx` downloads, and CI validation. PWA file handling or desktop file association can improve convenience later, but the first durable adoption signal is an external repository running `htmlx validate` in CI.
