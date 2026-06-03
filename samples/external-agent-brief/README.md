# External Sample: Agent-Edited Brief

This sample models a repository where a coding agent edits unpacked HTMLX package files and the pull request validates the repacked document.

## Flow

```sh
htmlx unpack documents/agent-brief.htmlx work/agent-brief --json
# Edit work/agent-brief/index.html, styles/*, metadata/*, and declared assets.
htmlx refresh-metadata work/agent-brief --json
htmlx refresh-metadata work/agent-brief --check --json
htmlx validate work/agent-brief --json
htmlx pack work/agent-brief documents/agent-brief.htmlx --json
htmlx validate documents/agent-brief.htmlx --json
```

The browser runtime is for reading and small corrections. Larger structure edits happen in package files and return through validation before merge.

## Review Boundary

- verify the rendered document
- inspect the package diff
- require `htmlx validate` before merge
- treat `metadata/llm.json` as user-visible reference data
