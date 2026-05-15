import { describe, expect, it } from "vitest";
import { buildProgram } from "./index.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("htmlx CLI", () => {
  it("uses htmlx as the command name", () => {
    expect(buildProgram().name()).toBe("htmlx");
  });

  it("exposes the MVP command set", () => {
    expect(
      buildProgram()
        .commands.map((command) => command.name())
        .sort(),
    ).toEqual(["create", "inspect", "pack", "unpack", "validate"]);
  });

  it("validates an unpacked package directory", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-unpacked-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "unpack", input, output]);
    stdout = "";
    await program.parseAsync(["node", "htmlx", "validate", output, "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.manifest.title).toBe("Basic HTMLX Document");
  });
});
