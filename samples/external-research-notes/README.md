# External Sample: Research Notes

This sample shows a Markdown-first repository that stores a generated HTMLX package in `documents/`.

During the OpenWebDoc public preview, the `htmlx` command below assumes either a
checked-out OpenWebDoc repository running `pnpm htmlx ...` or a project-specific
tooling setup. Repositories can adopt HTMLX validation first through the
tag-pinned GitHub Action without installing an npm package.

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
