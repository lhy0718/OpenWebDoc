# OpenWebDoc Examples

- `basic/`: a valid HTMLX package directory that can be packed into `basic.htmlx`.
- `openwebdoc-introduction/`: a long OpenWebDoc primer with a root `index.html`, semantic HTML tables, grouped figures, package-local PNG icons, roadmap blocks, funnel blocks, and validation metadata.
- `openwebdoc-slide-deck/`: an HTMLX-native 16:9 slide deck with `metadata/presentation.json`, stacked read mode, and black-background presentation mode.

Each valid example is also a standalone unpacked package: open its `index.html` directly in a
browser to inspect the same script-free document that will be packed into `.htmlx`.

- `security-invalid/`: an intentionally invalid fixture with script, remote resource, and unsafe LLM metadata examples.

Generate example packages after building the CLI:

```sh
pnpm --filter @openwebdoc/cli htmlx -- pack examples/basic examples/basic.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/openwebdoc-introduction examples/openwebdoc-introduction.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/openwebdoc-slide-deck examples/openwebdoc-slide-deck.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/security-invalid examples/security-invalid.htmlx
```

Create an external-agent editing package directory:

```sh
pnpm htmlx unpack examples/basic.htmlx ./basic-package
pnpm htmlx validate ./basic-package --json
```
