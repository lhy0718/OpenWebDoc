import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.OPENWEBDOC_PAGES_URL ?? "https://lhy0718.github.io/OpenWebDoc/";
const appUrl = new URL("app/", baseUrl).toString();
const screenshotDirectory =
  process.env.OPENWEBDOC_PAGES_SCREENSHOTS === "1" ? "docs/assets/screenshots" : "";

let browser;

try {
  if (screenshotDirectory) {
    await mkdir(screenshotDirectory, { recursive: true });
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "OpenWebDoc", exact: true }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("link", { name: "Open OpenWebDoc" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("heading", { name: "Template gallery" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("heading", { name: "Starter repositories" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("link", { name: "Browse templates" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  const landingDownloadLinks = await page.locator('a[download][href$=".htmlx"]').count();
  if (landingDownloadLinks < 13) {
    throw new Error(`Expected at least 13 landing download links, found ${landingDownloadLinks}.`);
  }
  const landingCiLinks = await page.getByRole("link", { name: "Validate in CI" }).count();
  if (landingCiLinks < 13) {
    throw new Error(`Expected at least 13 landing CI links, found ${landingCiLinks}.`);
  }
  const starterRepoLinks = await page
    .locator('a[download][href^="./samples/"][href$=".zip"]')
    .count();
  if (starterRepoLinks < 3) {
    throw new Error(`Expected at least 3 starter repository downloads, found ${starterRepoLinks}.`);
  }
  await assertStarterRepositoryArchives(page);
  await assertNoHorizontalOverflow(page, "landing page");

  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Open a document package" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("heading", { name: "Try a bundled example" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  const appDownloadLinks = await page.locator('a[download][href$=".htmlx"]').count();
  if (appDownloadLinks < 13) {
    throw new Error(`Expected at least 13 app download links, found ${appDownloadLinks}.`);
  }
  const appCiLinks = await page.getByRole("link", { name: "Validate in CI" }).count();
  if (appCiLinks < 13) {
    throw new Error(`Expected at least 13 app CI links, found ${appCiLinks}.`);
  }
  await assertNoHorizontalOverflow(page, "empty state");
  await screenshot(page, "openwebdoc-pages-empty.png");

  await page.goto(`${appUrl}?example=openwebdoc-introduction`, { waitUntil: "networkidle" });
  await page
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "OpenWebDoc Introduction" })
    .waitFor({ state: "visible", timeout: 10000 });
  await page.locator('[data-htmlx-kind="table"] table').first().waitFor({
    state: "attached",
    timeout: 10000,
  });
  await assertNoHorizontalOverflow(page, "introduction example");
  await screenshot(page, "openwebdoc-pages-introduction.png");

  await page.goto(`${appUrl}?example=openwebdoc-slide-deck`, { waitUntil: "networkidle" });
  await page
    .locator('[data-htmlx-slide-id="slide-1"]')
    .filter({ hasText: "OpenWebDoc slide decks are documents first." })
    .waitFor({ state: "visible", timeout: 10000 });
  const slideCount = await page.locator('[data-htmlx-kind="slide"]').count();
  if (slideCount !== 7) {
    throw new Error(`Expected 7 slide-deck slides, found ${slideCount}.`);
  }
  await assertNoHorizontalOverflow(page, "slide deck read mode");
  await screenshot(page, "openwebdoc-pages-slide-deck-read.png");

  await page.getByRole("button", { name: "Expand menu" }).click();
  await page.getByRole("button", { name: "Enter presentation mode" }).click();
  await page
    .locator(".presentation-notice")
    .filter({ hasText: "Press Esc to exit presentation mode." })
    .waitFor({ state: "visible", timeout: 10000 });
  if ((await page.locator(".floating-controls").count()) !== 0) {
    throw new Error("Presentation mode should hide floating app controls.");
  }
  await page.keyboard.press("End");
  await page
    .locator('[data-htmlx-slide-id="slide-7"]')
    .filter({ hasText: "Documents can become software surfaces without becoming apps." })
    .waitFor({ state: "visible", timeout: 10000 });
  await screenshot(page, "openwebdoc-pages-slide-deck-present.png");
  await page.keyboard.press("Escape");
  await page.locator(".floating-controls").waitFor({ state: "visible", timeout: 10000 });

  await page.goto(`${appUrl}?example=template-status-review-deck`, { waitUntil: "networkidle" });
  await page
    .locator('[data-htmlx-slide-id="slide-1"]')
    .filter({ hasText: "OpenWebDoc alpha readiness" })
    .waitFor({ state: "visible", timeout: 10000 });
  await assertNoHorizontalOverflow(page, "status review deck read mode");
  await screenshot(page, "openwebdoc-pages-template-status-read.png");
  await page.getByRole("button", { name: "Expand menu" }).click();
  await page.getByRole("button", { name: "Enter presentation mode" }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page
    .locator('[data-htmlx-slide-id="slide-3"]')
    .filter({ hasText: "Track risks where the document and runtime meet." })
    .waitFor({ state: "visible", timeout: 10000 });
  await assertReadableActiveSlide(page, "status review deck presentation");
  await screenshot(page, "openwebdoc-pages-template-status-present.png");
  await page.keyboard.press("Escape");
  await page.locator(".floating-controls").waitFor({ state: "visible", timeout: 10000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}?example=openwebdoc-introduction`, { waitUntil: "networkidle" });
  await page
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "OpenWebDoc Introduction" })
    .waitFor({ state: "visible", timeout: 10000 });
  await assertNoHorizontalOverflow(page, "mobile introduction example");
  await screenshot(page, "openwebdoc-pages-mobile.png");

  console.log(`OpenWebDoc Pages smoke passed: ${appUrl}`);
} finally {
  await browser?.close();
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
  const maxScrollWidth = Math.max(overflow.scrollWidth, overflow.bodyScrollWidth);
  if (maxScrollWidth > overflow.clientWidth + 2) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
  }
}

async function assertReadableActiveSlide(page, label) {
  const metrics = await page.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot ?? document;
    const slide = root.querySelector('[data-openwebdoc-slide-active="true"]');
    if (!slide) throw new Error("No active slide.");
    const slideBox = slide.getBoundingClientRect();
    const cells = Array.from(slide.querySelectorAll("th, td"));
    const cellSizes = cells.map((cell) => Number.parseFloat(getComputedStyle(cell).fontSize));
    return {
      activeSlideId: slide.getAttribute("data-htmlx-slide-id"),
      ratio: slideBox.width / slideBox.height,
      minCellFontSize: cellSizes.length ? Math.min(...cellSizes) : 99,
      overflowX: Math.max(0, slide.scrollWidth - slide.clientWidth),
      overflowY: Math.max(0, slide.scrollHeight - slide.clientHeight),
    };
  });
  if (
    metrics.minCellFontSize < 13.5 ||
    metrics.overflowX > 2 ||
    metrics.overflowY > 2 ||
    Math.abs(metrics.ratio - 16 / 9) > 0.04
  ) {
    throw new Error(`${label} is not readable: ${JSON.stringify(metrics)}`);
  }
}

async function assertStarterRepositoryArchives(page) {
  const archiveResults = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('a[download][href$=".zip"]'));
    return Promise.all(
      links.map(async (link) => {
        const response = await fetch(link.href);
        const bytes = response.ok ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array();
        return {
          href: link.getAttribute("href"),
          ok: response.ok,
          status: response.status,
          byteLength: bytes.byteLength,
          signature: Array.from(bytes.slice(0, 4)),
        };
      }),
    );
  });
  for (const archive of archiveResults) {
    const hasZipSignature =
      archive.signature[0] === 0x50 &&
      archive.signature[1] === 0x4b &&
      archive.signature[2] === 0x03 &&
      archive.signature[3] === 0x04;
    if (!archive.ok || archive.byteLength < 500 || !hasZipSignature) {
      throw new Error(`Invalid starter repository archive: ${JSON.stringify(archive)}`);
    }
  }
}

async function screenshot(page, name) {
  if (!screenshotDirectory) return;
  await page.screenshot({
    path: join(screenshotDirectory, name),
    fullPage: false,
  });
}
