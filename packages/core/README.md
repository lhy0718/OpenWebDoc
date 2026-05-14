# @openwebdoc/core

Core read, write, pack, unpack, validation, and package-local asset resolution APIs for HTMLX Document Package files.

## Install

```sh
npm install @openwebdoc/core
```

## Usage

```ts
import { openHtmlx, validateHtmlx } from "@openwebdoc/core";

const validation = await validateHtmlx(bytes);
const document = await openHtmlx(bytes);
```

All `.htmlx` input should be treated as untrusted input and validated before rendering or unpacking.
