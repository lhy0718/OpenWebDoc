# Status Review Deck

This source note describes the slide deck packaged as
`documents/status-review-deck.htmlx`.

## Why this repository uses HTMLX

- The deck remains a browser-readable package instead of a closed presentation file.
- The slide-deck profile can be validated in CI.
- An external coding agent can make bounded edits to the unpacked package and return
  through validation.

## Review checklist

1. Confirm the deck opens in read mode.
2. Confirm presentation mode shows one centered slide.
3. Confirm the `.htmlx` package validates in CI.
4. Review message clarity separately from package integrity.
