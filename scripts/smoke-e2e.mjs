import { createHtmlx, encodeJson, encodeText, sha256Integrity } from "@openwebdoc/core";
import { createDefaultManifest } from "@openwebdoc/spec";
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = new URL("..", import.meta.url).pathname;
const pnpm = process.env.PNPM_BIN ?? "pnpm";
const env = {
  ...process.env,
};

const appUrl = "http://127.0.0.1:4173/";
const tmpRoot = await mkdtemp(join(tmpdir(), "openwebdoc-e2e-"));

const servers = [];
let browser;

try {
  await createAssetFixture(join(tmpRoot, "asset-doc.htmlx"));

  servers.push(
    startServer([
      "--filter",
      "@openwebdoc/app",
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
    ]),
  );
  await waitForHttp(appUrl);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const openShortcut = process.platform === "darwin" ? "Meta+O" : "Control+O";
  const undoShortcut = process.platform === "darwin" ? "Meta+Z" : "Control+Z";
  const redoShortcut = process.platform === "darwin" ? "Meta+Shift+Z" : "Control+Shift+Z";
  const boldShortcut = process.platform === "darwin" ? "Meta+B" : "Control+B";
  const italicShortcut = process.platform === "darwin" ? "Meta+I" : "Control+I";
  const underlineShortcut = process.platform === "darwin" ? "Meta+U" : "Control+U";

  await page.goto(appUrl);
  await page.getByRole("heading", { name: "Open a document package" }).waitFor({
    state: "visible",
    timeout: 5000,
  });
  if ((await page.locator(".document-page").count()) !== 0) {
    throw new Error("Empty state should not render document chrome before a file is selected.");
  }

  await openInApp(page, join(repoRoot, "examples/basic.htmlx"));
  await expectFrameText(page, "h1", "Basic HTMLX Document");

  await openInApp(page, join(repoRoot, "examples/openwebdoc-introduction.htmlx"));
  await page
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "OpenWebDoc Introduction" })
    .waitFor({ state: "visible", timeout: 5000 });
  await page.locator('iframe[title="HTMLX document"]').waitFor({ state: "detached" });
  await page.locator('[data-htmlx-kind="table"] table').first().waitFor({
    state: "attached",
    timeout: 5000,
  });
  await page.locator('[data-htmlx-kind="figure"] img[src^="blob:"]').first().waitFor({
    state: "attached",
    timeout: 5000,
  });
  await verifyProportionalSurface(page, [
    { width: 1440, height: 960 },
    { width: 1024, height: 820 },
    { width: 390, height: 844 },
  ]);
  await page.setViewportSize({ width: 1280, height: 720 });

  await openInApp(page, join(repoRoot, "examples/openwebdoc-slide-deck.htmlx"));
  await page
    .locator('[data-htmlx-slide-id="slide-1"]')
    .filter({ hasText: "OpenWebDoc slide decks are documents first." })
    .waitFor({ state: "visible", timeout: 5000 });
  const deckSlides = await page.locator('[data-htmlx-kind="slide"]').count();
  if (deckSlides !== 7) {
    throw new Error(`Expected 7 bundled slide-deck slides, found ${deckSlides}.`);
  }
  const readSlideBox = await page.locator('[data-htmlx-slide-id="slide-1"]').boundingBox();
  if (!readSlideBox || Math.abs(readSlideBox.width / readSlideBox.height - 16 / 9) > 0.04) {
    throw new Error(
      `Slide deck read mode did not preserve 16:9 ratio: ${JSON.stringify(readSlideBox)}`,
    );
  }
  await page.getByRole("button", { name: "Expand menu" }).click();
  await page.getByRole("button", { name: "Enter presentation mode" }).click();
  await page
    .locator(".presentation-notice")
    .filter({ hasText: "Press Esc to exit presentation mode." })
    .waitFor({ state: "visible", timeout: 5000 });
  if ((await page.locator(".floating-controls").count()) !== 0) {
    throw new Error("Slide-deck presentation mode should hide app chrome.");
  }
  let visibleSlides = await visibleSlideIds(page);
  if (visibleSlides.join(",") !== "slide-1") {
    throw new Error(`Presentation mode should show only slide-1, saw ${visibleSlides.join(",")}`);
  }
  await page.keyboard.press("ArrowRight");
  visibleSlides = await visibleSlideIds(page);
  if (visibleSlides.join(",") !== "slide-2") {
    throw new Error(`ArrowRight should advance to slide-2, saw ${visibleSlides.join(",")}`);
  }
  await page.keyboard.press("End");
  visibleSlides = await visibleSlideIds(page);
  if (visibleSlides.join(",") !== "slide-7") {
    throw new Error(`End should jump to slide-7, saw ${visibleSlides.join(",")}`);
  }
  await page.keyboard.press("Home");
  visibleSlides = await visibleSlideIds(page);
  if (visibleSlides.join(",") !== "slide-1") {
    throw new Error(`Home should jump to slide-1, saw ${visibleSlides.join(",")}`);
  }
  await page.keyboard.press("Escape");
  await page.locator(".floating-controls").waitFor({ state: "visible", timeout: 5000 });

  await page.goto(`${appUrl}?example=template-status-review-deck`);
  await page
    .locator('[data-htmlx-slide-id="slide-1"]')
    .filter({ hasText: "OpenWebDoc alpha readiness" })
    .waitFor({ state: "visible", timeout: 5000 });
  const statusSlideCount = await page.locator('[data-htmlx-kind="slide"]').count();
  if (statusSlideCount !== 4) {
    throw new Error(`Expected 4 status-review slides, found ${statusSlideCount}.`);
  }
  await assertNoHorizontalOverflow(page, "status-review read mode");
  await page.getByRole("button", { name: "Expand menu" }).click();
  await page.getByRole("button", { name: "Enter presentation mode" }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page
    .locator('[data-htmlx-slide-id="slide-3"]')
    .filter({ hasText: "Track risks where the document and runtime meet." })
    .waitFor({ state: "visible", timeout: 5000 });
  const statusDeckReadability = await page.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot ?? document;
    const slide = root.querySelector('[data-openwebdoc-slide-active="true"]');
    if (!slide) throw new Error("No active status-review slide.");
    const cells = Array.from(slide.querySelectorAll("th, td"));
    const cellSizes = cells.map((cell) => Number.parseFloat(getComputedStyle(cell).fontSize));
    const slideBox = slide.getBoundingClientRect();
    return {
      activeSlideId: slide.getAttribute("data-htmlx-slide-id"),
      minCellFontSize: Math.min(...cellSizes),
      maxOverflowX: Math.max(0, slide.scrollWidth - slide.clientWidth),
      maxOverflowY: Math.max(0, slide.scrollHeight - slide.clientHeight),
      ratio: slideBox.width / slideBox.height,
    };
  });
  if (
    statusDeckReadability.activeSlideId !== "slide-3" ||
    statusDeckReadability.minCellFontSize < 13.5 ||
    statusDeckReadability.maxOverflowX > 2 ||
    statusDeckReadability.maxOverflowY > 2 ||
    Math.abs(statusDeckReadability.ratio - 16 / 9) > 0.04
  ) {
    throw new Error(
      `Status review deck presentation is not readable: ${JSON.stringify(statusDeckReadability)}`,
    );
  }
  await page.keyboard.press("Escape");
  await page.locator(".floating-controls").waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: "Expand menu" }).click();
  await page.getByRole("button", { name: "Switch to editing mode" }).click();
  await page
    .locator('[data-htmlx-block-id="status-risks"][contenteditable="true"]')
    .waitFor({ state: "attached", timeout: 5000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "status-review mobile edit mode");
  await page.setViewportSize({ width: 1280, height: 720 });

  await openInApp(page, join(tmpRoot, "asset-doc.htmlx"));
  await expectFrameText(page, "h1", "Asset Resolver Smoke");
  await page
    .frameLocator('iframe[title="HTMLX document"]')
    .locator('img[src^="blob:"]')
    .first()
    .waitFor({ state: "attached", timeout: 5000 });

  const appPage = await browser.newPage();
  await appPage.goto(appUrl);
  await appPage.locator("body").click({ position: { x: 12, y: 12 } });
  const fileChooserPromise = appPage.waitForEvent("filechooser");
  await appPage.keyboard.press(openShortcut);
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(join(repoRoot, "examples/openwebdoc-introduction.htmlx"));
  await appPage
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "OpenWebDoc Introduction" })
    .waitFor({ state: "visible", timeout: 5000 });
  const readModeEditable = await appPage
    .locator('[data-htmlx-block-id="doc-title"]')
    .getAttribute("contenteditable");
  if (readModeEditable !== "false") {
    throw new Error(`Document did not open in reading mode: ${readModeEditable}`);
  }
  await appPage.locator('[data-htmlx-block-id="doc-title"]').click();
  if ((await appPage.locator('[data-htmlx-runtime-selected="true"]').count()) !== 0) {
    throw new Error("Read mode should not select document objects on click.");
  }
  const moveButton = appPage.getByRole("button", { name: "Move menu" });
  const menuButton = appPage.getByRole("button", { name: "Expand menu" });
  const menuBeforeDrag = await moveButton.boundingBox();
  if (!menuBeforeDrag) {
    throw new Error("Collapsed runtime menu handle was not visible for drag smoke.");
  }
  await appPage.mouse.move(
    menuBeforeDrag.x + menuBeforeDrag.width / 2,
    menuBeforeDrag.y + menuBeforeDrag.height / 2,
  );
  await appPage.mouse.down();
  await appPage.mouse.move(
    menuBeforeDrag.x + menuBeforeDrag.width / 2 - 84,
    menuBeforeDrag.y + menuBeforeDrag.height / 2 + 42,
    { steps: 8 },
  );
  await appPage.mouse.up();
  const menuAfterDrag = await moveButton.boundingBox();
  if (
    !menuAfterDrag ||
    menuAfterDrag.x > menuBeforeDrag.x - 50 ||
    menuAfterDrag.y < menuBeforeDrag.y + 25
  ) {
    throw new Error("Collapsed menu handle did not stay under pointer after drag.");
  }
  await menuButton.click();
  const headBox = await appPage.locator(".toolbar-head").boundingBox();
  const actionsBox = await appPage.locator(".toolbar-actions").boundingBox();
  if (!headBox || !actionsBox || actionsBox.y <= headBox.y + headBox.height) {
    throw new Error("Expanded toolbar actions did not open below the fixed header row.");
  }
  const headerButtonCount = await appPage.locator(".toolbar-head button").count();
  if (headerButtonCount !== 2) {
    throw new Error(
      `Toolbar header should only expose move and menu buttons: ${headerButtonCount}`,
    );
  }
  if (
    (await appPage.locator('.toolbar-head [aria-label="Switch to editing mode"]').count()) !== 0
  ) {
    throw new Error("Edit/read arrow button must live inside the expanded submenu.");
  }
  if ((await appPage.locator(".toolbar-mode-row").count()) !== 1) {
    throw new Error("Expanded runtime menu must expose one dedicated mode switch row.");
  }
  const readModeButton = appPage.getByRole("button", { name: "Switch to reading mode" });
  const editModeButton = appPage.getByRole("button", { name: "Switch to editing mode" });
  if ((await readModeButton.getAttribute("aria-pressed")) !== "true") {
    throw new Error("Read mode segment should be active when the document opens.");
  }
  const selectionTool = appPage.getByRole("button", { name: "Object selection tool" });
  if (await selectionTool.isEnabled()) {
    throw new Error("Object selection arrow must only be enabled in edit mode.");
  }
  const controlsClass = await appPage.locator(".floating-controls").getAttribute("class");
  if (!controlsClass?.includes("open-left")) {
    throw new Error(
      `Expanded toolbar did not adapt direction near the right edge: ${controlsClass}`,
    );
  }
  await appPage.getByRole("button", { name: "Show document info" }).click();
  await appPage
    .locator(".document-drawer .shortcut-list")
    .filter({ hasText: "Command/Ctrl+Z, Command/Ctrl+Shift+Z" })
    .waitFor({ state: "visible", timeout: 5000 });
  await appPage.getByRole("button", { name: "Close document info" }).click();
  if ((await appPage.getByRole("button", { name: "Enter presentation mode" }).count()) !== 0) {
    throw new Error("Continuous documents should not expose presentation mode controls.");
  }
  const readSelectionTarget = appPage.locator('[data-htmlx-block-id="doc-subtitle"]');
  const readSelectionBox = await readSelectionTarget.boundingBox();
  if (!readSelectionBox) throw new Error("Read-mode text target was not measurable.");
  await appPage.mouse.move(readSelectionBox.x + 18, readSelectionBox.y + 12);
  await appPage.mouse.down();
  await appPage.mouse.move(readSelectionBox.x + 260, readSelectionBox.y + 12, { steps: 8 });
  await appPage.mouse.up();
  await appPage.waitForTimeout(100);
  const readSelectionBeforeEditState = await appPage.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return {
      shadowText: root?.getSelection?.()?.toString(),
      windowText: window.getSelection()?.toString(),
    };
  });
  await editModeButton.click();
  await appPage.waitForTimeout(250);
  const readSelectionState = await appPage.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    const subtitle = root?.querySelector('[data-htmlx-block-id="doc-subtitle"]');
    return {
      contentEditable: subtitle?.getAttribute("contenteditable"),
      runtimeSelected: subtitle?.getAttribute("data-htmlx-runtime-selected"),
      shadowText: root?.getSelection?.()?.toString(),
      windowText: window.getSelection()?.toString(),
      hasTextSize: Boolean(document.querySelector('[aria-label="Text font size"]')),
      hasTextColor: Boolean(document.querySelector('[aria-label="Text color"]')),
    };
  });
  if (
    readSelectionState.contentEditable !== "true" ||
    readSelectionState.runtimeSelected !== "true" ||
    !readSelectionState.hasTextSize ||
    !readSelectionState.hasTextColor
  ) {
    throw new Error(
      `Read-mode text selection was not recovered after entering edit mode: ${JSON.stringify({
        before: readSelectionBeforeEditState,
        after: readSelectionState,
      })}`,
    );
  }
  await appPage
    .locator('[aria-label="Text font size"] input')
    .waitFor({ state: "visible", timeout: 5000 });
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "2.35");
  const readSelectionHtml = await readSelectionTarget.evaluate((element) => element.innerHTML);
  if (
    !/<(?:span|htmlx-inline)[^>]+style="(?=[^"]*display:\s*inline)(?=[^"]*font-size:)[^"]*"[^>]*>/i.test(
      readSelectionHtml,
    )
  ) {
    throw new Error(
      `Text selection made before edit mode was not preserved for range typography: ${readSelectionHtml}`,
    );
  }
  if (!(await selectionTool.isEnabled())) {
    throw new Error("Object selection arrow was not enabled after entering edit mode.");
  }
  if ((await editModeButton.getAttribute("aria-pressed")) !== "true") {
    throw new Error("Edit mode segment should become active after switching modes.");
  }
  await appPage.locator('[data-htmlx-block-id="doc-title"]').click();
  await appPage
    .locator('[data-htmlx-block-id="doc-title"][data-htmlx-runtime-selected="true"]')
    .waitFor({ state: "attached", timeout: 5000 });
  await selectionTool.click();
  if ((await appPage.locator('[data-htmlx-runtime-selected="true"]').count()) !== 0) {
    throw new Error("Object selection arrow did not clear the current selection.");
  }
  const editModeEditable = await appPage
    .locator('[data-htmlx-block-id="doc-title"]')
    .getAttribute("contenteditable");
  if (editModeEditable !== "true") {
    throw new Error(`Editing mode did not activate on the document surface: ${editModeEditable}`);
  }
  if ((await appPage.getByRole("button", { name: /rectangle/i }).count()) !== 0) {
    throw new Error("OpenWebDoc app must not expose new rectangle creation.");
  }
  if ((await appPage.getByRole("button", { name: /add table/i }).count()) !== 0) {
    throw new Error("OpenWebDoc app must not expose new table creation.");
  }
  const editSurfaceAudit = await appPage.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    if (!root) throw new Error("Editable document shadow root was not available.");
    const tableCell = root.querySelector(
      '[data-htmlx-block-id="need-matrix"] tbody tr:nth-child(1) td:nth-child(1)',
    );
    const tableCaption = root.querySelector('[data-htmlx-block-id="need-matrix"] figcaption');
    const figureText = root.querySelector(
      '[data-htmlx-block-id="implementation-map"] .figure-card strong[data-htmlx-object-text="true"]',
    );
    const topChip = root.querySelector(".top-rail span:nth-child(2)");
    const heroAction = root.querySelector(".hero-actions span:nth-child(1)");
    return {
      tableCellEditable: tableCell?.getAttribute("contenteditable") ?? "",
      tableCaptionEditable: tableCaption?.getAttribute("contenteditable") ?? "",
      figureTextEditable: figureText?.getAttribute("contenteditable") ?? "",
      topChipEditable: topChip?.getAttribute("contenteditable") ?? "",
      heroActionEditable: heroAction?.getAttribute("contenteditable") ?? "",
      tableTag: root.querySelector('[data-htmlx-block-id="need-matrix"] table')?.tagName ?? "",
    };
  });
  if (
    editSurfaceAudit.tableCellEditable !== "true" ||
    editSurfaceAudit.tableCaptionEditable !== "true" ||
    editSurfaceAudit.figureTextEditable !== "true" ||
    editSurfaceAudit.topChipEditable !== "true" ||
    editSurfaceAudit.heroActionEditable !== "true"
  ) {
    throw new Error(
      `Object-internal text did not become editable in edit mode: ${JSON.stringify(
        editSurfaceAudit,
      )}`,
    );
  }
  if (editSurfaceAudit.tableTag !== "TABLE") {
    throw new Error(`Table editing target was not a semantic table: ${editSurfaceAudit.tableTag}`);
  }
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    const figure = root?.querySelector('[data-htmlx-block-id="implementation-map"]');
    const card = root?.querySelector('[data-htmlx-block-id="implementation-map"] .figure-card');
    if (!figure || !card) return false;
    const figureBox = figure.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return figureBox.width > 0 && figureBox.height > 0 && cardBox.width > 0 && cardBox.height > 0;
  });
  const firstFigure = appPage.locator('[data-htmlx-block-id="implementation-map"]');
  const firstFigureCard = firstFigure.locator(".figure-card").first();
  await firstFigureCard.scrollIntoViewIfNeeded();
  const figureBox = await firstFigure.boundingBox();
  if (!figureBox || !(await firstFigureCard.boundingBox())) {
    throw new Error("Grouped figure and inner card were not visible for drag smoke.");
  }
  await appPage.mouse.click(figureBox.x + figureBox.width / 2, figureBox.y + figureBox.height / 2);
  await appPage.waitForTimeout(100);
  const cardBox = await firstFigureCard.boundingBox();
  if (!cardBox) {
    throw new Error("Grouped figure card disappeared after selecting the figure.");
  }
  const cardMoveHandle = firstFigureCard.locator('[data-htmlx-card-move-handle="true"]');
  await cardMoveHandle.waitFor({ state: "attached", timeout: 5000 });
  const cardMoveHandleBox = await cardMoveHandle.boundingBox();
  if (!cardMoveHandleBox) {
    throw new Error("Grouped figure card move handle was not visible.");
  }
  const cardStyleBeforeBodyDrag = await firstFigureCard.getAttribute("style");
  await appPage.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await appPage.mouse.down();
  await appPage.mouse.move(
    cardBox.x + cardBox.width / 2 + 60,
    cardBox.y + cardBox.height / 2 + 40,
    {
      steps: 8,
    },
  );
  await appPage.mouse.up();
  await appPage.waitForTimeout(100);
  const cardStyleAfterBodyDrag = await firstFigureCard.getAttribute("style");
  if (cardStyleAfterBodyDrag !== cardStyleBeforeBodyDrag) {
    throw new Error(
      "Figure card body drag should not move the card; movement must use the card handle.",
    );
  }
  const cardStyleBefore = await firstFigureCard.getAttribute("style");
  await appPage.mouse.move(
    cardMoveHandleBox.x + cardMoveHandleBox.width / 2,
    cardMoveHandleBox.y + cardMoveHandleBox.height / 2,
  );
  await appPage.mouse.down();
  await appPage.mouse.move(
    cardMoveHandleBox.x + cardMoveHandleBox.width / 2 + 60,
    cardMoveHandleBox.y + cardMoveHandleBox.height / 2 + 40,
    {
      steps: 8,
    },
  );
  await appPage.mouse.up();
  await appPage.waitForTimeout(100);
  const cardStyleAfter = await firstFigureCard.getAttribute("style");
  if (cardStyleAfter === cardStyleBefore) {
    throw new Error("Figure inner card did not move after selecting the grouped figure.");
  }
  await replaceEditableText(
    appPage.locator('[data-htmlx-block-id="doc-title"]'),
    "Playwright Export Smoke",
  );
  const subtitle = appPage.locator('[data-htmlx-block-id="doc-subtitle"]');
  await replaceEditableText(
    subtitle,
    "The runtime export smoke keeps inline formatting, typography, and micro edits valid.",
  );
  await subtitle.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await appPage.keyboard.press(boldShortcut);
  await appPage.keyboard.press(italicShortcut);
  await appPage.keyboard.press(underlineShortcut);
  const formattedSubtitle = await subtitle.evaluate((element) => element.innerHTML);
  if (
    !/<(?:strong|b)\b/i.test(formattedSubtitle) ||
    !/<(?:em|i)\b/i.test(formattedSubtitle) ||
    !/<u\b/i.test(formattedSubtitle)
  ) {
    throw new Error(`Inline formatting shortcuts did not update subtitle: ${formattedSubtitle}`);
  }
  const paragraphCountBeforeEnter = await appPage.locator('[data-htmlx-kind="paragraph"]').count();
  await appPage.keyboard.press("Enter");
  await appPage.waitForTimeout(100);
  const paragraphCountAfterEnter = await appPage.locator('[data-htmlx-kind="paragraph"]').count();
  if (paragraphCountAfterEnter <= paragraphCountBeforeEnter) {
    throw new Error("Enter did not insert a new paragraph block.");
  }
  const placeholderParagraphs = await appPage
    .locator('[data-htmlx-kind="paragraph"]')
    .evaluateAll(
      (elements) =>
        elements.filter((element) => element.textContent?.trim() === "New paragraph").length,
    );
  if (placeholderParagraphs > 0) {
    throw new Error("Enter inserted a visible placeholder paragraph instead of a blank paragraph.");
  }
  await appPage.keyboard.press("Backspace");
  await appPage.waitForTimeout(100);
  const paragraphCountAfterEmptyDelete = await appPage
    .locator('[data-htmlx-kind="paragraph"]')
    .count();
  if (paragraphCountAfterEmptyDelete !== paragraphCountBeforeEnter) {
    throw new Error("Backspace did not delete the focused empty paragraph block.");
  }
  await subtitle.click();
  if ((await appPage.getByRole("button", { name: "Increase block font size" }).count()) !== 0) {
    throw new Error("Text block toolbar should use numeric sizing, not increase/decrease buttons.");
  }
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "20");
  await appPage.locator('label[aria-label="Text color"] input').evaluate((input) => {
    input.value = "#1f4f82";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await subtitle.click();
  await appPage.getByRole("button", { name: "Duplicate selected text block" }).click();
  const paragraphCountAfterDuplicate = await appPage
    .locator('[data-htmlx-kind="paragraph"]')
    .count();
  if (paragraphCountAfterDuplicate <= paragraphCountAfterEmptyDelete) {
    throw new Error("Duplicate selected text block did not create a paragraph copy.");
  }
  await appPage.getByRole("button", { name: "Delete selected block" }).click();
  if (
    (await appPage.locator('[data-htmlx-kind="paragraph"]').count()) !==
    paragraphCountAfterEmptyDelete
  ) {
    throw new Error("Toolbar delete did not remove the duplicated text block.");
  }
  const removableHeading = appPage.locator('[data-htmlx-block-id="use-cases-heading"]');
  await removableHeading.click();
  await appPage.getByRole("button", { name: "Delete selected block" }).click();
  if ((await appPage.locator('[data-htmlx-block-id="use-cases-heading"]').count()) !== 0) {
    throw new Error("Heading blocks must be deletable from the toolbar.");
  }

  const figureCountBeforeDelete = await appPage.locator('[data-htmlx-kind="figure"]').count();
  const temporaryFigure = appPage.locator('[data-htmlx-block-id="hero-system-card"]');
  await temporaryFigure.click({ position: { x: 8, y: 8 } });
  await appPage
    .locator('[data-htmlx-block-id="hero-system-card"][data-htmlx-runtime-selected="true"]')
    .waitFor({ state: "attached", timeout: 5000 });
  await temporaryFigure.locator('[data-htmlx-object-move-handle="true"]').click();
  await appPage.keyboard.press("Delete");
  const figureCountAfterDelete = await appPage.locator('[data-htmlx-kind="figure"]').count();
  if (figureCountAfterDelete !== figureCountBeforeDelete - 1) {
    throw new Error("Delete/Backspace shortcut did not remove the selected object.");
  }
  await openInApp(appPage, join(repoRoot, "examples/openwebdoc-introduction.htmlx"));
  await appPage
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "OpenWebDoc Introduction" })
    .waitFor({ state: "visible", timeout: 5000 });
  if ((await appPage.getByRole("button", { name: "Expand menu" }).count()) === 1) {
    await appPage.getByRole("button", { name: "Expand menu" }).click();
  }
  await appPage.getByRole("button", { name: "Switch to editing mode" }).click();
  await appPage
    .locator('[data-htmlx-block-id="doc-title"][contenteditable="true"]')
    .waitFor({ state: "attached", timeout: 5000 });
  await replaceEditableText(
    appPage.locator('[data-htmlx-block-id="doc-title"]'),
    "Playwright Export Smoke",
  );
  const exportSubtitle = appPage.locator('[data-htmlx-block-id="doc-subtitle"]');
  await replaceEditableText(
    exportSubtitle,
    "The runtime export smoke keeps inline formatting, typography, and micro edits valid.",
  );
  await exportSubtitle.click();
  const subtitleBlockSizeBefore = Number(await exportSubtitle.getAttribute("data-htmlx-font-size"));
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "21");
  const subtitleBlockSizeAfter = Number(await exportSubtitle.getAttribute("data-htmlx-font-size"));
  const subtitleBlockHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (!(subtitleBlockSizeAfter > subtitleBlockSizeBefore)) {
    throw new Error(
      `Text font size did not increase: ${subtitleBlockSizeBefore} -> ${subtitleBlockSizeAfter}`,
    );
  }
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "24");
  const subtitleBlockSizeAfterSecondClick = Number(
    await exportSubtitle.getAttribute("data-htmlx-font-size"),
  );
  if (!(subtitleBlockSizeAfterSecondClick > subtitleBlockSizeAfter)) {
    throw new Error(
      `Text font size only changed once: ${subtitleBlockSizeAfter} -> ${subtitleBlockSizeAfterSecondClick}`,
    );
  }
  if (/<(?:span|htmlx-inline)[^>]+style="[^"]*font-size:[^"]*"[^>]*>/i.test(subtitleBlockHtml)) {
    throw new Error(`Whole text block font sizing should not wrap text: ${subtitleBlockHtml}`);
  }
  await selectEditableTextRange(exportSubtitle, 4, 7);
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "2.40");
  await appPage.locator('label[aria-label="Text color"] input').evaluate((input) => {
    input.value = "#0f766e";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const subtitlePartialSizeHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (
    !/<(?:span|htmlx-inline)[^>]+style="(?=[^"]*display:\s*inline)(?=[^"]*font-size:)(?=[^"]*color:\s*(?:#0f766e|rgb\(15,\s*118,\s*110\)))[^"]*"[^>]*>runtime<\/(?:span|htmlx-inline)>/i.test(
      subtitlePartialSizeHtml,
    )
  ) {
    throw new Error(
      `Selected text block range did not receive inline font size and color: ${subtitlePartialSizeHtml}`,
    );
  }
  const subtitlePartialColorState = await exportSubtitle.evaluate((element) => {
    const inline = element.querySelector("htmlx-inline[style*='color'], span[style*='color']");
    return {
      blockColor: element.getAttribute("data-htmlx-color"),
      inlineColor: inline instanceof HTMLElement ? getComputedStyle(inline).color : "",
      inlineDisplay: inline instanceof HTMLElement ? getComputedStyle(inline).display : "",
    };
  });
  if (
    subtitlePartialColorState.blockColor === "#0f766e" ||
    subtitlePartialColorState.inlineColor !== "rgb(15, 118, 110)" ||
    subtitlePartialColorState.inlineDisplay !== "inline"
  ) {
    throw new Error(
      `Text color should affect only the inline range: ${JSON.stringify(
        subtitlePartialColorState,
      )}`,
    );
  }
  await selectEditableTextRange(exportSubtitle, 8, 8);
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "3.10");
  await appPage.locator('label[aria-label="Text color"] input').evaluate((input) => {
    input.value = "#7e22ce";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const mixedTypographySamples = await getTextRangeStyleSamples(exportSubtitle, 8, 16);
  const mixedTypographySizes = mixedTypographySamples.map((sample) => sample.fontSize);
  if (
    mixedTypographySamples.length < 2 ||
    mixedTypographySamples.some(
      (sample) => sample.color !== "rgb(126, 34, 206)" || !(sample.fontSize > 0),
    ) ||
    Math.max(...mixedTypographySizes) - Math.min(...mixedTypographySizes) > 0.75
  ) {
    throw new Error(
      `Mixed inline typography did not update both existing and adjacent text: ${JSON.stringify(
        mixedTypographySamples,
      )}`,
    );
  }
  await selectEditableTextRange(exportSubtitle, 6, 14);
  const inlineCountBeforeColorStress = await getInlineWrapperCount(exportSubtitle);
  const colorInput = appPage.locator('label[aria-label="Text color"] input');
  for (const color of ["#be185d", "#6d28d9", "#0369a1", "#047857", "#b45309"]) {
    await colorInput.evaluate((input, nextColor) => {
      input.value = nextColor;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, color);
  }
  const inlineCountAfterColorStress = await getInlineWrapperCount(exportSubtitle);
  const colorStressSamples = await getTextRangeStyleSamples(exportSubtitle, 6, 20);
  if (
    inlineCountAfterColorStress > inlineCountBeforeColorStress + 2 ||
    colorStressSamples.some((sample) => sample.color !== "rgb(180, 83, 9)")
  ) {
    throw new Error(
      `Repeated color changes across inline boundaries created stale styles or wrapper growth: ${JSON.stringify(
        {
          before: inlineCountBeforeColorStress,
          after: inlineCountAfterColorStress,
          samples: colorStressSamples,
        },
      )}`,
    );
  }
  const partialInlineSizeBeforeBlockScale = await exportSubtitle.evaluate((element) => {
    const match = element
      .querySelector("span[style*='font-size'], htmlx-inline[style*='font-size']")
      ?.getAttribute("style")
      ?.match(/font-size:\s*(\d+(?:\.\d+)?)cqw/i);
    return match ? Number(match[1]) : 0;
  });
  await exportSubtitle.click();
  await clearEditableSelection(exportSubtitle);
  const subtitleBlockSizeBeforeInlineScale = Number(
    await exportSubtitle.getAttribute("data-htmlx-font-size"),
  );
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "32");
  const subtitleBlockSizeAfterInlineScale = Number(
    await exportSubtitle.getAttribute("data-htmlx-font-size"),
  );
  const partialInlineSizeAfterBlockScale = await exportSubtitle.evaluate((element) => {
    const match = element
      .querySelector("span[style*='font-size'], htmlx-inline[style*='font-size']")
      ?.getAttribute("style")
      ?.match(/font-size:\s*(\d+(?:\.\d+)?)cqw/i);
    return match ? Number(match[1]) : 0;
  });
  if (
    !(subtitleBlockSizeAfterInlineScale > subtitleBlockSizeBeforeInlineScale) ||
    !(partialInlineSizeAfterBlockScale > partialInlineSizeBeforeBlockScale)
  ) {
    throw new Error(
      `Block font sizing did not scale existing inline text: ${JSON.stringify({
        blockBefore: subtitleBlockSizeBeforeInlineScale,
        blockAfter: subtitleBlockSizeAfterInlineScale,
        inlineBefore: partialInlineSizeBeforeBlockScale,
        inlineAfter: partialInlineSizeAfterBlockScale,
      })}`,
    );
  }
  await selectEditableTextRange(exportSubtitle, 4, 7);
  await appPage.getByRole("button", { name: "Bold" }).click();
  const selectedAfterBold = await getShadowSelectionText(appPage);
  if (selectedAfterBold !== "runtime") {
    throw new Error(`Bold formatting cleared the selected text: ${selectedAfterBold}`);
  }
  const subtitleBoldHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  const subtitleBoldText = await exportSubtitle.evaluate(
    (element) => element.querySelector("strong")?.textContent ?? "",
  );
  if (subtitleBoldText !== "runtime") {
    throw new Error(`Selected text did not become bold: ${subtitleBoldHtml}`);
  }
  await appPage.getByRole("button", { name: "Bold" }).click();
  const selectedAfterUnbold = await getShadowSelectionText(appPage);
  if (selectedAfterUnbold !== "runtime") {
    throw new Error(`Bold toggle cleared the selected text: ${selectedAfterUnbold}`);
  }
  const subtitleUnboldHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (/<strong>[\s\S]*runtime[\s\S]*<\/strong>/i.test(subtitleUnboldHtml)) {
    throw new Error(`Bold toggle did not remove bold formatting: ${subtitleUnboldHtml}`);
  }
  await appPage.getByRole("button", { name: "Italic" }).click();
  const selectedAfterItalic = await getShadowSelectionText(appPage);
  const subtitleItalicText = await exportSubtitle.evaluate(
    (element) => element.querySelector("em")?.textContent ?? "",
  );
  if (selectedAfterItalic !== "runtime" || subtitleItalicText !== "runtime") {
    throw new Error(`Italic formatting did not preserve/apply selection: ${subtitleItalicText}`);
  }
  await appPage.getByRole("button", { name: "Italic" }).click();
  const selectedAfterUnitalic = await getShadowSelectionText(appPage);
  const subtitleUnitalicHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (
    selectedAfterUnitalic !== "runtime" ||
    /<em\b[\s\S]*runtime[\s\S]*<\/em>/i.test(subtitleUnitalicHtml)
  ) {
    throw new Error(`Italic toggle did not remove italic formatting: ${subtitleUnitalicHtml}`);
  }
  await appPage.getByRole("button", { name: "Underline" }).click();
  const selectedAfterUnderline = await getShadowSelectionText(appPage);
  const subtitleUnderlineText = await exportSubtitle.evaluate(
    (element) => element.querySelector("u")?.textContent ?? "",
  );
  if (selectedAfterUnderline !== "runtime" || subtitleUnderlineText !== "runtime") {
    throw new Error(
      `Underline formatting did not preserve/apply selection: ${subtitleUnderlineText}`,
    );
  }
  await appPage.getByRole("button", { name: "Underline" }).click();
  const selectedAfterUnunderline = await getShadowSelectionText(appPage);
  const subtitleUnunderlineHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (
    selectedAfterUnunderline !== "runtime" ||
    /<u\b[\s\S]*runtime[\s\S]*<\/u>/i.test(subtitleUnunderlineHtml)
  ) {
    throw new Error(
      `Underline toggle did not remove underline formatting: ${subtitleUnunderlineHtml}`,
    );
  }
  await exportSubtitle.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await appPage.getByRole("button", { name: "Bold" }).click();
  const subtitleWholeBoldHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (!/^<strong>[\s\S]*<\/strong>$/i.test(subtitleWholeBoldHtml.trim())) {
    throw new Error(`Whole-block bold did not wrap the block cleanly: ${subtitleWholeBoldHtml}`);
  }
  await appPage.getByRole("button", { name: "Bold" }).click();
  const subtitleWholeUnboldHtml = await exportSubtitle.evaluate((element) => element.innerHTML);
  if (/<(?:strong|b)\b/i.test(subtitleWholeUnboldHtml)) {
    throw new Error(`Whole-block bold toggle did not remove bold: ${subtitleWholeUnboldHtml}`);
  }
  await exportSubtitle.click();
  await exportSubtitle.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await appPage.keyboard.press(boldShortcut);
  await appPage.keyboard.press(italicShortcut);
  await appPage.keyboard.press(underlineShortcut);
  await exportSubtitle.click();
  await clearEditableSelection(exportSubtitle);
  await setNumericInput(appPage.locator('[aria-label="Text font size"] input'), "34");
  await appPage.locator('label[aria-label="Text color"] input').evaluate((input) => {
    input.value = "#1f4f82";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const subtitleColorState = await exportSubtitle.evaluate((element) => ({
    dataColor: element.getAttribute("data-htmlx-color"),
    computedColor: getComputedStyle(element).color,
    strongColor: element.querySelector("strong")
      ? getComputedStyle(element.querySelector("strong")).color
      : "",
    emColor: element.querySelector("em") ? getComputedStyle(element.querySelector("em")).color : "",
  }));
  if (
    subtitleColorState.dataColor !== "#1f4f82" ||
    subtitleColorState.computedColor !== "rgb(31, 79, 130)"
  ) {
    throw new Error(`Text color did not update: ${JSON.stringify(subtitleColorState)}`);
  }
  const exportTitle = appPage.locator('[data-htmlx-block-id="doc-title"]');
  await exportTitle.click();
  await appPage.locator('label[aria-label="Text color"] input').evaluate((input) => {
    input.value = "#7c2d12";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const twoBlockColorState = await appPage.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    const title = root?.querySelector('[data-htmlx-block-id="doc-title"]');
    const subtitle = root?.querySelector('[data-htmlx-block-id="doc-subtitle"]');
    return {
      titleColor: title?.getAttribute("data-htmlx-color"),
      titleComputed: title ? getComputedStyle(title).color : "",
      subtitleColor: subtitle?.getAttribute("data-htmlx-color"),
      subtitleComputed: subtitle ? getComputedStyle(subtitle).color : "",
    };
  });
  if (
    twoBlockColorState.titleColor !== "#7c2d12" ||
    twoBlockColorState.titleComputed !== "rgb(124, 45, 18)" ||
    twoBlockColorState.subtitleColor !== "#1f4f82"
  ) {
    throw new Error(`Text color changed the wrong block: ${JSON.stringify(twoBlockColorState)}`);
  }
  const exportTableCell = appPage.locator(
    '[data-htmlx-block-id="need-matrix"] tbody tr:nth-child(1) td:nth-child(1)',
  );
  const exportTableCaption = appPage.locator('[data-htmlx-block-id="need-matrix"] figcaption');
  await replaceEditableText(exportTableCaption, "Table 1. Directly editable comparison matrix");
  await replaceEditableText(exportTableCell, "Readable surface");
  if ((await appPage.locator(".toolbar-format-row").count()) !== 1) {
    throw new Error("Object-internal text focus should expose inline formatting controls.");
  }
  const objectFontSizeInput = appPage.locator('[aria-label="Object text font size"] input');
  await objectFontSizeInput.waitFor({ state: "visible", timeout: 5000 });
  const objectFontSizeValue = await objectFontSizeInput.inputValue();
  if (!/^\d+(?:\.\d+)?$/.test(objectFontSizeValue.trim())) {
    throw new Error(`Object text toolbar did not show a numeric font size: ${objectFontSizeValue}`);
  }
  const objectTextSizeBefore = await exportTableCell.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  await setNumericInput(objectFontSizeInput, "1.75");
  const objectTextBlockSizeAfter = await exportTableCell.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  if (!(objectTextBlockSizeAfter > objectTextSizeBefore)) {
    throw new Error(
      `Object-internal block font size did not increase: ${objectTextSizeBefore} -> ${objectTextBlockSizeAfter}`,
    );
  }
  await setNumericInput(objectFontSizeInput, "2.10");
  const objectTextBlockSizeAfterSecondClick = await exportTableCell.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  if (!(objectTextBlockSizeAfterSecondClick > objectTextBlockSizeAfter)) {
    throw new Error(
      `Object-internal block font size only changed once: ${objectTextBlockSizeAfter} -> ${objectTextBlockSizeAfterSecondClick}`,
    );
  }
  await exportTableCell.evaluate((element) => {
    const root = element.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const text = element.firstChild;
    if (!text?.textContent) return;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(8, text.textContent.length));
    const selection = root.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });
  await appPage.getByRole("button", { name: "Bold" }).click();
  await setNumericInput(appPage.locator('[aria-label="Object text font size"] input'), "2.80");
  await appPage.locator('label[aria-label="Object text color"] input').evaluate((input) => {
    input.value = "#be123c";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const objectTextSizeAfter = await exportTableCell.evaluate((element) =>
    Number.parseFloat(
      getComputedStyle(
        element.querySelector("span[style*='font-size'], htmlx-inline[style*='font-size']") ??
          element,
      ).fontSize,
    ),
  );
  if (!(objectTextSizeAfter > objectTextBlockSizeAfterSecondClick)) {
    throw new Error(
      `Object-internal selected font size did not increase: ${objectTextBlockSizeAfterSecondClick} -> ${objectTextSizeAfter}`,
    );
  }
  const formattedTableCell = await exportTableCell.evaluate((element) => element.innerHTML);
  if (!/<(?:strong|b)\b/i.test(formattedTableCell)) {
    throw new Error(
      `Toolbar formatting did not update object-internal text: ${formattedTableCell}`,
    );
  }
  if (
    !/<(?:span|htmlx-inline)[^>]+style="(?=[^"]*font-size:)(?=[^"]*color:\s*(?:#be123c|rgb\(190,\s*18,\s*60\)))[^"]*"[^>]*>Readable<\/(?:span|htmlx-inline)>/.test(
      formattedTableCell,
    )
  ) {
    throw new Error(
      `Object-internal partial font size/color did not wrap only the selected text: ${formattedTableCell}`,
    );
  }
  const exportTopChip = appPage.locator(".top-rail span:nth-child(2)");
  await replaceEditableText(exportTopChip, "Readable in any browser");
  const topChipFontInput = appPage.locator('[aria-label="Object text font size"] input');
  await topChipFontInput.waitFor({ state: "visible", timeout: 5000 });
  const topChipFontValue = await topChipFontInput.inputValue();
  if (!/^\d+(?:\.\d+)?$/.test(topChipFontValue.trim())) {
    throw new Error(`Top chip text did not expose object typography controls: ${topChipFontValue}`);
  }
  const topChipSizeBefore = await exportTopChip.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  const topChipFirstSize = (Number.parseFloat(topChipFontValue) + 0.35).toFixed(2);
  await setNumericInput(topChipFontInput, topChipFirstSize);
  const topChipSizeAfter = await exportTopChip.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  if (!(topChipSizeAfter > topChipSizeBefore)) {
    throw new Error(
      `Top chip object text font size did not increase: ${topChipSizeBefore} -> ${topChipSizeAfter}`,
    );
  }
  await setNumericInput(topChipFontInput, (Number.parseFloat(topChipFirstSize) + 0.35).toFixed(2));
  const topChipSizeAfterSecondClick = await exportTopChip.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  if (!(topChipSizeAfterSecondClick > topChipSizeAfter)) {
    throw new Error(
      `Top chip object text font size only changed once: ${topChipSizeAfter} -> ${topChipSizeAfterSecondClick}`,
    );
  }
  await exportTopChip.evaluate((element) => {
    const root = element.getRootNode();
    if (!(root instanceof ShadowRoot)) return;
    const text = element.firstChild;
    if (!text?.textContent) return;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(7, text.textContent.length));
    const selection = root.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });
  await setNumericInput(appPage.locator('[aria-label="Object text font size"] input'), "2.20");
  const topChipInlineState = await exportTopChip.evaluate((element) => {
    const inline = element.querySelector("htmlx-inline, span[style*='font-size']");
    return {
      html: element.innerHTML,
      inlineTag: inline?.tagName ?? "",
      inlineDisplay: inline instanceof HTMLElement ? getComputedStyle(inline).display : "",
    };
  });
  if (
    topChipInlineState.inlineTag !== "HTMLX-INLINE" ||
    topChipInlineState.inlineDisplay !== "inline"
  ) {
    throw new Error(
      `Selected chip text sizing should use an inline-only wrapper, not a nested chip: ${JSON.stringify(
        topChipInlineState,
      )}`,
    );
  }
  const exportHeroAction = appPage.locator(".hero-actions span:nth-child(1)");
  await replaceEditableText(exportHeroAction, "Open anywhere");
  await appPage.keyboard.press(undoShortcut);
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root?.querySelector(".hero-actions span:nth-child(1)")?.textContent?.trim() ===
      "Read in any browser"
    );
  });
  await appPage.keyboard.press(undoShortcut);
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root?.querySelector(".top-rail span:nth-child(2)")?.textContent?.trim() === "Browser-readable"
    );
  });
  await appPage.keyboard.press(undoShortcut);
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root
        ?.querySelector('[data-htmlx-block-id="need-matrix"] tbody tr:nth-child(1) td:nth-child(1)')
        ?.textContent?.trim() === "Reading model"
    );
  });
  await appPage.keyboard.press(redoShortcut);
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root
        ?.querySelector('[data-htmlx-block-id="need-matrix"] tbody tr:nth-child(1) td:nth-child(1)')
        ?.textContent?.trim() === "Readable surface"
    );
  });
  await appPage.keyboard.press(redoShortcut);
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root?.querySelector(".top-rail span:nth-child(2)")?.textContent?.trim() ===
      "Readable in any browser"
    );
  });
  await appPage.keyboard.press(redoShortcut);
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root?.querySelector(".hero-actions span:nth-child(1)")?.textContent?.trim() ===
      "Open anywhere"
    );
  });
  const tableObject = appPage.locator('[data-htmlx-block-id="need-matrix"]');
  const beforeDrag = await tableObject.boundingBox();
  if (!beforeDrag) {
    throw new Error("Semantic table object was not visible for drag smoke.");
  }
  await tableObject.click();
  const selectedTableBox = await tableObject.boundingBox();
  if (!selectedTableBox) {
    throw new Error("Semantic table object disappeared after selection.");
  }
  await appPage.waitForFunction(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return (
      root?.querySelectorAll(
        '[data-htmlx-block-id="need-matrix"] [data-openwebdoc-runtime-control="resize"]',
      ).length === 8
    );
  });
  const handleCount = await tableObject
    .locator('[data-openwebdoc-runtime-control="resize"]')
    .count();
  if (handleCount !== 8) {
    throw new Error(`Selected object did not expose eight resize handles: ${handleCount}`);
  }
  const resizeHandle = tableObject.locator('[data-htmlx-resize-handle="se"]');
  const resizeHandleBox = await resizeHandle.boundingBox();
  if (!resizeHandleBox) {
    throw new Error("Selected object resize handle was not visible.");
  }
  await appPage.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2,
    resizeHandleBox.y + resizeHandleBox.height / 2,
  );
  await appPage.mouse.down();
  await appPage.mouse.move(
    resizeHandleBox.x + resizeHandleBox.width / 2 + 80,
    resizeHandleBox.y + resizeHandleBox.height / 2 + 24,
    { steps: 8 },
  );
  await appPage.mouse.up();
  await appPage.waitForTimeout(150);
  const afterResize = await tableObject.boundingBox();
  if (
    !afterResize ||
    (Math.abs(afterResize.width - selectedTableBox.width) < 20 &&
      Math.abs(afterResize.height - selectedTableBox.height) < 4)
  ) {
    throw new Error(
      `Selected object did not resize from the visible handle: ${JSON.stringify({
        before: selectedTableBox,
        after: afterResize,
      })}`,
    );
  }
  const bodyDragStateBefore = await tableObject.evaluate((element) => ({
    x: element.getAttribute("data-htmlx-x"),
    y: element.getAttribute("data-htmlx-y"),
    transform: (element instanceof HTMLElement ? element.style.transform : "") || "",
  }));
  await appPage.mouse.move(
    afterResize.x + afterResize.width / 2,
    afterResize.y + afterResize.height / 2,
  );
  await appPage.mouse.down();
  await appPage.mouse.move(
    afterResize.x + afterResize.width / 2 + 80,
    afterResize.y + afterResize.height / 2 + 40,
    {
      steps: 6,
    },
  );
  await appPage.mouse.up();
  await appPage.waitForTimeout(120);
  const bodyDragStateAfter = await tableObject.evaluate((element) => ({
    x: element.getAttribute("data-htmlx-x"),
    y: element.getAttribute("data-htmlx-y"),
    transform: (element instanceof HTMLElement ? element.style.transform : "") || "",
  }));
  if (
    bodyDragStateAfter.x !== bodyDragStateBefore.x ||
    bodyDragStateAfter.y !== bodyDragStateBefore.y ||
    bodyDragStateAfter.transform !== bodyDragStateBefore.transform
  ) {
    throw new Error(
      `Object body drag should select only; movement must use the handle: ${JSON.stringify({
        before: bodyDragStateBefore,
        after: bodyDragStateAfter,
      })}`,
    );
  }
  const beforeMoveState = await tableObject.evaluate((element) => ({
    x: element.getAttribute("data-htmlx-x"),
    y: element.getAttribute("data-htmlx-y"),
    transform: (element instanceof HTMLElement ? element.style.transform : "") || "",
  }));
  const moveHandle = tableObject.locator('[data-htmlx-object-move-handle="true"]');
  const moveHandleBox = await moveHandle.boundingBox();
  if (!moveHandleBox) {
    throw new Error("Selected object move handle was not visible.");
  }
  await appPage.mouse.move(
    moveHandleBox.x + moveHandleBox.width / 2,
    moveHandleBox.y + moveHandleBox.height / 2,
  );
  await appPage.mouse.down();
  await appPage.mouse.move(
    moveHandleBox.x + moveHandleBox.width / 2 + 84,
    moveHandleBox.y + moveHandleBox.height / 2 + 48,
    {
      steps: 8,
    },
  );
  await appPage.mouse.up();
  await appPage.waitForTimeout(150);
  const afterDrag = await tableObject.boundingBox();
  if (!afterDrag || afterDrag.x <= afterResize.x + 60 || afterDrag.y <= afterResize.y + 30) {
    throw new Error("Semantic table object did not move after pointer drag.");
  }
  await appPage.keyboard.press(undoShortcut);
  await appPage.waitForTimeout(150);
  const undoState = await appPage.evaluate(
    ({ original }) => {
      const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
      const rail = root?.querySelector(".top-rail");
      const marker = root?.querySelector('[data-htmlx-block-id="need-matrix"]');
      if (!(rail instanceof HTMLElement) || !(marker instanceof HTMLElement)) return null;
      const railStyle = getComputedStyle(rail);
      const markerStyle = getComputedStyle(marker);
      return {
        cssApplied: railStyle.display === "grid" && markerStyle.borderColor !== "rgb(0, 0, 0)",
        transform: marker.style.transform || "",
        x: marker.getAttribute("data-htmlx-x"),
        y: marker.getAttribute("data-htmlx-y"),
        restored:
          marker.getAttribute("data-htmlx-x") === original.x &&
          marker.getAttribute("data-htmlx-y") === original.y &&
          (marker.style.transform || "") === original.transform,
      };
    },
    { original: beforeMoveState },
  );
  if (!undoState || !undoState.cssApplied || !undoState.restored) {
    throw new Error(
      `Undo did not restore the table position without breaking document CSS: ${JSON.stringify(
        undoState,
      )}`,
    );
  }
  await tableObject.click();
  if ((await appPage.locator('[data-htmlx-runtime-selected="true"]').count()) === 0) {
    throw new Error("Table object did not become selected before Escape smoke.");
  }
  await appPage.keyboard.press("Escape");
  await appPage.locator(".toolbar-actions").waitFor({ state: "detached", timeout: 5000 });
  await appPage.keyboard.press("Escape");
  if ((await appPage.locator('[data-htmlx-runtime-selected="true"]').count()) !== 0) {
    throw new Error("Escape did not clear the selected object.");
  }
  if ((await appPage.getByRole("button", { name: "Expand menu" }).count()) === 1) {
    await appPage.getByRole("button", { name: "Expand menu" }).click();
  }
  const downloadPromise = appPage.waitForEvent("download");
  const exportButton = appPage.getByRole("button", { name: "Export .htmlx" });
  if (!(await exportButton.isEnabled())) {
    throw new Error("Export button should be enabled before saving the package.");
  }
  await exportButton.click();
  const download = await downloadPromise;
  const exportPath = join(tmpRoot, "playwright-export-smoke.htmlx");
  await download.saveAs(exportPath);
  await appPage
    .locator(".runtime-status")
    .filter({ hasText: "Exported playwright-export-smoke.htmlx" })
    .waitFor({ state: "visible", timeout: 5000 });

  const cliEntry = join(repoRoot, "packages/cli/dist/index.js");
  const validate = spawnSync("node", [cliEntry, "validate", exportPath, "--json"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
  if (validate.status !== 0) {
    throw new Error(`Exported package failed validation:\n${validate.stdout}\n${validate.stderr}`);
  }
  const unpackedPackage = join(tmpRoot, "unpacked-export");
  const unpackResult = spawnSync(
    "node",
    [cliEntry, "unpack", exportPath, unpackedPackage, "--json"],
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
  const exportedIndex = await readFile(join(unpackedPackage, "index.html"), "utf8");
  if (!/<table[\s>]/i.test(exportedIndex)) {
    throw new Error("Exported document did not preserve semantic HTML table markup.");
  }
  if (!exportedIndex.replace(/<[^>]+>/g, "").includes("Readable surface")) {
    throw new Error("Exported document did not preserve edited table-cell text.");
  }
  if (!exportedIndex.includes("Table 1. Directly editable comparison matrix")) {
    throw new Error("Exported document did not preserve edited table caption text.");
  }
  if (
    !/<td[^>]*><strong><(?:span|htmlx-inline)[^>]+style="[^"]*font-size:[^"]*"[^>]*>Readable<\/(?:span|htmlx-inline)><\/strong> surface<\/td>/i.test(
      exportedIndex,
    )
  ) {
    throw new Error("Exported document did not preserve object-internal inline formatting.");
  }
  if (!/<td[^>]*>[\s\S]*<(?:span|htmlx-inline)[^>]+style="[^"]*font-size:/i.test(exportedIndex)) {
    throw new Error("Exported document did not preserve object-internal font size adjustment.");
  }
  if (!exportedIndex.replace(/<[^>]+>/g, "").includes("Readable in any browser")) {
    throw new Error("Exported document did not preserve edited top-rail chip text.");
  }
  if (!exportedIndex.includes("Open anywhere")) {
    throw new Error("Exported document did not preserve edited hero action text.");
  }
  if (
    exportedIndex.includes("data-htmlx-object-text") ||
    exportedIndex.includes("data-openwebdoc-runtime-control") ||
    exportedIndex.includes("data-htmlx-original-src") ||
    exportedIndex.includes("data-htmlx-runtime-origin") ||
    exportedIndex.includes("contenteditable=") ||
    exportedIndex.includes("spellcheck=") ||
    exportedIndex.includes("tabindex=")
  ) {
    throw new Error("Exported document leaked runtime-only editing attributes.");
  }
  if (
    !/<strong>/i.test(exportedIndex) ||
    !/<em>/i.test(exportedIndex) ||
    !/<u>/i.test(exportedIndex)
  ) {
    throw new Error("Exported document did not preserve semantic inline formatting.");
  }
  if (
    !/(data-htmlx-color="#1f4f82"|style="[^"]*color:\s*(?:#1f4f82|rgb\(31,\s*79,\s*130\)))/i.test(
      exportedIndex,
    )
  ) {
    throw new Error("Exported document did not preserve selected text color.");
  }
  const validateDirectory = spawnSync("node", [cliEntry, "validate", unpackedPackage, "--json"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
  if (validateDirectory.status !== 0) {
    throw new Error(
      `Unpacked package failed validation:\n${validateDirectory.stdout}\n${validateDirectory.stderr}`,
    );
  }

  await openInApp(page, exportPath);
  await page
    .locator('[data-htmlx-block-id="doc-title"]')
    .filter({ hasText: "Playwright Export Smoke" })
    .waitFor({ state: "attached", timeout: 5000 });
  await page.locator('img[src^="blob:"]').first().waitFor({ state: "attached", timeout: 5000 });
  await page
    .locator('[data-htmlx-kind="table"] table')
    .first()
    .waitFor({ state: "attached", timeout: 5000 });

  console.log("OpenWebDoc smoke e2e passed.");
} finally {
  await browser?.close();
  for (const server of servers) {
    server.kill("SIGTERM");
  }
}

async function openInApp(page, filePath) {
  await page.goto(appUrl);
  await page.locator('input[type="file"]').setInputFiles(filePath);
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

async function verifyProportionalSurface(page, viewports) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const metrics = await page.locator(".shadow-document-frame").evaluate((host) => {
      const root = host.shadowRoot;
      if (!root) throw new Error("Editable document shadow root was not available.");
      const element = root.querySelector(".htmlx-document");
      if (!element) throw new Error("Editable HTMLX document root was not rendered.");
      const pageBox = element.getBoundingClientRect();
      const titleBox = element
        .querySelector('[data-htmlx-block-id="doc-title"]')
        ?.getBoundingClientRect();
      const tableBox = element.querySelector("table")?.getBoundingClientRect();
      return {
        width: pageBox.width,
        height: pageBox.height,
        titleWidth: titleBox?.width ?? 0,
        titleHeight: titleBox?.height ?? 0,
        tableWidth: tableBox?.width ?? 0,
      };
    });
    const expectedWidth = viewport.width - 16;
    if (Math.abs(metrics.width - expectedWidth) > 2) {
      throw new Error(
        `Document surface did not fill viewport width at ${viewport.width}px: ${metrics.width}`,
      );
    }
    if (metrics.titleWidth <= 0 || metrics.titleHeight <= 0) {
      throw new Error(`Document title was not measurable at ${viewport.width}px.`);
    }
    if (metrics.tableWidth <= 0 || metrics.tableWidth > metrics.width) {
      throw new Error(`Document table overflowed or disappeared at ${viewport.width}px.`);
    }
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const maxScrollWidth = Math.max(overflow.scrollWidth, overflow.bodyScrollWidth);
  if (maxScrollWidth > overflow.clientWidth + 2) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
  }
}

async function replaceEditableText(locator, text) {
  await locator.click();
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await locator.press("Backspace");
  await locator.pressSequentially(text);
}

async function setNumericInput(locator, value) {
  await locator.waitFor({ state: "visible", timeout: 5000 });
  await locator.evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function selectEditableTextRange(locator, start, length) {
  await locator.click();
  await locator.evaluate(
    (element, rangeSpec) => {
      const root = element.getRootNode();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const findPosition = (absoluteOffset) => {
        let current = walker.nextNode();
        let remaining = absoluteOffset;
        let lastTextNode = null;
        while (current) {
          const text = current.textContent ?? "";
          if (current.nodeType === Node.TEXT_NODE) {
            lastTextNode = current;
            if (remaining <= text.length) return { node: current, offset: remaining };
            remaining -= text.length;
          }
          current = walker.nextNode();
        }
        if (lastTextNode) {
          return { node: lastTextNode, offset: lastTextNode.textContent?.length ?? 0 };
        }
        return null;
      };
      const startPosition = findPosition(rangeSpec.start);
      walker.currentNode = element;
      const endPosition = findPosition(rangeSpec.start + rangeSpec.length);
      if (!startPosition || !endPosition) {
        throw new Error("No text node found for selection.");
      }
      const range = document.createRange();
      range.setStart(startPosition.node, startPosition.offset);
      range.setEnd(endPosition.node, endPosition.offset);
      const selection = root instanceof ShadowRoot ? root.getSelection() : window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    },
    { start, length },
  );
}

async function getShadowSelectionText(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".shadow-document-frame")?.shadowRoot;
    return root?.getSelection?.()?.toString() ?? "";
  });
}

