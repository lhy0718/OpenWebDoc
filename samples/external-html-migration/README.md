# External Sample: HTML Migration

This sample shows how an existing safe standalone HTML page can enter HTMLX and leave again as ordinary static HTML.

## Flow

```sh
htmlx from-html source/operations-page.html documents/operations-page.htmlx --title "Operations Page" --json
htmlx validate documents/operations-page.htmlx --json
htmlx to-static-html documents/operations-page.htmlx public/operations-page --overwrite --json
```

The converter rejects scripts, event handlers, forms, iframes, remote resources, file resources, data resources, CSS resource imports, and body-local asset references. Add assets later in an unpacked package when the package manifest can declare them.

## Review Boundary

- keep the source HTML simple and local
- validate the generated `.htmlx`
- publish the static export only after validation passes
