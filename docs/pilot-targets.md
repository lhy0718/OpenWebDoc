# HTMLX Pilot Target List

Use this list to recruit the first external repositories for HTMLX validation pilots. The goal is not broad consumer adoption. The goal is to prove that an external repository can accept `.htmlx` artifacts, edit them with an AI coding agent, and enforce integrity with CI.

## Selection Criteria

A strong pilot target has:

- document artifacts stored in Git
- pull requests as a normal review path
- repeated reports, specs, briefs, or generated docs
- enough rich content that Markdown alone feels limited
- interest in AI-assisted document editing
- tolerance for alpha tooling when validation is useful

Avoid targets that require:

- real-time collaborative editing
- direct DOCX/PDF/HWPX round-trip compatibility
- browser-side model provider calls
- confidential documents that cannot be shared even as a case study
- full office-suite replacement features

## Ten Pilot Archetypes

| Priority | Pilot archetype             | Document to test             | Why HTMLX fits                                               | Success signal                                    |
| -------: | --------------------------- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
|        1 | AI evaluation repo          | benchmark report             | rich outputs need validation and provenance-ready metadata   | `.htmlx` report validates in PR                   |
|        2 | research lab docs repo      | weekly research memo         | figures, tables, and notes benefit from package-local assets | agent edits one section and CI stays green        |
|        3 | devrel sample repo          | technical product brief      | richer than Markdown but still reviewable in Git             | sample `.htmlx` ships with release notes          |
|        4 | internal analytics repo     | recurring data report        | generated HTML can be packaged and archived                  | generated package validates after refresh         |
|        5 | agent workflow demo repo    | agent-edited brief           | directly tests the unpack/edit/validate loop                 | PR shows bounded file diff and validation pass    |
|        6 | open-source project docs    | release explainer            | diagrams and tables need portable local assets               | maintainers can preview and validate the artifact |
|        7 | course/workshop repo        | lesson handout or slide deck | static web assets and slides can live in one package         | participants download and open the package        |
|        8 | product spec repo           | spec snapshot                | product docs often need tables, figures, and history         | CI catches stale metadata or missing asset        |
|        9 | security documentation repo | threat model brief           | local-only resources and hidden-instruction guard are useful | security-invalid fixture is understandable        |
|       10 | static site migration repo  | standalone HTML page         | safe HTML can enter HTMLX and export back to static HTML     | `from-html` and `to-static-html` round trip works |

## Outreach Message

```text
I am testing HTMLX, a browser-readable document package for agent-edited reports.

The pilot is small: take one document artifact in your repo, package it as `.htmlx`, let an AI coding agent edit one bounded section, and add a GitHub Action that validates the package in the PR.

The goal is not to replace your docs tool. The goal is to see whether package validation catches broken resources, stale metadata, unsafe HTML, or profile mismatches before the document is shared.
```

## Pilot Intake Questions

- What repository contains the candidate document?
- Is the document currently Markdown, HTML, PDF, DOCX, or generated output?
- What one bounded edit should an external coding agent attempt?
- Can the pilot PR be public?
- Can the validation result be summarized as a case study?
- Which output matters more: readable app preview, `.htmlx` package, or static HTML export?

## Case Study Fields

```text
Repository category:
Document category:
Source format:
HTMLX profile:
Agent edit task:
Validation issues found:
Metadata refresh required:
Human review findings:
Time to first passing PR:
Would keep the PR gate:
Next blocker:
```

## Pilot Exit Criteria

A pilot counts as successful when:

- one `.htmlx` package is committed or attached as a release artifact
- a tag-pinned or SHA-pinned validator workflow runs in CI
- a bounded agent edit returns through validate/pack/validate
- the reviewer can explain what CI proved and what remained human judgment
- at least one improvement request is recorded for issue-code clarity, workflow friction, or package authoring
