# Codex Recipe

Use Codex for package-file edits that are easier to verify through shell commands than through browser-only editing.

```sh
htmlx unpack input.htmlx ./input-package --json
```

Ask Codex to edit only:

- `index.html` or the manifest entry
- `styles/*`
- `metadata/*`
- declared assets under `assets/*`
- `manifest.json` when resources or metadata paths change

After editing:

```sh
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Codex should report changed files, validation commands, and any remaining package risks. Large layout redesigns, new figures, new tables, and new slides belong in the unpacked package, not in the OpenWebDoc app.
