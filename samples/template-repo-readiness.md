# External Template Repository Readiness

The `samples/` folders are copyable skeletons. Before splitting them into separate public template repositories, each skeleton should satisfy the same small contract.

## Candidate Repositories

| Candidate repo                                                                                      | Source folder                     | Purpose                                                    |
| --------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| [`htmlx-markdown-notes-starter`](https://github.com/lhy0718/htmlx-markdown-notes-starter)           | `samples/external-research-notes` | Markdown-first notes converted to `.htmlx`                 |
| [`htmlx-safe-html-migration-starter`](https://github.com/lhy0718/htmlx-safe-html-migration-starter) | `samples/external-html-migration` | safe standalone HTML converted to `.htmlx` and static HTML |
| [`htmlx-agent-brief-starter`](https://github.com/lhy0718/htmlx-agent-brief-starter)                 | `samples/external-agent-brief`    | agent-edited brief with PR validation                      |
| [`htmlx-data-report-starter`](https://github.com/lhy0718/htmlx-data-report-starter)                 | `samples/external-data-report`    | analytics report package with PR validation                |
| [`htmlx-slide-deck-starter`](https://github.com/lhy0718/htmlx-slide-deck-starter)                   | `samples/external-slide-deck`     | presentation-style HTMLX slide deck with PR validation     |

The machine-readable mapping lives in [`template-repos.json`](template-repos.json). `pnpm samples:check` verifies that the manifest matches the available external sample folders. Each listed repository is public, marked as a GitHub template repository, and has a passing current-release pull-request validation smoke linked from the [Starter PR Gate Case Study](../docs/starter-pr-gate-case-study.md).

## Required Files

Each extracted template repo should include:

- `README.md`
- `LICENSE`
- `.github/workflows/validate-htmlx.yml`
- one source document
- one generated `.htmlx` package
- one local validation command block
- one GitHub Action workflow using a release tag
- one note linking to SHA-pinned usage guidance

## Split Procedure

1. Copy the sample folder into a new repository.
2. Keep source files and generated `.htmlx` files together.
3. Run `htmlx validate documents/*.htmlx --json`.
4. Run the repository workflow on a pull request.
5. Confirm the workflow does not use `@main`.
6. Mark the repository as a GitHub template repository.
7. Add or update the repository URL in `samples/template-repos.json`.
8. Keep the repository linked from OpenWebDoc adoption docs only after validation passes.

For local export from the OpenWebDoc repository:

```sh
pnpm build
pnpm samples:check
pnpm samples:export
pnpm samples:verify-export
```

The exported copies are written to `dist/sample-repos/`. `pnpm samples:verify-export` confirms that each exported candidate still matches its source folder, includes the template note, pins the validation workflow to a release tag, validates contained `.htmlx` files, and contains no private or absolute local paths.

## Release Tag Policy

Template repositories should use a readable release tag by default:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.4
```

Security-sensitive repositories can replace the tag with the release commit SHA documented in [GitHub Action Pinning and Supply-Chain Notes](../docs/supply-chain-action-pinning.md).

## Current Export Evidence

The repository-local skeletons are checked by:

- `pnpm samples:check`
- `pnpm samples:export`
- `pnpm samples:verify-export`
- `pnpm release:check`

Those checks verify source/export drift, required files, tag-pinned workflows,
contained `.htmlx` package validation, and private-path hygiene for the exported
sample repositories.

## Per-Repository Acceptance Gate

Before linking a newly extracted public template repository from OpenWebDoc docs,
confirm:

- [ ] The template validates with `htmlx validate`.
- [ ] The workflow passes on a pull request.
- [ ] The README names the document use case in the first paragraph.
- [ ] The repo does not mention local machine paths or private workspaces.
- [ ] The `.htmlx` file opens in the public OpenWebDoc app after download.
- [ ] The template explains what CI proves and does not prove.
- [ ] The template links back to OpenWebDoc docs for conformance, issue-code recovery, and action pinning.
