# @openwebdoc/spec

Format constants, TypeScript types, JSON Schemas, and fixtures for the HTMLX Document Package format.

## Install

```sh
npm install @openwebdoc/spec
```

## Usage

```ts
import {
  HTMLX_MANIFEST_PATH,
  validateHtmlxManifestSchema,
  validateHtmlxPresentationMetadataSchema,
} from "@openwebdoc/spec";
```

Use this package when implementing manifest-aware tooling for `.htmlx` files, including optional HTMLX-native slide deck presentation metadata.
