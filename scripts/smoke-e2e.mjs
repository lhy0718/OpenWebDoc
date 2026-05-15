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
  const editorImagePath = join(tmpRoot, "editor-pixel.svg");
  await writeFile(
    editorImagePath,
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" rx="8" fill="#2f6fed"/><circle cx="68" cy="28" r="14" fill="#dbeafe"/></svg>',
  );

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

  await page
    .locator('input[type="file"]')
    .setInputFiles(join(repoRoot, "examples/rich-self-editable.htmlx"));
  await expectFrameText(page, "h1", "OpenWebDoc Introduction");
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator('[data-htmlx-kind="table"] table')
    .first()
    .waitFor({ state: "attached", timeout: 5000 });
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator('[data-htmlx-kind="figure"] img[src^="blob:"]')
    .first()
    .waitFor({ state: "attached", timeout: 5000 });

  await page.locator('input[type="file"]').setInputFiles(join(tmpRoot, "asset-doc.htmlx"));
  await expectFrameText(page, "h1", "Asset Resolver Smoke");
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator('img[src^="blob:"]')
    .first()
    .waitFor({ state: "attached", timeout: 5000 });

  const editor = await browser.newPage();
  await editor.goto(editorUrl);
  const moveButton = editor.getByRole("button", { name: "Move menu" });
  const menuButton = editor.getByRole("button", { name: "Expand menu" });
  const menuBeforeDrag = await moveButton.boundingBox();
  if (!menuBeforeDrag) {
    throw new Error("Collapsed editor menu handle was not visible for drag smoke.");
  }
  await editor.mouse.move(
    menuBeforeDrag.x + menuBeforeDrag.width / 2,
    menuBeforeDrag.y + menuBeforeDrag.height / 2,
  );
  await editor.mouse.down();
  await editor.mouse.move(
    menuBeforeDrag.x + menuBeforeDrag.width / 2 - 84,
    menuBeforeDrag.y + menuBeforeDrag.height / 2 + 42,
    { steps: 8 },
  );
  await editor.mouse.up();
  const menuAfterDrag = await moveButton.boundingBox();
  if (
    !menuAfterDrag ||
    menuAfterDrag.x > menuBeforeDrag.x - 50 ||
    menuAfterDrag.y < menuBeforeDrag.y + 25
  ) {
    throw new Error("Collapsed menu handle did not stay under pointer after drag.");
  }
  await menuButton.click();
  const headBox = await editor.locator(".toolbar-head").boundingBox();
  const actionsBox = await editor.locator(".toolbar-actions").boundingBox();
  if (!headBox || !actionsBox || actionsBox.y <= headBox.y + headBox.height) {
    throw new Error("Expanded toolbar actions did not open below the fixed header row.");
  }
  const controlsClass = await editor.locator(".floating-controls").getAttribute("class");
  if (!controlsClass?.includes("open-left")) {
    throw new Error(
      `Expanded toolbar did not adapt direction near the right edge: ${controlsClass}`,
    );
  }
  await editor
    .locator('input[accept=".htmlx,application/vnd.openwebdoc.htmlx+zip"]')
    .setInputFiles(join(repoRoot, "examples/rich-self-editable.htmlx"));
  await editor
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "OpenWebDoc Introduction" })
    .waitFor({ state: "visible", timeout: 5000 });
  await editor.waitForFunction(() => {
    const figure = document.querySelector(".figure-object");
    const card = document.querySelector(".figure-object .figure-card");
    if (!figure || !card) return false;
    const figureBox = figure.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return figureBox.width > 0 && figureBox.height > 0 && cardBox.width > 0 && cardBox.height > 0;
  });
  const firstFigure = editor.locator('[data-htmlx-block-id="implementation-map"]');
  const firstFigureCard = firstFigure.locator(".figure-card").first();
  await firstFigureCard.scrollIntoViewIfNeeded();
  const figureBox = await firstFigure.boundingBox();
  if (!figureBox || !(await firstFigureCard.boundingBox())) {
    throw new Error("Grouped figure and inner card were not visible for drag smoke.");
  }
  await editor.mouse.click(figureBox.x + figureBox.width / 2, figureBox.y + figureBox.height / 2);
  await editor.waitForTimeout(100);
  const cardBox = await firstFigureCard.boundingBox();
  if (!cardBox) {
    throw new Error("Grouped figure card disappeared after selecting the figure.");
  }
  await editor.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await editor.waitForTimeout(100);
  const activeCardBox = await firstFigureCard.boundingBox();
  if (!activeCardBox) {
    throw new Error("Grouped figure card disappeared after activation click.");
  }
  const cardStyleBefore = await firstFigureCard.getAttribute("style");
  await editor.mouse.move(
    activeCardBox.x + activeCardBox.width / 2,
    activeCardBox.y + activeCardBox.height / 2,
  );
  await editor.mouse.down();
  await editor.mouse.move(
    activeCardBox.x + activeCardBox.width / 2 + 60,
    activeCardBox.y + activeCardBox.height / 2 + 40,
    {
      steps: 8,
    },
  );
  await editor.mouse.up();
  await editor.waitForTimeout(100);
  const cardStyleAfter = await firstFigureCard.getAttribute("style");
  if (cardStyleAfter === cardStyleBefore) {
    throw new Error("Figure inner card did not move after selecting the grouped figure.");
  }
  await replaceEditableText(
    editor.locator('[data-htmlx-block-id="doc-title"]'),
    "Playwright Export Smoke",
  );
  await replaceEditableText(
    editor.locator('[data-htmlx-block-id="doc-subtitle"]'),
    "The editor export smoke produces a valid HTMLX package through the WYSIWYG flow.",
  );
  await editor.locator('input[accept="image/*"]').setInputFiles(editorImagePath);
  await editor.getByRole("button", { name: /rectangle/i }).click();
  const rectangle = editor.locator(".shape-object").last();
  const beforeDrag = await rectangle.boundingBox();
  if (!beforeDrag) {
    throw new Error("Rectangle shape was not visible for drag smoke.");
  }
  await rectangle.click();
  const selectedShapeBox = await rectangle.boundingBox();
  if (!selectedShapeBox) {
    throw new Error("Rectangle shape disappeared after selection.");
  }
  const shapeStyleBeforeDrag = await rectangle.getAttribute("style");
  await editor.mouse.move(
    selectedShapeBox.x + selectedShapeBox.width / 2,
    selectedShapeBox.y + selectedShapeBox.height / 2,
  );
  await editor.mouse.down();
  await editor.mouse.move(
    selectedShapeBox.x + selectedShapeBox.width / 2 + 84,
    selectedShapeBox.y + selectedShapeBox.height / 2 + 48,
    {
      steps: 8,
    },
  );
  await editor.mouse.up();
  const afterDrag = await rectangle.boundingBox();
  if (
    !afterDrag ||
    afterDrag.x <= selectedShapeBox.x + 60 ||
    afterDrag.y <= selectedShapeBox.y + 30
  ) {
    throw new Error("Rectangle shape did not move after pointer drag.");
  }
  const shapeStyleAfterDrag = await rectangle.getAttribute("style");
  const undoShortcut = process.platform === "darwin" ? "Meta+Z" : "Control+Z";
  const redoShortcut = process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Shift+Z";
  await editor.locator('[data-htmlx-block-id="doc-title"]').click();
  await editor.keyboard.press(undoShortcut);
  const shapeStyleAfterUndo = await rectangle.getAttribute("style");
  if (shapeStyleAfterUndo !== shapeStyleBeforeDrag) {
    throw new Error(
      `Command/Ctrl+Z did not undo rectangle movement.\nExpected ${shapeStyleBeforeDrag}\nActual ${shapeStyleAfterUndo}`,
    );
  }
  await editor.keyboard.press(redoShortcut);
  const shapeStyleAfterRedo = await rectangle.getAttribute("style");
  if (shapeStyleAfterRedo !== shapeStyleAfterDrag) {
    throw new Error(
      `Command/Ctrl+Shift+Z did not redo rectangle movement.\nExpected ${shapeStyleAfterDrag}\nActual ${shapeStyleAfterRedo}`,
    );
  }
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
  const unpackedPackage = join(tmpRoot, "unpacked-export");
  const unpackResult = spawnSync(
    pnpm,
    ["exec", "htmlx", "unpack", exportPath, unpackedPackage, "--json"],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    },
  );
  if (unpackResult.status !== 0) {
    throw new Error(`Package unpack failed:\n${unpackResult.stdout}\n${unpackResult.stderr}`);
  }
  await stat(join(unpackedPackage, "manifest.json"));
  const validateDirectory = spawnSync(
    pnpm,
    ["exec", "htmlx", "validate", unpackedPackage, "--json"],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    },
  );
  if (validateDirectory.status !== 0) {
    throw new Error(
      `Unpacked package failed validation:\n${validateDirectory.stdout}\n${validateDirectory.stderr}`,
    );
  }

  await page.goto(viewerUrl);
  await page.locator('input[type="file"]').setInputFiles(exportPath);
  await expectFrameText(page, "h1", "Playwright Export Smoke");
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator('img[src^="blob:"]')
    .first()
    .waitFor({ state: "attached", timeout: 5000 });
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator(".htmlx-shape-rectangle")
    .first()
    .waitFor({ state: "attached", timeout: 5000 });

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
    .waitFor({ state: "attached", timeout: 5000 });
}

async function replaceEditableText(locator, text) {
  await locator.click();
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await locator.press("Backspace");
  await locator.pressSequentially(text);
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
