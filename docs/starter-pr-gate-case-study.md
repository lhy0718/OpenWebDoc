# Starter PR Gate Case Study

This case study documents the public starter-repository smoke tests for
Agentic Document Integrity CI. It shows the intended adoption path: a repository
adds one `.htmlx` package, opens a pull request, and lets the OpenWebDoc validator
decide whether the package boundary is still intact.

## Scope

The test covers five public starter repositories:

| Repository                                                                                          | Workflow                                   | Current release PR                                                           | Result |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ------ |
| [`htmlx-markdown-notes-starter`](https://github.com/lhy0718/htmlx-markdown-notes-starter)           | Markdown notes converted to `.htmlx`       | [PR #2](https://github.com/lhy0718/htmlx-markdown-notes-starter/pull/2)      | Merged |
| [`htmlx-safe-html-migration-starter`](https://github.com/lhy0718/htmlx-safe-html-migration-starter) | safe standalone HTML converted to `.htmlx` | [PR #2](https://github.com/lhy0718/htmlx-safe-html-migration-starter/pull/2) | Merged |
| [`htmlx-agent-brief-starter`](https://github.com/lhy0718/htmlx-agent-brief-starter)                 | unpacked package files edited and repacked | [PR #2](https://github.com/lhy0718/htmlx-agent-brief-starter/pull/2)         | Merged |
| [`htmlx-data-report-starter`](https://github.com/lhy0718/htmlx-data-report-starter)                 | analytics report package validation        | [PR #2](https://github.com/lhy0718/htmlx-data-report-starter/pull/2)         | Merged |
| [`htmlx-slide-deck-starter`](https://github.com/lhy0718/htmlx-slide-deck-starter)                   | HTMLX-native slide deck validation         | [PR #2](https://github.com/lhy0718/htmlx-slide-deck-starter/pull/2)          | Merged |

The latest published starter evidence in this case study used the same public
validator action:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.3
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
The evidence below uses `v0.1.0-alpha.3`, which also includes the production
dependency audit gate and stricter editing metadata validation. Starter
repositories should be synchronized to newer release tags after each new
OpenWebDoc tag is published.

## Passing Evidence

After upgrading the starter workflows to `v0.1.0-alpha.3`, the validation checks
passed and the pull requests were merged.

| Repository                  | Passing run                                                                                                 | Merge commit                               | Action tag       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------- |
| Markdown notes starter      | [Validate HTMLX run](https://github.com/lhy0718/htmlx-markdown-notes-starter/actions/runs/26940817187)      | `23fd2f023a98a1afa5686fb3a03bf8d8d1d1eb7c` | `v0.1.0-alpha.3` |
| Safe HTML migration starter | [Validate HTMLX run](https://github.com/lhy0718/htmlx-safe-html-migration-starter/actions/runs/26940821836) | `e0506821fdf19fca94837dd61a43320f1ca907fe` | `v0.1.0-alpha.3` |
| Agent brief starter         | [Validate HTMLX run](https://github.com/lhy0718/htmlx-agent-brief-starter/actions/runs/26940825751)         | `f798d9788e3fee0cbb92f7d8be50469cdddf6f5f` | `v0.1.0-alpha.3` |
| Data report starter         | [Validate HTMLX run](https://github.com/lhy0718/htmlx-data-report-starter/actions/runs/26940828697)         | `be2115798cd99a1f1367c661ff9305a4dad75da6` | `v0.1.0-alpha.3` |
| Slide deck starter          | [Validate HTMLX run](https://github.com/lhy0718/htmlx-slide-deck-starter/actions/runs/26940833018)          | `a30ba595adbd9d41868f0bc28fb6f9dc2932b7c5` | `v0.1.0-alpha.3` |

Newer OpenWebDoc releases keep the same adoption path: pin the validator to a
published release tag, open a pull request, and use the issue-code output to
recover from validation failures.

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
