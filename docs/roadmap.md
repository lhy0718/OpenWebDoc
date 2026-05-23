# OpenWebDoc Public Alpha Roadmap

This roadmap tracks the work needed to move OpenWebDoc from a usable public preview toward a stronger `v0.1.0-alpha.0` release.

## Product Direction

OpenWebDoc stays centered on one runtime: a `.htmlx` document opens as the reading surface, and edit mode activates small corrections on that same surface. Structural redesign, large rewrites, new slide/table/figure creation, and AI-assisted authoring belong in unpacked package files edited by external coding agents, then validated and repacked with the `htmlx` CLI.

## Public Alpha Milestones

- [#10 Prepare v0.1.0-alpha.0 release](https://github.com/lhy0718/OpenWebDoc/issues/10): release readiness is GitHub Pages plus GitHub release artifacts. npm registry publishing is deferred for the public preview.
- [#9 Accessibility and keyboard QA pass](https://github.com/lhy0718/OpenWebDoc/issues/9): the QA bar is captured in [Accessibility, Mobile, and Export QA](accessibility-mobile-export-qa.md), with keyboard, focus, reduced-motion, presentation, and live-status expectations.
- [#8 Harden table and figure micro-editing](https://github.com/lhy0718/OpenWebDoc/issues/8): smoke coverage includes semantic table editing, table caption and cell edits, grouped figure movement, inner-card movement, object handles, and export round trip.
- [#12 Mobile and export UX hardening](https://github.com/lhy0718/OpenWebDoc/issues/12): mobile overflow checks and export/reopen validation are part of `pnpm smoke:e2e`; export success is announced in the app.
- [#11 Explore Chrome extension and file association entry points](https://github.com/lhy0718/OpenWebDoc/issues/11): [Chrome Extension Strategy](extension-strategy.md) keeps extension work optional and outside the alpha release gate.
- [#13 Research package signing and trusted provenance](https://github.com/lhy0718/OpenWebDoc/issues/13): [Package Signing and Trusted Provenance](package-signing-provenance.md) records future signing scope without adding alpha trust complexity.

## Release Gate

Before the alpha tag, the following commands should pass on a clean checkout:

```sh
pnpm install
pnpm guard:repo
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm smoke:e2e
pnpm pages:smoke
pnpm release:check
```

The live app should also be checked manually at:

- <https://lhy0718.github.io/OpenWebDoc/app/>
- <https://lhy0718.github.io/OpenWebDoc/app/?example=openwebdoc-introduction>
- <https://lhy0718.github.io/OpenWebDoc/app/?example=openwebdoc-slide-deck>
- <https://lhy0718.github.io/OpenWebDoc/app/?example=template-status-review-deck>
