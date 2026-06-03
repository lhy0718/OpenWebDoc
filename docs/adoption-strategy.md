# Positioning and Adoption Strategy

HTMLX should spread as a verified AI document workflow before it spreads as a general-purpose file format.

## Positioning

Strong positioning:

> HTMLX is an agent-safe, browser-readable document package for verified local editing.

HTMLX packages make ordinary web documents portable while keeping validation close to the editing workflow. A package carries HTML, CSS, local assets, an explicit manifest, security rules, provenance-ready metadata, and user-visible LLM reference data.

OpenWebDoc is the reference implementation and toolchain: opener, validator, packer, runtime, template gallery, and external-agent workflow surface.

## First Users

| Priority | Audience                           | Reason                                                                                                       |
| -------: | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
|        1 | AI coding agent users              | Codex, Claude Code, Cursor, and similar tools can edit unpacked package files and return through validation. |
|        2 | Developers and maintainers         | CLI validation, GitHub Actions, and template packages fit existing CI workflows.                             |
|        3 | Document automation teams          | Reports and generated documents need package-local assets, validation, and reproducible exports.             |
|        4 | Research and benchmark communities | HTMLX can serve as a document-agent reliability fixture format.                                              |
|        5 | General users                      | They benefit after opener, converter, and template workflows are already reliable.                           |

## Distribution Flywheel

```text
Strong templates
-> fast browser opener
-> CLI validation
-> GitHub Action
-> Markdown converter
-> static HTML export
-> HTML converter
-> AI agent cookbook
-> real usage demos
-> third-party viewers and converters
-> media type registration
-> standardization discussion
```

Standardization should follow adoption. The early product should focus on practical opener, validator, converter, template, and agent-editing workflows.

## First 30 Days

- Cut public alpha GitHub releases with example `.htmlx` packages, npm tarballs, user-facing release notes, and a spec snapshot.
- Keep npm registry publishing as an explicit release decision. If enabled, publish only scoped `@openwebdoc/*` packages with alpha or canary tags.
- Make the GitHub Action validator easy to copy into another repository, using tag-pinned examples by default.
- Provide a SHA-pinned GitHub Action variant for repositories that treat the validator as a supply-chain dependency.
- Show the four-step workflow on the landing page: open, validate, edit with an agent, export.
- Keep ten strong templates visible and downloadable from GitHub Pages.
- Add a conformance page and fixture runner so external validators can compare expected issue codes.
- Publish short security and MIME/extension briefs to reduce early adoption uncertainty.
- Publish an Agentic Document Integrity CI report shape so external repositories know what a pass or failure should communicate.
- Provide three copyable external sample repositories for Markdown-first notes, safe HTML migration, and agent-edited briefs.
- Publish a 30-minute pilot script so teams can test one agent-edited `.htmlx` PR without adopting the whole toolchain.
- Maintain a pilot target list focused on Git-based document workflows rather than general office-suite users.
- Export and verify sample skeletons in `dist/sample-repos/`, and publish downloadable starter repository archives from GitHub Pages so template candidates can be reviewed before separate repositories are created.

## Months 1-3

Converter and integration work has the highest leverage:

| Priority | Feature                | Why                                                                        |
| -------: | ---------------------- | -------------------------------------------------------------------------- |
|        1 | `htmlx from-markdown`  | Developer and research workflows can enter HTMLX without custom authoring. |
|        2 | `htmlx to-static-html` | Users can leave the package format without lock-in concerns.               |
|        3 | `htmlx from-html`      | Existing standalone HTML documents can become `.htmlx` packages.           |
|        4 | `htmlx to-pdf`         | Sharing and print workflows get an escape hatch.                           |
|        5 | VS Code extension      | Inspect, validate, pack, and unpack can live near editing.                 |
|        6 | React viewer package   | Other applications can embed validated HTMLX rendering.                    |

`htmlx from-markdown`, `htmlx from-html`, and `htmlx to-static-html` are the first implemented web-native converter set. DOCX, HWPX, PPTX, and PDF round-trip import/export should stay behind these simpler web-native converters.

## Months 3-6

- Publish a conformance suite with valid packages, invalid packages, and expected issue codes.
- Expand the agent cookbook for Codex, Claude Code, Cursor, GitHub Copilot, and Aider.
- Add demos where an agent edits one target section, validation passes, and a diff report shows the changed boundary.
- Connect HTMLXBench-style reliability claims to the practical CI report shape.
- Treat OpenWebDoc as a fixture preview and micro-edit runtime, not as a full authoring studio.

## Months 6-12

- Draft media type registration material for `application/vnd.openwebdoc.htmlx+zip`.
- Separate the format specification snapshot from current app behavior.
- Seek independent implementations before standards-track discussion.

## Success Metrics

The most important adoption metric is the number of repositories that run `htmlx validate` in CI.

Secondary metrics:

- GitHub release downloads
- npm package usage after scoped alpha publish
- template downloads
- external sample repositories with tag-pinned GitHub Action workflows
- external repositories that run a tag-pinned or SHA-pinned Agentic Document Integrity gate
- pilot case studies that report validation failures, fixes, and remaining human review
- VS Code extension installs
- conformance suite users
