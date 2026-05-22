# OpenWebDoc Public Alpha Roadmap

This roadmap tracks the work needed to move OpenWebDoc from a usable public preview toward a stronger `v0.1.0-alpha.0` release.

## Product Direction

OpenWebDoc stays centered on one runtime: a `.htmlx` document opens as the reading surface, and edit mode activates small corrections on that same surface. Structural redesign, large rewrites, new slide/table/figure creation, and AI-assisted authoring belong in unpacked package files edited by external coding agents, then validated and repacked with the `htmlx` CLI.

## Public Alpha Milestones

- [#10 Prepare v0.1.0-alpha.0 release](https://github.com/lhy0718/OpenWebDoc/issues/10): finish release gate, tag strategy, npm readiness, and GitHub Pages confirmation.
- [#9 Accessibility and keyboard QA pass](https://github.com/lhy0718/OpenWebDoc/issues/9): verify focus order, keyboard-only operation, labels, and presentation-mode escape paths.
- [#8 Harden table and figure micro-editing](https://github.com/lhy0718/OpenWebDoc/issues/8): tighten editing behavior for semantic tables, captions, grouped figures, and inner figure cards.
- [#12 Mobile and export UX hardening](https://github.com/lhy0718/OpenWebDoc/issues/12): polish mobile read/edit interactions, export feedback, and reopened-package confidence.
- [#11 Explore Chrome extension and file association entry points](https://github.com/lhy0718/OpenWebDoc/issues/11): evaluate whether a browser extension or file association improves local `.htmlx` opening without changing the package format.
- [#13 Research package signing and trusted provenance](https://github.com/lhy0718/OpenWebDoc/issues/13): explore future integrity, authorship, and provenance verification without adding executable package code.

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
