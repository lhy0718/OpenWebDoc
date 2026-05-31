import { describe, expect, it } from "vitest";
import {
  bytesEqual,
  compareFileMaps,
  scanFileMapForAbsolutePaths,
  scanTextForAbsolutePaths,
} from "../../../scripts/release-check-helpers.mjs";

describe("release check helpers", () => {
  it("compares file maps and reports missing extra and different files", () => {
    const sourceFiles = new Map([
      ["index.html", Buffer.from("same")],
      ["metadata/llm.json", Buffer.from("fresh")],
      ["styles/document.css", Buffer.from("css")],
    ]);
    const packageFiles = new Map([
      ["index.html", Buffer.from("same")],
      ["metadata/llm.json", Buffer.from("stale")],
      ["mimetype", Buffer.from("application/vnd.openwebdoc.htmlx+zip")],
      ["extra.txt", Buffer.from("extra")],
    ]);

    const result = compareFileMaps(sourceFiles, packageFiles, new Set(["mimetype"]));

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["styles/document.css"]);
    expect(result.extra).toEqual(["extra.txt"]);
    expect(result.different).toEqual(["metadata/llm.json"]);
  });

  it("detects private paths in package text files but skips binary content", () => {
    const macUserPath = ["", "Users", "example", "document"].join("/");
    const fileUriPrefix = ["file:", "", ""].join("/");
    const files = new Map([
      ["index.html", Buffer.from(`<p>${macUserPath}</p>`)],
      ["assets/image.png", new Uint8Array([0, 1, 2, 3])],
    ]);

    expect(scanFileMapForAbsolutePaths(files)).toEqual(["index.html contains macOS user path."]);
    expect(scanTextForAbsolutePaths(`${fileUriPrefix}${macUserPath}/document.html`)).toEqual([
      "macOS user path",
      "absolute file URI",
    ]);
  });

  it("compares package bytes exactly", () => {
    expect(bytesEqual(Buffer.from("abc"), Buffer.from("abc"))).toBe(true);
    expect(bytesEqual(Buffer.from("abc"), Buffer.from("abd"))).toBe(false);
  });
});
