# Starter PR Gate Case Study

This case study documents the public starter-repository smoke tests for
Agentic Document Integrity CI. It shows the intended adoption path: a repository
adds one `.htmlx` package, opens a pull request, and lets the OpenWebDoc validator
decide whether the package boundary is still intact.

## Scope

The test covers five public starter repositories:

| Repository                                                                                          | Workflow                                   | Current release PR                                                           | Result |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ------ |
| [`htmlx-markdown-notes-starter`](https://github.com/lhy0718/htmlx-markdown-notes-starter)           | Markdown notes converted to `.htmlx`       | [PR #3](https://github.com/lhy0718/htmlx-markdown-notes-starter/pull/3)      | Merged |
| [`htmlx-safe-html-migration-starter`](https://github.com/lhy0718/htmlx-safe-html-migration-starter) | safe standalone HTML converted to `.htmlx` | [PR #3](https://github.com/lhy0718/htmlx-safe-html-migration-starter/pull/3) | Merged |
| [`htmlx-agent-brief-starter`](https://github.com/lhy0718/htmlx-agent-brief-starter)                 | unpacked package files edited and repacked | [PR #3](https://github.com/lhy0718/htmlx-agent-brief-starter/pull/3)         | Merged |
| [`htmlx-data-report-starter`](https://github.com/lhy0718/htmlx-data-report-starter)                 | analytics report package validation        | [PR #3](https://github.com/lhy0718/htmlx-data-report-starter/pull/3)         | Merged |
| [`htmlx-slide-deck-starter`](https://github.com/lhy0718/htmlx-slide-deck-starter)                   | HTMLX-native slide deck validation         | [PR #3](https://github.com/lhy0718/htmlx-slide-deck-starter/pull/3)          | Merged |

Each repository uses the same public validator action:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.4
  with:
    paths: |
      documents/**/*.htmlx
```

## Failure Found

The first PR-gate attempt used `v0.1.0-alpha.1` and failed in the first three
repositories. The `.htmlx` packages were not the problem. The reusable GitHub
Action built `@openwebdoc/cli` before the workspace packages it depends on, so
external repositories could not build the validator from a clean checkout.

The fix shipped in `v0.1.0-alpha.2`: the action now builds the validator
workspace in dependency order:

1. `@openwebdoc/spec`
2. `@openwebdoc/core`
3. `@openwebdoc/cli`

The data report and slide deck starters were added after the action fix and
passed their first public pull-request validation smoke with the same release tag.
The current starter repositories use `v0.1.0-alpha.4`, which includes the
production dependency audit gate, stricter editing metadata validation, public
release consistency checks, and the gallery release-link smoke gate.

## Passing Evidence

After upgrading the starter workflows to `v0.1.0-alpha.4`, the validation checks
passed and the pull requests were merged.

| Repository                  | Passing run                                                                                                 | Merge commit                               | Action tag       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| Markdown notes starter      | [Validate HTMLX run](https://github.com/lhy0718/htmlx-markdown-notes-starter/actions/runs/26945954587)      | `ed4377a19ec23f6dd75f219512035c0369dde964` | `v0.1.0-alpha.4` |
| Safe HTML migration starter | [Validate HTMLX run](https://github.com/lhy0718/htmlx-safe-html-migration-starter/actions/runs/26945957950) | `1ad9850ac5498c7b60f79bb41ff79f5c51908b85` | `v0.1.0-alpha.4` |
| Agent brief starter         | [Validate HTMLX run](https://github.com/lhy0718/htmlx-agent-brief-starter/actions/runs/26945962404)         | `dbf5d49985776631fd64750d0634c496e121660a` | `v0.1.0-alpha.4` |
| Data report starter         | [Validate HTMLX run](https://github.com/lhy0718/htmlx-data-report-starter/actions/runs/26945965108)         | `a138eaf148bea18d02cfcfc23eb1cc75245a37d2` | `v0.1.0-alpha.4` |
| Slide deck starter          | [Validate HTMLX run](https://github.com/lhy0718/htmlx-slide-deck-starter/actions/runs/26945968422)          | `400b67dcf40c70d874869fe4907900e5d0692fcc` | `v0.1.0-alpha.4` |

The current OpenWebDoc release is
[`v0.1.0-alpha.4`](https://github.com/lhy0718/OpenWebDoc/releases/tag/v0.1.0-alpha.4).

## What This Proves

- A repository outside the OpenWebDoc monorepo can call the public validator
  action from a release tag.
- The validator can build from a clean external checkout.
- The validator can find and validate committed `.htmlx` packages in pull
  requests.
- Five starter repositories are copyable adoption paths rather than only local
  sample folders, and each has a passing current-release PR-gate smoke run.

## What This Does Not Prove

- The document content is factually correct.
- The document has publication-quality visual design.
- The action is a stable long-term API.
- The action is the only acceptable integration path.

The gate proves package integrity and validator-addressable trust boundaries. Human
review still decides content quality, factual accuracy, and whether the document is
ready to share.

## Reproduce The Adoption Path

1. Create a repository from one of the starter templates.
2. Add or edit one `.htmlx` package under `documents/`.
3. Open a pull request.
4. Confirm the `Validate HTMLX` check passes.
5. If the check fails, inspect the issue code in the CI log and use the
   [Issue Code Cookbook](issue-code-cookbook.md) to recover.

For a 30-minute pilot flow, see [HTMLX Pilot Adoption Plan](pilot-adoption.md).
