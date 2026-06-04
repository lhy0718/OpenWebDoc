# @openwebdoc/spec

Format constants, TypeScript types, JSON Schemas, and fixtures for the HTMLX Document Package format.

## Public Preview Availability

OpenWebDoc does not publish npm packages during the public preview phase. Use the
repository checkout for development, or inspect the GitHub release tarballs. The
future published package will remain scoped as `@openwebdoc/spec`.

## Usage

```ts
import {
  HTMLX_MANIFEST_PATH,
  validateHtmlxManifestSchema,
  validateHtmlxPresentationMetadataSchema,
} from "@openwebdoc/spec";
```

Use this package when implementing manifest-aware tooling for `.htmlx` files, including optional HTMLX-native slide deck presentation metadata.
