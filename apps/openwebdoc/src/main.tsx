import "./style.css";
import {
  HTMLX_EDITING_METADATA_SCHEMA_URL,
  createDefaultManifest,
  type HtmlxEditingMetadata,
  type HtmlxLlmMetadata,
  type HtmlxManifest,
  type HtmlxPresentationMetadata,
} from "@openwebdoc/spec";
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  GripHorizontal,
  GripVertical,
  Heading1,
  ImagePlus,
  Info,
  Italic,
  Maximize2,
  Menu,
  MousePointer2,
  Palette,
  Pencil,
  Pilcrow,
  Plus,
  Trash2,
  Underline,
  Upload,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { proposalIconDataUrls } from "./generatedIcons";

const DESIGN_WIDTH = 980;
const DESIGN_HEIGHT = 7200;
const TOOLBAR_ANCHOR_WIDTH = 232;
const TOOLBAR_ANCHOR_HEIGHT = 48;
const HISTORY_LIMIT = 100;
const BUNDLED_EXAMPLES = [
  { id: "openwebdoc-introduction", title: "OpenWebDoc Introduction", type: "Document" },
  { id: "openwebdoc-slide-deck", title: "OpenWebDoc Slide Deck", type: "Presentation" },
  { id: "template-research-brief", title: "Research Brief", type: "Document template" },
  { id: "template-product-spec", title: "Product Spec", type: "Document template" },
  { id: "template-operations-manual", title: "Operations Manual", type: "Document template" },
  { id: "template-meeting-notes", title: "Meeting Notes", type: "Document template" },
  { id: "template-project-proposal", title: "Project Proposal", type: "Document template" },
  { id: "template-data-report", title: "Data Report", type: "Document template" },
  { id: "template-pitch-deck", title: "Pitch Deck", type: "Presentation template" },
  { id: "template-lesson-deck", title: "Lesson Deck", type: "Presentation template" },
  { id: "template-research-talk", title: "Research Talk", type: "Presentation template" },
  { id: "template-status-review-deck", title: "Status Review Deck", type: "Presentation template" },
] as const;
const EDITABLE_RUNTIME_TEXT_OVERRIDES = `
.document-page .text-layer h1,
.document-page .text-layer p {
  margin: 0;
}
`;
const EDITABLE_SURFACE_TEXT_SELECTOR =
  '[data-htmlx-editable="text"], [data-htmlx-object-text="true"]';
const OBJECT_TEXT_TARGET_SELECTOR = [
  '[data-htmlx-editable="object"] figcaption',
  '[data-htmlx-editable="object"] figcaption strong',
  '[data-htmlx-editable="object"] figcaption span',
  '[data-htmlx-editable="object"] table th',
  '[data-htmlx-editable="object"] table td',
  '[data-htmlx-editable="object"] .figure-card strong',
  '[data-htmlx-editable="object"] .figure-card span',
  '[data-htmlx-editable="object"] article b',
  '[data-htmlx-editable="object"] article strong',
  '[data-htmlx-editable="object"] article span',
  '[data-htmlx-editable="object"] article p',
  '[data-htmlx-editable="object"] h3',
  '[data-htmlx-editable="object"] li',
  '[data-htmlx-editable="object"] code',
  '[data-htmlx-editable="document"] .top-rail span',
  '[data-htmlx-editable="document"] .hero-actions span',
].join(", ");
const RESIZE_DIRECTIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type ResizeDirection = (typeof RESIZE_DIRECTIONS)[number];

type TextBlockType = "heading" | "paragraph";
type FigureVariant = "cards" | "flow" | "roadmap" | "funnel" | "boundary";
type RuntimeStatus = "empty" | "document";

interface InlineTypographyState {
  fontSizeCqw: number;
  color: string;
}

interface SurfaceTextSelectionContext {
  blockId: string;
  element: HTMLElement;
  start: number;
  end: number;
}

interface InlineTypographyPatch {
  fontSizeCqw?: number;
  color?: string;
}

interface AssetState {
  id: string;
  name: string;
  path: string;
  mediaType: string;
  bytes: Uint8Array;
  dataUrl: string;
}

interface BaseBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  sourceClassName?: string;
}

interface TextBlock extends BaseBlock {
  type: TextBlockType;
  text: string;
  html: string;
  fontSize: number;
  lineHeight: number;
  color?: string;
}

interface ImageBlock extends BaseBlock {
  type: "image";
  assetId: string;
  alt: string;
}

interface ShapeBlock extends BaseBlock {
  type: "shape";
  shape: "rectangle";
  height: number;
  fill: string;
  html?: string;
}

interface TableBlock extends BaseBlock {
  type: "table";
  title: string;
  caption: string;
  columns: string[];
  rows: string[][];
}

