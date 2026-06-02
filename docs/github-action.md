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
      - uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@main
        with:
          paths: |
            docs/**/*.htmlx
            examples/*.htmlx
```

The action builds the `@openwebdoc/cli` package from the referenced OpenWebDoc revision and runs `htmlx validate` with JSON output for every matched package.

## Recommended PR Gate

Use the action as the first adoption surface for HTMLX:

- validate every changed `.htmlx` package
- keep invalid fixtures in a separate path or workflow
- add `htmlx refresh-metadata <directory> --check --json` when a workflow edits unpacked package directories before packing
- report validation issue codes in PR review or CI logs

The action is intentionally focused on validation. Agent-specific editing remains a package-file workflow outside the browser runtime.
