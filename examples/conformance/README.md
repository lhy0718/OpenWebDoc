# HTMLX Conformance Fixtures

This directory contains small packages for testing HTMLX validator behavior. These fixtures are not gallery templates and are not meant to be pretty documents. They exist so OpenWebDoc and future compatible implementations can agree on package validity, profile boundaries, and issue codes.

Run the conformance check after building the CLI:

```sh
pnpm build
pnpm conformance:check
```

The cases are declared in `cases.json`.

## Fixture Types

- Valid fixtures must pass `htmlx validate`.
- Invalid fixtures must fail `htmlx validate`.
- Invalid fixtures also declare the issue codes that must appear in validation output.

## Current Coverage

| Case                                   | Expected result | Contract                                                         |
| -------------------------------------- | --------------: | ---------------------------------------------------------------- |
| `valid-flow-minimal`                   |            pass | Minimal `flow-document` with local CSS and no executable content |
| `invalid-script`                       |            fail | `script` elements are rejected                                   |
| `invalid-flow-stage-conflict`          |            fail | `flow-document` cannot declare fixed-stage editing metadata      |
| `invalid-fixed-stage-editing-missing`  |            fail | fixed-stage documents must declare editing metadata              |
| `invalid-slide-profile-mismatch`       |            fail | packages with presentation metadata must use `slide-deck`        |
| `invalid-fixed-stage-proportional-css` |            fail | fixed-stage CSS cannot use non-proportional layout functions     |

## Scope

The conformance suite is a validator contract, not a visual regression suite. Rendering expectations belong in app smoke tests and screenshot checks. New fixtures should stay minimal and isolate one rule whenever possible.
