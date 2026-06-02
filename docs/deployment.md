# Deployment

OpenWebDoc has three release surfaces during the public preview:

- a static site that hosts the OpenWebDoc app and template gallery
- npm tarballs under `dist/npm/` for inspection, not registry publication
- GitHub Releases for tagged alpha snapshots, example packages, and release notes

The current public alpha release notes are stored in
[`docs/releases/v0.1.0-alpha.1.md`](releases/v0.1.0-alpha.1.md) and mirrored into
the GitHub Release body at
<https://github.com/lhy0718/OpenWebDoc/releases/tag/v0.1.0-alpha.1>.

## Local release check

Run the full release gate before tagging or deploying:

```sh
pnpm release:check
```

This command runs repository guards, builds all workspaces, runs tests and linting, checks valid example metadata freshness with `refresh-metadata --check`, verifies packed examples against their source directories, verifies public app example copies byte-for-byte, rejects the intentionally invalid security fixture, creates npm package tarballs, and builds the static site.

Tagged release workflow runs create a GitHub Release with npm tarballs, example `.htmlx` packages, the generated site manifest, and a compressed spec/docs snapshot as attached artifacts.

## npm package artifacts

Create local npm tarballs:

```sh
pnpm pack:packages
```

The tarballs are written to `dist/npm/`.

The publishable packages are:

- `@openwebdoc/spec`
- `@openwebdoc/core`
- `@openwebdoc/cli`
- `@openwebdoc/ui`

Apps under `apps/` are private deployable applications, not npm packages.

## Static site artifact

Build the static site:

```sh
pnpm site:build
```

The output is written to `dist/site/`:

- `dist/site/app/`
- `dist/site/index.html`

`dist/site/app/` is the deployable OpenWebDoc runtime. It starts with a single file-open screen. After a valid package is selected, the runtime shows the document first and keeps app controls in a small floating toolbar.

`dist/site/index.html` is the public entry page and template gallery. It exposes live previews, direct `.htmlx` downloads, and the external-agent command boundary for each public template listed in `examples/gallery.json`.

The current GitHub Pages deployment is:

- Entry page: <https://lhy0718.github.io/OpenWebDoc/>
- OpenWebDoc app: <https://lhy0718.github.io/OpenWebDoc/app/>
- Introduction example: <https://lhy0718.github.io/OpenWebDoc/app/?example=openwebdoc-introduction>
- Flow document example: <https://lhy0718.github.io/OpenWebDoc/app/?example=template-flow-article>
- Slide deck example: <https://lhy0718.github.io/OpenWebDoc/app/?example=openwebdoc-slide-deck>
- Template download example: <https://lhy0718.github.io/OpenWebDoc/app/examples/template-flow-article.htmlx>

For a local static smoke check after building:

```sh
pnpm site:build
pnpm exec vite preview --host 127.0.0.1 --outDir dist/site
```

For a live GitHub Pages smoke check:

```sh
pnpm pages:smoke
OPENWEBDOC_PAGES_SCREENSHOTS=1 pnpm pages:smoke
```

Use `OPENWEBDOC_PAGES_URL` to test a fork or preview deployment:

```sh
OPENWEBDOC_PAGES_URL=https://example.github.io/OpenWebDoc/ pnpm pages:smoke
```

## GitHub Actions

- `CI` runs on `main` and pull requests.
- `Deploy Pages` builds and deploys `dist/site/` from `main`.
- `Release` builds release artifacts on version tags and uploads npm tarballs and the static site as GitHub Actions artifacts.
- `Release` creates a spec/docs snapshot archive for tagged GitHub Releases.

## npm package artifacts

OpenWebDoc does not publish npm packages during the public preview phase. The release workflow creates local package tarballs for inspection, but it does not publish them to the npm registry.

Create package artifacts locally:

```sh
pnpm pack:packages
```

The tarballs are written to `dist/npm/`.

Recommended release flow:

```sh
pnpm release:check
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
```

The release workflow uploads local artifacts on every run. npm publishing is intentionally deferred until OpenWebDoc is ready to support external package consumers.

## Public alpha follow-up gates

Before tagging a public alpha release, confirm:

- GitHub Pages serves the entry page, app, introduction example, slide deck example, and template gallery.
- `pnpm smoke:e2e` covers table/figure micro-editing, keyboard shortcuts, mobile overflow, export validation, and reopened-package confidence.
- `pnpm pages:smoke` passes against the live Pages URL.
- The Chrome extension direction remains a decision note, not an alpha dependency.
- Package signing remains a future provenance design, not an alpha dependency.
