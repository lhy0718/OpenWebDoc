# OpenWebDoc Examples

- `basic/`: a valid HTMLX package directory that can be packed into `basic.htmlx`.
- `openwebdoc-introduction/`: a long OpenWebDoc primer with a root `index.html`, semantic HTML tables, grouped figures, package-local PNG icons, roadmap blocks, funnel blocks, and validation metadata.
- `openwebdoc-slide-deck/`: an HTMLX-native 16:9 slide deck with `metadata/presentation.json`, stacked read mode, and black-background presentation mode.
- `template-research-brief/`: a research memo template with claim, evidence, decision, and workflow sections.
- `template-product-spec/`: a product specification template for requirements, non-goals, release gates, and owner decisions.
- `template-operations-manual/`: an operations manual template for package intake, validation, and escalation.
- `template-meeting-notes/`: a meeting notes template for agenda, decisions, owners, and follow-up actions.
- `template-project-proposal/`: a project proposal template for need, approach, validation plan, and outcomes.
- `template-data-report/`: a data report template for metrics, methodology notes, and semantic tables.
- `template-pitch-deck/`: an HTMLX-native pitch deck template.
- `template-lesson-deck/`: an HTMLX-native lesson deck template.
- `template-research-talk/`: an HTMLX-native research talk template.
- `template-status-review-deck/`: an HTMLX-native status review deck template.

Each valid example is also a standalone unpacked package: open its `index.html` directly in a
browser to inspect the same script-free document that will be packed into `.htmlx`.

- `security-invalid/`: an intentionally invalid fixture with script, remote resource, and unsafe LLM metadata examples.

Generate example packages after building the CLI:

```sh
pnpm --filter @openwebdoc/cli htmlx -- pack examples/basic examples/basic.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/openwebdoc-introduction examples/openwebdoc-introduction.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/openwebdoc-slide-deck examples/openwebdoc-slide-deck.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-research-brief examples/template-research-brief.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-product-spec examples/template-product-spec.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-operations-manual examples/template-operations-manual.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-meeting-notes examples/template-meeting-notes.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-project-proposal examples/template-project-proposal.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-data-report examples/template-data-report.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-pitch-deck examples/template-pitch-deck.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-lesson-deck examples/template-lesson-deck.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-research-talk examples/template-research-talk.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/template-status-review-deck examples/template-status-review-deck.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/security-invalid examples/security-invalid.htmlx
```

Create an external-agent editing package directory:

```sh
pnpm htmlx unpack examples/basic.htmlx ./basic-package
pnpm htmlx validate ./basic-package --json
```
