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

For a local static smoke check after building:

```sh
pnpm site:build
pnpm exec vite preview --host 127.0.0.1 --outDir dist/site
```

## GitHub Actions

- `CI` runs on `main` and pull requests.
- `Deploy Pages` builds and deploys `dist/site/` from `main`.
- `Release` builds release artifacts on version tags and can publish npm packages when `NPM_TOKEN` is configured.

## npm publishing

Publishing uses npm provenance. Required repository secret:

- `NPM_TOKEN`

Recommended release flow:

```sh
pnpm release:check
git tag v0.1.0-alpha.0
git push origin v0.1.0-alpha.0
```

The release workflow uploads local artifacts on every run. It publishes npm packages only for version tags or a manual workflow dispatch with publishing enabled.
