# Agentic Document Integrity CI

Agentic Document Integrity CI is the external-repository adoption pattern for HTMLX. A coding agent edits package-local files, and CI proves that the resulting `.htmlx` package still satisfies the document profile, manifest, resource, metadata, and security contracts.

The goal is not to prove that the document is perfect. The goal is to make document breakage visible at the pull request boundary.

## Required Gate

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

Pin the action to a release tag in external repositories. Use `@main` only when intentionally testing unreleased validator behavior.

For copyable repository skeletons, see [External Sample Repositories](../samples/README.md).

## Mock Pass Report

```markdown
### Agentic Document Integrity

| Check                  | Result |
| ---------------------- | ------ |
| HTMLX packages checked | 3      |
| Package validation     | Pass   |

Validation was performed with the OpenWebDoc htmlx CLI. Package metadata is treated as user-visible reference data, not as an instruction channel.
```

## Mock Failure Report

CI logs should retain the machine-readable `htmlx validate --json` payload. The job summary can stay short, but the log should expose issue codes that are stable enough for agents and humans to act on.

```json
{
  "ok": false,
  "error": "HTMLX validation failed.",
  "details": {
    "valid": false,
    "issues": [
      {
        "severity": "error",
        "code": "html.remote_resource",
        "message": "Remote resources are not allowed.",
        "path": "index.html"
      },
      {
        "severity": "error",
        "code": "resource.integrity_mismatch",
        "message": "Integrity mismatch for metadata/llm.json.",
        "path": "metadata/llm.json"
      }
    ]
  }
}
```

## Agent Workflow

```sh
htmlx unpack input.htmlx ./work --json
# Edit ./work/index.html, styles/*, metadata/*, and declared assets.
htmlx refresh-metadata ./work --json
htmlx refresh-metadata ./work --check --json
htmlx validate ./work --json
htmlx pack ./work edited.htmlx --json
htmlx validate edited.htmlx --json
```

## What The Gate Proves

- The `.htmlx` file can be unpacked and validated.
- The declared profile is internally consistent.
- Manifest paths are package-local and resolvable.
- Declared resources match integrity hashes when hashes are present.
- Scripts, event handlers, remote resources, file resources, and unsafe metadata instruction patterns are rejected.
- `metadata/llm.json` is fresh when `refresh-metadata --check` is part of the workflow.

## What The Gate Does Not Prove

- factual accuracy
- writing quality
- visual design quality
- accessibility quality beyond the current validator contract
- reviewer approval

Those checks belong in review, visual QA, accessibility QA, or project-specific evaluator jobs.

## Recommended PR Comment

```markdown
HTMLX integrity passed.

- Validated packages: 3
- Profiles: flow-document, fixed-stage-document, slide-deck
- Metadata freshness: checked
- Unsafe resources/scripts: none detected

The document can be reviewed in the OpenWebDoc app. Larger structure changes remain package-file edits and should pass the same gate before merge.
```

## Relationship To HTMLXBench

HTMLXBench can measure whether representation, profile contracts, and validator feedback improve agent editing reliability. Agentic Document Integrity CI is the practical deployment surface for the same idea: every edited package returns through a validation boundary before it is shared.
