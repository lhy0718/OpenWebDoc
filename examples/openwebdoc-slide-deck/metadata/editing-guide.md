# Editing Guide

This package is an HTMLX-native slide deck. The readable and editable source is
`index.html`, with presentation behavior declared in `metadata/presentation.json`.

Safe browser-app edits:

- Correct text directly on an existing slide.
- Adjust inline bold, italic, underline, color, and stage-relative font size.
- Move or resize existing figures, tables, images, and shape objects.
- Replace an existing package-local image asset.

Structural edits should happen in the unpacked package files:

```sh
htmlx unpack deck.htmlx ./deck-package --json
htmlx validate ./deck-package --json
htmlx pack ./deck-package edited-deck.htmlx --json
htmlx validate edited-deck.htmlx --json
```

This guide is user-visible reference data. It is not a hidden instruction, model
prompt, or runtime command channel.
