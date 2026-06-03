# GitHub Action Validator

OpenWebDoc includes a starter composite action for validating `.htmlx` files in CI.

## Repository-local Usage

When the workflow runs inside this repository:

```yaml
name: Validate HTMLX

on:
  pull_request:

jobs:
  validate-htmlx:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/validate-htmlx
        with:
          paths: |
            examples/*.htmlx
```

## Cross-repository Usage

Other repositories can reference the action from OpenWebDoc:

```yaml
name: Validate HTMLX

on:
  pull_request:

jobs:
  validate-htmlx:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.2
        with:
          paths: |
            docs/**/*.htmlx
            examples/*.htmlx
```

The action builds the `@openwebdoc/cli` package from the referenced OpenWebDoc revision and runs `htmlx validate` with JSON output for every matched package.

Pin to a release tag when adopting the action in another repository. Use `@main` only when intentionally testing the latest unreleased validator behavior.

For stricter supply-chain pinning, use the full release commit SHA instead of the tag:

```yaml
name: Validate HTMLX

on:
  pull_request:

jobs:
  validate-htmlx:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@<release-commit-sha>
        with:
          paths: |
            docs/**/*.htmlx
            examples/*.htmlx
```

Replace `<release-commit-sha>` with the resolved commit for the `v0.1.0-alpha.2` release tag before committing a SHA-pinned workflow. See [GitHub Action Pinning and Supply-Chain Notes](supply-chain-action-pinning.md) for when to use tag-pinned or SHA-pinned references.

By default the action writes an `Agentic Document Integrity` job summary with the number of packages checked and the pass/fail result. Set `summary: "false"` to disable that summary. See [Agentic Document Integrity CI](agentic-document-integrity-ci.md) for the public report shape and failure examples.

## Recommended PR Gate

Use the action as the first adoption surface for HTMLX:

- validate every changed `.htmlx` package
- keep invalid fixtures in a separate path or workflow
- add `htmlx refresh-metadata <directory> --check --json` when a workflow edits unpacked package directories before packing
- report validation issue codes in PR review or CI logs

The action is intentionally focused on validation. Agent-specific editing remains a package-file workflow outside the browser runtime.

For generator repositories that modify unpacked package directories, add a separate job step before packing:

```sh
htmlx refresh-metadata ./work --check --json
htmlx validate ./work --json
htmlx pack ./work edited.htmlx --json
htmlx validate edited.htmlx --json
```

For compatibility fixtures, see [HTMLX Conformance](conformance.md).

For issue-code recovery guidance, see [HTMLX Issue Code Cookbook](issue-code-cookbook.md).

For copyable external repository skeletons, see [External Sample Repositories](../samples/README.md).

For a verified external-repository smoke test of the action, see
[Starter PR Gate Case Study](starter-pr-gate-case-study.md).
