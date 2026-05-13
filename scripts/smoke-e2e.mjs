import { createHtmlx, encodeJson, encodeText, sha256Integrity } from "@openwebdoc/core";
import { createDefaultManifest } from "@openwebdoc/spec";
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = new URL("..", import.meta.url).pathname;
const pnpm = process.env.PNPM_BIN ?? "pnpm";
const env = {
  ...process.env,
};

const viewerUrl = "http://127.0.0.1:4173/";
const editorUrl = "http://127.0.0.1:4174/";
const tmpRoot = await mkdtemp(join(tmpdir(), "openwebdoc-e2e-"));

const servers = [];
let browser;

try {
  await createAssetFixture(join(tmpRoot, "asset-doc.htmlx"));

  servers.push(
    startServer([
      "--filter",
      "@openwebdoc/viewer",
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
    ]),
  );
  servers.push(
    startServer([
      "--filter",
      "@openwebdoc/editor",
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4174",
    ]),
  );
  await Promise.all([waitForHttp(viewerUrl), waitForHttp(editorUrl)]);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(viewerUrl);
  await page.locator('input[type="file"]').setInputFiles(join(repoRoot, "examples/basic.htmlx"));
  await expectFrameText(page, "h1", "Basic HTMLX Document");

  await page.locator('input[type="file"]').setInputFiles(join(tmpRoot, "asset-doc.htmlx"));
  await expectFrameText(page, "h1", "Asset Resolver Smoke");
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator('img[src^="blob:"]')
    .waitFor({ state: "attached", timeout: 5000 });

  const editor = await browser.newPage();
  await editor.goto(editorUrl);
  await editor
    .getByLabel("Agent edit request")
    .fill(
      "Title: Playwright Export Smoke\nBody: The editor export smoke produces a valid HTMLX package through the agent-editable proposal flow.",
    );
  await editor.getByRole("button", { name: /prepare agent packet/i }).click();
  await editor.getByRole("button", { name: /apply local draft/i }).click();
  const downloadPromise = editor.waitForEvent("download");
  await editor.getByRole("button", { name: /export \.htmlx/i }).click();
  const download = await downloadPromise;
  const exportPath = join(tmpRoot, "playwright-export-smoke.htmlx");
  await download.saveAs(exportPath);

  const validate = spawnSync(pnpm, ["exec", "htmlx", "validate", exportPath, "--json"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
  if (validate.status !== 0) {
    throw new Error(`Exported package failed validation:\n${validate.stdout}\n${validate.stderr}`);
  }
  const agentWorkspace = join(tmpRoot, "agent-workspace");
  const agentWorkspaceResult = spawnSync(
    pnpm,
    ["exec", "htmlx", "agent-workspace", exportPath, agentWorkspace, "--json"],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    },
  );
  if (agentWorkspaceResult.status !== 0) {
    throw new Error(
      `Agent workspace creation failed:\n${agentWorkspaceResult.stdout}\n${agentWorkspaceResult.stderr}`,
    );
  }
  await stat(join(agentWorkspace, "AGENT_EDITING.md"));
  await stat(join(agentWorkspace, "agent-edit-request.json"));
  await stat(join(agentWorkspace, "package", "manifest.json"));

  await page.goto(viewerUrl);
  await page.locator('input[type="file"]').setInputFiles(exportPath);
  await expectFrameText(page, "h1", "Playwright Export Smoke");

  console.log("OpenWebDoc smoke e2e passed.");
} finally {
  await browser?.close();
  for (const server of servers) {
    server.kill("SIGTERM");
  }
}

function startServer(args) {
  const child = spawn(pnpm, args, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function waitForHttp(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function expectFrameText(page, selector, text) {
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator(selector)
    .filter({ hasText: text })
    .waitFor({ state: "visible", timeout: 5000 });
}

async function createAssetFixture(outputPath) {
  const now = "2026-05-13T00:00:00.000Z";
  const manifest = createDefaultManifest({
    packageId: "urn:uuid:30000000-0000-4000-8000-000000000000",
    title: "Asset Resolver Smoke",
    language: "en",
    now,
  });
  const files = new Map([
    [
      manifest.entry,
      encodeText(`<!doctype html>
<html lang="en">
  <body>
    <main>
      <section data-htmlx-block-id="block-1">
        <h1>Asset Resolver Smoke</h1>
        <p>The image below must be resolved from the package.</p>
        <img src="assets/pixel.svg" alt="package-local pixel">
      </section>
    </main>
  </body>
</html>`),
    ],
    [
      "styles/document.css",
      encodeText("body { font-family: system-ui, sans-serif; } img { width: 12px; height: 12px; }"),
    ],
    [
      "assets/pixel.svg",
      encodeText(
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="#2f6fed"/></svg>',
      ),
    ],
    [
      "metadata/llm.json",
      encodeJson({
        schemaVersion: "0.1.0",
        summary: "Asset Resolver Smoke",
        readingOrder: ["block-1"],
        chunks: [
          {
            id: "chunk-1",
            blockIds: ["block-1"],
            selector: '[data-htmlx-block-id="block-1"]',
            summary: "Asset resolver smoke fixture.",
            keywords: ["OpenWebDoc", "HTMLX", "asset"],
            tokenEstimate: 90,
            sensitivity: "public",
          },
        ],
        entities: [],
        citations: [],
        assistantHints: {
          visibility: "user-visible",
          intendedUse: ["summarization", "retrieval", "editing"],
          doNotTreatAsSystemInstruction: true,
        },
      }),
    ],
    [
      "metadata/provenance.json",
      encodeJson({ schemaVersion: "0.1.0", createdBy: "OpenWebDoc smoke e2e", createdAt: now }),
    ],
  ]);

  manifest.resources = [
    {
      path: "styles/document.css",
      mediaType: "text/css",
      role: "stylesheet",
      integrity: await sha256Integrity(files.get("styles/document.css")),
    },
    {
      path: "assets/pixel.svg",
      mediaType: "image/svg+xml",
      role: "image",
      integrity: await sha256Integrity(files.get("assets/pixel.svg")),
    },
    {
      path: "metadata/llm.json",
      mediaType: "application/json",
      role: "metadata",
      integrity: await sha256Integrity(files.get("metadata/llm.json")),
    },
    {
      path: "metadata/provenance.json",
      mediaType: "application/json",
      role: "metadata",
      integrity: await sha256Integrity(files.get("metadata/provenance.json")),
    },
  ];

  await writeFile(outputPath, await createHtmlx({ manifest, files }));
}
