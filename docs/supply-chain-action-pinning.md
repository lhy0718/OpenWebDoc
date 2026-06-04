# GitHub Action Pinning and Supply-Chain Notes

OpenWebDoc's GitHub Action validator is the easiest way for another repository to adopt Agentic Document Integrity checks. Treat that action as a supply-chain dependency.

## Recommended References

Use a release tag for normal adoption:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.3
  with:
    paths: |
      docs/**/*.htmlx
      examples/*.htmlx
```

Use the full release commit SHA for stricter pinning. Resolve the readable tag
first, then replace the tag in the workflow with the returned 40-character SHA:

```sh
git ls-remote https://github.com/lhy0718/OpenWebDoc.git refs/tags/v0.1.0-alpha.3
```

## Pinning Policy

| Reference       | Use when                                 | Tradeoff                            |
| --------------- | ---------------------------------------- | ----------------------------------- |
| Release tag     | most teams want readable version updates | easier to audit and upgrade         |
| Full commit SHA | a repository needs stronger immutability | harder to read and update           |
| Branch name     | testing unreleased validator behavior    | not recommended for stable PR gates |

Do not use `@main` for routine validation in another repository. It can change without warning and can turn a document PR into a validator-upgrade test.

## What the Action Proves

The action proves that matched `.htmlx` packages satisfy the OpenWebDoc validator at the referenced action revision.

It can check:

- package layout
- manifest and profile contracts
- package-local resource declarations
- unsafe scripts and remote resources
- LLM metadata guardrails
- validation issue codes in CI logs

It does not prove:

- the document is factually correct
- the author is trusted
- the document is legally safe
- the writing quality is high
- an external AI agent followed a hidden instruction

## Upgrade Routine

1. Update the action reference in a small PR.
2. Run the existing `.htmlx` validation workflow.
3. Review any new issue codes or stricter diagnostics.
4. Update generator scripts or package metadata if the validator is correctly stricter.
5. Merge the validator upgrade separately from content edits.

## Generator Repository Gate

Repositories that generate or edit unpacked package directories should add checks before packing:

```sh
htmlx refresh-metadata ./work --check --json
htmlx validate ./work --json
htmlx pack ./work edited.htmlx --json
htmlx validate edited.htmlx --json
```

The GitHub Action validates packed `.htmlx` files. Directory freshness checks belong in the generator job before the package is packed.
