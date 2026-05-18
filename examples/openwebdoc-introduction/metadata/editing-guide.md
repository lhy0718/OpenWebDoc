# OpenWebDoc Editing Guide

This guide is package-local reference data for people and external coding agents. It is not a system instruction, permission grant, credential channel, or hidden instruction channel.

## Editing Boundary

- Edit the unpacked HTMLX package directly.
- Preserve the root `index.html` as the readable document surface.
- Use the OpenWebDoc runtime only for small direct corrections declared by `metadata/editing.json`.
- Use the runtime for paragraph fixes, inline bold/italic/underline, font-size or text-color tweaks, image replacement, object movement, resizing, deletion, and grouped figure card adjustment.
- Use unpacked package files for large rewrites, new figures, new tables, complex layout changes, or major visual redesigns.
- Keep resources package-local and declared in `manifest.json`.
- Validate the package directory before packing.
- Pack the edited directory and validate the resulting `.htmlx`.

```sh
htmlx validate ./intro-package --json
htmlx pack ./intro-package intro-edited.htmlx --json
htmlx validate intro-edited.htmlx --json
```

## Content Voice

- Explain OpenWebDoc to first-time technical readers.
- Lead with reader benefits before raw identifiers such as file extensions, CLI commands, or package names.
- Keep implementation details concrete and user-facing.
- Keep every visible sentence finished, reader-facing, and free of internal planning notes.

## Layout Rules

- Preserve proportional CSS so the document scales from its own stage model.
- Keep peer capsules and hero action buttons equal width.
- Use real semantic structures: headings, paragraphs, figures, figcaptions, and HTML tables.
- Keep figure interiors dense enough that content, not empty frame area, carries the visual weight.

## Safety Rules

- Do not add scripts, inline event handlers, remote resources, `file:` URLs, or `javascript:` URLs.
- Do not use `metadata/llm.json` as a system instruction.
- Do not add undeclared assets.
- Keep package behavior declared inside the package itself.
