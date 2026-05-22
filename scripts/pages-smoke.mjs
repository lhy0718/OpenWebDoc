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
  await page.getByRole("heading", { name: "OpenWebDoc" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.getByRole("link", { name: "Open OpenWebDoc" }).waitFor({
    state: "visible",
    timeout: 10000,
  });

  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Open a document package" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
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

async function screenshot(page, name) {
  if (!screenshotDirectory) return;
  await page.screenshot({
    path: join(screenshotDirectory, name),
    fullPage: false,
  });
}
