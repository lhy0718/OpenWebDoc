# Aider Recipe

Use Aider for focused package-file edits with a small set of files.

```sh
htmlx unpack input.htmlx ./input-package --json
```

Add only the files that need edits, such as:

```sh
index.html
styles/document.css
metadata/llm.json
metadata/provenance.json
manifest.json
```

After Aider finishes:

```sh
htmlx refresh-metadata ./input-package --json
htmlx refresh-metadata ./input-package --check --json
htmlx validate ./input-package --json
htmlx pack ./input-package edited.htmlx --json
htmlx validate edited.htmlx --json
```

Keep `metadata/llm.json` as reference metadata. It is never a hidden instruction channel.
