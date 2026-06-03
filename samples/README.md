# OpenWebDoc External Sample Repositories

These folders are copyable external-repository skeletons for adopting HTMLX outside the OpenWebDoc monorepo.

Each sample includes:

- a small source document
- one generated `.htmlx` package
- a tag-pinned GitHub Action workflow that validates the package in pull requests
- a README with the local editing and validation flow

The samples are not pnpm workspace packages. They model what another repository can copy.

The template repository mapping is declared in [`template-repos.json`](template-repos.json).

## Samples

| Sample                    | Entry path                                               | Use case                            |
| ------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `external-research-notes` | Markdown -> `.htmlx`                                     | Research notes and technical memos  |
| `external-html-migration` | safe HTML -> `.htmlx` -> static HTML                     | Existing standalone web documents   |
| `external-agent-brief`    | `.htmlx` -> unpacked package edits -> validated `.htmlx` | Agent-edited document pull requests |

## Local Check

From the OpenWebDoc repository root:

```sh
pnpm build
pnpm samples:check
pnpm samples:export
pnpm samples:verify-export
```

The check validates sample `.htmlx` files, confirms the workflows pin the OpenWebDoc validator action to a release tag, and scans sample packages for private or absolute paths.

The export command copies the skeletons into `dist/sample-repos/` and adds a small `TEMPLATE_REPOSITORY.md` note for each candidate repository.

The export verification confirms that each exported candidate preserves its source sample content, includes the template note and validation workflow, avoids `@main` action refs, validates contained `.htmlx` packages, and contains no private or absolute local paths.

`pnpm site:build` packages the exported candidates as downloadable archives under `dist/site/samples/` so the GitHub Pages landing page can expose them before separate template repositories are created. `pnpm release:check` runs export verification before building the public site.

## Security-Sensitive Adoption

The sample workflows use a readable release tag:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@v0.1.0-alpha.1
```

Repositories that require stricter action immutability can replace the tag with the release commit SHA:

```yaml
- uses: lhy0718/OpenWebDoc/.github/actions/validate-htmlx@5e00f71fc722f984352484b04e5f9179398cf74b
```

See [GitHub Action Pinning and Supply-Chain Notes](../docs/supply-chain-action-pinning.md) for upgrade guidance.

## Splitting Into Template Repositories

See [External Template Repository Readiness](template-repo-readiness.md) before copying a sample into a separate public starter repository.
