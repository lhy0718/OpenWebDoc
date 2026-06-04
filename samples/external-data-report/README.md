# External Sample: Data Report

This sample models a repository that keeps an analytics-style report as a validated
HTMLX package under `documents/`.

During the OpenWebDoc public preview, the `htmlx` command below assumes either a
checked-out OpenWebDoc repository running `pnpm htmlx ...` or a project-specific
tooling setup. Repositories can adopt HTMLX validation first through the
tag-pinned GitHub Action without installing an npm package.

## Flow

```sh
htmlx validate documents/support-quality-report.htmlx --json
```

The pull request gate validates every `.htmlx` package under `documents/`.
This repository has been checked with the OpenWebDoc pull-request validation
gate using `v0.1.0-alpha.3`.

## Review Boundary

- update the source notes in `content/support-quality-report.md`
- let a coding agent revise package-local files only when a larger report edit is needed
- refresh metadata before packing when visible text changes
- require `htmlx validate` before merge
- keep factual interpretation and visual quality in human review
