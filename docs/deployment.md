# Deployment

OpenWebDoc has two deployable surfaces:

- npm packages under `@openwebdoc/*`
- a static site that hosts the OpenWebDoc app

## Local release check

Run the full release gate before tagging or deploying:

```sh
pnpm release:check
```

This command runs repository guards, builds all workspaces, runs tests and linting, verifies examples, creates npm package tarballs, and builds the static site.

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

`dist/site/app/` is the deployable OpenWebDoc runtime. It starts with a single file-open screen. After a valid package is selected, the runtime shows the document first and keeps app controls in a small floating toolbar. `dist/site/index.html` is only a lightweight entry page that links to the app.

The current GitHub Pages deployment is:

- Entry page: <https://lhy0718.github.io/OpenWebDoc/>
- OpenWebDoc app: <https://lhy0718.github.io/OpenWebDoc/app/>
- Introduction example: <https://lhy0718.github.io/OpenWebDoc/app/?example=openwebdoc-introduction>
- Slide deck example: <https://lhy0718.github.io/OpenWebDoc/app/?example=openwebdoc-slide-deck>

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
git tag v0.1.0-alpha.0
git push origin v0.1.0-alpha.0
```

The release workflow uploads local artifacts on every run. npm publishing is intentionally deferred until OpenWebDoc is ready to support external package consumers.
