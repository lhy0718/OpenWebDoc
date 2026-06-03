# External Sample: Research Notes

This sample shows a Markdown-first repository that stores a generated HTMLX package in `documents/`.

## Flow

```sh
htmlx from-markdown content/research-notes.md documents/research-notes.htmlx --title "Research Notes" --json
htmlx validate documents/research-notes.htmlx --json
```

The pull request gate validates every `.htmlx` package under `documents/`.

## Review Boundary

- edit `content/research-notes.md` for source notes
- regenerate `documents/research-notes.htmlx`
- validate before merge
- keep larger document restructuring in source files, not in the browser runtime