async function getTextRangeStyleSamples(locator, start, end) {
  return locator.evaluate(
    (element, rangeSpec) => {
      const samples = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let current = walker.nextNode();
      while (current) {
        const text = current.textContent ?? "";
        const nodeStart = offset;
        const nodeEnd = offset + text.length;
        const overlapStart = Math.max(nodeStart, rangeSpec.start);
        const overlapEnd = Math.min(nodeEnd, rangeSpec.end);
        if (overlapStart < overlapEnd && current.parentElement) {
          const styleElement =
            current.parentElement.closest(
              "htmlx-inline, span[style], strong[style], em[style], u[style]",
            ) ?? current.parentElement;
          const style = getComputedStyle(styleElement);
          samples.push({
            text: text.slice(overlapStart - nodeStart, overlapEnd - nodeStart),
            color: style.color,
            fontSize: Number.parseFloat(style.fontSize),
            tag: styleElement.tagName,
            style: styleElement.getAttribute("style") ?? "",
          });
        }
        offset = nodeEnd;
        current = walker.nextNode();
      }
      return samples;
    },
    { start, end },
  );
}

async function getInlineWrapperCount(locator) {
  return locator.evaluate(
    (element) => element.querySelectorAll("htmlx-inline, span[style]").length,
  );
}

async function clearEditableSelection(locator) {
  await locator.evaluate((element) => {
    const root = element.getRootNode();
    const selection = root instanceof ShadowRoot ? root.getSelection() : window.getSelection();
    selection?.removeAllRanges();
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  });
}

async function visibleSlideIds(page) {
  return page
    .locator('[data-htmlx-kind="slide"]')
    .evaluateAll((slides) =>
      slides
        .filter((slide) => getComputedStyle(slide).display !== "none")
        .map((slide) => slide.getAttribute("data-htmlx-slide-id") ?? ""),
    );
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
