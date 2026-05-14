# HTMLX CLI Usage

The CLI binary is named `htmlx` and is provided by `@openwebdoc/cli`.

```sh
htmlx create document.htmlx --title "My Document"
htmlx validate document.htmlx
htmlx inspect document.htmlx --json
htmlx pack examples/basic examples/basic.htmlx
htmlx unpack examples/basic.htmlx ./basic-htmlx
htmlx agent-workspace examples/basic.htmlx ./basic-agent
htmlx validate-workspace ./basic-agent --json
```

Validation exits with a non-zero status for invalid packages. Use `--json` for machine-readable output.

`agent-workspace` is the preferred handoff command for external coding agents. It validates the input package, unpacks it into `package/`, and writes `AGENT_EDITING.md`, `agent-edit-request.json`, and `agent-edit-proposal.json` beside it.

`validate-workspace` validates the generated request/proposal JSON files and the unpacked `package/` directory. It is intended for external agents before they return an edited package.

During workspace development, run the binary through pnpm:

```sh
pnpm htmlx validate examples/basic.htmlx
```
