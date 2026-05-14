# OpenWebDoc Examples

- `basic/`: a valid HTMLX package directory that can be packed into `basic.htmlx`.
- `security-invalid/`: an intentionally invalid fixture with script, remote resource, and unsafe LLM metadata examples.

Generate example packages after building the CLI:

```sh
pnpm --filter @openwebdoc/cli htmlx -- pack examples/basic examples/basic.htmlx
pnpm --filter @openwebdoc/cli htmlx -- pack examples/security-invalid examples/security-invalid.htmlx
```

Create an external-agent editing workspace:

```sh
pnpm htmlx agent-workspace examples/basic.htmlx ./basic-agent
```
