import { describe, expect, it } from "vitest";
import {
  HtmlxError,
  createHtmlx,
  decodeText,
  normalizePackagePath,
  openHtmlx,
  resolveHtmlxDocument,
  sha256Integrity,
  validateHtmlx,
} from "./index.js";

const html = `<!doctype html>
<html>
  <body>
    <main>
      <section data-htmlx-block-id="block-1">
        <h1>Basic HTMLX Document</h1>
        <p>Hello OpenWebDoc.</p>
      </section>
    </main>
  </body>
</html>`;

describe("HTMLX core", () => {
  it("roundtrips a generated document", async () => {
    const archive = await createHtmlx({
      title: "Basic HTMLX Document",
      language: "en",
      html,
    });
    const opened = await openHtmlx(archive);

    expect(opened.manifest.title).toBe("Basic HTMLX Document");
    expect(decodeText(opened.files.get(opened.manifest.entry)!)).toContain("Hello OpenWebDoc");
    expect(opened.validation.valid).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(normalizePackagePath("../evil.txt")).toBeNull();
    expect(normalizePackagePath("content/document.html")).toBe("content/document.html");
  });

  it("rejects unsafe scripts", async () => {
    await expect(
      createHtmlx({
        title: "Unsafe",
        html: `<section data-htmlx-block-id="block-1"><script>alert(1)</script></section>`,
      }),
    ).rejects.toBeInstanceOf(HtmlxError);
  });

  it("rejects remote resources", async () => {
    const result = await validateHtmlx({
      mimetype: "application/vnd.openwebdoc.htmlx+zip",
      "manifest.json": JSON.stringify({
        $schema: "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json",
        htmlxVersion: "0.1.0",
        packageId: "urn:test",
        title: "Remote",
        language: "en",
        createdAt: "2026-05-13T00:00:00.000Z",
        modifiedAt: "2026-05-13T00:00:00.000Z",
        entry: "content/document.html",
        styles: [],
        resources: [],
        metadata: {},
        security: {
          allowScripts: false,
          allowRemoteResources: false,
          allowedOrigins: [],
          interactionModel: "declarative",
        },
      }),
      "content/document.html": `<img src="https://example.com/image.png" alt="">`,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("html.remote_resource");
  });

  it("rewrites package-local assets to object URLs for rendering", async () => {
    const archive = await createHtmlx({
      manifest: {
        $schema: "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json",
        htmlxVersion: "0.1.0",
        packageId: "urn:test",
        title: "Asset",
        language: "en",
        createdAt: "2026-05-13T00:00:00.000Z",
        modifiedAt: "2026-05-13T00:00:00.000Z",
        entry: "content/document.html",
        styles: ["styles/document.css"],
        resources: [
          { path: "styles/document.css", mediaType: "text/css", role: "stylesheet" },
          { path: "assets/pixel.png", mediaType: "image/png", role: "image" },
        ],
        metadata: {},
        security: {
          allowScripts: false,
          allowRemoteResources: false,
          allowedOrigins: [],
          interactionModel: "declarative",
        },
      },
      files: {
        "content/document.html": `<section data-htmlx-block-id="block-1"><img src="assets/pixel.png" alt="pixel"></section>`,
        "styles/document.css": "img { max-width: 100%; }",
        "assets/pixel.png": new Uint8Array([137, 80, 78, 71]),
      },
    });
    const opened = await openHtmlx(archive);
    const resolved = resolveHtmlxDocument(opened, {
      createObjectUrl: (_blob, path) => `blob:test/${path}`,
    });

    expect(resolved.html).toContain('src="blob:test/assets/pixel.png"');
    expect(resolved.html).toContain('data-htmlx-style="styles/document.css"');
    expect(resolved.objectUrls).toEqual(["blob:test/assets/pixel.png"]);
  });

  it("rejects missing local document resources", async () => {
    const result = await validateHtmlx({
      mimetype: "application/vnd.openwebdoc.htmlx+zip",
      "manifest.json": JSON.stringify({
        $schema: "https://openwebdoc.org/schemas/htmlx-manifest-v0.1.schema.json",
        htmlxVersion: "0.1.0",
        packageId: "urn:test",
        title: "Missing",
        language: "en",
        createdAt: "2026-05-13T00:00:00.000Z",
        modifiedAt: "2026-05-13T00:00:00.000Z",
        entry: "content/document.html",
        styles: [],
        resources: [],
        metadata: {},
        security: {
          allowScripts: false,
          allowRemoteResources: false,
          allowedOrigins: [],
          interactionModel: "declarative",
        },
      }),
      "content/document.html": `<img src="assets/missing.png" alt="">`,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("html.local_resource_missing");
  });

  it("calculates sha256 integrity strings", async () => {
    await expect(sha256Integrity(new TextEncoder().encode("hello"))).resolves.toMatch(/^sha256-/);
  });
});
