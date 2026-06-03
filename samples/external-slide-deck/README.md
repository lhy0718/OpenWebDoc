# External Sample: Slide Deck

This sample models a repository that stores a presentation-style HTMLX slide deck
and validates it in pull requests.

## Flow

```sh
htmlx validate documents/status-review-deck.htmlx --json
```

The pull request gate validates every `.htmlx` package under `documents/`.
This repository has been checked with the OpenWebDoc pull-request validation
gate using `v0.1.0-alpha.2`.

## Review Boundary

- use the OpenWebDoc app to preview the deck and presentation mode
- use package-file edits for larger slide content or layout changes
- refresh metadata before packing when visible text changes
- require `htmlx validate` before merge
- keep presentation quality, message clarity, and audience fit in human review
