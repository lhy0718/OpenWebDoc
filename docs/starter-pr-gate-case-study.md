# Starter PR Gate Case Study

This case study documents the public starter-repository smoke tests for
Agentic Document Integrity CI. It shows the intended adoption path: a repository
adds one `.htmlx` package, opens a pull request, and lets the OpenWebDoc validator
decide whether the package boundary is still intact.

## Scope

The test covers five public starter repositories:

| Repository                                                                                          | Workflow                                   | PR                                                                           | Result |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ------ |
| [`htmlx-markdown-notes-starter`](https://github.com/lhy0718/htmlx-markdown-notes-starter)           | Markdown notes converted to `.htmlx`       | [PR #1](https://github.com/lhy0718/htmlx-markdown-notes-starter/pull/1)      | Merged |
| [`htmlx-safe-html-migration-starter`](https://github.com/lhy0718/htmlx-safe-html-migration-starter) | safe standalone HTML converted to `.htmlx` | [PR #1](https://github.com/lhy0718/htmlx-safe-html-migration-starter/pull/1) | Merged |
| [`htmlx-agent-brief-starter`](https://github.com/lhy0718/htmlx-agent-brief-starter)                 | unpacked package files edited and repacked | [PR #1](https://github.com/lhy0718/htmlx-agent-brief-starter/pull/1)         | Merged |
| [`htmlx-data-report-starter`](https://github.com/lhy0718/htmlx-data-report-starter)                 | analytics report package validation        | [PR #1](https://github.com/lhy0718/htmlx-data-report-starter/pull/1)         | Merged |
| [`htmlx-slide-deck-starter`](https://github.com/lhy0718/htmlx-slide-deck-starter)                   | HTMLX-native slide deck validation         | [PR #1](https://github.com/lhy0718/htmlx-slide-deck-starter/pull/1)          | Merged |

Each repository uses the same public validator action:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.2
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

## Passing Evidence

After upgrading the starter workflows to `v0.1.0-alpha.2`, the validation checks
passed and the pull requests were merged.

| Repository                  | Passing run                                                                                                 | Merge commit                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Markdown notes starter      | [Validate HTMLX run](https://github.com/lhy0718/htmlx-markdown-notes-starter/actions/runs/26912702313)      | `43fff4abbd5fe8ecf1494b33ca07de90485585d4` |
| Safe HTML migration starter | [Validate HTMLX run](https://github.com/lhy0718/htmlx-safe-html-migration-starter/actions/runs/26912707081) | `4a13a0d97f4b12fd0c60a21592b79eb43534391e` |
| Agent brief starter         | [Validate HTMLX run](https://github.com/lhy0718/htmlx-agent-brief-starter/actions/runs/26912704534)         | `d4c786c4b5a84546dff1712e40870f7a7db09b66` |
| Data report starter         | [Validate HTMLX run](https://github.com/lhy0718/htmlx-data-report-starter/actions/runs/26913986503)         | `298977f0664fc92eb7f176987c2bb5d012aecdf5` |
| Slide deck starter          | [Validate HTMLX run](https://github.com/lhy0718/htmlx-slide-deck-starter/actions/runs/26913896457)          | `90b28296cbe1bcef522cc85cb0b211fb3231d7a0` |

The OpenWebDoc release that fixed the action is
[`v0.1.0-alpha.2`](https://github.com/lhy0718/OpenWebDoc/releases/tag/v0.1.0-alpha.2).

## What This Proves

- A repository outside the OpenWebDoc monorepo can call the public validator
  action from a release tag.
- The validator can build from a clean external checkout.
- The validator can find and validate committed `.htmlx` packages in pull
  requests.
- Five starter repositories are copyable adoption paths rather than only local
  sample folders.

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
