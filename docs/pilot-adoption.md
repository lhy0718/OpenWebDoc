# HTMLX Pilot Adoption Plan

The first pilots should test whether another repository can use HTMLX as a CI-validatable document package for agent-edited reports.

## Pilot Goal

Prove this workflow in repositories outside OpenWebDoc:

```text
Open a sample .htmlx
Unpack package files
Let an external coding agent edit a bounded section
Refresh metadata
Pack the package
Validate in CI
Review the document in the OpenWebDoc app
```

The pilot is not a general office-suite evaluation. It tests package integrity, agent-edit boundaries, and the usefulness of `htmlx validate` as a PR gate.

## Target Profiles

| Priority | Target                           | Why it fits                                                |
| -------: | -------------------------------- | ---------------------------------------------------------- |
|        1 | AI coding agent users            | already comfortable with file edits and PR validation      |
|        2 | docs-as-code maintainers         | can adopt `.htmlx` as a checked artifact                   |
|        3 | report automation teams          | need rich local assets and reproducible exports            |
|        4 | research benchmark teams         | can evaluate document-agent reliability                    |
|        5 | devrel / technical writing teams | need richer artifacts than Markdown without a SaaS lock-in |

Avoid early pilots where real-time collaboration, cloud comments, DOCX compatibility, or full authoring tools are mandatory.

For a concrete recruiting list, see [HTMLX Pilot Target List](pilot-targets.md).

## 30-Minute Pilot Script

### 0-5 minutes: Open and inspect

- Open a public sample in the OpenWebDoc app.
- Download the `.htmlx` package.
- Run `htmlx validate` or use the provided GitHub Action.

### 5-15 minutes: Agent edit

- Unpack the package.
- Ask an external coding agent to update one bounded section, table row, or figure caption.
- Do not ask the agent to redesign the whole document.

### 15-20 minutes: Metadata and validation

```sh
htmlx refresh-metadata ./work --json
htmlx refresh-metadata ./work --check --json
htmlx validate ./work --json
htmlx pack ./work edited.htmlx --json
htmlx validate edited.htmlx --json
```

### 20-25 minutes: CI gate

- Add the GitHub Action validator to the pilot repository.
- Open a PR containing the changed `.htmlx`.
- Confirm the PR gate reports pass or actionable issue codes.

### 25-30 minutes: Review

- Open the edited package in the OpenWebDoc app.
- Check whether the visual document still reads correctly.
- Record what the validator caught, what it missed, and what the human reviewer still had to judge.

## Pilot Success Criteria

| Criterion                  | Evidence                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| Package opens              | OpenWebDoc app loads the `.htmlx`                                    |
| Package validates          | `htmlx validate edited.htmlx --json` exits successfully              |
| Agent edit is reviewable   | PR diff shows package-local files and intended changed section       |
| Metadata is fresh          | `htmlx refresh-metadata ./work --check --json` passes before packing |
| CI is useful               | GitHub Action pass/fail is understandable to the team                |
| Human review remains clear | reviewer can tell what CI did and did not prove                      |

## Questions to Ask Pilot Users

- What was easier than your current Markdown, PDF, DOCX, or static HTML workflow?
- Which validation issue codes were useful?
- Which failure was confusing or too strict?
- Did the unpacked package structure make agent edits easier to review?
- Did the OpenWebDoc app feel like a runtime rather than a full editor?
- What would block using this in one real repository?

## Case Study Template

```text
Repository type:
Document type:
Agent used:
Edited package files:
Validation failures:
Human review findings:
Time to first valid package:
Would adopt as PR gate:
Missing requirement:
```

## Next Pilot Assets

- one SHA-pinned GitHub Action workflow example
- one small issue-code recovery guide
- three copyable sample repositories
- one template-repository split checklist
- a release artifact with sample `.htmlx` files
- a one-page explanation of what CI proves and does not prove
