# Chrome Extension Strategy

OpenWebDoc should keep the current web runtime and CLI as the canonical implementation. A Chrome extension can become a thin companion later, but it should not replace the `.htmlx` package, validation, and unpacked-package editing model.

## Recommendation

Use a `web-app + optional extension` direction:

- Keep `@openwebdoc/spec`, `@openwebdoc/core`, and `@openwebdoc/cli` as the stable format and automation layer.
- Keep `apps/openwebdoc` as the static web runtime for opening, reading, editing, and exporting `.htmlx`.
- Add a Chrome extension only when capture/open convenience becomes a validated user need.

## Why Not Extension-only

An extension-only product would simplify the visible entry point, but it would move too much of the core system into Chrome-specific constraints:

- browser extension permissions and review policies
- Manifest V3 content-script limits
- local file access prompts
- shared bundle size constraints for ZIP parsing and validation
- weaker fit for CLI pack, validate, unpack, and external-agent package editing workflows

OpenWebDoc's core value is the portable HTMLX Document Package and the validation boundary around it, not the extension container.

## Good Extension Scope

A future extension should be a thin companion:

- open a local `.htmlx` with the hosted OpenWebDoc app
- capture the current page or selection into a draft HTMLX package
- send a package to a local or hosted external-agent editing flow
- expose validation status for a package before sharing

It should reuse `@openwebdoc/core` where practical and avoid provider API keys in content scripts.

## Decision Gate

Promote an extension to official product scope only after one of these signals is true:

- users repeatedly ask to capture current web pages into `.htmlx`
- users need OS/browser-level `.htmlx` open convenience more than CLI automation
- pilot results show web capture is more important than document-surface authoring
- the extension can remain a thin shell without duplicating CLI validation logic
