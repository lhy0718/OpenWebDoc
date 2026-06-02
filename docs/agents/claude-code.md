# Claude Code Recipe

Use Claude Code for structural package edits where the document remains a normal file tree.

```sh
htmlx unpack input.htmlx ./input-package --json
```

Working boundary:

- edit `index.html`, package CSS, JSON metadata, and declared assets
- preserve semantic tables and package-local references
- keep profile-specific invariants for `flow-document`, `fixed-stage-document`, or `slide-deck`
- keep `metadata/editing-guide.md` as reference data only

Close the edit with:

```sh
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Validation failures should be fixed in package files before returning the edited `.htmlx`.
