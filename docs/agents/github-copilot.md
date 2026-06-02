# GitHub Copilot Recipe

Use GitHub Copilot with an unpacked package directory when `.htmlx` documents live in a repository.

```sh
htmlx unpack input.htmlx ./input-package --json
```

Repository workflow:

1. Edit package-local HTML, CSS, metadata, and declared assets.
2. Refresh profile-aware LLM metadata.
3. Validate the unpacked directory.
4. Pack the edited `.htmlx`.
5. Validate the packed file.

```sh
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Use the GitHub Action validator so pull requests fail when packages contain unsafe HTML, remote resources, stale metadata, or undeclared assets.
