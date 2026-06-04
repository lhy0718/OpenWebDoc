# HTMLX Conformance

HTMLX conformance is the contract that keeps the format from becoming an OpenWebDoc-app-only file. A conforming implementation should agree on package validity, document profiles, security boundaries, metadata freshness, and validator issue codes.

The reference checker lives in this repository:

```sh
pnpm build
pnpm conformance:check
```

The fixture manifest is `examples/conformance/cases.json`.

## Conformance Levels

| Level         | Requirement                                                                                                                        | Evidence                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Package       | ZIP or unpacked directory has `manifest.json`, root `index.html`, valid package-local paths, and declared resources                | `htmlx validate <package>`                                |
| Profile       | `manifest.profile` resolves to `flow-document`, `fixed-stage-document`, or `slide-deck`, with profile-specific constraints         | validator profile result and issue codes                  |
| Security      | package rejects executable HTML, remote resources, path traversal, unsafe CSS resource references, and hidden-instruction metadata | invalid conformance fixtures and `security-invalid.htmlx` |
| Metadata      | `metadata/llm.json` matches the current entry text, profile, block map, selectors, and declared resource integrity                 | `htmlx refresh-metadata <directory> --check --json`       |
| Artifact sync | source package directory, packed `.htmlx`, and public app copy match                                                               | `pnpm release:check`                                      |
| CI            | an external repository can run validation in pull requests                                                                         | `.github/actions/validate-htmlx`                          |

## Document Profiles

### `flow-document`

The default browser-native profile. It reflows like normal HTML and does not require fixed-stage geometry.

Minimum expectations:

- root `index.html`
- script-free HTML
- package-local styles and assets
- no fixed-stage editing metadata unless a future flow editing contract explicitly allows it

### `fixed-stage-document`

A proportional visual document profile for proposal-style and showcase documents.

Minimum expectations:

- root `index.html`
- `metadata/editing.json`
- one stage element with `data-htmlx-editable="document"`
- `data-htmlx-stage-width` and `data-htmlx-stage-height`
- package CSS `aspect-ratio` matching the declared stage
- no `min()`, `max()`, `clamp()`, or media-query layout overrides for the proportional stage contract

### `slide-deck`

An HTMLX-native presentation profile.

Minimum expectations:

- `manifest.profile: "slide-deck"`
- `manifest.metadata.presentation`
- `metadata/presentation.json`
- slide deck root with declared stage width and height
- at least one `[data-htmlx-kind="slide"]` section

## Issue Code Contract

Conformance fixtures should isolate one rule when possible and declare the issue codes that must appear.

Current baseline examples:

| Issue code                               | Meaning                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `html.script`                            | executable script content is present                                      |
| `html.remote_resource`                   | a remote resource reference is present                                    |
| `html.local_resource_missing`            | a local resource is referenced but missing or undeclared                  |
| `css.local_resource_missing`             | a local CSS `url(...)` resource is missing or undeclared                  |
| `profile.flow_stage_conflict`            | a `flow-document` declares fixed-stage editing metadata or stage markup   |
| `profile.presentation_mismatch`          | presentation metadata exists but the explicit profile is not `slide-deck` |
| `profile.fixed_stage_missing`            | a fixed-stage package lacks required stage geometry                       |
| `profile.fixed_stage_editing_missing`    | a fixed-stage package lacks required editing metadata                     |
| `editing.schema_invalid`                 | `metadata/editing.json` fails the editing metadata JSON Schema            |
| `editing.stage_mismatch`                 | editing metadata stage geometry differs from document stage attributes    |
| `editing.block_missing`                  | editing metadata references a missing document block                      |
| `editing_guide.system_instruction_guard` | editing guide metadata looks like hidden instruction text                 |
| `layout.non_proportional_css_function`   | fixed-stage CSS uses non-proportional layout functions                    |
| `layout.media_query_override`            | fixed-stage CSS uses media queries that can break stage scaling           |
| `resource.integrity_mismatch`            | manifest resource integrity does not match package bytes                  |
| `llm.text_hash_mismatch`                 | document-level LLM text hash is stale                                     |
| `llm.block_text_hash_mismatch`           | block-level LLM text hash is stale                                        |
| `llm.system_instruction_guard`           | LLM metadata contains instruction-like authority it must not carry        |

New issue codes should be stable enough for CI logs, PR comments, and third-party validators.

For recovery-oriented guidance, see [HTMLX Issue Code Cookbook](issue-code-cookbook.md).

## Fixture Policy

Conformance fixtures live under `examples/conformance/` and are not shown in the public template gallery.

Fixture rules:

- Keep each fixture small.
- Prefer one rule per invalid fixture.
- Declare expected issue codes in `cases.json`.
- Do not include private paths, local machine details, or secrets.
- Do not use external network resources.
- Do not rely on the OpenWebDoc app to repair invalid package layout.

## Relationship to Release Checks

`pnpm release:check` runs `pnpm conformance:check` after the CLI is built. Release readiness also validates gallery packages, rejects the intentionally invalid security package, checks metadata freshness, verifies packed/source/public example drift, scans packed text files for private paths, builds package tarballs, and builds the static site.

The conformance suite proves validator compatibility over focused fixtures. It does not replace visual smoke tests, browser rendering checks, or human review of public templates.
