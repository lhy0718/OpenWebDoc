# Cursor Recipe

Use Cursor when the document package is edited inside a project workspace.

```sh
htmlx unpack input.htmlx ./input-package --json
```

Open `./input-package` as the workspace. Keep edits inside the package directory and preserve package-relative paths.

Recommended checks:

```sh
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
```

When validation passes:

```sh
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Cursor should avoid browser-side model calls inside OpenWebDoc. The agent edits files; OpenWebDoc opens and micro-edits the validated result.
