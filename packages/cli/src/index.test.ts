import { describe, expect, it } from "vitest";
import { buildProgram } from "./index.js";
import { mkdtemp, readFile, stat } from "node:fs/promises";
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
    ).toEqual([
      "agent-workspace",
      "create",
      "inspect",
      "pack",
      "unpack",
      "validate",
      "validate-workspace",
    ]);
  });

  it("creates an agent-editable workspace", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-agent-workspace-"));
    let stdout = "";
    const program = buildProgram({
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    });

    await program.parseAsync(["node", "htmlx", "agent-workspace", input, output, "--json"]);

    await stat(join(output, "AGENT_EDITING.md"));
    await stat(join(output, "agent-edit-request.json"));
    await stat(join(output, "agent-edit-proposal.json"));
    await stat(join(output, "package", "manifest.json"));
    const request = JSON.parse(await readFile(join(output, "agent-edit-request.json"), "utf8"));
    expect(request.workflow).toBe("htmlx-agent-edit");
    expect(request.$schema).toContain("htmlx-agent-edit-request");
    expect(request.commands.pack).toBe("htmlx pack package edited.htmlx --json");
    expect(JSON.parse(stdout).ok).toBe(true);
  });

  it("validates an agent-editable workspace", async () => {
    const input = new URL("../../../examples/basic.htmlx", import.meta.url).pathname;
    const output = await mkdtemp(join(tmpdir(), "htmlx-agent-workspace-"));
    const io = {
      stdout: { write: (chunk: string) => ((stdout += chunk), true) },
      stderr: { write: () => true },
    };
    let stdout = "";

    await buildProgram(io).parseAsync(["node", "htmlx", "agent-workspace", input, output]);
    stdout = "";
    await buildProgram(io).parseAsync(["node", "htmlx", "validate-workspace", output, "--json"]);

    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.package.valid).toBe(true);
    expect(parsed.request.workflow).toBe("htmlx-agent-edit");
  });
});