interface FigureCard {
  title: string;
  body: string;
  iconAssetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FigureBlock extends BaseBlock {
  type: "figure";
  title: string;
  caption: string;
  variant: FigureVariant;
  cards: FigureCard[];
}

type DocumentBlock = TextBlock | ImageBlock | ShapeBlock | TableBlock | FigureBlock;
type ObjectBlock = ImageBlock | ShapeBlock | TableBlock | FigureBlock;
type DrawerMode = "none" | "info";

interface DragState {
  mode: "move" | "resize";
  blockId: string;
  originClientX: number;
  originClientY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight?: number;
  historyRecorded: boolean;
}

interface ToolbarPosition {
  x: number;
  y: number;
}

interface ToolbarDragState {
  source: "menu" | "grip";
  originClientX: number;
  originClientY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

interface FigureCardDragState {
  figureId: string;
  cardIndex: number;
  originClientX: number;
  originClientY: number;
  originX: number;
  originY: number;
  historyRecorded: boolean;
}

interface DocumentSnapshot {
  blocks: DocumentBlock[];
  assets: AssetState[];
  selectedBlockId: string;
  surfaceHtml?: string;
}

const initialAssets = createInitialIconAssets();
const initialBlocks = createInitialBlocks();

function OpenWebDocApp() {
  const stageRef = useRef<HTMLElement | null>(null);
  const documentFrameRef = useRef<HTMLDivElement | null>(null);
  const openFileInputRef = useRef<HTMLInputElement | null>(null);
  const textDraftsRef = useRef(new Map<string, string>());
  const toolbarDragMovedRef = useRef(false);
  const [blocks, setBlocks] = useState<DocumentBlock[]>(initialBlocks);
  const [assets, setAssets] = useState<AssetState[]>(initialAssets);
  const [selectedBlockId, setSelectedBlockId] = useState(initialBlocks[0]?.id ?? "");
  const documentStateRef = useRef<DocumentSnapshot>({
    blocks: initialBlocks,
    assets: initialAssets,
    selectedBlockId: initialBlocks[0]?.id ?? "",
  });
  const undoStackRef = useRef<DocumentSnapshot[]>([]);
  const redoStackRef = useRef<DocumentSnapshot[]>([]);
  const activeTextHistoryRef = useRef(new Set<string>());
  const activeInlineTextElementRef = useRef<HTMLElement | null>(null);
  const readOnlyRevokeRef = useRef<(() => void) | null>(null);
  const stylesheetPathRef = useRef("styles/document.css");
  const presentationReturnEditingRef = useRef(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("empty");
  const [readOnlyHtml, setReadOnlyHtml] = useState("");
  const [renderedDocumentHtml, setRenderedDocumentHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationNoticeKey, setPresentationNoticeKey] = useState(0);
  const [presentationMetadata, setPresentationMetadata] =
    useState<HtmlxPresentationMetadata | null>(null);
  const [presentationSlideCount, setPresentationSlideCount] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const dragStateRef = useRef<DragState | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [toolbarPosition, setToolbarPosition] = useState(getInitialToolbarPosition);
  const toolbarDragStateRef = useRef<ToolbarDragState | null>(null);
  const figureCardDragStateRef = useRef<FigureCardDragState | null>(null);
  const [activeInlineTextBlockId, setActiveInlineTextBlockId] = useState("");
  const [activeInlineTextSelection, setActiveInlineTextSelection] = useState(false);
  const [activeTextTypography, setActiveTextTypography] = useState<InlineTypographyState | null>(
    null,
  );
  const [activeObjectTextTypography, setActiveObjectTextTypography] =
    useState<InlineTypographyState | null>(null);
  const preservedInlineTextSelectionRef = useRef<SurfaceTextSelectionContext | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode>("none");
  const [lastManifest, setLastManifest] = useState<HtmlxManifest | null>(null);
  const [documentCss, setDocumentCss] = useState("");
  const [issues, setIssues] = useState<
    Array<{ severity: string; code: string; message: string; path?: string }>
  >([]);

  const textBlocks = blocks.filter(isTextBlock);
  const objectBlocks = blocks.filter(isObjectBlock);
  const selectedBlock = blocks.find((block) => block.id === selectedBlockId);
  const title = getTitle(blocks);
  const isSlideDeck = presentationMetadata?.profile === "slide-deck";
  const wordCount = textBlocks
    .map((block) => block.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const canEdit = runtimeStatus === "document" && !readOnlyHtml && blocks.length > 0;
  const canPresent = runtimeStatus === "document" && isSlideDeck && presentationSlideCount > 0;

  useLayoutEffect(() => {
    documentStateRef.current = { blocks, assets, selectedBlockId };
  }, [assets, blocks, selectedBlockId]);

  useEffect(() => {
    function handleSelectionChange() {
      const context = captureSurfaceTextSelection();
      if (!context && editing && !isToolbarControlFocused()) setActiveInlineTextSelection(false);
    }
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(restorePreservedTextSelection);
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exampleName = params.get("example");
    const examplePackages = new Set<string>(BUNDLED_EXAMPLES.map((example) => example.id));
    if (!exampleName || !examplePackages.has(exampleName)) return;
    let cancelled = false;
    setBusy(true);
    fetch(`./examples/${exampleName}.htmlx`)
      .then((response) => {
        if (!response.ok) throw new Error(`Example package failed to load: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) return openDocumentBytes(new Uint8Array(buffer), false);
        return undefined;
      })
      .catch((error) => {
        if (cancelled) return;
        setIssues([
          {
            severity: "error",
            code: "app.example_failed",
            message: error instanceof Error ? error.message : "Unable to load example package.",
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const shadowActiveElement = documentFrameRef.current?.shadowRoot?.activeElement ?? null;
      const targetIsEditable =
        isEditableShortcutTarget(event.target) || isEditableShortcutTarget(shadowActiveElement);
      const modifier = event.metaKey || event.ctrlKey;
      const shadowHasKeyboardFocus = shadowActiveElement instanceof HTMLElement;

      if (presentationMode && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (key === "escape" && !event.repeat) {
          event.preventDefault();
          exitPresentationMode();
          return;
        }
        if (isSlideDeck) {
          if (key === "arrowright" || key === "pagedown" || event.key === " ") {
            event.preventDefault();
            setCurrentSlideIndex((index) =>
              Math.min(Math.max(presentationSlideCount - 1, 0), index + 1),
            );
            return;
          }
          if (key === "arrowleft" || key === "pageup") {
            event.preventDefault();
            setCurrentSlideIndex((index) => Math.max(0, index - 1));
            return;
          }
          if (key === "home") {
            event.preventDefault();
            setCurrentSlideIndex(0);
            return;
          }
          if (key === "end") {
            event.preventDefault();
            setCurrentSlideIndex(Math.max(0, presentationSlideCount - 1));
            return;
          }
        }
      }

      if (
        shadowHasKeyboardFocus &&
        editing &&
        !event.altKey &&
        ((modifier && ["z", "b", "i", "u", "e", "s"].includes(key)) ||
          (!modifier && ["delete", "backspace"].includes(key)))
      ) {
        return;
      }

      if (modifier && key === "o" && !event.altKey && !event.repeat) {
        event.preventDefault();
        openFileInputRef.current?.click();
        return;
      }

      if (modifier && key === "s" && !event.altKey && !event.repeat) {
        event.preventDefault();
        if (canEdit) {
          void exportPackage();
        } else {
          setDrawer("info");
        }
        return;
      }

      if (modifier && key === "e" && !event.altKey && !event.repeat) {
        event.preventDefault();
        setEditingMode(!editing);
        return;
      }

      const isUndoOrRedo = modifier && key === "z" && !event.altKey;
      if (isUndoOrRedo) {
        const hasHistory = event.shiftKey
          ? redoStackRef.current.length > 0
          : undoStackRef.current.length > 0;
        if (targetIsEditable && !hasHistory) return;
        event.preventDefault();
        if (event.shiftKey) {
          redoDocument();
        } else {
          undoDocument();
        }
        return;
      }

      if (
        editing &&
        modifier &&
        !event.altKey &&
        !event.repeat &&
        (key === "b" || key === "i" || key === "u")
      ) {
        const formatBlockId =
          getActiveTextBlockId() ??
          (selectedBlock && isTextBlock(selectedBlock) ? selectedBlock.id : "");
        if (!formatBlockId) return;
        event.preventDefault();
        applyInlineFormat(
          key === "b" ? "bold" : key === "i" ? "italic" : "underline",
          formatBlockId,
        );
        return;
      }

      if (key === "escape" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat) {
        if (drawer !== "none") {
          event.preventDefault();
          setDrawer("none");
          return;
        }
        if (!toolbarCollapsed) {
          event.preventDefault();
          setToolbarCollapsed(true);
          return;
        }
        if (selectedBlockId) {
          event.preventDefault();
          clearSelection();
        }
        return;
      }

      if (
        editing &&
        selectedBlock &&
        !targetIsEditable &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (key === "delete" || key === "backspace")
      ) {
        event.preventDefault();
        deleteSelectedBlock();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts, true);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts, true);
  });

  useEffect(() => {
    return () => readOnlyRevokeRef.current?.();
  }, []);

  useLayoutEffect(() => {
    function handleWindowDragMove(event: globalThis.PointerEvent | globalThis.MouseEvent) {
      if (!figureCardDragStateRef.current) return;
      event.preventDefault();
      updateFigureCardDragFromPoint(event.clientX, event.clientY);
    }

    function handleWindowDragEnd() {
      stopFigureCardDrag();
    }

    window.addEventListener("pointermove", handleWindowDragMove, true);
    window.addEventListener("pointerup", handleWindowDragEnd, true);
    window.addEventListener("mousemove", handleWindowDragMove, true);
    window.addEventListener("mouseup", handleWindowDragEnd, true);
    return () => {
      window.removeEventListener("pointermove", handleWindowDragMove, true);
      window.removeEventListener("pointerup", handleWindowDragEnd, true);
      window.removeEventListener("mousemove", handleWindowDragMove, true);
      window.removeEventListener("mouseup", handleWindowDragEnd, true);
    };
  }, []);

  function currentSnapshot(): DocumentSnapshot {
    const syncedBlocks = getDomSyncedBlocks();
    return {
      blocks: syncedBlocks,
      assets,
      selectedBlockId,
      surfaceHtml: captureCurrentSurfaceHtml(),
    };
  }

  function recordHistory() {
    const snapshot = currentSnapshot();
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-HISTORY_LIMIT);
    redoStackRef.current = [];
  }

  function beginTextMutation(blockId: string) {
    if (!blockId || activeTextHistoryRef.current.has(blockId)) return;
    recordHistory();
    activeTextHistoryRef.current.add(blockId);
  }

  function restoreSnapshot(snapshot: DocumentSnapshot) {
    textDraftsRef.current.clear();
    activeTextHistoryRef.current.clear();
    dragStateRef.current = null;
    figureCardDragStateRef.current = null;
    documentStateRef.current = {
      blocks: snapshot.blocks,
      assets: snapshot.assets,
      selectedBlockId: snapshot.selectedBlockId,
    };
    setAssets(snapshot.assets);
    setBlocks(snapshot.blocks);
    setSelectedBlockId(snapshot.selectedBlockId);
    if (snapshot.surfaceHtml) setRenderedDocumentHtml(snapshot.surfaceHtml);
    requestAnimationFrame(() => {
      documentFrameRef.current?.focus({ preventScroll: true });
    });
  }

  function undoDocument() {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    const current = currentSnapshot();
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, current].slice(-HISTORY_LIMIT);
    restoreSnapshot(previous);
  }

  function redoDocument() {
    const next = redoStackRef.current.at(-1);
    if (!next) return;
    const current = currentSnapshot();
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, current].slice(-HISTORY_LIMIT);
    restoreSnapshot(next);
  }

  function rememberTextDraft(blockId: string, html: string) {
    const sanitized = sanitizeInlineHtml(html);
    const text = plainTextFromInlineHtml(sanitized);
    const current = documentStateRef.current;
    const existing = current.blocks.find(
      (block): block is TextBlock => block.id === blockId && isTextBlock(block),
    );
    if (!existing || existing.html === sanitized) return;
    if (!activeTextHistoryRef.current.has(blockId)) {
      recordHistory();
      activeTextHistoryRef.current.add(blockId);
    }
    textDraftsRef.current.set(blockId, sanitized);
    documentStateRef.current = {
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId && isTextBlock(block) ? { ...block, text, html: sanitized } : block,
      ),
    };
  }

  function commitTextDraft(blockId: string) {
    const hasDraft = textDraftsRef.current.has(blockId);
    if (hasDraft) textDraftsRef.current.delete(blockId);
    activeTextHistoryRef.current.delete(blockId);
    if (hasDraft) setBlocks(documentStateRef.current.blocks);
  }

  function getDomSyncedBlocks(): DocumentBlock[] {
    const stage = stageRef.current;
    const frameRoot = documentFrameRef.current?.shadowRoot;
    const root = stage ?? frameRoot;
    if (!root) return blocks;
    if (frameRoot) {
      const parsed = parseEditableBlocksFromRoot(frameRoot, assets);
      if (parsed.length) return parsed;
    }
    const textById = new Map<string, { html: string; text: string }>();
    root.querySelectorAll<HTMLElement>('[data-htmlx-editable="text"]').forEach((element) => {
      const id = element.dataset.htmlxBlockId;
      if (id) {
        const html = sanitizeInlineHtml(element.innerHTML);
        textById.set(id, { html, text: plainTextFromInlineHtml(html) });
      }
    });
    return blocks.map((block) =>
      isTextBlock(block)
        ? {
            ...block,
            html: textById.get(block.id)?.html ?? textDraftsRef.current.get(block.id) ?? block.html,
            text:
              textById.get(block.id)?.text ??
              plainTextFromInlineHtml(textDraftsRef.current.get(block.id) ?? block.html),
          }
        : block,
    );
  }

  function getEditableRoot(): ParentNode | null {
    return stageRef.current ?? documentFrameRef.current?.shadowRoot ?? null;
  }

  function getEditableBlockElement(blockId: string): HTMLElement | null {
    return (
      getEditableRoot()?.querySelector<HTMLElement>(
        `[data-htmlx-block-id="${CSS.escape(blockId)}"]`,
      ) ?? null
    );
  }

  function getActiveTextBlockId(): string {
    return getActiveEditableContext()?.blockId ?? "";
  }

  function getActiveEditableContext(): { editable: HTMLElement; blockId: string } | null {
    const shadowRoot = documentFrameRef.current?.shadowRoot;
    const shadowActiveElement = shadowRoot?.activeElement;
    const activeElement =
      shadowActiveElement instanceof HTMLElement ? shadowActiveElement : document.activeElement;
    const editable =
      activeElement instanceof HTMLElement
        ? activeElement.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR)
        : null;
    const blockId = editable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
    if (editable && blockId) return { editable, blockId };
    const rememberedEditable = activeInlineTextElementRef.current;
    const rememberedBlockId =
      rememberedEditable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
    if (rememberedEditable?.isConnected && rememberedBlockId) {
      return { editable: rememberedEditable, blockId: rememberedBlockId };
    }
    return null;
  }

  function setActiveInlineTextTarget(blockId: string, element: HTMLElement | null = null) {
    const hasSelection = Boolean(blockId && element && hasNonCollapsedTextSelection(element));
    activeInlineTextElementRef.current = blockId ? element : null;
    setActiveInlineTextBlockId(blockId);
    setActiveInlineTextSelection(hasSelection);
    if (!hasSelection && element) preservedInlineTextSelectionRef.current = null;
    setActiveTextTypography(
      element ? readActiveInlineTypography(element, documentFrameRef.current) : null,
    );
    setActiveObjectTextTypography(
      blockId && element?.dataset.htmlxObjectText === "true"
        ? readActiveInlineTypography(element, documentFrameRef.current)
        : null,
    );
  }

  function captureSurfaceTextSelection() {
    const context = getSelectedEditableContext(documentFrameRef.current?.shadowRoot ?? null);
    preservedInlineTextSelectionRef.current = context;
    if (editing && context) {
      setSelectedBlockId(context.blockId);
      setActiveInlineTextTarget(context.blockId, context.element);
    }
    return context;
  }

  function restorePreservedTextSelection() {
    const context =
      getSelectedEditableContext(documentFrameRef.current?.shadowRoot ?? null) ??
      preservedInlineTextSelectionRef.current;
    if (!context) return;
    const element = getPreservedSelectionElement(
      documentFrameRef.current?.shadowRoot ?? null,
      context,
    );
    if (!element) return;
    restoreTextSelection({ ...context, element });
    setSelectedBlockId(context.blockId);
    setActiveInlineTextTarget(context.blockId, element);
  }

  function isToolbarControlFocused() {
    return document.activeElement instanceof HTMLElement
      ? Boolean(document.activeElement.closest(".floating-controls"))
      : false;
  }

  function syncBlocksFromDom(nextSelectedBlockId = selectedBlockId) {
    const nextBlocks = getDomSyncedBlocks();
    documentStateRef.current = {
      blocks: nextBlocks,
      assets,
      selectedBlockId: nextSelectedBlockId,
    };
    setBlocks(nextBlocks);
    setSelectedBlockId(nextSelectedBlockId);
    return nextBlocks;
  }

  function captureCurrentSurfaceHtml() {
    const title = getTitle(getDomSyncedBlocks());
    return serializeCurrentSurfaceHtml(title, { cleanForExport: false }) ?? renderedDocumentHtml;
  }

  async function openDocumentBytes(bytes: Uint8Array, record = true) {
    const { openHtmlx, decodeText, resolveHtmlxDocument } = await import("@openwebdoc/core");
    const htmlxPackage = await openHtmlx(bytes);
    const nextAssets = await packageAssetsToState(htmlxPackage.files, htmlxPackage.manifest);
    const html = decodeText(htmlxPackage.files.get(htmlxPackage.manifest.entry)!);
    const stylesheetPath = htmlxPackage.manifest.styles?.[0] ?? "styles/document.css";
    stylesheetPathRef.current = stylesheetPath;
    const css = decodeText(htmlxPackage.files.get(stylesheetPath) ?? new Uint8Array());
    const parsedBlocks = parseEditableBlocks(html, nextAssets);
    const editingPath = htmlxPackage.manifest.metadata?.editing;
    const declaresEditing = Boolean(editingPath && htmlxPackage.files.has(editingPath));
    const nextPresentationMetadata = parsePresentationMetadata(
      htmlxPackage.files,
      htmlxPackage.manifest,
    );
    const nextSlideCount = countPresentationSlides(html);
    readOnlyRevokeRef.current?.();
    readOnlyRevokeRef.current = null;
    setPresentationMetadata(nextPresentationMetadata);
    setPresentationSlideCount(nextSlideCount);
    setCurrentSlideIndex(0);
    setPresentationMode(false);
    if (!declaresEditing || parsedBlocks.length === 0) {
      const resolved = resolveHtmlxDocument(htmlxPackage);
      readOnlyRevokeRef.current = resolved.revoke;
      setReadOnlyHtml(resolved.html);
      setRenderedDocumentHtml("");
      setRuntimeStatus("document");
      setEditing(false);
      setAssets([]);
      setBlocks([]);
      setDocumentCss("");
      setSelectedBlockId("");
      setActiveInlineTextTarget("");
      setLastManifest(htmlxPackage.manifest);
      setIssues(htmlxPackage.validation.issues);
      setDrawer("none");
      return;
    }
    if (record) recordHistory();
    textDraftsRef.current.clear();
    const resolved = resolveHtmlxDocument(htmlxPackage);
    readOnlyRevokeRef.current = resolved.revoke;
    setReadOnlyHtml("");
    setRenderedDocumentHtml(resolved.html);
    setAssets(nextAssets.length ? nextAssets : initialAssets);
    setBlocks(parsedBlocks);
    setDocumentCss(css);
    setSelectedBlockId("");
    setActiveInlineTextTarget("");
    setLastManifest(htmlxPackage.manifest);
    setIssues(htmlxPackage.validation.issues);
    setRuntimeStatus("document");
    setEditing(false);
    setDrawer("none");
  }

  async function openDocument(file: File) {
    setBusy(true);
    try {
      await openDocumentBytes(new Uint8Array(await file.arrayBuffer()), true);
    } catch (error) {
      const errorIssues =
        error && typeof error === "object" && "issues" in error
          ? (error as { issues?: unknown }).issues
          : undefined;
      setRuntimeStatus("empty");
      setEditing(false);
      setActiveInlineTextTarget("");
      setReadOnlyHtml("");
      setRenderedDocumentHtml("");
      setPresentationMetadata(null);
      setPresentationSlideCount(0);
      setCurrentSlideIndex(0);
      setPresentationMode(false);
      setLastManifest(null);
      setIssues(
        Array.isArray(errorIssues)
          ? (errorIssues as Array<{
              severity: string;
              code: string;
              message: string;
              path?: string;
            }>)
          : [
              {
                severity: "error",
                code: "app.open_failed",
                message: error instanceof Error ? error.message : "Unable to open HTMLX package.",
              },
            ],
      );
    } finally {
      setBusy(false);
    }
  }

  function handleOpenInputChange(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) void openDocument(file);
    event.currentTarget.value = "";
  }

  function addParagraph(blockId = selectedBlockId) {
    const syncedBlocks = getDomSyncedBlocks();
    documentStateRef.current = { ...documentStateRef.current, blocks: syncedBlocks };
    const selectedIndex = syncedBlocks.findIndex(
      (block) => block.id === blockId && isTextBlock(block),
    );
    const anchor =
      selectedIndex >= 0
        ? syncedBlocks[selectedIndex]
        : [...syncedBlocks].reverse().find(isTextBlock);
    const id = createBlockId();
    const y = Math.min(
      DESIGN_HEIGHT - 120,
      anchor ? anchor.y + estimateBlockHeight(anchor) + 18 : nextParagraphY(syncedBlocks),
    );
    const newBlock: TextBlock = {
      id,
      type: "paragraph",
      text: "",
      html: "<br>",
      x: anchor && isTextBlock(anchor) ? anchor.x : 64,
      y,
      width: anchor && isTextBlock(anchor) ? anchor.width : 720,
      fontSize: 16,
      lineHeight: 1.5,
      color: "#526179",
    };
    const anchorElement = anchor ? getEditableBlockElement(anchor.id) : null;
    if (anchorElement) {
      recordHistory();
      const paragraph = document.createElement("p");
      paragraph.id = id;
      paragraph.className = textClassNameForNewParagraph(anchorElement);
      paragraph.dataset.htmlxBlockId = id;
      paragraph.dataset.htmlxKind = "paragraph";
      paragraph.dataset.htmlxEditable = "text";
      paragraph.dataset.htmlxX = String(newBlock.x);
      paragraph.dataset.htmlxY = String(newBlock.y);
      paragraph.dataset.htmlxWidth = String(newBlock.width);
      paragraph.dataset.htmlxFontSize = String(newBlock.fontSize);
      paragraph.dataset.htmlxLineHeight = String(newBlock.lineHeight);
      paragraph.dataset.htmlxColor = newBlock.color;
      paragraph.contentEditable = editing ? "true" : "false";
      paragraph.innerHTML = newBlock.html;
      anchorElement.after(paragraph);
      syncBlocksFromDom(id);
      requestAnimationFrame(() => {
        paragraph.focus();
        placeCaretAtEnd(paragraph);
      });
      return;
    }
    recordHistory();
    setBlocks(insertBlockAfter(syncedBlocks, selectedIndex, newBlock, 74));
    setSelectedBlockId(id);
  }

  async function replaceSelectedImage(file: File) {
    const selected = selectedBlock;
    if (!selected || selected.type !== "image") return;
    const asset = await fileToAsset(file);
    recordHistory();
    const selectedElement = getEditableBlockElement(selected.id);
    if (selectedElement) {
      selectedElement.dataset.htmlxAssetId = asset.id;
      const image = selectedElement.querySelector("img");
      if (image) {
        image.src = asset.dataUrl;
        image.alt = file.name;
        image.dataset.htmlxOriginalSrc = asset.path;
      }
    }
    setAssets((current) => [...current, asset]);
    setBlocks((current) =>
      current.map((block) =>
        block.id === selected.id && block.type === "image"
          ? { ...block, assetId: asset.id, alt: file.name }
          : block,
      ),
    );
  }

  function deleteSelectedBlock() {
    const selected = selectedBlock;
    if (!selected) return;
    deleteBlockById(selected.id);
  }

  function deleteBlockById(blockId: string) {
    const syncedBlocks = getDomSyncedBlocks();
    const selected = syncedBlocks.find((block) => block.id === blockId);
    if (!selected) return;
    documentStateRef.current = { ...documentStateRef.current, blocks: syncedBlocks };
    recordHistory();
    const selectedElement = getEditableBlockElement(blockId);
    if (selectedElement) {
      selectedElement.remove();
      const remaining = syncBlocksFromDom("");
      setSelectedBlockId(remaining.find(isTextBlock)?.id ?? remaining[0]?.id ?? "");
      return;
    }
    const next = syncedBlocks.filter((block) => block.id !== blockId);
    setBlocks(next);
    setSelectedBlockId(next.find(isTextBlock)?.id ?? next[0]?.id ?? "");
  }

  function duplicateSelectedTextBlock() {
    const selected = selectedBlock;
    if (!selected || !isTextBlock(selected)) return;
    const syncedBlocks = getDomSyncedBlocks();
    const index = syncedBlocks.findIndex((block) => block.id === selected.id);
    const source = syncedBlocks[index];
    if (!source || !isTextBlock(source)) return;
    const id = createBlockId();
    const duplicate: TextBlock = {
      ...source,
      id,
      y: Math.min(DESIGN_HEIGHT - 120, source.y + estimateBlockHeight(source) + 18),
    };
    documentStateRef.current = { ...documentStateRef.current, blocks: syncedBlocks };
    const sourceElement = getEditableBlockElement(source.id);
    if (sourceElement) {
      recordHistory();
      const clone = sourceElement.cloneNode(true) as HTMLElement;
      clone.id = id;
      clone.dataset.htmlxBlockId = id;
      clone.dataset.htmlxY = String(duplicate.y);
      clone.contentEditable = editing ? "true" : "false";
      sourceElement.after(clone);
      syncBlocksFromDom(id);
      requestAnimationFrame(() => clone.focus());
      return;
    }
    recordHistory();
    setBlocks(insertBlockAfter(syncedBlocks, index, duplicate, 74));
    setSelectedBlockId(id);
  }

  function toggleSelectedTextType() {
    const selected = selectedBlock;
    if (!selected || !isTextBlock(selected)) return;
    const syncedBlocks = getDomSyncedBlocks();
    documentStateRef.current = { ...documentStateRef.current, blocks: syncedBlocks };
    const selectedElement = getEditableBlockElement(selected.id);
    if (selectedElement) {
      const nextType: TextBlockType = selected.type === "heading" ? "paragraph" : "heading";
      recordHistory();
      const replacement = document.createElement(nextType === "heading" ? "h2" : "p");
      copyAttributes(selectedElement, replacement);
      replacement.id = selected.id;
      replacement.dataset.htmlxBlockId = selected.id;
      replacement.dataset.htmlxKind = nextType;
      replacement.dataset.htmlxEditable = "text";
      replacement.dataset.htmlxFontSize =
        nextType === "heading"
          ? String(Math.max(selected.fontSize, 25))
          : String(Math.min(selected.fontSize, 18));
      replacement.dataset.htmlxLineHeight = nextType === "heading" ? "1.3" : "1.5";
      replacement.dataset.htmlxColor =
        nextType === "heading" ? (selected.color ?? "#172033") : (selected.color ?? "#526179");
      replacement.contentEditable = editing ? "true" : "false";
      replacement.innerHTML = selectedElement.innerHTML;
      selectedElement.replaceWith(replacement);
      syncBlocksFromDom(selected.id);
      requestAnimationFrame(() => replacement.focus());
      return;
    }
    recordHistory();
    setBlocks(
      syncedBlocks.map((block) => {
        if (block.id !== selected.id || !isTextBlock(block)) return block;
        const nextType: TextBlockType = block.type === "heading" ? "paragraph" : "heading";
        return {
          ...block,
          type: nextType,
          fontSize:
            nextType === "heading" ? Math.max(block.fontSize, 25) : Math.min(block.fontSize, 18),
          lineHeight: nextType === "heading" ? 1.3 : 1.5,
          color: nextType === "heading" ? (block.color ?? "#172033") : (block.color ?? "#526179"),
        };
      }),
    );
  }

  function updateSelectedTextTypography(patch: {
    fontSize?: number;
    fontSizeDelta?: number;
    color?: string;
  }) {
    const activeEditable = getActiveEditableContext();
    const selectedTextBlock = selectedBlock && isTextBlock(selectedBlock) ? selectedBlock : null;
    const activeTextId =
      activeEditable?.editable.dataset.htmlxEditable === "text" ? activeEditable.blockId : "";
    const activeTextBlock = activeTextId
      ? getDomSyncedBlocks().find(
          (block): block is TextBlock => block.id === activeTextId && isTextBlock(block),
        )
      : null;
    const selected = activeTextBlock ?? selectedTextBlock;
    if (!selected || !isTextBlock(selected)) return;
    const syncedBlocks = getDomSyncedBlocks();
    documentStateRef.current = { ...documentStateRef.current, blocks: syncedBlocks };
    const selectedElement =
      activeTextBlock && activeEditable?.editable.dataset.htmlxEditable === "text"
        ? activeEditable.editable
        : getEditableBlockElement(selected.id);
    if (selectedElement) {
      recordHistory();
      if (patch.fontSize !== undefined || patch.fontSizeDelta !== undefined) {
        const previousFontSize = readNumber(
          selectedElement.dataset.htmlxFontSize,
          selected.fontSize,
        );
        const fontSize = clamp(
          patch.fontSize ?? previousFontSize + (patch.fontSizeDelta ?? 0),
          10,
          72,
        );
        selectedElement.dataset.htmlxFontSize = String(fontSize);
        selectedElement.style.fontSize = `${toCqw(fontSize)}cqw`;
        scaleInlineFontSizes(
          selectedElement,
          previousFontSize > 0 ? fontSize / previousFontSize : 1,
        );
      }
      if (patch.color) {
        selectedElement.dataset.htmlxColor = patch.color;
        selectedElement.style.color = patch.color;
      }
      pruneEmptyInlineSpans(selectedElement);
      setActiveTextTypography(
        readActiveInlineTypography(selectedElement, documentFrameRef.current),
      );
      syncBlocksFromDom(selected.id);
      return;
    }
    recordHistory();
    setBlocks(
      syncedBlocks.map((block) =>
        block.id === selected.id && isTextBlock(block)
          ? {
              ...block,
              color: patch.color ?? block.color,
              fontSize:
                patch.fontSize !== undefined
                  ? clamp(patch.fontSize, 10, 72)
                  : patch.fontSizeDelta === undefined
                    ? block.fontSize
                    : clamp(block.fontSize + patch.fontSizeDelta, 10, 72),
            }
          : block,
      ),
    );
  }

  function updateSelectedTextRangeTypography(patch: {
    fontSizeCqw?: number;
    fontSizeDelta?: number;
    color?: string;
  }) {
    const activeEditable = getActiveEditableContext();
    if (!editing || activeEditable?.editable.dataset.htmlxEditable !== "text") return;
    const { editable, blockId } = activeEditable;
    if (!hasNonCollapsedTextSelection(editable)) {
      const preserved = preservedInlineTextSelectionRef.current;
      if (preserved?.blockId === blockId) {
        restoreTextSelection({ ...preserved, element: editable });
      }
    }
    if (!hasNonCollapsedTextSelection(editable)) return;
    const inlinePatch: InlineTypographyPatch = {};
    if (patch.fontSizeCqw !== undefined || patch.fontSizeDelta !== undefined) {
      const currentFontSize = readActiveInlineTypography(
        editable,
        documentFrameRef.current,
      ).fontSizeCqw;
      inlinePatch.fontSizeCqw = clamp(
        Math.round((patch.fontSizeCqw ?? currentFontSize + (patch.fontSizeDelta ?? 0)) * 100) / 100,
        0.7,
        8,
      );
    }
    if (patch.color) inlinePatch.color = patch.color;
    if (!activeTextHistoryRef.current.has(blockId)) {
      recordHistory();
      activeTextHistoryRef.current.add(blockId);
    }
    if (
      !applyInlineTypographyToSelection(editable, inlinePatch) &&
      !applyInlineTypographyToPreservedSelection(
        editable,
        preservedInlineTextSelectionRef.current,
        inlinePatch,
      )
    ) {
      return;
    }
    pruneEmptyInlineSpans(editable);
    setSelectedBlockId(blockId);
    setActiveInlineTextTarget(blockId, editable);
    syncBlocksFromDom(blockId);
  }

  function updateActiveObjectTextTypography(
    patch: { fontSizeCqw?: number; fontSizeDelta?: number; color?: string },
    scope: "block" | "selection" = "block",
  ) {
    const activeEditable = getActiveEditableContext();
    if (!editing || activeEditable?.editable.dataset.htmlxObjectText !== "true") return;
    const { editable, blockId } = activeEditable;
    if (!activeTextHistoryRef.current.has(blockId)) {
      recordHistory();
      activeTextHistoryRef.current.add(blockId);
    }
    editable.focus();
    setSelectedBlockId(blockId);
    setActiveInlineTextTarget(blockId, editable);
    const inlinePatch: InlineTypographyPatch = {};
    if (patch.fontSizeCqw !== undefined || patch.fontSizeDelta !== undefined) {
      const currentFontSize = readObjectTextFontSizeCqw(editable, documentFrameRef.current);
      const nextFontSize = clamp(
        Math.round((patch.fontSizeCqw ?? currentFontSize + (patch.fontSizeDelta ?? 0)) * 100) / 100,
        0.7,
        8,
      );
      inlinePatch.fontSizeCqw = nextFontSize;
    }
    if (patch.color) inlinePatch.color = patch.color;
    let appliedSelectionTypography = false;
    if (scope === "selection") {
      if (!hasNonCollapsedTextSelection(editable)) {
        const preserved = preservedInlineTextSelectionRef.current;
        if (preserved?.blockId === blockId) {
          restoreTextSelection({ ...preserved, element: editable });
        }
      }
      appliedSelectionTypography =
        applyInlineTypographyToSelection(editable, inlinePatch) ||
        applyInlineTypographyToPreservedSelection(
          editable,
          preservedInlineTextSelectionRef.current,
          inlinePatch,
        );
    }
    if (scope !== "selection" || !appliedSelectionTypography) {
      if (inlinePatch.fontSizeCqw !== undefined) {
        const previousFontSize = readObjectTextFontSizeCqw(editable, documentFrameRef.current);
        editable.style.fontSize = `${inlinePatch.fontSizeCqw}cqw`;
        scaleInlineFontSizes(editable, inlinePatch.fontSizeCqw / previousFontSize);
      }
      if (inlinePatch.color) {
        editable.style.color = inlinePatch.color;
      }
    }
    pruneEmptyInlineSpans(editable);
    setActiveTextTypography(readActiveInlineTypography(editable, documentFrameRef.current));
    setActiveObjectTextTypography(readActiveInlineTypography(editable, documentFrameRef.current));
    syncBlocksFromDom(blockId);
  }

  function applyInlineFormat(
    command: "bold" | "italic" | "underline",
    blockId = getActiveTextBlockId(),
  ) {
    const activeEditable = getActiveEditableContext();
    if (editing && activeEditable?.editable.dataset.htmlxObjectText === "true") {
      if (!activeTextHistoryRef.current.has(activeEditable.blockId)) {
        recordHistory();
        activeTextHistoryRef.current.add(activeEditable.blockId);
      }
      activeEditable.editable.focus();
      setSelectedBlockId(activeEditable.blockId);
      setActiveInlineTextTarget(activeEditable.blockId, activeEditable.editable);
      if (!applySemanticInlineFormat(activeEditable.editable, command)) {
        document.execCommand(command);
      }
      pruneEmptyInlineSpans(activeEditable.editable);
      syncBlocksFromDom(activeEditable.blockId);
      return;
    }
    const targetBlockId =
      blockId || (selectedBlock && isTextBlock(selectedBlock) ? selectedBlock.id : "");
    if (!editing || !targetBlockId) return;
    const textBlock = getDomSyncedBlocks().find(
      (block): block is TextBlock => block.id === targetBlockId && isTextBlock(block),
    );
    if (!textBlock) return;
    const shadowRoot = documentFrameRef.current?.shadowRoot;
    const shadowActiveElement = shadowRoot?.activeElement;
    const activeElement =
      shadowActiveElement instanceof HTMLElement ? shadowActiveElement : document.activeElement;
    const editableElement =
      activeElement instanceof HTMLElement
        ? activeElement.closest<HTMLElement>('[data-htmlx-editable="text"]')
        : null;
    const editableRoot = stageRef.current ?? shadowRoot;
    const target =
      editableElement?.dataset.htmlxBlockId === textBlock.id
        ? editableElement
        : editableRoot?.querySelector<HTMLElement>(
            `[data-htmlx-block-id="${CSS.escape(textBlock.id)}"][data-htmlx-editable="text"]`,
          );
    if (!target) return;
    if (!activeTextHistoryRef.current.has(textBlock.id)) {
      recordHistory();
      activeTextHistoryRef.current.add(textBlock.id);
    }
    target.focus();
    setSelectedBlockId(textBlock.id);
    if (!applySemanticInlineFormat(target, command)) {
      document.execCommand(command);
    }
    pruneEmptyInlineSpans(target);
    const html = sanitizeInlineHtml(target.innerHTML);
    const text = plainTextFromInlineHtml(html);
    textDraftsRef.current.set(textBlock.id, html);
    documentStateRef.current = {
      ...documentStateRef.current,
      blocks: documentStateRef.current.blocks.map((block) =>
        block.id === textBlock.id && isTextBlock(block) ? { ...block, html, text } : block,
      ),
      selectedBlockId: textBlock.id,
    };
  }

  function updateSelectedShapeFill(fill: string) {
    const selected = selectedBlock;
    if (!selected || selected.type !== "shape") return;
    if (selected.fill === fill) return;
    recordHistory();
    const selectedElement = getEditableBlockElement(selected.id);
    if (selectedElement) {
      selectedElement.dataset.htmlxFill = fill;
      selectedElement.style.background = fill;
      syncBlocksFromDom(selected.id);
      return;
    }
    setBlocks((current) =>
      current.map((block) =>
        block.id === selected.id && block.type === "shape" ? { ...block, fill } : block,
      ),
    );
  }

  function startDrag(event: PointerEvent<HTMLElement>, block: ObjectBlock) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedBlockId(block.id);
    const nextDragState: DragState = {
      mode: "move",
      blockId: block.id,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originX: block.x,
      originY: block.y,
      originWidth: block.width,
      originHeight: "height" in block ? block.height : estimateObjectHeight(block),
      historyRecorded: false,
    };
    dragStateRef.current = nextDragState;
  }

  function startResize(event: PointerEvent<HTMLElement>, block: ObjectBlock) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedBlockId(block.id);
    const nextDragState: DragState = {
      mode: "resize",
      blockId: block.id,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originX: block.x,
      originY: block.y,
      originWidth: block.width,
      originHeight: "height" in block ? block.height : estimateObjectHeight(block),
      historyRecorded: false,
    };
    dragStateRef.current = nextDragState;
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    const currentDragState = dragStateRef.current;
    if (!currentDragState) return;
    const scale = getStageScale(stageRef.current);
    const deltaX = (event.clientX - currentDragState.originClientX) / scale;
    const deltaY = (event.clientY - currentDragState.originClientY) / scale;
    if (!currentDragState.historyRecorded) {
      recordHistory();
      currentDragState.historyRecorded = true;
    }
    if (currentDragState.mode === "move") {
      setBlocks((current) =>
        current.map((block) =>
          block.id === currentDragState.blockId && isObjectBlock(block)
            ? {
                ...block,
                x: clamp(Math.round(currentDragState.originX + deltaX), 0, DESIGN_WIDTH - 24),
                y: clamp(Math.round(currentDragState.originY + deltaY), 0, DESIGN_HEIGHT - 24),
              }
            : block,
        ),
      );
      return;
    }
    setBlocks((current) =>
      current.map((block) =>
        block.id === currentDragState.blockId && isObjectBlock(block)
          ? resizeObjectBlock(
              block,
              currentDragState.originWidth + deltaX,
              (currentDragState.originHeight ?? 96) + deltaY,
            )
          : block,
      ),
    );
  }

  function stopDrag() {
    dragStateRef.current = null;
  }

  function startFigureCardDrag(
    event: PointerEvent<HTMLElement>,
    figure: FigureBlock,
    cardIndex: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    beginFigureCardDrag(event.clientX, event.clientY, figure, cardIndex);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window-level drag listeners keep the interaction working if capture is unavailable.
    }
  }

  function startFigureCardMouseDrag(
    event: MouseEvent<HTMLElement>,
    figure: FigureBlock,
    cardIndex: number,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginFigureCardDrag(event.clientX, event.clientY, figure, cardIndex);
  }

  function beginFigureCardDrag(
    clientX: number,
    clientY: number,
    figure: FigureBlock,
    cardIndex: number,
  ) {
    setSelectedBlockId(figure.id);
    const card = figure.cards[cardIndex];
    const nextDragState = {
      figureId: figure.id,
      cardIndex,
      originClientX: clientX,
      originClientY: clientY,
      originX: card.x,
      originY: card.y,
      historyRecorded: false,
    };
    figureCardDragStateRef.current = nextDragState;
  }

  function updateFigureCardDrag(event: PointerEvent<HTMLElement>) {
    updateFigureCardDragFromPoint(event.clientX, event.clientY);
    event.stopPropagation();
  }

  function updateFigureCardMouseDrag(event: MouseEvent<HTMLElement>) {
    updateFigureCardDragFromPoint(event.clientX, event.clientY);
    event.stopPropagation();
  }

  function updateFigureCardDragFromPoint(clientX: number, clientY: number) {
    const currentDragState = figureCardDragStateRef.current;
    if (!currentDragState) return;
    const scale = getStageScale(stageRef.current);
    const deltaX = (clientX - currentDragState.originClientX) / scale;
    const deltaY = (clientY - currentDragState.originClientY) / scale;
    if (!currentDragState.historyRecorded) {
      recordHistory();
      currentDragState.historyRecorded = true;
    }
    setBlocks((current) =>
      current.map((block) => {
        if (block.type !== "figure" || block.id !== currentDragState.figureId) return block;
        return {
          ...block,
          cards: block.cards.map((card, index) =>
            index === currentDragState.cardIndex
              ? {
                  ...card,
                  x: clamp(Math.round(currentDragState.originX + deltaX), 0, 720),
                  y: clamp(Math.round(currentDragState.originY + deltaY), 0, 420),
                }
              : card,
          ),
        };
      }),
    );
  }

  function stopFigureCardDrag() {
    figureCardDragStateRef.current = null;
  }

  function startToolbarDrag(event: PointerEvent<HTMLElement>, source: "menu" | "grip") {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    toolbarDragMovedRef.current = false;
    const nextDragState: ToolbarDragState = {
      source,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originX: toolbarPosition.x,
      originY: toolbarPosition.y,
      moved: false,
    };
    toolbarDragStateRef.current = nextDragState;
  }

  function updateToolbarDrag(event: PointerEvent<HTMLElement>) {
    const currentDragState = toolbarDragStateRef.current;
    if (!currentDragState) return;
    const deltaX = event.clientX - currentDragState.originClientX;
    const deltaY = event.clientY - currentDragState.originClientY;
    if (!currentDragState.moved && Math.hypot(deltaX, deltaY) < 4) return;
    if (!currentDragState.moved) {
      toolbarDragMovedRef.current = true;
      currentDragState.moved = true;
    }
    setToolbarPosition(
      clampToolbarPosition({
        x: currentDragState.originX + deltaX,
        y: currentDragState.originY + deltaY,
      }),
    );
  }

  function stopToolbarDrag() {
    const currentDragState = toolbarDragStateRef.current;
    if (currentDragState?.source === "menu" && !toolbarDragMovedRef.current) {
      setToolbarCollapsed((value) => !value);
    }
    toolbarDragMovedRef.current = false;
    toolbarDragStateRef.current = null;
  }

  async function exportPackage() {
    if (!canEdit) return;
    const syncedBlocks = getDomSyncedBlocks();
    setBlocks(syncedBlocks);
    const { archive, manifest } = await buildActivePackage(syncedBlocks);
    const { validateHtmlx } = await import("@openwebdoc/core");
    const validation = await validateHtmlx(archive);
    setIssues(validation.issues);
    setLastManifest(manifest);
    if (!validation.valid) {
      setDrawer("info");
      return;
    }
    const archiveCopy = new Uint8Array(archive.byteLength);
    archiveCopy.set(archive);
    const url = URL.createObjectURL(
      new Blob([archiveCopy.buffer as ArrayBuffer], {
        type: "application/vnd.openwebdoc.htmlx+zip",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(getTitle(syncedBlocks))}.htmlx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function validateCurrentPackage() {
    if (!canEdit) {
      setDrawer("info");
      return;
    }
    const syncedBlocks = getDomSyncedBlocks();
    setBlocks(syncedBlocks);
    const { archive, manifest } = await buildActivePackage(syncedBlocks);
    const { validateHtmlx } = await import("@openwebdoc/core");
    const validation = await validateHtmlx(archive);
    setIssues(validation.issues);
    setLastManifest(manifest);
    setDrawer("info");
  }

  async function buildActivePackage(syncedBlocks: DocumentBlock[]) {
    const currentHtml = serializeCurrentSurfaceHtml(getTitle(syncedBlocks));
    if (!currentHtml) return buildPackage(syncedBlocks, assets);
    return buildPackageFromHtml({
      html: currentHtml,
      css: documentCss || buildDocumentCss(syncedBlocks),
      stylesheetPath: stylesheetPathRef.current,
      blocks: syncedBlocks,
      assets,
      presentationMetadata,
    });
  }

  function serializeCurrentSurfaceHtml(title: string, options: { cleanForExport?: boolean } = {}) {
    const root = documentFrameRef.current?.shadowRoot;
    const documentElement = root?.querySelector<HTMLElement>(".htmlx-document, .htmlx-slide-deck");
    if (!documentElement) return null;
    const clone = documentElement.cloneNode(true) as HTMLElement;
    if (options.cleanForExport === false) {
      prepareDocumentCloneForHistory(clone);
    } else {
      prepareDocumentCloneForExport(clone, assets);
    }
    const stylesheetPath = stylesheetPathRef.current || "styles/document.css";
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="${escapeHtmlAttribute(stylesheetPath)}" />
  </head>
  <body>
    ${clone.outerHTML}
  </body>
</html>`;
  }

  function clearPresentationFocus() {
    setSelectedBlockId("");
    setActiveInlineTextTarget("");
    setActiveInlineTextSelection(false);
    setActiveTextTypography(null);
    setActiveObjectTextTypography(null);
    preservedInlineTextSelectionRef.current = null;

    const root = documentFrameRef.current?.shadowRoot ?? null;
    root
      ?.querySelectorAll<HTMLElement>("[data-htmlx-runtime-selected]")
      .forEach((element) => delete element.dataset.htmlxRuntimeSelected);
    if (root) removeRuntimeControls(root);
    const shadowSelection =
      root && "getSelection" in root
        ? (root as ShadowRoot & { getSelection: () => Selection | null }).getSelection()
        : null;
    shadowSelection?.removeAllRanges();
    window.getSelection()?.removeAllRanges();

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
    const shadowActiveElement = root?.activeElement;
    if (shadowActiveElement instanceof HTMLElement) shadowActiveElement.blur();
  }

  function enterPresentationMode() {
    if (!canPresent) return;
    presentationReturnEditingRef.current = editing;
    setDrawer("none");
    setToolbarCollapsed(true);
    clearPresentationFocus();
    setEditing(false);
    if (isSlideDeck) setCurrentSlideIndex(0);
    setPresentationNoticeKey((value) => value + 1);
    setPresentationMode(true);
  }

  function exitPresentationMode() {
    setPresentationMode(false);
    const shouldRestoreEditing = presentationReturnEditingRef.current && canEdit;
    presentationReturnEditingRef.current = false;
    setEditing(shouldRestoreEditing);
    clearPresentationFocus();
  }

  function setEditingMode(nextEditing: boolean) {
    if (nextEditing && !canEdit) return;
    if (nextEditing) captureSurfaceTextSelection();
    setEditing(nextEditing);
    if (!nextEditing) {
      setSelectedBlockId("");
      setActiveInlineTextTarget("");
    }
  }

  function clearSelection() {
    setSelectedBlockId("");
    setActiveInlineTextTarget("");
  }

  if (runtimeStatus === "empty") {
    return (
      <OpenScreen
        busy={busy}
        issues={issues}
        examples={BUNDLED_EXAMPLES}
        onOpenDocument={openDocument}
      />
    );
  }

  return (
    <main className={presentationMode ? "openwebdoc-shell presentation-mode" : "openwebdoc-shell"}>
      <input
        ref={openFileInputRef}
        className="hidden-file-input"
        type="file"
        accept=".htmlx,application/vnd.openwebdoc.htmlx+zip"
        onChange={handleOpenInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      {presentationMode ? (
        <PresentationNotice key={presentationNoticeKey} />
      ) : (
        <FloatingControls
          canEdit={canEdit}
          editing={editing}
          collapsed={toolbarCollapsed}
          position={toolbarPosition}
          selectedBlock={selectedBlock}
          activeInlineTextBlockId={activeInlineTextBlockId}
          activeInlineTextSelection={activeInlineTextSelection}
          activeTextTypography={activeTextTypography}
          activeObjectTextTypography={activeObjectTextTypography}
          canPresent={canPresent}
          onSetEditing={setEditingMode}
          onToggleCollapsed={() => setToolbarCollapsed((value) => !value)}
          onRequestOpen={() => openFileInputRef.current?.click()}
          onAddParagraph={addParagraph}
          onDuplicateText={duplicateSelectedTextBlock}
          onToggleTextType={toggleSelectedTextType}
          onFormatInline={applyInlineFormat}
          onTextFontSizeChange={(fontSize) => updateSelectedTextTypography({ fontSize })}
          onTextColorChange={(color) => updateSelectedTextTypography({ color })}
          onTextRangeFontSizeChange={(fontSizeCqw) =>
            updateSelectedTextRangeTypography({ fontSizeCqw })
          }
          onTextRangeColorChange={(color) => updateSelectedTextRangeTypography({ color })}
          onObjectTextFontSizeChange={(delta) =>
            updateActiveObjectTextTypography({ fontSizeCqw: delta }, "block")
          }
          onObjectTextRangeFontSizeChange={(delta) =>
            updateActiveObjectTextTypography({ fontSizeCqw: delta }, "selection")
          }
          onObjectTextColorChange={(color) => updateActiveObjectTextTypography({ color })}
          onObjectTextRangeColorChange={(color) =>
            updateActiveObjectTextTypography({ color }, "selection")
          }
          onReplaceImage={replaceSelectedImage}
          onValidate={() => void validateCurrentPackage()}
          onExport={() => void exportPackage()}
          onShowInfo={() => setDrawer("info")}
          onDeleteSelected={deleteSelectedBlock}
          onClearSelection={clearSelection}
          onShapeFillChange={updateSelectedShapeFill}
          onEnterPresentation={enterPresentationMode}
          onToolbarPointerDown={startToolbarDrag}
          onToolbarPointerMove={updateToolbarDrag}
          onToolbarPointerUp={stopToolbarDrag}
        />
      )}

      {readOnlyHtml ? (
        <iframe
          className="read-only-document-frame"
          title="HTMLX document"
          sandbox="allow-same-origin"
          data-editing={editing ? "true" : "false"}
          srcDoc={
            presentationMode && isSlideDeck
              ? buildPresentationSrcDoc(readOnlyHtml, currentSlideIndex)
              : readOnlyHtml
          }
        />
      ) : renderedDocumentHtml ? (
        <ShadowHtmlxDocument
          hostRef={documentFrameRef}
          html={renderedDocumentHtml}
          css={documentCss}
          assets={assets}
          editing={editing}
          presentationMode={presentationMode}
          presentationProfile={presentationMetadata?.profile}
          currentSlideIndex={currentSlideIndex}
          selectedBlockId={selectedBlockId}
          onSelectBlock={(blockId) => {
            setSelectedBlockId(blockId);
            if (!blockId) setActiveInlineTextTarget("");
          }}
          onBeforeDomMutation={recordHistory}
          onDomMutation={(blockId) => syncBlocksFromDom(blockId)}
          onActiveInlineTextChange={setActiveInlineTextTarget}
          onBeforeTextMutation={beginTextMutation}
          onTextDraft={rememberTextDraft}
          onTextCommit={commitTextDraft}
          onInsertParagraphAfter={addParagraph}
          onToggleEditing={() => setEditingMode(!editing)}
          onDeleteSelected={deleteSelectedBlock}
          onDeleteBlock={deleteBlockById}
          onUndo={undoDocument}
          onRedo={redoDocument}
          onExport={() => void exportPackage()}
          onFormatInline={applyInlineFormat}
        />
      ) : (
        <section className="document-stage-wrap" aria-label="HTMLX document">
          <main
            className="document-page"
            ref={stageRef}
            data-editing={editing ? "true" : "false"}
            onPointerDownCapture={(event) => {
              const target = event.target as HTMLElement;
              const cardElement = target.closest<HTMLElement>(".figure-card");
              const figureElement = target.closest<HTMLElement>('[data-htmlx-kind="figure"]');
              if (editing && cardElement && figureElement?.dataset.htmlxBlockId) {
                const figure = documentStateRef.current.blocks.find(
                  (block): block is FigureBlock =>
                    block.type === "figure" && block.id === figureElement.dataset.htmlxBlockId,
                );
                const cardIndex = Number(cardElement.dataset.htmlxCardIndex);
                if (figure && Number.isFinite(cardIndex)) {
                  startFigureCardDrag(event, figure, cardIndex);
                  return;
                }
              }
              if (!target.closest("[data-htmlx-block-id]")) {
                clearSelection();
              }
            }}
          >
            {documentCss ? <style>{scopeDocumentCssForRuntime(documentCss)}</style> : null}
            <style>{EDITABLE_RUNTIME_TEXT_OVERRIDES}</style>
            <section className="object-layer" aria-label="Document grouped objects">
              {objectBlocks.map((block) => (
                <GroupedObject
                  key={block.id}
                  block={block}
                  assets={assets}
                  selected={block.id === selectedBlockId}
                  editing={editing}
                  onPointerDown={startDrag}
                  onPointerMove={updateDrag}
                  onPointerUp={stopDrag}
                  onResize={startResize}
                  onFigureCardPointerDown={startFigureCardDrag}
                  onFigureCardPointerMove={updateFigureCardDrag}
                  onFigureCardPointerUp={stopFigureCardDrag}
                  onFigureCardMouseDown={startFigureCardMouseDrag}
                  onFigureCardMouseMove={updateFigureCardMouseDrag}
                  onFigureCardMouseUp={stopFigureCardDrag}
                />
              ))}
            </section>

            <section className="text-layer" aria-label="Document text">
              {textBlocks.map((block) => (
                <EditableTextBlock
                  key={block.id}
                  block={block}
                  editing={editing}
                  selected={block.id === selectedBlockId}
                  onSelect={() => setSelectedBlockId(block.id)}
                  onDraft={rememberTextDraft}
                  onCommit={commitTextDraft}
                  onInsertParagraphAfter={addParagraph}
                  onDeleteBlock={deleteBlockById}
                />
              ))}
            </section>
          </main>
        </section>
      )}

      {drawer === "info" && !presentationMode ? (
        <DocumentDrawer
          title={title}
          blockCount={blocks.length}
          objectCount={objectBlocks.length}
          wordCount={wordCount}
          manifest={lastManifest}
          issues={issues}
          onClose={() => setDrawer("none")}
        />
      ) : null}
    </main>
  );
}

function OpenScreen({
  busy,
  issues,
  examples,
  onOpenDocument,
}: {
  busy: boolean;
  issues: Array<{ severity: string; code: string; message: string; path?: string }>;
  examples: typeof BUNDLED_EXAMPLES;
  onOpenDocument: (file: File) => Promise<void>;
}) {
  const openInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    function handleOpenShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o" && !event.altKey) {
        event.preventDefault();
        openInputRef.current?.click();
      }
    }
    window.addEventListener("keydown", handleOpenShortcut, true);
    return () => window.removeEventListener("keydown", handleOpenShortcut, true);
  }, []);

  return (
    <main className="open-screen">
      <section className="open-card" aria-label="Open document package">
        <p className="open-eyebrow">OpenWebDoc</p>
        <h1>Open a document package</h1>
        <p>
          Choose a local HTMLX package. OpenWebDoc shows the document first, then enables light
          direct edits when the package declares them.
        </p>
        <label className="open-file-button">
          <Upload size={18} />
          <span>{busy ? "Opening..." : "Choose file"}</span>
          <input
            ref={openInputRef}
            type="file"
            accept=".htmlx,application/vnd.openwebdoc.htmlx+zip"
            disabled={busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void onOpenDocument(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {issues.length ? (
          <section className="open-error" role="alert" aria-label="Validation failed">
            <div className="open-error-title">
              <AlertTriangle size={18} />
              <strong>File could not be opened.</strong>
            </div>
            <ul>
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <code>{issue.code}</code>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="example-gallery" aria-label="Bundled examples">
          <h2>Try a bundled example</h2>
          <div className="example-list">
            {examples.map((example) => (
              <a key={example.id} href={`?example=${example.id}`}>
                <strong>{example.title}</strong>
                <span>{example.type}</span>
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function PresentationNotice() {
  return (
    <div className="presentation-notice" role="status" aria-live="polite">
      Press Esc to exit presentation mode.
    </div>
  );
}

function ShadowHtmlxDocument({
  hostRef,
  html,
  css,
  assets,
  editing,
  presentationMode,
  presentationProfile,
  currentSlideIndex,
  selectedBlockId,
  onSelectBlock,
  onBeforeDomMutation,
  onDomMutation,
  onBeforeTextMutation,
  onTextDraft,
  onTextCommit,
  onInsertParagraphAfter,
  onToggleEditing,
  onDeleteSelected,
  onDeleteBlock,
  onUndo,
  onRedo,
  onExport,
  onFormatInline,
  onActiveInlineTextChange,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  html: string;
  css: string;
  assets: AssetState[];
  editing: boolean;
  presentationMode: boolean;
  presentationProfile?: "slide-deck";
  currentSlideIndex: number;
  selectedBlockId: string;
  onSelectBlock: (blockId: string) => void;
  onBeforeDomMutation: () => void;
  onDomMutation: (blockId: string) => void;
  onBeforeTextMutation: (blockId: string) => void;
  onTextDraft: (blockId: string, html: string) => void;
  onTextCommit: (blockId: string) => void;
  onInsertParagraphAfter: (blockId: string) => void;
  onToggleEditing: () => void;
  onDeleteSelected: () => void;
  onDeleteBlock: (blockId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onFormatInline: (command: "bold" | "italic" | "underline") => void;
  onActiveInlineTextChange: (blockId: string, element?: HTMLElement | null) => void;
}) {
  const shadowDragStateRef = useRef<{
    mode: "move" | "resize" | "card";
    element: HTMLElement;
    blockId: string;
    originClientX: number;
    originClientY: number;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
    resizeDirection?: ResizeDirection;
    recorded: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const parsed = new DOMParser().parseFromString(html, "text/html");
    rewritePackageLocalAssetsForRuntime(parsed, assets);
    markImplicitEditableText(parsed);
    const headContent = Array.from(parsed.head.querySelectorAll("style"))
      .map((element) => element.outerHTML)
      .join("\n");
    const packageCss = css.trim() ? `<style data-openwebdoc-package-css>${css}</style>` : "";
    shadow.innerHTML = `<style>:host { display: block; width: 100%; }</style>${packageCss}${headContent}<style data-openwebdoc-runtime-style>
      :host([data-presentation="true"][data-presentation-profile="slide-deck"]) {
        display: block;
        width: 100%;
        min-height: 100vh;
        background: #000000;
      }
      :host([data-presentation="true"][data-presentation-profile="slide-deck"]) .htmlx-slide-deck {
        display: grid !important;
        width: 100vw !important;
        max-width: none !important;
        min-height: 100vh !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        place-items: center !important;
        overflow: hidden !important;
        background: #000000 !important;
      }
      :host([data-presentation="true"][data-presentation-profile="slide-deck"]) .htmlx-slide {
        display: none !important;
        width: min(100vw, calc(100vh * 16 / 9)) !important;
        height: min(100vh, calc(100vw * 9 / 16)) !important;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
      }
      :host([data-presentation="true"][data-presentation-profile="slide-deck"]) .htmlx-slide[data-openwebdoc-slide-active="true"] {
        display: block !important;
      }
      :host([data-editing="true"]) [data-htmlx-editable="text"][contenteditable="true"]:hover,
      :host([data-editing="true"]) [data-htmlx-object-text="true"][contenteditable="true"]:hover {
        border-radius: 0.55cqw;
        background: rgba(47, 111, 237, 0.055);
        outline-color: rgba(47, 111, 237, 0.22);
      }
      :host([data-editing="true"]) [data-htmlx-editable="object"]:not([data-htmlx-runtime-selected="true"]):hover,
      :host([data-editing="true"]) [data-htmlx-editable="object"]:not([data-htmlx-runtime-selected="true"]):focus-visible {
        outline: 0.24cqw solid rgba(47, 111, 237, 0.36);
        outline-offset: 0.18cqw;
        box-shadow: 0 0 0 0.42cqw rgba(47, 111, 237, 0.06);
        cursor: pointer;
      }
      :host([data-editing="true"]) [data-htmlx-runtime-selected="true"] {
        outline: 0.38cqw solid rgba(47, 111, 237, 0.78);
        outline-offset: 0.3cqw;
      }
      :host([data-editing="true"]) [data-htmlx-editable="object"][data-htmlx-runtime-selected="true"] {
        cursor: default;
        overflow: visible !important;
        position: relative !important;
      }
      :host([data-editing="true"]) [data-htmlx-editable="object"][data-htmlx-runtime-selected="true"] .figure-card {
        position: relative;
      }
      :host([data-editing="true"]) [data-htmlx-object-text="true"][contenteditable="true"] {
        cursor: text;
        outline: 0.18cqw solid transparent;
        outline-offset: 0.18cqw;
        user-select: text;
        -webkit-user-select: text;
      }
      :host([data-editing="true"]) [data-htmlx-object-text="true"][contenteditable="true"]:focus {
        outline-color: rgba(47, 111, 237, 0.45);
      }
      [data-openwebdoc-runtime-control="resize"] {
        position: absolute;
        z-index: 2147483647;
        width: 1.35cqw;
        height: 1.35cqw;
        min-width: 11px;
        min-height: 11px;
        border: 0.22cqw solid #ffffff;
        border-radius: 999px;
        background: #102033;
        box-shadow: 0 0.55cqw 1.35cqw rgba(16, 32, 51, 0.24);
        pointer-events: auto;
        touch-action: none;
      }
      [data-htmlx-resize-handle="nw"] { left: 0; top: 0; cursor: nwse-resize; transform: translate(-50%, -50%); }
      [data-htmlx-resize-handle="n"] { left: 50%; top: 0; cursor: ns-resize; transform: translate(-50%, -50%); }
      [data-htmlx-resize-handle="ne"] { right: 0; top: 0; cursor: nesw-resize; transform: translate(50%, -50%); }
      [data-htmlx-resize-handle="e"] { right: 0; top: 50%; cursor: ew-resize; transform: translate(50%, -50%); }
      [data-htmlx-resize-handle="se"] { right: 0; bottom: 0; cursor: nwse-resize; transform: translate(50%, 50%); }
      [data-htmlx-resize-handle="s"] { left: 50%; bottom: 0; cursor: ns-resize; transform: translate(-50%, 50%); }
      [data-htmlx-resize-handle="sw"] { left: 0; bottom: 0; cursor: nesw-resize; transform: translate(-50%, 50%); }
      [data-htmlx-resize-handle="w"] { left: 0; top: 50%; cursor: ew-resize; transform: translate(-50%, -50%); }
      [data-openwebdoc-runtime-control="object-move"] {
        position: absolute;
        left: 50%;
        top: 0;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3.2cqw;
        height: 1.45cqw;
        min-width: 30px;
        min-height: 14px;
        border: 0.14cqw solid rgba(255, 255, 255, 0.86);
        border-radius: 999px;
        background: rgba(16, 32, 51, 0.88);
        box-shadow: 0 0.45cqw 1.1cqw rgba(16, 32, 51, 0.22);
        cursor: grab;
        pointer-events: auto;
        touch-action: none;
        transform: translate(-50%, -125%);
      }
      [data-openwebdoc-runtime-control="object-move"]::before {
        content: "";
        width: 48%;
        height: 0.16cqw;
        min-height: 1px;
        border-top: 0.16cqw solid rgba(255, 255, 255, 0.94);
        border-bottom: 0.16cqw solid rgba(255, 255, 255, 0.94);
      }
      [data-openwebdoc-runtime-control="card-move"] {
        position: absolute;
        top: 0.45cqw;
        right: 0.45cqw;
        z-index: 2147483647;
        width: 1.7cqw;
        height: 1.7cqw;
        min-width: 15px;
        min-height: 15px;
        border: 0.14cqw solid rgba(255, 255, 255, 0.86);
        border-radius: 999px;
        background: rgba(16, 32, 51, 0.88);
        box-shadow: 0 0.45cqw 1.1cqw rgba(16, 32, 51, 0.22);
        cursor: grab;
        pointer-events: auto;
        touch-action: none;
      }
      [data-openwebdoc-runtime-control="card-move"]::before,
      [data-openwebdoc-runtime-control="card-move"]::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 42%;
        height: 0.13cqw;
        min-height: 1px;
        background: #ffffff;
        transform: translate(-50%, -50%);
      }
      [data-openwebdoc-runtime-control="card-move"]::after {
        transform: translate(-50%, -50%) rotate(90deg);
      }
      @media (max-width: 520px) {
        [data-openwebdoc-runtime-control="resize"] {
          width: 14px;
          height: 14px;
        }
      }
    </style>${parsed.body.innerHTML}`;
    markImplicitEditableText(shadow);
    prepareObjectTextEditing(shadow);
  }, [hostRef, html, css]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const root = host?.shadowRoot ?? null;
    if (!host || !root) return;
    if (presentationProfile) {
      host.dataset.presentationProfile = presentationProfile;
      host.dataset.currentSlide = String(currentSlideIndex + 1);
    } else {
      delete host.dataset.presentationProfile;
      delete host.dataset.currentSlide;
    }
    root.querySelectorAll<HTMLElement>('[data-htmlx-kind="slide"]').forEach((slide, index) => {
      if (presentationMode && presentationProfile === "slide-deck" && index === currentSlideIndex) {
        slide.dataset.openwebdocSlideActive = "true";
      } else {
        slide.removeAttribute("data-openwebdoc-slide-active");
      }
    });
  }, [currentSlideIndex, hostRef, presentationMode, presentationProfile]);

  useLayoutEffect(() => {
    const root = hostRef.current?.shadowRoot ?? null;
    if (!root) return;
    prepareObjectTextEditing(root);
    removeRuntimeControls(root);
    root.querySelectorAll<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR).forEach((element) => {
      element.contentEditable = editing ? "true" : "false";
      element.style.outline = editing ? "2px solid transparent" : "";
      element.style.outlineOffset = editing ? "2px" : "";
      element.spellcheck = editing;
      element.tabIndex = editing ? 0 : -1;
    });
    root.querySelectorAll<HTMLElement>("[data-htmlx-editable='object']").forEach((element) => {
      element.style.cursor = editing ? "pointer" : "";
      element.tabIndex = editing ? 0 : -1;
    });
    root.querySelectorAll<HTMLElement>("[data-htmlx-block-id]").forEach((element) => {
      if (!element.dataset.htmlxKind && element.dataset.htmlxEditable !== "document") return;
      if (editing && element.dataset.htmlxBlockId === selectedBlockId) {
        element.dataset.htmlxRuntimeSelected = "true";
        if (editing && element.dataset.htmlxEditable === "object") {
          appendRuntimeObjectMoveHandle(element);
          appendRuntimeResizeHandles(element);
          if (element.dataset.htmlxKind === "figure") appendRuntimeFigureCardHandles(element);
        }
      } else {
        delete element.dataset.htmlxRuntimeSelected;
      }
    });

    function syncTextSelectionContext() {
      const context = getSelectedEditableContext(root);
      if (!context) return;
      onSelectBlock(context.blockId);
      onActiveInlineTextChange(context.blockId, context.element);
    }

    function handleFocus(event: globalThis.Event) {
      if (!editing) return;
      const target = event.target;
      if (!isElementLike(target)) return;
      const editable = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      const block = target.closest<HTMLElement>("[data-htmlx-block-id]");
      if (block?.dataset.htmlxBlockId) onSelectBlock(block.dataset.htmlxBlockId);
      if (editable && block?.dataset.htmlxBlockId)
        onActiveInlineTextChange(block.dataset.htmlxBlockId, editable);
      const objectText = target.closest<HTMLElement>('[data-htmlx-object-text="true"]');
      const blockId =
        objectText?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
      if (editing && blockId) onBeforeTextMutation(blockId);
    }

    function handleClick(event: globalThis.Event) {
      if (!editing) return;
      const target = event.target;
      if (!isElementLike(target)) return;
      const editable = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      const block = target.closest<HTMLElement>("[data-htmlx-block-id]");
      if (editable && block?.dataset.htmlxBlockId) {
        onActiveInlineTextChange(block.dataset.htmlxBlockId, editable);
      } else {
        onActiveInlineTextChange("");
      }
      onSelectBlock(block?.dataset.htmlxBlockId ?? "");
      syncTextSelectionContext();
      if (editable && block?.dataset.htmlxBlockId) {
        requestAnimationFrame(() => {
          onActiveInlineTextChange(block.dataset.htmlxBlockId!, editable);
          syncTextSelectionContext();
        });
      }
    }

    function handleBeforeInput(event: globalThis.Event) {
      if (!editing) return;
      const target = event.target;
      if (!isElementLike(target)) return;
      const editable = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      const blockId = editable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
      if (blockId) onBeforeTextMutation(blockId);
    }

    function handleInput(event: globalThis.Event) {
      const target = event.target;
      if (!isElementLike(target)) return;
      const editable = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      const blockId = editable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
      if (!blockId || !editable) return;
      onActiveInlineTextChange(blockId, editable);
      if (editable.dataset.htmlxEditable === "text") {
        onTextDraft(blockId, editable.innerHTML);
        return;
      }
      onSelectBlock(blockId);
    }

    function handleBlur(event: globalThis.Event) {
      const target = event.target;
      if (!isElementLike(target)) return;
      const editable = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      const blockId = editable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
      if (!blockId) return;
      onTextCommit(blockId);
      if (editable?.dataset.htmlxObjectText === "true") onDomMutation(blockId);
    }

    function handleKeyDown(event: globalThis.Event) {
      if (!editing || !(event instanceof globalThis.KeyboardEvent)) return;
      const key = event.key.toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && key === "z" && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (modifier && !event.altKey && !event.repeat) {
        if (key === "e") {
          event.preventDefault();
          event.stopPropagation();
          onToggleEditing();
          return;
        }
        if (key === "s") {
          event.preventDefault();
          event.stopPropagation();
          onExport();
          return;
        }
        if (key === "b" || key === "i" || key === "u") {
          event.preventDefault();
          event.stopPropagation();
          const target = event.target;
          const editable = isElementLike(target)
            ? target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR)
            : null;
          if (editable?.dataset.htmlxObjectText === "true") {
            const blockId =
              editable.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
            if (blockId) onBeforeTextMutation(blockId);
            if (
              !applySemanticInlineFormat(
                editable,
                key === "b" ? "bold" : key === "i" ? "italic" : "underline",
              )
            ) {
              document.execCommand(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
            }
            if (blockId) onDomMutation(blockId);
            return;
          }
          onFormatInline(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
          return;
        }
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "escape") {
        event.preventDefault();
        event.stopPropagation();
        onSelectBlock("");
        return;
      }
      const target = event.target;
      if (!isElementLike(target)) return;
      const editable = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      if (
        editable?.dataset.htmlxEditable === "text" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (key === "delete" || key === "backspace") &&
        normalizeInlineText(editable.textContent ?? "") === ""
      ) {
        const blockId =
          editable.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
        if (blockId) {
          event.preventDefault();
          event.stopPropagation();
          onDeleteBlock(blockId);
        }
        return;
      }
      if (
        editable?.dataset.htmlxObjectText === "true" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        isTextMutationKey(event)
      ) {
        const blockId =
          editable.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
        if (blockId) onBeforeTextMutation(blockId);
      }
      if (
        !editable &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (key === "delete" || key === "backspace")
      ) {
        event.preventDefault();
        event.stopPropagation();
        onDeleteSelected();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.key !== "Enter") return;
      const blockId = editable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
      if (!blockId || !editable) return;
      event.preventDefault();
      event.stopPropagation();
      onBeforeTextMutation(blockId);
      if (editable.dataset.htmlxObjectText === "true") {
        if (event.shiftKey) {
          insertLineBreakIntoEditable(editable);
          onDomMutation(blockId);
        }
        return;
      }
      if (event.shiftKey) {
        insertLineBreakIntoEditable(editable);
        onTextDraft(blockId, editable.innerHTML);
        return;
      }
      onTextDraft(blockId, editable.innerHTML);
      onTextCommit(blockId);
      onInsertParagraphAfter(blockId);
    }

    function handlePointerDown(event: globalThis.Event) {
      if (!editing || !isPointingEvent(event) || shadowDragStateRef.current) return;
      if (event instanceof globalThis.MouseEvent && event.button !== 0) return;
      const target = event.target;
      if (!isElementLike(target)) return;
      const resizeHandle = target.closest<HTMLElement>("[data-htmlx-resize-handle]");
      const objectMoveHandle = target.closest<HTMLElement>("[data-htmlx-object-move-handle]");
      const cardMoveHandle = target.closest<HTMLElement>("[data-htmlx-card-move-handle]");
      const editableTextTarget = target.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
      if (!resizeHandle && !objectMoveHandle && !cardMoveHandle && editableTextTarget) {
        if (editableTextTarget.dataset.htmlxObjectText === "true") {
          const blockId =
            editableTextTarget.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
          if (blockId) {
            onActiveInlineTextChange(blockId, editableTextTarget);
            onBeforeTextMutation(blockId);
          }
        }
        return;
      }
      onActiveInlineTextChange("");
      const object =
        resizeHandle?.closest<HTMLElement>('[data-htmlx-editable="object"]') ??
        objectMoveHandle?.closest<HTMLElement>('[data-htmlx-editable="object"]') ??
        target.closest<HTMLElement>('[data-htmlx-editable="object"]');
      const blockId = object?.dataset.htmlxBlockId;
      if (!object || !blockId) return;
      onSelectBlock(blockId);
      object.focus({ preventScroll: true });
      if (!resizeHandle && !objectMoveHandle && !cardMoveHandle) return;
      const card = cardMoveHandle?.closest<HTMLElement>(".figure-card") ?? null;
      if (cardMoveHandle && card && object.dataset.htmlxKind === "figure") {
        event.preventDefault();
        event.stopPropagation();
        onBeforeDomMutation();
        shadowDragStateRef.current = {
          mode: "card",
          element: card,
          blockId,
          originClientX: event.clientX,
          originClientY: event.clientY,
          originX: readNumber(card.dataset.htmlxCardX, 0),
          originY: readNumber(card.dataset.htmlxCardY, 0),
          originWidth: readNumber(card.dataset.htmlxCardWidth, card.getBoundingClientRect().width),
          originHeight: readNumber(
            card.dataset.htmlxCardHeight,
            card.getBoundingClientRect().height,
          ),
          recorded: true,
        };
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onBeforeDomMutation();
      const objectBox = object.getBoundingClientRect();
      shadowDragStateRef.current = {
        mode: resizeHandle ? "resize" : "move",
        element: object,
        blockId,
        originClientX: event.clientX,
        originClientY: event.clientY,
        originX: readNumber(object.dataset.htmlxX, 0),
        originY: readNumber(object.dataset.htmlxY, 0),
        originWidth: readNumber(object.dataset.htmlxWidth, objectBox.width),
        originHeight: readNumber(object.dataset.htmlxHeight, objectBox.height),
        resizeDirection: normalizeResizeDirection(resizeHandle?.dataset.htmlxResizeHandle),
        recorded: true,
      };
    }

    function handlePointerMove(event: globalThis.Event) {
      if (!isPointingEvent(event)) return;
      const dragState = shadowDragStateRef.current;
      if (!dragState) return;
      const hostWidth = hostRef.current?.getBoundingClientRect().width || DESIGN_WIDTH;
      const stageWidth = getElementStageWidth(dragState.element);
      const deltaX = ((event.clientX - dragState.originClientX) / hostWidth) * stageWidth;
      const deltaY = ((event.clientY - dragState.originClientY) / hostWidth) * stageWidth;
      if (!dragState.recorded) {
        onBeforeDomMutation();
        dragState.recorded = true;
      }
      if (dragState.mode === "resize") {
        const resized = resizeGeometryFromDirection(dragState, deltaX, deltaY);
        const originX = readNumber(
          dragState.element.dataset.htmlxRuntimeOriginX,
          dragState.originX,
        );
        const originY = readNumber(
          dragState.element.dataset.htmlxRuntimeOriginY,
          dragState.originY,
        );
        dragState.element.dataset.htmlxRuntimeOriginX = String(originX);
        dragState.element.dataset.htmlxRuntimeOriginY = String(originY);
        dragState.element.dataset.htmlxX = String(resized.x);
        dragState.element.dataset.htmlxY = String(resized.y);
        dragState.element.dataset.htmlxWidth = String(resized.width);
        dragState.element.dataset.htmlxHeight = String(resized.height);
        dragState.element.style.transform = `translate(${toStageCqw(
          resized.x - originX,
          stageWidth,
        )}cqw, ${toStageCqw(resized.y - originY, stageWidth)}cqw)`;
        dragState.element.style.width = `${toStageCqw(resized.width, stageWidth)}cqw`;
        dragState.element.style.height = `${toStageCqw(resized.height, stageWidth)}cqw`;
        return;
      }
      if (dragState.mode === "card") {
        const x = Math.round(dragState.originX + deltaX);
        const y = Math.round(dragState.originY + deltaY);
        dragState.element.dataset.htmlxCardX = String(x);
        dragState.element.dataset.htmlxCardY = String(y);
        dragState.element.style.transform = `translate(${toStageCqw(
          x - dragState.originX,
          stageWidth,
        )}cqw, ${toStageCqw(y - dragState.originY, stageWidth)}cqw)`;
        return;
      }
      const originX = readNumber(dragState.element.dataset.htmlxRuntimeOriginX, dragState.originX);
      const originY = readNumber(dragState.element.dataset.htmlxRuntimeOriginY, dragState.originY);
      const x = Math.round(dragState.originX + deltaX);
      const y = Math.round(dragState.originY + deltaY);
      dragState.element.dataset.htmlxRuntimeOriginX = String(originX);
      dragState.element.dataset.htmlxRuntimeOriginY = String(originY);
      dragState.element.dataset.htmlxX = String(x);
      dragState.element.dataset.htmlxY = String(y);
      dragState.element.style.transform = `translate(${toStageCqw(
        x - originX,
        stageWidth,
      )}cqw, ${toStageCqw(y - originY, stageWidth)}cqw)`;
    }

    function handlePointerUp() {
      const dragState = shadowDragStateRef.current;
      if (!dragState) {
        syncTextSelectionContext();
        return;
      }
      const blockId = dragState.blockId;
      const changed = dragState.recorded;
      shadowDragStateRef.current = null;
      if (changed) onDomMutation(blockId);
    }

    function handleSelectionChange() {
      syncTextSelectionContext();
    }

    root.addEventListener("focusin", handleFocus, true);
    root.addEventListener("click", handleClick, true);
    root.addEventListener("beforeinput", handleBeforeInput, true);
    root.addEventListener("input", handleInput, true);
    root.addEventListener("focusout", handleBlur, true);
    root.addEventListener("keydown", handleKeyDown, true);
    root.addEventListener("pointerdown", handlePointerDown, true);
    root.addEventListener("pointermove", handlePointerMove, true);
    root.addEventListener("pointerup", handlePointerUp, true);
    root.addEventListener("mousedown", handlePointerDown, true);
    root.addEventListener("mousemove", handlePointerMove, true);
    root.addEventListener("mouseup", handlePointerUp, true);
    root.addEventListener("keyup", handleSelectionChange, true);
    document.addEventListener("selectionchange", handleSelectionChange, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("mousemove", handlePointerMove, true);
    window.addEventListener("mouseup", handlePointerUp, true);
    return () => {
      root.removeEventListener("focusin", handleFocus, true);
      root.removeEventListener("click", handleClick, true);
      root.removeEventListener("beforeinput", handleBeforeInput, true);
      root.removeEventListener("input", handleInput, true);
      root.removeEventListener("focusout", handleBlur, true);
      root.removeEventListener("keydown", handleKeyDown, true);
      root.removeEventListener("pointerdown", handlePointerDown, true);
      root.removeEventListener("pointermove", handlePointerMove, true);
      root.removeEventListener("pointerup", handlePointerUp, true);
      root.removeEventListener("mousedown", handlePointerDown, true);
      root.removeEventListener("mousemove", handlePointerMove, true);
      root.removeEventListener("mouseup", handlePointerUp, true);
      root.removeEventListener("keyup", handleSelectionChange, true);
      document.removeEventListener("selectionchange", handleSelectionChange, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("mousemove", handlePointerMove, true);
      window.removeEventListener("mouseup", handlePointerUp, true);
    };
  }, [
    editing,
    hostRef,
    onActiveInlineTextChange,
    onBeforeDomMutation,
    onBeforeTextMutation,
    onDeleteSelected,
    onDomMutation,
    onExport,
    onFormatInline,
    onInsertParagraphAfter,
    onRedo,
    onSelectBlock,
    onTextCommit,
    onTextDraft,
    onToggleEditing,
    onUndo,
    selectedBlockId,
  ]);

  return (
    <section
      ref={hostRef}
      className="shadow-document-frame"
      data-editing={editing ? "true" : "false"}
      data-presentation={presentationMode ? "true" : "false"}
      data-presentation-profile={presentationProfile}
      data-current-slide={
        presentationProfile === "slide-deck" ? String(currentSlideIndex + 1) : undefined
      }
      aria-label="HTMLX document"
      tabIndex={-1}
    />
  );
}

function prepareObjectTextEditing(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>('[data-htmlx-editable="object"][data-htmlx-kind="shape"]')
    .forEach(wrapShapeObjectText);
  root.querySelectorAll<HTMLElement>(OBJECT_TEXT_TARGET_SELECTOR).forEach(markObjectTextElement);
}

function wrapShapeObjectText(shape: HTMLElement) {
  if (shape.querySelector("[data-htmlx-object-text='true']")) return;
  const editableNodes = Array.from(shape.childNodes).filter(
    (node) =>
      !(
        node instanceof HTMLElement &&
        node.getAttribute("data-openwebdoc-runtime-control") === "resize"
      ),
  );
  const hasVisibleContent = editableNodes.some((node) => (node.textContent ?? "").trim());
  if (!hasVisibleContent) return;
  const wrapper = document.createElement("span");
  wrapper.className = "htmlx-shape-text";
  for (const node of editableNodes) {
    wrapper.appendChild(node);
  }
  shape.appendChild(wrapper);
  markObjectTextElement(wrapper);
}

function markObjectTextElement(element: HTMLElement) {
  if (element.matches("figcaption") && element.querySelector("strong, span")) return;
  if (element.parentElement?.closest('[data-htmlx-object-text="true"]')) return;
  const block = element.closest<HTMLElement>("[data-htmlx-block-id]");
  const blockId = block?.dataset.htmlxBlockId;
  if (!blockId) return;
  element.dataset.htmlxObjectText = "true";
  if (element.dataset.htmlxEditable !== "text") delete element.dataset.htmlxBlockId;
}

function removeRuntimeControls(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>("[data-openwebdoc-runtime-control]")
    .forEach((element) => element.remove());
}

function appendRuntimeObjectMoveHandle(element: HTMLElement) {
  if (element.querySelector('[data-openwebdoc-runtime-control="object-move"]')) return;
  const handle = document.createElement("span");
  handle.dataset.openwebdocRuntimeControl = "object-move";
  handle.dataset.htmlxObjectMoveHandle = "true";
  handle.contentEditable = "false";
  handle.setAttribute("aria-hidden", "true");
  element.appendChild(handle);
}

function appendRuntimeResizeHandles(element: HTMLElement) {
  if (element.querySelector('[data-openwebdoc-runtime-control="resize"]')) return;
  for (const direction of RESIZE_DIRECTIONS) {
    const handle = document.createElement("span");
    handle.dataset.openwebdocRuntimeControl = "resize";
    handle.dataset.htmlxResizeHandle = direction;
    handle.contentEditable = "false";
    handle.setAttribute("aria-hidden", "true");
    element.appendChild(handle);
  }
}

function appendRuntimeFigureCardHandles(element: HTMLElement) {
  element.querySelectorAll<HTMLElement>(".figure-card").forEach((card) => {
    if (card.querySelector('[data-openwebdoc-runtime-control="card-move"]')) return;
    const handle = document.createElement("span");
    handle.dataset.openwebdocRuntimeControl = "card-move";
    handle.dataset.htmlxCardMoveHandle = "true";
    handle.contentEditable = "false";
    handle.setAttribute("aria-hidden", "true");
    card.appendChild(handle);
  });
}

function normalizeResizeDirection(value: string | undefined): ResizeDirection {
  return RESIZE_DIRECTIONS.includes(value as ResizeDirection) ? (value as ResizeDirection) : "se";
}

function resizeGeometryFromDirection(
  dragState: {
    resizeDirection?: ResizeDirection;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
  },
  deltaX: number,
  deltaY: number,
) {
  const direction = dragState.resizeDirection ?? "se";
  const minWidth = 32;
  const minHeight = 24;
  let x = dragState.originX;
  let y = dragState.originY;
  let width = dragState.originWidth;
  let height = dragState.originHeight;

  if (direction.includes("e")) {
    width = clamp(Math.round(dragState.originWidth + deltaX), minWidth, DESIGN_WIDTH - x);
  }
  if (direction.includes("s")) {
    height = clamp(Math.round(dragState.originHeight + deltaY), minHeight, DESIGN_HEIGHT - y);
  }
  if (direction.includes("w")) {
    width = clamp(Math.round(dragState.originWidth - deltaX), minWidth, dragState.originWidth + x);
    x = dragState.originX + dragState.originWidth - width;
  }
  if (direction.includes("n")) {
    height = clamp(
      Math.round(dragState.originHeight - deltaY),
      minHeight,
      dragState.originHeight + y,
    );
    y = dragState.originY + dragState.originHeight - height;
  }

  x = clamp(Math.round(x), 0, DESIGN_WIDTH - minWidth);
  y = clamp(Math.round(y), 0, DESIGN_HEIGHT - minHeight);
  width = clamp(Math.round(width), minWidth, DESIGN_WIDTH - x);
  height = clamp(Math.round(height), minHeight, DESIGN_HEIGHT - y);
  return { x, y, width, height };
}

function EditableTextBlock({
  block,
  editing,
  selected,
  onSelect,
  onDraft,
  onCommit,
  onInsertParagraphAfter,
  onDeleteBlock,
}: {
  block: TextBlock;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onDraft: (blockId: string, html: string) => void;
  onCommit: (blockId: string) => void;
  onInsertParagraphAfter: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    if (sanitizeInlineHtml(element.innerHTML) !== block.html) element.innerHTML = block.html;
  }, [block.html, block.id]);

  const sharedProps = {
    id: block.id,
    className: classNames(block.sourceClassName, selected && editing ? "selected-text" : ""),
    style: textObjectStyle(block),
    contentEditable: editing,
    "data-htmlx-block-id": block.id,
    "data-htmlx-kind": block.type,
    "data-htmlx-editable": "text",
    suppressContentEditableWarning: true,
    onFocus: onSelect,
    onInput: (event: FormEvent<HTMLElement>) => onDraft(block.id, event.currentTarget.innerHTML),
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (!editing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          document.execCommand("insertLineBreak");
          onDraft(block.id, event.currentTarget.innerHTML);
          return;
        }
        onDraft(block.id, event.currentTarget.innerHTML);
        onCommit(block.id);
        onInsertParagraphAfter(block.id);
        return;
      }
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        plainTextFromInlineHtml(event.currentTarget.innerHTML).trim() === ""
      ) {
        event.preventDefault();
        onDeleteBlock(block.id);
      }
    },
    onBlur: () => onCommit(block.id),
  };

  return block.type === "heading" ? (
    <h1
      ref={(element) => {
        ref.current = element;
      }}
      {...sharedProps}
    />
  ) : (
    <p
      ref={(element) => {
        ref.current = element;
      }}
      {...sharedProps}
    />
  );
}

function GroupedObject({
  block,
  assets,
  selected,
  editing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResize,
  onFigureCardPointerDown,
  onFigureCardPointerMove,
  onFigureCardPointerUp,
  onFigureCardMouseDown,
  onFigureCardMouseMove,
  onFigureCardMouseUp,
}: {
  block: ObjectBlock;
  assets: AssetState[];
  selected: boolean;
  editing: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>, block: ObjectBlock) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onResize: (event: PointerEvent<HTMLElement>, block: ObjectBlock) => void;
  onFigureCardPointerDown: (
    event: PointerEvent<HTMLElement>,
    figure: FigureBlock,
    cardIndex: number,
  ) => void;
  onFigureCardPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onFigureCardPointerUp: () => void;
  onFigureCardMouseDown: (
    event: MouseEvent<HTMLElement>,
    figure: FigureBlock,
    cardIndex: number,
  ) => void;
  onFigureCardMouseMove: (event: MouseEvent<HTMLElement>) => void;
  onFigureCardMouseUp: () => void;
}) {
  const className = classNames(
    "movable-object",
    objectClass(block),
    block.sourceClassName,
    selected && editing ? "selected-object" : "",
  );
  const shared = {
    id: block.id,
    className,
    style: objectStyle(block),
    "data-htmlx-block-id": block.id,
    "data-htmlx-kind": block.type,
    "data-htmlx-editable": "object",
    onPointerDown: editing
      ? (event: PointerEvent<HTMLElement>) => onPointerDown(event, block)
      : undefined,
    onPointerMove: editing ? onPointerMove : undefined,
    onPointerUp: editing ? onPointerUp : undefined,
    onPointerCancel: editing ? onPointerUp : undefined,
    onLostPointerCapture: editing ? onPointerUp : undefined,
  };
  const figureShared =
    block.type === "figure"
      ? {
          ...shared,
          onPointerMove: editing
            ? (event: PointerEvent<HTMLElement>) => {
                onFigureCardPointerMove(event);
                onPointerMove(event);
              }
            : undefined,
          onPointerUp: editing
            ? () => {
                onFigureCardPointerUp();
                onPointerUp();
              }
            : undefined,
          onPointerCancel: editing
            ? () => {
                onFigureCardPointerUp();
                onPointerUp();
              }
            : undefined,
          onLostPointerCapture: editing
            ? () => {
                onFigureCardPointerUp();
                onPointerUp();
              }
            : undefined,
        }
      : shared;

  if (block.type === "image") {
    const asset = assets.find((item) => item.id === block.assetId);
    return (
      <figure {...shared}>
        <DragHandle visible={editing && selected} />
        <img src={asset?.dataUrl} alt={block.alt} />
        <ResizeHandle
          visible={editing && selected}
          onPointerDown={(event) => onResize(event, block)}
        />
      </figure>
    );
  }

  if (block.type === "shape") {
    return (
      <div {...shared}>
        <DragHandle visible={editing && selected} />
        <ResizeHandle
          visible={editing && selected}
          onPointerDown={(event) => onResize(event, block)}
        />
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <figure {...shared}>
        <DragHandle visible={editing && selected} />
        <figcaption>
          <strong>{block.title}</strong>
          <span>{block.caption}</span>
        </figcaption>
        <table>
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${block.id}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${block.id}-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ResizeHandle
          visible={editing && selected}
          onPointerDown={(event) => onResize(event, block)}
        />
      </figure>
    );
  }

  return (
    <figure {...figureShared}>
      <DragHandle visible={editing && selected} />
      <figcaption>
        <strong>{block.title}</strong>
        <span>{block.caption}</span>
      </figcaption>
      <div className={`figure-grid ${block.variant}`}>
        {block.cards.map((card, cardIndex) => {
          const asset = assets.find((item) => item.id === card.iconAssetId);
          return (
            <div
              className="figure-card"
              key={`${block.id}-${card.title}`}
              style={figureCardStyle(card)}
              data-htmlx-card-index={cardIndex}
              onPointerDownCapture={
                editing ? (event) => onFigureCardPointerDown(event, block, cardIndex) : undefined
              }
              onPointerDown={
                editing ? (event) => onFigureCardPointerDown(event, block, cardIndex) : undefined
              }
              onPointerMove={editing ? onFigureCardPointerMove : undefined}
              onPointerUp={editing ? onFigureCardPointerUp : undefined}
              onPointerCancel={editing ? onFigureCardPointerUp : undefined}
              onMouseDownCapture={
                editing ? (event) => onFigureCardMouseDown(event, block, cardIndex) : undefined
              }
              onMouseDown={
                editing ? (event) => onFigureCardMouseDown(event, block, cardIndex) : undefined
              }
              onMouseMove={editing ? onFigureCardMouseMove : undefined}
              onMouseUp={editing ? onFigureCardMouseUp : undefined}
            >
              {asset ? <img src={asset.dataUrl} alt="" aria-hidden="true" /> : null}
              <strong>{card.title}</strong>
              <span>{card.body}</span>
            </div>
          );
        })}
      </div>
      <ResizeHandle
        visible={editing && selected}
        onPointerDown={(event) => onResize(event, block)}
      />
    </figure>
  );
}

function DragHandle({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="drag-handle" aria-hidden="true">
      <GripHorizontal size={14} />
    </span>
  );
}

function ResizeHandle({
  visible,
  onPointerDown,
}: {
  visible: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
}) {
  if (!visible) return null;
  return (
    <span
      className="resize-handle"
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
    />
  );
}

function FloatingControls({
  canEdit,
  editing,
  collapsed,
  position,
  selectedBlock,
  activeInlineTextBlockId,
  activeInlineTextSelection,
  activeTextTypography,
  activeObjectTextTypography,
  canPresent,
  onSetEditing,
  onToggleCollapsed,
  onRequestOpen,
  onAddParagraph,
  onDuplicateText,
  onToggleTextType,
  onFormatInline,
  onTextFontSizeChange,
  onTextRangeFontSizeChange,
  onTextColorChange,
  onTextRangeColorChange,
  onObjectTextFontSizeChange,
  onObjectTextRangeFontSizeChange,
  onObjectTextColorChange,
  onObjectTextRangeColorChange,
  onReplaceImage,
  onValidate,
  onExport,
  onShowInfo,
  onDeleteSelected,
  onClearSelection,
  onShapeFillChange,
  onEnterPresentation,
  onToolbarPointerDown,
  onToolbarPointerMove,
  onToolbarPointerUp,
}: {
  canEdit: boolean;
  editing: boolean;
  collapsed: boolean;
  position: ToolbarPosition;
  selectedBlock: DocumentBlock | undefined;
  activeInlineTextBlockId: string;
  activeInlineTextSelection: boolean;
  activeTextTypography: InlineTypographyState | null;
  activeObjectTextTypography: InlineTypographyState | null;
  canPresent: boolean;
  onSetEditing: (editing: boolean) => void;
  onToggleCollapsed: () => void;
  onRequestOpen: () => void;
  onAddParagraph: () => void;
  onDuplicateText: () => void;
  onToggleTextType: () => void;
  onFormatInline: (command: "bold" | "italic" | "underline") => void;
  onTextFontSizeChange: (fontSize: number) => void;
  onTextRangeFontSizeChange: (delta: number) => void;
  onTextColorChange: (color: string) => void;
  onTextRangeColorChange: (color: string) => void;
  onObjectTextFontSizeChange: (delta: number) => void;
  onObjectTextRangeFontSizeChange: (delta: number) => void;
  onObjectTextColorChange: (color: string) => void;
  onObjectTextRangeColorChange: (color: string) => void;
  onReplaceImage: (file: File) => Promise<void>;
  onValidate: () => void;
  onExport: () => void;
  onShowInfo: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onShapeFillChange: (fill: string) => void;
  onEnterPresentation: () => void;
  onToolbarPointerDown: (event: PointerEvent<HTMLElement>, source: "menu" | "grip") => void;
  onToolbarPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onToolbarPointerUp: () => void;
}) {
  const isTextSelected = selectedBlock !== undefined && isTextBlock(selectedBlock);
  const isImageSelected = selectedBlock?.type === "image";
  const isShapeSelected = selectedBlock?.type === "shape";
  const hasActiveObjectText =
    Boolean(activeInlineTextBlockId) && Boolean(activeObjectTextTypography);
  const canFormatInlineText = isTextSelected || hasActiveObjectText;
  const selectedText = isTextSelected ? selectedBlock : undefined;
  const modeLabel = canEdit ? (editing ? "Edit mode" : "Read mode") : "Read-only";
  const placement = getToolbarPlacement(position);
  const controlsClassName = [
    "floating-controls",
    collapsed ? "collapsed" : "expanded",
    placement.openLeft ? "open-left" : "open-right",
    placement.openUp ? "open-up" : "open-down",
  ].join(" ");
  const textRangeSize = activeTextTypography?.fontSizeCqw ?? 1.2;
  const objectTextSize = activeObjectTextTypography?.fontSizeCqw ?? 1.2;
  const textSizeInput = selectedText
    ? activeInlineTextSelection
      ? textRangeSize.toFixed(2)
      : String(selectedText.fontSize)
    : objectTextSize.toFixed(2);
  const textSizeMin = selectedText && !activeInlineTextSelection ? 10 : 0.7;
  const textSizeMax = selectedText && !activeInlineTextSelection ? 72 : 8;
  const textSizeStep = selectedText && !activeInlineTextSelection ? 1 : 0.05;
  const textSizeUnit = selectedText && !activeInlineTextSelection ? "Size" : "cqw";
  const textColorInput = selectedText
    ? activeInlineTextSelection
      ? (activeTextTypography?.color ?? selectedText.color ?? "#526179")
      : (selectedText.color ?? (selectedText.type === "heading" ? "#172033" : "#526179"))
    : activeInlineTextSelection
      ? (activeTextTypography?.color ?? activeObjectTextTypography?.color ?? "#172033")
      : (activeObjectTextTypography?.color ?? "#172033");

  return (
    <div
      className={controlsClassName}
      aria-label="Document controls"
      style={{ left: position.x, top: position.y }}
      onPointerMove={onToolbarPointerMove}
      onPointerUp={onToolbarPointerUp}
      onPointerCancel={onToolbarPointerUp}
      onLostPointerCapture={onToolbarPointerUp}
    >
      <div className="toolbar-head">
        <button
          type="button"
          className="overlay-button drag-button"
          onPointerDown={(event) => onToolbarPointerDown(event, "grip")}
          onPointerMove={onToolbarPointerMove}
          onPointerUp={onToolbarPointerUp}
          onPointerCancel={onToolbarPointerUp}
          onLostPointerCapture={onToolbarPointerUp}
          aria-label="Move menu"
          title="Move menu"
        >
          <GripVertical size={16} />
        </button>
        <span className={canEdit ? "brand-chip" : "brand-chip readonly"} title={modeLabel}>
          <FileText size={15} />
          <span>{modeLabel}</span>
        </span>
        <button
          type="button"
          className="overlay-button menu-button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Menu size={17} />
        </button>
      </div>
      {collapsed ? null : (
        <div className="toolbar-actions">
          <div
            className={canPresent ? "toolbar-mode-row has-present" : "toolbar-mode-row"}
            aria-label="Document mode"
          >
            <button
              type="button"
              className={!editing ? "mode-segment-button active" : "mode-segment-button"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSetEditing(false)}
              aria-label="Switch to reading mode"
              aria-pressed={!editing}
              title="Read mode"
            >
              <FileText size={15} />
              <span>Read</span>
            </button>
            <button
              type="button"
              className={editing ? "mode-segment-button active" : "mode-segment-button"}
              onMouseDown={(event) => {
                event.preventDefault();
                if (!editing) onSetEditing(true);
              }}
              onClick={() => {
                if (!editing) onSetEditing(true);
              }}
              disabled={!canEdit}
              aria-label="Switch to editing mode"
              aria-pressed={editing}
              title={canEdit ? "Edit mode (Command/Ctrl+E)" : "Read-only document"}
            >
              <Pencil size={15} />
              <span>Edit</span>
            </button>
            {canPresent ? (
              <button
                type="button"
                className="mode-segment-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onEnterPresentation}
                aria-label="Enter presentation mode"
                title="Presentation mode"
              >
                <Maximize2 size={15} />
                <span>Present</span>
              </button>
            ) : null}
          </div>
          {editing ? (
            <div className="toolbar-selection-row">
              <span className="selected-chip" title={selectedBlock?.id ?? "No selection"}>
                {selectedBlock?.type ?? "none"}
                <button
                  type="button"
                  onClick={onDeleteSelected}
                  disabled={!selectedBlock}
                  aria-label="Delete selected block"
                  title="Delete selected"
                >
                  <Trash2 size={13} />
                </button>
              </span>
              {isTextSelected ? (
                <>
                  <button
                    type="button"
                    className="overlay-button"
                    onClick={onAddParagraph}
                    aria-label="Add paragraph after selected text"
                    title="Add paragraph after selection"
                  >
                    <Plus size={17} />
                  </button>
                  <button
                    type="button"
                    className="overlay-button"
                    onClick={onDuplicateText}
                    aria-label="Duplicate selected text block"
                    title="Duplicate paragraph"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="overlay-button"
                    onClick={onToggleTextType}
                    aria-label="Toggle heading or paragraph"
                    title="Heading / paragraph"
                  >
                    {selectedText?.type === "heading" ? (
                      <Pilcrow size={17} />
                    ) : (
                      <Heading1 size={17} />
                    )}
                  </button>
                </>
              ) : null}
              {isShapeSelected ? (
                <label className="color-control" aria-label="Shape color" title="Shape color">
                  <Palette size={15} />
                  <input
                    type="color"
                    value={selectedBlock.fill}
                    onInput={(event) => onShapeFillChange(event.currentTarget.value)}
                    onChange={(event) => onShapeFillChange(event.currentTarget.value)}
                  />
                </label>
              ) : null}
              {isImageSelected ? (
                <label className="overlay-button" aria-label="Replace image" title="Replace image">
                  <ImagePlus size={17} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void onReplaceImage(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {editing && canFormatInlineText ? (
            <div className="toolbar-format-row" aria-label="Text formatting">
              <button
                type="button"
                className="overlay-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onFormatInline("bold")}
                aria-label="Bold"
                title="Bold (Command/Ctrl+B)"
              >
                <Bold size={17} />
              </button>
              <button
                type="button"
                className="overlay-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onFormatInline("italic")}
                aria-label="Italic"
                title="Italic (Command/Ctrl+I)"
              >
                <Italic size={17} />
              </button>
              <button
                type="button"
                className="overlay-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onFormatInline("underline")}
                aria-label="Underline"
                title="Underline (Command/Ctrl+U)"
              >
                <Underline size={17} />
              </button>
              {selectedText ? (
                <>
                  <label
                    className="number-control"
                    aria-label="Text font size"
                    title={
                      activeInlineTextSelection ? "Selected text font size" : "Text block font size"
                    }
                  >
                    <span>{textSizeUnit}</span>
                    <input
                      type="number"
                      min={textSizeMin}
                      max={textSizeMax}
                      step={textSizeStep}
                      value={textSizeInput}
                      onInput={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (!Number.isFinite(value)) return;
                        if (activeInlineTextSelection) onTextRangeFontSizeChange(value);
                        else onTextFontSizeChange(value);
                      }}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (!Number.isFinite(value)) return;
                        if (activeInlineTextSelection) onTextRangeFontSizeChange(value);
                        else onTextFontSizeChange(value);
                      }}
                    />
                  </label>
                  <label
                    className="color-control text-color-control"
                    aria-label="Text color"
                    title={activeInlineTextSelection ? "Selected text color" : "Text block color"}
                  >
                    <Palette size={15} />
                    <input
                      type="color"
                      value={textColorInput}
                      onInput={(event) => {
                        if (activeInlineTextSelection)
                          onTextRangeColorChange(event.currentTarget.value);
                        else onTextColorChange(event.currentTarget.value);
                      }}
                      onChange={(event) => {
                        if (activeInlineTextSelection)
                          onTextRangeColorChange(event.currentTarget.value);
                        else onTextColorChange(event.currentTarget.value);
                      }}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label
                    className="number-control"
                    aria-label="Object text font size"
                    title={
                      activeInlineTextSelection
                        ? "Selected object text font size"
                        : "Object text font size"
                    }
                  >
                    <span>{textSizeUnit}</span>
                    <input
                      type="number"
                      min={textSizeMin}
                      max={textSizeMax}
                      step={textSizeStep}
                      value={textSizeInput}
                      onInput={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (!Number.isFinite(value)) return;
                        if (activeInlineTextSelection) onObjectTextRangeFontSizeChange(value);
                        else onObjectTextFontSizeChange(value);
                      }}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (!Number.isFinite(value)) return;
                        if (activeInlineTextSelection) onObjectTextRangeFontSizeChange(value);
                        else onObjectTextFontSizeChange(value);
                      }}
                    />
                  </label>
                  <label
                    className="color-control text-color-control"
                    aria-label="Object text color"
                    title={
                      activeInlineTextSelection ? "Selected object text color" : "Object text color"
                    }
                  >
                    <Palette size={15} />
                    <input
                      type="color"
                      value={textColorInput}
                      onInput={(event) => {
                        if (activeInlineTextSelection)
                          onObjectTextRangeColorChange(event.currentTarget.value);
                        else onObjectTextColorChange(event.currentTarget.value);
                      }}
                      onChange={(event) => {
                        if (activeInlineTextSelection)
                          onObjectTextRangeColorChange(event.currentTarget.value);
                        else onObjectTextColorChange(event.currentTarget.value);
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          ) : null}
          <div className="toolbar-button-grid">
            <button
              type="button"
              className={editing && selectedBlock ? "overlay-button active" : "overlay-button"}
              onClick={onClearSelection}
              disabled={!editing}
              aria-label="Object selection tool"
              aria-pressed={editing && Boolean(selectedBlock)}
              title={
                editing
                  ? selectedBlock
                    ? "Clear selection"
                    : "Select objects on the document"
                  : "Selection tool is available in edit mode"
              }
            >
              <MousePointer2 size={17} />
            </button>
            <button
              type="button"
              className="overlay-button"
              onClick={onRequestOpen}
              aria-label="Open document package"
              title="Open (Command/Ctrl+O)"
            >
              <Upload size={17} />
            </button>
            <button
              type="button"
              className="overlay-button"
              onClick={onValidate}
              aria-label="Validate document"
              title="Validate"
            >
              <CheckCircle2 size={17} />
            </button>
            <button
              type="button"
              className="overlay-button"
              onClick={onShowInfo}
              aria-label="Show document info"
              title="Info"
            >
              <Info size={17} />
            </button>
            <button
              type="button"
              className="overlay-button primary"
              onClick={onExport}
              disabled={!canEdit}
              aria-label="Export .htmlx"
              title="Export (Command/Ctrl+S)"
            >
              <Download size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentDrawer({
  title,
  blockCount,
  objectCount,
  wordCount,
  manifest,
  issues,
  onClose,
}: {
  title: string;
  blockCount: number;
  objectCount: number;
  wordCount: number;
  manifest: HtmlxManifest | null;
  issues: Array<{ severity: string; code: string; message: string; path?: string }>;
  onClose: () => void;
}) {
  return (
    <aside className="document-drawer" aria-label="Document information">
      <header>
        <strong>Document</strong>
        <button type="button" onClick={onClose} aria-label="Close document info">
          <X size={16} />
        </button>
      </header>
      <dl>
        <div>
          <dt>Title</dt>
          <dd>{title}</dd>
        </div>
        <div>
          <dt>Blocks</dt>
          <dd>
            {blockCount} total, {objectCount} grouped objects
          </dd>
        </div>
        <div>
          <dt>Words</dt>
          <dd>{wordCount}</dd>
        </div>
        <div>
          <dt>Package</dt>
          <dd>{manifest?.packageId ?? "not exported yet"}</dd>
        </div>
      </dl>
      <section>
        <strong>Validation</strong>
        {issues.length === 0 ? (
          <p>No validation issues reported.</p>
        ) : (
          <ul>
            {issues.map((issue) => (
              <li key={`${issue.code}-${issue.path ?? ""}`}>
                <span>{issue.code}</span>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <strong>Shortcuts</strong>
        <dl className="shortcut-list">
          <div>
            <dt>Open</dt>
            <dd>Command/Ctrl+O</dd>
          </div>
          <div>
            <dt>Export</dt>
            <dd>Command/Ctrl+S</dd>
          </div>
          <div>
            <dt>Edit mode</dt>
            <dd>Command/Ctrl+E</dd>
          </div>
          <div>
            <dt>Undo / redo</dt>
            <dd>Command/Ctrl+Z, Command/Ctrl+Shift+Z</dd>
          </div>
          <div>
            <dt>Text format</dt>
            <dd>Command/Ctrl+B, I, U</dd>
          </div>
          <div>
            <dt>Paragraph</dt>
            <dd>Enter inserts, Shift+Enter breaks</dd>
          </div>
          <div>
            <dt>Selection</dt>
            <dd>Delete removes, Escape clears</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

function createInitialBlocks(): DocumentBlock[] {
  return [
    {
      id: "block-title",
      type: "heading",
      text: "Untitled HTMLX Document",
      html: "Untitled HTMLX Document",
      x: 64,
      y: 64,
      width: 640,
      fontSize: 36,
      lineHeight: 1.08,
      color: "#172033",
    },
    {
      id: "block-1",
      type: "paragraph",
      text: "Open a .htmlx package or use the bundled example package.",
      html: "Open a .htmlx package or use the bundled example package.",
      x: 64,
      y: 140,
      width: 620,
      fontSize: 16,
      lineHeight: 1.5,
      color: "#526179",
    },
  ];
}

async function buildPackage(blocks: DocumentBlock[], assets: AssetState[]) {
  const { createHtmlx } = await import("@openwebdoc/core");
  const now = new Date().toISOString();
  const title = getTitle(blocks);
  const manifest = createDefaultManifest({
    packageId: `urn:uuid:${crypto.randomUUID()}`,
    title,
    language: "en",
    now,
  });
  const html = buildHtml(blocks, assets);
  const css = buildDocumentCss(blocks);
  const llm = buildLlmMetadata(blocks);
  const editing = buildEditingMetadata(blocks, assets);
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "@openwebdoc/runtime",
    createdAt: now,
    runtimeMode: "self-editable-document",
    blockCount: blocks.length,
    objectCount: blocks.filter(isObjectBlock).length,
  };
  manifest.metadata.editing = "metadata/editing.json";
  const files = new Map<string, Uint8Array>([
    [manifest.entry, encodeText(html)],
    ["styles/document.css", encodeText(css)],
    ["metadata/llm.json", encodeJson(llm)],
    ["metadata/editing.json", encodeJson(editing)],
    ["metadata/provenance.json", encodeJson(provenance)],
  ]);
  manifest.resources = [
    resource(
      "styles/document.css",
      "text/css",
      "stylesheet",
      await sha256Integrity(files.get("styles/document.css")!),
    ),
    resource(
      "metadata/llm.json",
      "application/json",
      "metadata",
      await sha256Integrity(files.get("metadata/llm.json")!),
    ),
    resource(
      "metadata/editing.json",
      "application/json",
      "metadata",
      await sha256Integrity(files.get("metadata/editing.json")!),
    ),
    resource(
      "metadata/provenance.json",
      "application/json",
      "metadata",
      await sha256Integrity(files.get("metadata/provenance.json")!),
    ),
  ];
  for (const asset of assets) {
    files.set(asset.path, asset.bytes);
    manifest.resources.push(
      resource(asset.path, asset.mediaType, "image", await sha256Integrity(asset.bytes)),
    );
  }
  return { manifest, archive: await createHtmlx({ manifest, files }) };
}

async function buildPackageFromHtml(input: {
  html: string;
  css: string;
  stylesheetPath: string;
  blocks: DocumentBlock[];
  assets: AssetState[];
  presentationMetadata: HtmlxPresentationMetadata | null;
}) {
  const { createHtmlx } = await import("@openwebdoc/core");
  const now = new Date().toISOString();
  const title = getTitle(input.blocks);
  const manifest = createDefaultManifest({
    packageId: `urn:uuid:${crypto.randomUUID()}`,
    title,
    language: "en",
    now,
  });
  manifest.styles = [input.stylesheetPath];
  manifest.metadata.editing = "metadata/editing.json";
  if (input.presentationMetadata) manifest.metadata.presentation = "metadata/presentation.json";
  const llm = buildLlmMetadata(input.blocks);
  const editing = buildEditingMetadata(input.blocks, input.assets);
  const provenance = {
    schemaVersion: "0.1.0",
    createdBy: "@openwebdoc/runtime",
    createdAt: now,
    runtimeMode: "self-editable-document",
    blockCount: input.blocks.length,
    objectCount: input.blocks.filter(isObjectBlock).length,
  };
  const files = new Map<string, Uint8Array>([
    [manifest.entry, encodeText(input.html)],
    [input.stylesheetPath, encodeText(input.css)],
    ["metadata/llm.json", encodeJson(llm)],
    ["metadata/editing.json", encodeJson(editing)],
    ["metadata/provenance.json", encodeJson(provenance)],
  ]);
  if (input.presentationMetadata) {
    files.set("metadata/presentation.json", encodeJson(input.presentationMetadata));
  }
  manifest.resources = [
    resource(
      input.stylesheetPath,
      "text/css",
      "stylesheet",
      await sha256Integrity(files.get(input.stylesheetPath)!),
    ),
    resource(
      "metadata/llm.json",
      "application/json",
      "metadata",
      await sha256Integrity(files.get("metadata/llm.json")!),
    ),
    resource(
      "metadata/editing.json",
      "application/json",
      "metadata",
      await sha256Integrity(files.get("metadata/editing.json")!),
    ),
    resource(
      "metadata/provenance.json",
      "application/json",
      "metadata",
      await sha256Integrity(files.get("metadata/provenance.json")!),
    ),
  ];
  if (input.presentationMetadata) {
    manifest.resources.push(
      resource(
        "metadata/presentation.json",
        "application/json",
        "metadata",
        await sha256Integrity(files.get("metadata/presentation.json")!),
      ),
    );
  }
  for (const asset of input.assets) {
    files.set(asset.path, asset.bytes);
    manifest.resources.push(
      resource(asset.path, asset.mediaType, "image", await sha256Integrity(asset.bytes)),
    );
  }
  return { manifest, archive: await createHtmlx({ manifest, files }) };
}

function buildHtml(blocks: DocumentBlock[], assets: AssetState[]): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(getTitle(blocks))}</title>
    <link rel="stylesheet" href="styles/document.css">
  </head>
  <body>
    <main class="htmlx-document">
      <section class="htmlx-stage" data-htmlx-block-id="canvas-1" data-htmlx-editable="document" data-htmlx-stage-width="${DESIGN_WIDTH}" data-htmlx-stage-height="${DESIGN_HEIGHT}">
        <div class="htmlx-canvas">
          ${blocks
            .map((block) => blockToHtml(block, assets))
            .filter(Boolean)
            .join("\n          ")}
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function blockToHtml(block: DocumentBlock, assets: AssetState[]): string {
  if (block.type === "heading") {
    return `<h1 id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-text", "htmlx-heading", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="heading" data-htmlx-editable="text" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-font-size="${block.fontSize}" data-htmlx-line-height="${block.lineHeight}"${block.color ? ` data-htmlx-color="${escapeHtmlAttribute(block.color)}"` : ""}>${sanitizeInlineHtml(block.html)}</h1>`;
  }
  if (block.type === "paragraph") {
    return `<p id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-text", "htmlx-paragraph", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="paragraph" data-htmlx-editable="text" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-font-size="${block.fontSize}" data-htmlx-line-height="${block.lineHeight}"${block.color ? ` data-htmlx-color="${escapeHtmlAttribute(block.color)}"` : ""}>${sanitizeInlineHtml(block.html)}</p>`;
  }
  if (block.type === "image") {
    const asset = assets.find((item) => item.id === block.assetId);
    if (!asset) return "";
    return `<figure id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-object", "htmlx-image", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="image" data-htmlx-editable="object" data-htmlx-asset-id="${escapeHtmlAttribute(block.assetId)}" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-height="${estimateObjectHeight(block)}"><img src="${escapeHtmlAttribute(asset.path)}" alt="${escapeHtmlAttribute(block.alt)}"></figure>`;
  }
  if (block.type === "shape") {
    return `<div id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-object", "htmlx-shape", "htmlx-shape-rectangle", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="shape" data-htmlx-editable="object" data-htmlx-shape="rectangle" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-height="${block.height}" data-htmlx-fill="${escapeHtmlAttribute(block.fill)}" aria-label="Rectangle shape">${sanitizeShapeObjectHtml(block.html ?? "")}</div>`;
  }
  if (block.type === "table") {
    return `<figure id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-object", "htmlx-table-block", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="table" data-htmlx-editable="object" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-height="${estimateObjectHeight(block)}"><figcaption><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.caption)}</span></figcaption><table><thead><tr>${block.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></figure>`;
  }
  if (block.type === "figure") {
    return `<figure id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-object", "htmlx-figure-block", `htmlx-figure-${block.variant}`, block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="figure" data-htmlx-editable="object" data-htmlx-variant="${block.variant}" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-height="${estimateObjectHeight(block)}"><figcaption><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(block.caption)}</span></figcaption><div class="figure-grid ${block.variant}">${block.cards
      .map((card) => {
        const asset = assets.find((item) => item.id === card.iconAssetId);
        const image = asset ? `<img src="${escapeHtmlAttribute(asset.path)}" alt="">` : "";
        return `<div class="figure-card" data-htmlx-card-x="${card.x}" data-htmlx-card-y="${card.y}" data-htmlx-card-width="${card.width}" data-htmlx-card-height="${card.height}" style="left:${toPercent(card.x, 760)}%;top:${toPercent(card.y, 440)}%;width:${toPercent(card.width, 760)}%;height:${toPercent(card.height, 440)}%;">${image}<strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(card.body)}</span></div>`;
      })
      .join("")}</div></figure>`;
  }
  return "";
}

function buildDocumentCss(blocks: DocumentBlock[]): string {
  return `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: #172033;
  background: #ffffff;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.htmlx-document {
  width: 100%;
  margin: 0 auto;
}

.htmlx-stage {
  position: relative;
  width: 100%;
  aspect-ratio: ${DESIGN_WIDTH} / ${DESIGN_HEIGHT};
  margin-inline: auto;
  overflow: hidden;
  container-type: inline-size;
  border-radius: 0.82cqw;
  background: #ffffff;
}

.htmlx-stage::before {
  content: "";
  position: absolute;
  top: ${toPercent(22, DESIGN_HEIGHT)}%;
  right: ${toPercent(22, DESIGN_WIDTH)}%;
  bottom: ${toPercent(22, DESIGN_HEIGHT)}%;
  left: ${toPercent(22, DESIGN_WIDTH)}%;
  border: 1px solid rgba(202, 214, 229, 0.7);
  border-radius: 0.82cqw;
  pointer-events: none;
}

.htmlx-canvas,
.htmlx-text,
.htmlx-object {
  position: absolute;
  top: 0;
  left: 0;
}

.htmlx-text,
.htmlx-object {
  margin: 0;
}

.htmlx-heading {
  color: #172033;
  letter-spacing: 0;
}

.htmlx-paragraph {
  color: #526179;
  white-space: normal;
}

.htmlx-image img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0.9cqw;
  object-fit: contain;
}

.htmlx-shape-rectangle {
  border-radius: 0.9cqw;
  box-shadow: inset 0 0 0 1px rgba(47, 94, 170, 0.24);
}

.htmlx-table-block,
.htmlx-figure-block {
  display: grid;
  gap: 1.9cqw;
  border: 1px solid #dbe4f0;
  border-radius: 1cqw;
  padding: 2.1cqw;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 1.8cqw 4.2cqw rgba(27, 39, 66, 0.08);
  overflow: hidden;
}

.htmlx-figure-block {
  grid-template-rows: auto 1fr;
}

figcaption {
  display: grid;
  gap: 0.72cqw;
}

figcaption strong {
  color: #172033;
  font-size: 2.5cqw;
}

figcaption span {
  color: #526179;
  font-size: 1.55cqw;
  line-height: 1.45;
}

table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 0.9cqw;
  font-size: 1.45cqw;
}

th,
td {
  border: 1px solid #d7e1ee;
  padding: 1.2cqw 1.4cqw;
  text-align: left;
}

th {
  color: white;
  background: #17324d;
}

td {
  color: #283951;
  background: #ffffff;
}

tr:nth-child(even) td {
  background: #f4f7fb;
}

.figure-grid {
  position: relative;
  height: 100%;
  min-height: 0;
}

.figure-card {
  position: absolute;
  z-index: 2;
  display: grid;
  gap: 0.9cqw;
  align-content: start;
  border: 1px solid #d9e4f2;
  border-radius: 0.9cqw;
  padding: 1.7cqw;
  background: #f8fafc;
  pointer-events: auto;
}

.figure-card * {
  pointer-events: none;
}

.figure-card img {
  width: 5.1cqw;
  height: 5.1cqw;
  object-fit: contain;
}

.figure-card strong {
  color: #172033;
  font-size: 1.75cqw;
}

.figure-card span {
  color: #526179;
  font-size: 1.36cqw;
  line-height: 1.35;
}

${blocks.map((block) => objectRule(block)).join("\n")}
`;
}

function buildLlmMetadata(blocks: DocumentBlock[]): HtmlxLlmMetadata {
  const title = getTitle(blocks);
  return {
    schemaVersion: "0.1.0",
    summary: title,
    readingOrder: blocks.map((block) => block.id),
    chunks: blocks.map((block, index) => ({
      id: `chunk-${index + 1}`,
      blockIds: [block.id],
      selector: `[data-htmlx-block-id="${block.id}"]`,
      summary: summarizeBlock(block),
      keywords: [title, "OpenWebDoc", "HTMLX", block.type],
      tokenEstimate: estimateTokens(block),
      sensitivity: "unknown",
    })),
    entities: [],
    citations: [],
    assistantHints: {
      visibility: "user-visible",
      intendedUse: ["summarization", "retrieval", "editing"],
      doNotTreatAsSystemInstruction: true,
    },
  };
}

function buildEditingMetadata(blocks: DocumentBlock[], assets: AssetState[]): HtmlxEditingMetadata {
  return {
    $schema: HTMLX_EDITING_METADATA_SCHEMA_URL,
    schemaVersion: "0.1.0",
    mode: "self-editable-document",
    runtime: "@openwebdoc/runtime",
    stage: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT, unit: "px", scaleMode: "uniform-fit" },
    blocks: blocks.map((block) => ({
      id: block.id,
      type: editableType(block),
      selector: `[data-htmlx-block-id="${block.id}"]`,
      editable: true,
      frame: {
        x: block.x,
        y: block.y,
        width: block.width,
        ...(block.type === "shape" ? { height: block.height } : {}),
      },
      ...(isTextBlock(block)
        ? {
            textRole: block.type === "heading" ? "title" : "body",
            fontSize: block.fontSize,
            lineHeight: block.lineHeight,
            color: block.color,
            inlineFormatting: detectInlineFormatting(block.html),
          }
        : {}),
      ...(block.type === "image"
        ? { assetPath: assets.find((item) => item.id === block.assetId)?.path }
        : {}),
      ...(block.type === "shape" ? { shape: block.shape, fill: block.fill } : {}),
      ...(block.type === "table"
        ? { table: { columns: block.columns, rowCount: block.rows.length } }
        : {}),
      ...(block.type === "figure"
        ? { figure: { variant: block.variant, cardCount: block.cards.length } }
        : {}),
    })),
    constraints: {
      scripts: false,
      remoteResources: false,
      coordinates: "stage-relative",
      textScaling: "stage-uniform",
      textFormatting: ["bold", "italic", "underline"],
      typography: {
        fontSize: "block-stage-relative",
        textColor: "safe-css-color",
        fontFamily: "package-css-or-system",
        remoteFonts: false,
      },
    },
  };
}

async function packageAssetsToState(files: Map<string, Uint8Array>, manifest: HtmlxManifest) {
  const assetResources = manifest.resources.filter((resourceItem) =>
    resourceItem.mediaType.startsWith("image/"),
  );
  const result: AssetState[] = [];
  for (const resourceItem of assetResources) {
    const bytes = files.get(resourceItem.path);
    if (!bytes) continue;
    result.push({
      id: assetIdFromPath(resourceItem.path),
      name: resourceItem.path.split("/").at(-1) ?? resourceItem.path,
      path: resourceItem.path,
      mediaType: resourceItem.mediaType,
      bytes,
      dataUrl: await bytesToDataUrl(bytes, resourceItem.mediaType),
    });
  }
  return result;
}

function parsePresentationMetadata(
  files: Map<string, Uint8Array>,
  manifest: HtmlxManifest,
): HtmlxPresentationMetadata | null {
  const presentationPath = manifest.metadata.presentation;
  if (!presentationPath) return null;
  const bytes = files.get(presentationPath);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as HtmlxPresentationMetadata;
    return parsed?.profile === "slide-deck" ? parsed : null;
  } catch {
    return null;
  }
}

function countPresentationSlides(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return parsed.querySelectorAll('[data-htmlx-kind="slide"]').length;
}

function buildPresentationSrcDoc(html: string, currentSlideIndex: number) {
  const slideNumber = currentSlideIndex + 1;
  const runtimeStyle = `<style data-openwebdoc-presentation-runtime>
html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  background: #000000;
  overflow: hidden;
}
.htmlx-slide-deck {
  display: grid !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100vh !important;
  min-height: 100vh !important;
  margin: 0 !important;
  padding: 0 !important;
  place-items: center !important;
  overflow: hidden !important;
  background: #000000 !important;
}
.htmlx-slide {
  display: none !important;
  width: min(100vw, calc(100vh * 16 / 9)) !important;
  height: min(100vh, calc(100vw * 9 / 16)) !important;
  margin: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: hidden !important;
}
.htmlx-slide[data-htmlx-slide-index="${slideNumber}"] {
  display: block !important;
}
</style>`;
  if (html.includes("</head>")) return html.replace("</head>", `${runtimeStyle}</head>`);
  return `${runtimeStyle}${html}`;
}

function parseEditableBlocks(html: string, assets: AssetState[]): DocumentBlock[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  return parseEditableBlocksFromRoot(document, assets);
}

function parseEditableBlocksFromRoot(root: ParentNode, assets: AssetState[]): DocumentBlock[] {
  const parsed: Array<DocumentBlock | null> = Array.from(
    root.querySelectorAll<HTMLElement>("[data-htmlx-block-id]"),
  ).map((element): DocumentBlock | null => {
    const id = element.dataset.htmlxBlockId;
    const kind = element.dataset.htmlxKind || inferImplicitEditableKind(element);
    if (!id || !kind) return null;
    const x = readNumber(element.dataset.htmlxX, 64);
    const y = readNumber(element.dataset.htmlxY, 64);
    const width = readNumber(element.dataset.htmlxWidth, 720);
    if (kind === "heading" || kind === "paragraph") {
      const html = sanitizeInlineHtml(element.innerHTML);
      return {
        id,
        type: kind,
        text: plainTextFromInlineHtml(html),
        html,
        x,
        y,
        width,
        sourceClassName: element.className,
        fontSize: readNumber(element.dataset.htmlxFontSize, kind === "heading" ? 34 : 16),
        lineHeight: readNumber(element.dataset.htmlxLineHeight, kind === "heading" ? 1.08 : 1.5),
        color: element.dataset.htmlxColor,
      };
    }
    if (kind === "image") {
      const img = element.querySelector("img");
      const src = img?.getAttribute("src") ?? "";
      const asset =
        assets.find((item) => item.id === element.dataset.htmlxAssetId) ??
        assets.find((item) => item.path === src);
      if (!asset) return null;
      return {
        id,
        type: "image",
        assetId: asset.id,
        alt: img?.getAttribute("alt") || asset.name,
        x,
        y,
        width,
        height: readNumber(element.dataset.htmlxHeight, 180),
        sourceClassName: element.className,
      };
    }
    if (kind === "shape") {
      const html = sanitizeShapeObjectHtml(element.innerHTML);
      return {
        id,
        type: "shape",
        shape: "rectangle",
        x,
        y,
        width,
        height: readNumber(element.dataset.htmlxHeight, 96),
        fill: element.dataset.htmlxFill || "#dbeafe",
        html,
        sourceClassName: element.className,
      };
    }
    if (kind === "table") {
      const objectCaption = readObjectCaption(element, "Table");
      return {
        id,
        type: "table",
        title: objectCaption.title,
        caption: objectCaption.caption,
        columns: Array.from(element.querySelectorAll("th")).map(
          (cell) => cell.textContent?.trim() || "",
        ),
        rows: Array.from(element.querySelectorAll("tbody tr")).map((row) =>
          Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent?.trim() || ""),
        ),
        x,
        y,
        width,
        height: readNumber(element.dataset.htmlxHeight, 150),
        sourceClassName: element.className,
      };
    }
    if (kind === "figure") {
      const objectCaption = readObjectCaption(element, "Figure");
      return {
        id,
        type: "figure",
        title: objectCaption.title,
        caption: objectCaption.caption,
        variant: (element.dataset.htmlxVariant as FigureVariant) || "cards",
        cards: parseFigureCards(element, assets),
        x,
        y,
        width,
        height: readNumber(element.dataset.htmlxHeight, 440),
        sourceClassName: element.className,
      };
    }
    return null;
  });
  return parsed.filter((block): block is DocumentBlock => Boolean(block));
}

function inferImplicitEditableKind(element: HTMLElement): "heading" | "paragraph" | "" {
  const tag = element.tagName.toLowerCase();
  if (tag === "h1" || tag === "h2" || tag === "h3") return "heading";
  if (["p", "span", "b", "strong", "li", "th", "td", "code", "figcaption"].includes(tag))
    return "paragraph";
  return "";
}

function markImplicitEditableText(root: ParentNode) {
  let generatedIndex = 0;
  const hasCoordinateEditingSurface = Boolean(
    root.querySelector('[data-htmlx-editable="document"]'),
  );
  root.querySelectorAll<HTMLElement>("[data-htmlx-block-id]").forEach((element) => {
    const implicitMatch = /^implicit-text-(\d+)$/.exec(element.dataset.htmlxBlockId ?? "");
    if (implicitMatch) generatedIndex = Math.max(generatedIndex, Number(implicitMatch[1]));
    if (element.closest('[data-htmlx-editable="object"]')) return;
    if (element.matches(OBJECT_TEXT_TARGET_SELECTOR)) return;
    const kind = element.dataset.htmlxKind || inferImplicitEditableKind(element);
    if (kind !== "heading" && kind !== "paragraph") return;
    element.dataset.htmlxKind = kind;
    element.dataset.htmlxEditable = "text";
  });
  if (hasCoordinateEditingSurface) return;
  root
    .querySelectorAll<HTMLElement>("h1, h2, h3, p, span, b, strong, li, th, td, code, figcaption")
    .forEach((element) => {
      if (element.dataset.htmlxBlockId) return;
      if (!element.textContent?.trim()) return;
      if (element.closest("[data-openwebdoc-runtime-control]")) return;
      if (element.closest('[data-htmlx-editable="object"]')) return;
      if (element.matches(OBJECT_TEXT_TARGET_SELECTOR)) return;
      if (element.closest('[data-htmlx-editable="text"]')) return;

      const nestedEditable = element.querySelector<HTMLElement>(
        "h1, h2, h3, p, span, b, strong, li, th, td, code, figcaption",
      );
      if (nestedEditable?.textContent?.trim()) return;

      const kind = inferImplicitEditableKind(element);
      if (kind !== "heading" && kind !== "paragraph") return;
      generatedIndex += 1;
      element.dataset.htmlxBlockId = `implicit-text-${generatedIndex}`;
      element.dataset.htmlxKind = kind;
      element.dataset.htmlxEditable = "text";
    });
}

function readObjectCaption(element: HTMLElement, fallbackTitle: string) {
  const caption = element.querySelector("figcaption");
  const title = caption?.querySelector("strong")?.textContent?.trim();
  const body = caption?.querySelector("span")?.textContent?.trim();
  if (title || body) return { title: title || fallbackTitle, caption: body || "" };
  const plainCaption = caption?.textContent?.replace(/\s+/g, " ").trim();
  return { title: plainCaption || fallbackTitle, caption: "" };
}

function parseFigureCards(element: HTMLElement, assets: AssetState[]): FigureCard[] {
  const explicitCards = Array.from(element.querySelectorAll<HTMLElement>(".figure-card"));
  if (explicitCards.length > 0) {
    return explicitCards.map((card) => {
      const src = card.querySelector("img")?.getAttribute("src") ?? "";
      const asset = assets.find((item) => item.path === src);
      return {
        title: card.querySelector("strong")?.textContent?.trim() || "",
        body: card.querySelector("span")?.textContent?.trim() || "",
        iconAssetId: asset?.id,
        x: readNumber(card.dataset.htmlxCardX, 0),
        y: readNumber(card.dataset.htmlxCardY, 0),
        width: readNumber(card.dataset.htmlxCardWidth, 170),
        height: readNumber(card.dataset.htmlxCardHeight, 110),
      };
    });
  }

  const articles = Array.from(element.querySelectorAll<HTMLElement>("article"));
  const columns = articles.length <= 3 ? articles.length || 1 : 2;
  const gap = 22;
  const cardWidth = Math.floor((720 - gap * (columns - 1)) / columns);
  return articles.map((article, index) => {
    const src = article.querySelector("img")?.getAttribute("src") ?? "";
    const asset = assets.find((item) => item.path === src);
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      title:
        article.querySelector("strong, b, h3")?.textContent?.trim() ||
        article.textContent?.trim().split(/\s+/).slice(0, 4).join(" ") ||
        "Figure item",
      body:
        article.querySelector("span, p, li")?.textContent?.trim() ||
        article.textContent?.trim().replace(/\s+/g, " ").slice(0, 160) ||
        "",
      iconAssetId: asset?.id,
      x: 20 + column * (cardWidth + gap),
      y: 46 + row * 132,
      width: cardWidth,
      height: 112,
    };
  });
}

function sanitizeInlineHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const allowed = new Map([
    ["b", "strong"],
    ["strong", "strong"],
    ["i", "em"],
    ["em", "em"],
    ["span", "span"],
    ["u", "u"],
    ["br", "br"],
  ]);

  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml((node.textContent ?? "").replace(/\s+/g, " "));
    }
    if (!(node instanceof HTMLElement)) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return "";
    if (tag === "div" || tag === "p") {
      return `${Array.from(node.childNodes).map(serialize).join("")}<br>`;
    }
    const mapped = allowed.get(tag);
    if (!mapped) return Array.from(node.childNodes).map(serialize).join("");
    if (mapped === "br") return "<br>";
    const style = sanitizeInlineStyle(node.getAttribute("style") ?? "");
    const styleAttribute = style ? ` style="${escapeHtmlAttribute(style)}"` : "";
    return `<${mapped}${styleAttribute}>${Array.from(node.childNodes).map(serialize).join("")}</${mapped}>`;
  }

  return Array.from(template.content.childNodes)
    .map(serialize)
    .join("")
    .replace(/(?:\s*<br>\s*){2,}/g, "<br>")
    .replace(/\s+</g, " <")
    .replace(/>\s+/g, "> ")
    .replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "")
    .trim();
}

function sanitizeShapeObjectHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value;
  const allowed = new Set(["span", "strong", "b", "em", "i", "u", "br"]);

  function serialize(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml((node.textContent ?? "").replace(/\s+/g, " "));
    }
    if (!(node instanceof HTMLElement)) return "";
    if (node.dataset.openwebdocRuntimeControl) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return "";
    if (!allowed.has(tag)) return Array.from(node.childNodes).map(serialize).join("");
    if (tag === "br") return "<br>";
    const mapped = tag === "b" ? "strong" : tag === "i" ? "em" : tag;
    const style = sanitizeInlineStyle(node.getAttribute("style") ?? "");
    const styleAttribute = style ? ` style="${escapeHtmlAttribute(style)}"` : "";
    const objectTextAttribute =
      node.dataset.htmlxObjectText === "true" ? ' data-htmlx-object-text="true"' : "";
    return `<${mapped}${objectTextAttribute}${styleAttribute}>${Array.from(node.childNodes).map(serialize).join("")}</${mapped}>`;
  }

  return Array.from(template.content.childNodes)
    .map(serialize)
    .join("")
    .replace(/\s+</g, " <")
    .replace(/>\s+/g, "> ")
    .replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "")
    .trim();
}

function sanitizeInlineStyle(value: string) {
  const properties: string[] = [];
  for (const declaration of value.split(";")) {
    const [rawName, ...rawValueParts] = declaration.split(":");
    const name = rawName?.trim().toLowerCase();
    const rawValue = rawValueParts.join(":").trim();
    if (!name || !rawValue) continue;
    if (name === "font-size" && /^(\d+(?:\.\d+)?)(cqw|px|em|rem)$/i.test(rawValue)) {
      properties.push(`font-size: ${rawValue.toLowerCase()}`);
    }
    if (name === "display" && rawValue.toLowerCase() === "inline") {
      properties.push("display: inline");
    }
    if (name === "color" && isSafeInlineColor(rawValue)) {
      properties.push(`color: ${rawValue}`);
    }
  }
  return properties.join("; ");
}

function isSafeInlineColor(value: string) {
  return (
    /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value)
  );
}

function plainTextFromInlineHtml(value: string) {
  const template = document.createElement("template");
  template.innerHTML = value.replaceAll(/<br\s*\/?>/gi, "\n");
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

function detectInlineFormatting(value: string): Array<"bold" | "italic" | "underline"> {
  const detected: Array<"bold" | "italic" | "underline"> = [];
  if (/<(?:strong|b)\b/i.test(value)) detected.push("bold");
  if (/<(?:em|i)\b/i.test(value)) detected.push("italic");
  if (/<u\b/i.test(value)) detected.push("underline");
  return detected;
}

function applySemanticInlineFormat(target: HTMLElement, command: "bold" | "italic" | "underline") {
  const selection = getSelectionForElement(target);
  const tagName = command === "bold" ? "strong" : command === "italic" ? "em" : "u";
  if (!selection || selection.rangeCount === 0) {
    toggleWholeTextElement(target, tagName);
    return true;
  }
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    const activeFormat = closestFormatAncestor(range.startContainer, target, tagName);
    if (activeFormat) unwrapElement(activeFormat);
    else toggleWholeTextElement(target, tagName);
    return true;
  }
  const ancestor =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!ancestor || !target.contains(ancestor)) {
    toggleWholeTextElement(target, tagName);
    return true;
  }
  const offsets = getTextSelectionOffsets(target, range);
  if (isWholeEditableSelection(target, selection)) {
    toggleWholeTextElement(target, tagName);
    if (offsets) restoreTextSelection({ blockId: "", element: target, ...offsets });
    return true;
  }

  try {
    const shouldRemoveFormat = isRangeFullyFormatted(target, range, tagName);
    const fragment = range.extractContents();
    unwrapMatchingTags(fragment, tagName);
    if (shouldRemoveFormat) {
      range.insertNode(fragment);
      if (offsets) restoreTextSelection({ blockId: "", element: target, ...offsets });
      return true;
    }
    const wrapper = document.createElement(tagName);
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
    if (offsets) restoreTextSelection({ blockId: "", element: target, ...offsets });
    return true;
  } catch {
    return false;
  }
}

function closestFormatAncestor(node: Node, boundary: HTMLElement, tagName: "strong" | "em" | "u") {
  const start = node instanceof HTMLElement ? node : node.parentElement;
  const tags = tagName === "strong" ? ["strong", "b"] : tagName === "em" ? ["em", "i"] : ["u"];
  let current: HTMLElement | null = start;
  while (current && current !== boundary) {
    if (tags.includes(current.tagName.toLowerCase())) return current;
    current = current.parentElement;
  }
  return null;
}

function isRangeFullyFormatted(target: HTMLElement, range: Range, tagName: "strong" | "em" | "u") {
  const offsets = getTextSelectionOffsets(target, range);
  if (!offsets) return false;
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let absoluteOffset = 0;
  let checkedText = false;
  let current = walker.nextNode();
  while (current) {
    const text = current.textContent ?? "";
    const nodeStart = absoluteOffset;
    const nodeEnd = nodeStart + text.length;
    const overlapStart = Math.max(nodeStart, offsets.start);
    const overlapEnd = Math.min(nodeEnd, offsets.end);
    if (overlapStart < overlapEnd) {
      const selectedPart = text.slice(overlapStart - nodeStart, overlapEnd - nodeStart);
      if (selectedPart.trim()) {
        checkedText = true;
        if (!closestFormatAncestor(current, target, tagName)) return false;
      }
    }
    absoluteOffset = nodeEnd;
    current = walker.nextNode();
  }
  return checkedText;
}

function unwrapMatchingTags(fragment: DocumentFragment, tagName: "strong" | "em" | "u") {
  const tags = tagName === "strong" ? "strong,b" : tagName === "em" ? "em,i" : "u";
  fragment.querySelectorAll<HTMLElement>(tags).forEach(unwrapElement);
}

function unwrapMatchingTagsInElement(target: HTMLElement, tagName: "strong" | "em" | "u") {
  const tags = tagName === "strong" ? "strong,b" : tagName === "em" ? "em,i" : "u";
  target.querySelectorAll<HTMLElement>(tags).forEach(unwrapElement);
}

function getSelectionForElement(target: HTMLElement) {
  const root = target.getRootNode();
  const shadowSelection =
    root instanceof ShadowRoot
      ? (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.()
      : null;
  const documentSelection = document.getSelection();
  if (shadowSelection && shadowSelection.rangeCount > 0 && shadowSelection.toString().trim()) {
    return shadowSelection;
  }
  return documentSelection ?? shadowSelection;
}

function getSelectionForRoot(root: ParentNode | null) {
  if (!root) return null;
  if (root instanceof ShadowRoot) {
    const shadowSelection = (
      root as ShadowRoot & { getSelection?: () => Selection | null }
    ).getSelection?.();
    const documentSelection = document.getSelection();
    if (shadowSelection && shadowSelection.rangeCount > 0 && shadowSelection.toString().trim()) {
      return shadowSelection;
    }
    return documentSelection ?? shadowSelection ?? null;
  }
  return document.getSelection();
}

function getSelectedEditableContext(root: ParentNode | null): SurfaceTextSelectionContext | null {
  const selection = getSelectionForRoot(root);
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  if (!selection.toString().trim()) return null;
  const range = selection.getRangeAt(0);
  const candidates = [range.startContainer, range.endContainer, range.commonAncestorContainer];
  for (const candidate of candidates) {
    const element =
      candidate instanceof HTMLElement
        ? candidate
        : candidate.parentElement instanceof HTMLElement
          ? candidate.parentElement
          : null;
    const editable = element?.closest<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
    const blockId = editable?.closest<HTMLElement>("[data-htmlx-block-id]")?.dataset.htmlxBlockId;
    const offsets = editable ? getTextSelectionOffsets(editable, range) : null;
    if (editable && blockId && offsets) return { blockId, element: editable, ...offsets };
  }
  return null;
}

function getTextSelectionOffsets(target: HTMLElement, range: Range) {
  const start = getTextOffset(target, range.startContainer, range.startOffset);
  const end = getTextOffset(target, range.endContainer, range.endOffset);
  if (start === null || end === null || start === end) return null;
  return start < end ? { start, end } : { start: end, end: start };
}

function getTextOffset(target: HTMLElement, node: Node, nodeOffset: number) {
  if (!target.contains(node) && node !== target) return null;
  try {
    const range = document.createRange();
    range.selectNodeContents(target);
    range.setEnd(node, nodeOffset);
    return range.toString().length;
  } catch {
    return null;
  }
}

function getPreservedSelectionElement(
  root: ParentNode | null,
  context: SurfaceTextSelectionContext,
) {
  if (context.element.isConnected) return context.element;
  const block = root?.querySelector<HTMLElement>(
    `[data-htmlx-block-id="${CSS.escape(context.blockId)}"]`,
  );
  if (!block) return null;
  if (block.matches(EDITABLE_SURFACE_TEXT_SELECTOR)) return block;
  return block.querySelector<HTMLElement>(EDITABLE_SURFACE_TEXT_SELECTOR);
}

function restoreTextSelection(context: SurfaceTextSelectionContext) {
  const startPosition = findTextPosition(context.element, context.start);
  const endPosition = findTextPosition(context.element, context.end);
  if (!startPosition || !endPosition) return false;
  const selection = getSelectionForElement(context.element);
  if (!selection) return false;
  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function findTextPosition(target: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let current = walker.nextNode();
  let lastTextNode: Text | null = null;
  while (current) {
    const text = current.textContent ?? "";
    if (current instanceof Text) {
      lastTextNode = current;
      if (remaining <= text.length) return { node: current, offset: remaining };
      remaining -= text.length;
    }
    current = walker.nextNode();
  }
  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.textContent?.length ?? 0,
    };
  }
  return null;
}

function hasNonCollapsedTextSelection(target: HTMLElement) {
  const selection = getSelectionForElement(target);
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  if (!selection.toString().trim()) return false;
  const range = selection.getRangeAt(0);
  const ancestor =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  return Boolean(ancestor && (target.contains(ancestor) || ancestor === target));
}

function toggleWholeTextElement(target: HTMLElement, tagName: "strong" | "em" | "u") {
  if (isElementFullyFormatted(target, tagName)) {
    unwrapMatchingTagsInElement(target, tagName);
    selectElementContents(target);
    return;
  }
  unwrapMatchingTagsInElement(target, tagName);
  const wrapper = document.createElement(tagName);
  while (target.firstChild) {
    wrapper.appendChild(target.firstChild);
  }
  target.appendChild(wrapper);
  selectElementContents(wrapper);
}

function selectElementContents(target: HTMLElement) {
  const selection = getSelectionForElement(target);
  const range = document.createRange();
  range.selectNodeContents(target);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAtEnd(target: HTMLElement) {
  const selection = getSelectionForElement(target);
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function isElementFullyFormatted(target: HTMLElement, tagName: "strong" | "em" | "u") {
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let foundText = false;
  let current = walker.nextNode();
  while (current) {
    foundText = true;
    if (!closestFormatAncestor(current, target, tagName)) return false;
    current = walker.nextNode();
  }
  return foundText;
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
  parent.normalize();
}

function scopeDocumentCssForRuntime(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .map((rule) => {
      const [selectorText, ...bodyParts] = rule.split("{");
      const body = bodyParts.join("{").trim();
      if (!selectorText?.trim() || !body) return "";
      const scopedSelectors = selectorText
        .split(",")
        .map((selector) => scopeDocumentSelector(selector.trim()))
        .filter(Boolean)
        .join(", ");
      return scopedSelectors ? `${scopedSelectors} { ${body} }` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function scopeDocumentSelector(selector: string): string {
  if (!selector || selector.startsWith("@")) return "";
  if (selector === "html" || selector === "body" || selector === ".htmlx-document") {
    return ".document-page";
  }
  if (selector.startsWith("html ") || selector.startsWith("body ")) {
    return `.document-page ${selector.replace(/^(html|body)\s+/, "")}`;
  }
  if (selector.startsWith(".htmlx-stage")) {
    return selector.replace(/^\.htmlx-stage/, ".document-page");
  }
  if (selector.startsWith(".htmlx-canvas")) {
    return selector.replace(/^\.htmlx-canvas/, ".document-page");
  }
  if (selector.startsWith(".document-page")) return selector;
  return `.document-page ${selector}`;
}

function objectRule(block: DocumentBlock): string {
  if (isTextBlock(block)) {
    return `#${block.id} { left: ${toPercent(block.x, DESIGN_WIDTH)}%; top: ${toPercent(block.y, DESIGN_HEIGHT)}%; width: ${toPercent(block.width, DESIGN_WIDTH)}%; font-size: ${toPercent(block.fontSize, DESIGN_WIDTH)}cqw; line-height: ${block.lineHeight};${block.color ? ` color: ${block.color};` : ""} }`;
  }
  const base = `#${block.id} { left: ${toPercent(block.x, DESIGN_WIDTH)}%; top: ${toPercent(block.y, DESIGN_HEIGHT)}%; width: ${toPercent(block.width, DESIGN_WIDTH)}%;`;
  if (block.type === "shape") {
    return `${base} height: ${toPercent(block.height, DESIGN_HEIGHT)}%; background: ${block.fill}; }`;
  }
  return `${base} height: ${toPercent(estimateObjectHeight(block), DESIGN_HEIGHT)}%; }`;
}

function textObjectStyle(block: TextBlock): CSSProperties {
  return {
    left: `${toPercent(block.x, DESIGN_WIDTH)}%`,
    top: `${toPercent(block.y, DESIGN_HEIGHT)}%`,
    width: `${toPercent(block.width, DESIGN_WIDTH)}%`,
    fontSize: `${toPercent(block.fontSize, DESIGN_WIDTH)}cqw`,
    lineHeight: block.lineHeight,
    color: block.color,
  };
}

function objectStyle(block: ObjectBlock): CSSProperties {
  return {
    left: `${toPercent(block.x, DESIGN_WIDTH)}%`,
    top: `${toPercent(block.y, DESIGN_HEIGHT)}%`,
    width: `${toPercent(block.width, DESIGN_WIDTH)}%`,
    height: `${toPercent(estimateObjectHeight(block), DESIGN_HEIGHT)}%`,
    background: block.type === "shape" ? block.fill : undefined,
  };
}

function figureCardStyle(card: FigureCard): CSSProperties {
  return {
    left: `${toPercent(card.x, 760)}%`,
    top: `${toPercent(card.y, 440)}%`,
    width: `${toPercent(card.width, 760)}%`,
    height: `${toPercent(card.height, 440)}%`,
  };
}

function textClassNameForNewParagraph(anchor: HTMLElement) {
  const names = anchor.className
    .split(/\s+/)
    .filter((name) => name && !/heading/i.test(name) && name !== "product-title");
  return classNames(...names, "htmlx-paragraph");
}

function copyAttributes(source: HTMLElement, target: HTMLElement) {
  for (const attribute of Array.from(source.attributes)) {
    target.setAttribute(attribute.name, attribute.value);
  }
}

function insertLineBreakIntoEditable(target: HTMLElement) {
  const selection = getSelectionForElement(target);
  if (!selection || selection.rangeCount === 0) {
    target.append(document.createElement("br"));
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const br = document.createElement("br");
  range.insertNode(br);
  range.setStartAfter(br);
  range.setEndAfter(br);
  selection.removeAllRanges();
  selection.addRange(range);
}

function readObjectTextFontSizeCqw(element: HTMLElement, host: HTMLElement | null) {
  const inlineSize = element.style.fontSize.trim();
  const cqwMatch = /^(\d+(?:\.\d+)?)cqw$/i.exec(inlineSize);
  if (cqwMatch) return Number(cqwMatch[1]);
  const computedPx = Number.parseFloat(getComputedStyle(element).fontSize);
  const hostWidth = host?.getBoundingClientRect().width || DESIGN_WIDTH;
  const oneCqw = hostWidth / 100;
  if (!Number.isFinite(computedPx) || computedPx <= 0 || oneCqw <= 0) return 1.2;
  return computedPx / oneCqw;
}

function readActiveInlineTypography(element: HTMLElement, host: HTMLElement | null) {
  const contextElement = getSelectionStyleElement(element) ?? element;
  return {
    fontSizeCqw: readObjectTextFontSizeCqw(contextElement, host),
    color: colorToHex(getComputedStyle(contextElement).color),
  };
}

function getSelectionStyleElement(target: HTMLElement) {
  const selection = getSelectionForElement(target);
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const node =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;
  if (!(node instanceof HTMLElement)) return null;
  if (!target.contains(node) && node !== target) return null;
  return node.closest<HTMLElement>("htmlx-inline, span, strong, em, u, b, i") ?? node;
}

function applyInlineTypographyToSelection(target: HTMLElement, patch: InlineTypographyPatch) {
  const selection = getSelectionForElement(target);
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  if (!selection.toString().trim()) return false;
  if (patch.fontSizeCqw === undefined && !patch.color) return false;
  const range = selection.getRangeAt(0);
  const ancestor =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!ancestor || (!target.contains(ancestor) && ancestor !== target)) return false;
  const selectedText = selection.toString();
  const offsets = getTextSelectionOffsets(target, range);
  const exactStyleElement = findExactSelectionStyleElement(target, range, selectedText);
  if (exactStyleElement) {
    applyInlineTypographyPatch(exactStyleElement, patch);
    applyInlineTypographyPatchToDescendants(exactStyleElement, patch);
    if (offsets) restoreTextSelection({ blockId: "", element: target, ...offsets });
    pruneEmptyInlineSpans(target);
    return true;
  }

  const wrapper = document.createElement("htmlx-inline");
  applyInlineTypographyPatch(wrapper, patch);
  try {
    wrapper.appendChild(range.extractContents());
    removeInlineTypographyPatchFromDescendants(wrapper, patch);
    unwrapEmptyStyleInlineElements(wrapper);
    range.insertNode(wrapper);
    pruneEmptyInlineSpans(target);
    if (offsets) restoreTextSelection({ blockId: "", element: target, ...offsets });
    else {
      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
    return true;
  } catch {
    return false;
  }
}

function applyInlineTypographyPatch(element: HTMLElement, patch: InlineTypographyPatch) {
  element.style.display = "inline";
  if (patch.fontSizeCqw !== undefined) element.style.fontSize = `${patch.fontSizeCqw}cqw`;
  if (patch.color) element.style.color = patch.color;
}

function applyInlineTypographyPatchToDescendants(
  element: HTMLElement,
  patch: InlineTypographyPatch,
) {
  element
    .querySelectorAll<HTMLElement>("htmlx-inline, span[style], strong[style], em[style], u[style]")
    .forEach((child) => applyInlineTypographyPatch(child, patch));
}

function findExactSelectionStyleElement(target: HTMLElement, range: Range, selectedText: string) {
  const normalizedSelection = normalizeInlineText(selectedText);
  if (!normalizedSelection) return null;
  const candidates: Node[] = [
    range.startContainer,
    range.commonAncestorContainer,
    range.endContainer,
  ];
  for (const candidate of candidates) {
    const start = candidate instanceof HTMLElement ? candidate : candidate.parentElement;
    let current: HTMLElement | null = start;
    while (current && current !== target) {
      if (
        current.matches("htmlx-inline, span[style]") &&
        normalizeInlineText(current.textContent ?? "") === normalizedSelection
      ) {
        return current;
      }
      current = current.parentElement;
    }
  }
  return null;
}

function removeInlineTypographyPatchFromDescendants(
  element: HTMLElement,
  patch: InlineTypographyPatch,
) {
  element
    .querySelectorAll<HTMLElement>("htmlx-inline, span[style], strong[style], em[style], u[style]")
    .forEach((child) => {
      if (patch.fontSizeCqw !== undefined) child.style.removeProperty("font-size");
      if (patch.color) child.style.removeProperty("color");
      if (!child.getAttribute("style")?.trim()) child.removeAttribute("style");
    });
}

function unwrapEmptyStyleInlineElements(target: HTMLElement | DocumentFragment) {
  Array.from(target.querySelectorAll<HTMLElement>("htmlx-inline, span")).forEach((element) => {
    if (element.attributes.length === 0) unwrapElement(element);
  });
}

function applyInlineTypographyToPreservedSelection(
  target: HTMLElement,
  context: SurfaceTextSelectionContext | null,
  patch: InlineTypographyPatch,
) {
  if (!context || context.element !== target) return false;
  if (patch.fontSizeCqw === undefined && !patch.color) return false;
  const startPosition = findTextPosition(target, context.start);
  const endPosition = findTextPosition(target, context.end);
  if (!startPosition || !endPosition) return false;
  const wrapper = document.createElement("htmlx-inline");
  applyInlineTypographyPatch(wrapper, patch);
  try {
    const range = document.createRange();
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
    wrapper.appendChild(range.extractContents());
    removeInlineTypographyPatchFromDescendants(wrapper, patch);
    unwrapEmptyStyleInlineElements(wrapper);
    range.insertNode(wrapper);
    pruneEmptyInlineSpans(target);
    const selection = getSelectionForElement(target);
    restoreTextSelection({ ...context, element: target });
    if (!selection?.toString().trim()) {
      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
    }
    return true;
  } catch {
    return false;
  }
}

function isWholeEditableSelection(target: HTMLElement, selection: Selection) {
  const selectedText = normalizeInlineText(selection.toString());
  const targetText = normalizeInlineText(target.textContent ?? "");
  return Boolean(selectedText && targetText && selectedText === targetText);
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function scaleInlineFontSizes(target: HTMLElement, ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - 1) < 0.001) return;
  target
    .querySelectorAll<HTMLElement>('span[style*="font-size"], htmlx-inline[style*="font-size"]')
    .forEach((span) => {
      const nextSize = scaleCssLength(span.style.fontSize, ratio);
      if (nextSize) {
        span.style.fontSize = nextSize;
        span.style.display = "inline";
      }
    });
}

function scaleCssLength(value: string, ratio: number) {
  const match = /^(\d+(?:\.\d+)?)(cqw|px|em|rem)$/i.exec(value.trim());
  if (!match) return "";
  const nextValue = Math.round(Number(match[1]) * ratio * 10000) / 10000;
  return `${nextValue}${match[2].toLowerCase()}`;
}

function pruneEmptyInlineSpans(target: HTMLElement) {
  Array.from(target.querySelectorAll("span, htmlx-inline"))
    .reverse()
    .forEach((span) => {
      if (normalizeInlineText(span.textContent ?? "") || span.querySelector("br,img,svg,table")) {
        return;
      }
      span.remove();
    });
}

function colorToHex(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(trimmed);
  if (!rgb) return "#172033";
  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) => clamp(Number(part), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function prepareDocumentCloneForExport(clone: HTMLElement, assets: AssetState[]) {
  clone
    .querySelectorAll<HTMLElement>("[data-openwebdoc-runtime-control]")
    .forEach((element) => element.remove());
  clone.querySelectorAll<HTMLElement>("[contenteditable]").forEach((element) => {
    element.removeAttribute("contenteditable");
  });
  clone
    .querySelectorAll<HTMLElement>("[data-htmlx-editable], [data-htmlx-object-text]")
    .forEach((element) => {
      element.removeAttribute("spellcheck");
      element.removeAttribute("tabindex");
    });
  clone.querySelectorAll<HTMLElement>("[data-htmlx-runtime-selected]").forEach((element) => {
    delete element.dataset.htmlxRuntimeSelected;
  });
  clone
    .querySelectorAll<HTMLElement>(
      "[data-htmlx-runtime-origin-x], [data-htmlx-runtime-origin-y], .figure-card",
    )
    .forEach((element) => {
      element.style.removeProperty("transform");
      element.style.removeProperty("transform-origin");
    });
  clone.querySelectorAll<HTMLElement>("[data-htmlx-runtime-origin-x]").forEach((element) => {
    delete element.dataset.htmlxRuntimeOriginX;
  });
  clone.querySelectorAll<HTMLElement>("[data-htmlx-runtime-origin-y]").forEach((element) => {
    delete element.dataset.htmlxRuntimeOriginY;
  });
  clone.querySelectorAll<HTMLElement>("[data-htmlx-object-text]").forEach((element) => {
    delete element.dataset.htmlxObjectText;
  });
  clone.querySelectorAll<HTMLElement>("[style]").forEach(cleanRuntimeStyle);
  clone.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const block = image.closest<HTMLElement>("[data-htmlx-block-id]");
    const asset =
      assets.find((item) => item.id === block?.dataset.htmlxAssetId) ??
      assets.find((item) => item.path === image.dataset.htmlxOriginalSrc);
    const originalSrc = asset?.path ?? image.dataset.htmlxOriginalSrc;
    if (originalSrc) image.setAttribute("src", originalSrc);
    delete image.dataset.htmlxOriginalSrc;
  });
}

function prepareDocumentCloneForHistory(clone: HTMLElement) {
  clone
    .querySelectorAll<HTMLElement>("[data-openwebdoc-runtime-control]")
    .forEach((element) => element.remove());
}

function rewritePackageLocalAssetsForRuntime(document: Document, assets: AssetState[]) {
  const assetByPath = new Map(assets.map((asset) => [asset.path, asset]));
  document.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
    const source = image.getAttribute("src") ?? "";
    if (
      !source ||
      source.startsWith("blob:") ||
      source.startsWith("data:") ||
      /^https?:\/\//i.test(source)
    ) {
      return;
    }
    const asset = assetByPath.get(source);
    if (!asset) return;
    image.dataset.htmlxOriginalSrc ||= source;
    image.setAttribute("src", asset.dataUrl);
  });
}

function cleanRuntimeStyle(element: HTMLElement) {
  element.style.removeProperty("cursor");
  element.style.removeProperty("outline");
  element.style.removeProperty("outline-offset");
  if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
}

function resizeObjectBlock(block: ObjectBlock, width: number, height: number): ObjectBlock {
  const nextWidth = clamp(Math.round(width), 90, DESIGN_WIDTH - block.x);
  if (block.type === "shape") {
    return {
      ...block,
      width: nextWidth,
      height: clamp(Math.round(height), 42, DESIGN_HEIGHT - block.y),
    };
  }
  return {
    ...block,
    width: nextWidth,
    height: clamp(Math.round(height), 90, DESIGN_HEIGHT - block.y),
  };
}

function estimateObjectHeight(block: ObjectBlock): number {
  if (typeof block.height === "number") return block.height;
  if (block.type === "shape") return block.height;
  if (block.type === "table") return 150 + block.rows.length * 42;
  if (block.type === "figure") return block.variant === "funnel" ? 560 : 440;
  return Math.round(block.width * 0.62);
}

function objectClass(block: ObjectBlock): string {
  if (block.type === "image") return "image-object";
  if (block.type === "shape") return "shape-object";
  if (block.type === "table") return "table-object";
  return `figure-object figure-${block.variant}`;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  const names = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const name of value.split(/\s+/)) {
      if (name) names.add(name);
    }
  }
  return [...names].join(" ");
}

function summarizeBlock(block: DocumentBlock): string {
  if (isTextBlock(block)) return block.text.trim() || block.type;
  if (block.type === "image") return `Image: ${block.alt}`;
  if (block.type === "shape") return "Rectangle shape";
  if (block.type === "table") return `${block.title}: ${block.caption}`;
  return `${block.title}: ${block.caption}`;
}

function estimateTokens(block: DocumentBlock): number {
  return Math.max(16, Math.ceil(summarizeBlock(block).split(/\s+/).filter(Boolean).length * 1.4));
}

function editableType(
  block: DocumentBlock,
): "heading" | "paragraph" | "image" | "shape" | "table" | "figure" {
  return block.type;
}

function getTitle(blocks: DocumentBlock[]) {
  return (
    blocks.find((block): block is TextBlock => block.type === "heading")?.text.trim() ||
    "Untitled HTMLX Document"
  );
}

function nextParagraphY(blocks: DocumentBlock[]) {
  const maxY = blocks.reduce(
    (value, block) => Math.max(value, block.y + estimateBlockHeight(block)),
    0,
  );
  return Math.min(DESIGN_HEIGHT - 120, maxY + 72);
}

function insertBlockAfter(
  blocks: DocumentBlock[],
  selectedIndex: number,
  newBlock: DocumentBlock,
  shiftY: number,
) {
  const insertionIndex = selectedIndex >= 0 ? selectedIndex + 1 : blocks.length;
  return [
    ...blocks.slice(0, insertionIndex),
    newBlock,
    ...blocks.slice(insertionIndex).map((block) => ({
      ...block,
      y: block.y >= newBlock.y ? Math.min(DESIGN_HEIGHT - 24, block.y + shiftY) : block.y,
    })),
  ];
}

function estimateBlockHeight(block: DocumentBlock) {
  if (isTextBlock(block)) return block.fontSize * block.lineHeight * 3;
  return estimateObjectHeight(block);
}

function createInitialIconAssets(): AssetState[] {
  return Object.entries(proposalIconDataUrls).map(([key, value]) => {
    const slug = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    return {
      id: `icon-${slug}`,
      name: value.name,
      path: `assets/icons/${value.name}`,
      mediaType: value.mediaType,
      bytes: dataUrlToBytes(value.dataUrl),
      dataUrl: value.dataUrl,
    };
  });
}

async function fileToAsset(file: File): Promise<AssetState> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = sanitizeAssetName(file.name);
  return {
    id: assetIdFromPath(`assets/${safeName}`),
    name: safeName,
    path: `assets/${safeName}`,
    mediaType: file.type || "application/octet-stream",
    bytes,
    dataUrl: await fileToDataUrl(file),
  };
}

function resource(
  path: string,
  mediaType: string,
  role: "stylesheet" | "metadata" | "image",
  integrity: string,
) {
  return { path, mediaType, role, integrity };
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPercent(value: number, base: number) {
  return ((value / base) * 100).toFixed(4);
}

function toCqw(value: number) {
  return ((value / DESIGN_WIDTH) * 100).toFixed(4);
}

function toStageCqw(value: number, stageWidth: number) {
  return ((value / stageWidth) * 100).toFixed(4);
}

function getElementStageWidth(element: HTMLElement) {
  const stage = element.closest<HTMLElement>("[data-htmlx-stage-width]");
  return readNumber(stage?.dataset.htmlxStageWidth, DESIGN_WIDTH);
}

function getStageScale(stage: HTMLElement | null) {
  return stage ? Math.max(0.1, stage.getBoundingClientRect().width / DESIGN_WIDTH) : 1;
}

function getInitialToolbarPosition(): ToolbarPosition {
  if (typeof window === "undefined") return { x: 8, y: 16 };
  const x = Math.max(8, window.innerWidth - TOOLBAR_ANCHOR_WIDTH - 16);
  const y =
    window.innerWidth < 720 ? Math.max(8, window.innerHeight - TOOLBAR_ANCHOR_HEIGHT - 16) : 16;
  return { x, y };
}

function clampToolbarPosition(position: ToolbarPosition): ToolbarPosition {
  if (typeof window === "undefined") return position;
  return {
    x: clamp(Math.round(position.x), 8, Math.max(8, window.innerWidth - TOOLBAR_ANCHOR_WIDTH - 8)),
    y: clamp(
      Math.round(position.y),
      8,
      Math.max(8, window.innerHeight - TOOLBAR_ANCHOR_HEIGHT - 8),
    ),
  };
}

function getToolbarPlacement(position: ToolbarPosition) {
  if (typeof window === "undefined") return { openLeft: false, openUp: false };
  return {
    openLeft: position.x > window.innerWidth * 0.48,
    openUp: position.y > window.innerHeight * 0.54,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isTextBlock(block: DocumentBlock): block is TextBlock {
  return block.type === "heading" || block.type === "paragraph";
}

function isObjectBlock(block: DocumentBlock): block is ObjectBlock {
  return (
    block.type === "image" ||
    block.type === "shape" ||
    block.type === "table" ||
    block.type === "figure"
  );
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[contenteditable="true"]')) return true;
  const formControl = target.closest("input, textarea, select");
  if (!(formControl instanceof HTMLElement)) return false;
  if (formControl instanceof HTMLInputElement) {
    return !["button", "checkbox", "color", "file", "radio", "range", "submit"].includes(
      formControl.type,
    );
  }
  return true;
}

function isElementLike(target: EventTarget | null): target is Element {
  return Boolean(
    target &&
    typeof (target as Element).closest === "function" &&
    typeof (target as Element).querySelectorAll === "function",
  );
}

function isPointingEvent(
  event: globalThis.Event,
): event is globalThis.PointerEvent | globalThis.MouseEvent {
  return event instanceof globalThis.PointerEvent || event instanceof globalThis.MouseEvent;
}

function isTextMutationKey(event: globalThis.KeyboardEvent) {
  return (
    event.key.length === 1 ||
    event.key === "Backspace" ||
    event.key === "Delete" ||
    event.key === "Enter"
  );
}

function createBlockId() {
  return `block-${crypto.randomUUID().slice(0, 8)}`;
}

function sanitizeAssetName(value: string) {
  return value.replaceAll(/[^\w.-]/g, "-").replaceAll(/^-+|-+$/g, "") || "asset";
}

function assetIdFromPath(value: string) {
  return `asset-${value.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "")}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function bytesToDataUrl(bytes: Uint8Array, mediaType: string): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([copy.buffer as ArrayBuffer], { type: mediaType }));
  });
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeText(value: string) {
  return new TextEncoder().encode(value);
}

function encodeJson(value: unknown) {
  return encodeText(`${JSON.stringify(value, null, 2)}\n`);
}

async function sha256Integrity(bytes: Uint8Array) {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const hash = await crypto.subtle.digest("SHA-256", input.buffer);
  return `sha256-${btoa(String.fromCharCode(...new Uint8Array(hash)))}`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "document"
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

createRoot(document.getElementById("root")!).render(<OpenWebDocApp />);
