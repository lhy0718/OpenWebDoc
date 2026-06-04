# @openwebdoc/core

Core read, write, pack, unpack, validation, and package-local asset resolution APIs for HTMLX Document Package files.

## Public Preview Availability

OpenWebDoc does not publish npm packages during the public preview phase. Use the
repository checkout for development, or inspect the GitHub release tarballs. The
future published package will remain scoped as `@openwebdoc/core`.

## Usage

```ts
import { openHtmlx, validateHtmlx } from "@openwebdoc/core";

const validation = await validateHtmlx(bytes);
const document = await openHtmlx(bytes);
```

All `.htmlx` input should be treated as untrusted input and validated before rendering or unpacking.
