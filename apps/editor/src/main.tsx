import "@openwebdoc/ui/styles.css";
import "./style.css";
import {
  HTMLX_EDITING_METADATA_SCHEMA_URL,
  createDefaultManifest,
  type HtmlxEditingMetadata,
  type HtmlxLlmMetadata,
  type HtmlxManifest,
} from "@openwebdoc/spec";
import {
  CheckCircle2,
  Download,
  FileText,
  GripHorizontal,
  GripVertical,
  ImagePlus,
  Info,
  Menu,
  MousePointer2,
  Square,
  Table2,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { proposalIconDataUrls } from "./generatedIcons";

const DESIGN_WIDTH = 980;
const DESIGN_HEIGHT = 7200;
const TOOLBAR_ANCHOR_WIDTH = 188;
const TOOLBAR_ANCHOR_HEIGHT = 48;
const HISTORY_LIMIT = 100;

type TextBlockType = "heading" | "paragraph";
type FigureVariant = "cards" | "flow" | "roadmap" | "funnel" | "boundary";

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
  fontSize: number;
  lineHeight: number;
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

type EditorBlock = TextBlock | ImageBlock | ShapeBlock | TableBlock | FigureBlock;
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

interface EditorSnapshot {
  blocks: EditorBlock[];
  assets: AssetState[];
  selectedBlockId: string;
}

const initialAssets = createInitialIconAssets();
const initialBlocks = createInitialBlocks();

function EditorApp() {
  const stageRef = useRef<HTMLElement | null>(null);
  const textDraftsRef = useRef(new Map<string, string>());
  const toolbarDragMovedRef = useRef(false);
  const [blocks, setBlocks] = useState<EditorBlock[]>(initialBlocks);
  const [assets, setAssets] = useState<AssetState[]>(initialAssets);
  const [selectedBlockId, setSelectedBlockId] = useState(initialBlocks[0]?.id ?? "");
  const documentStateRef = useRef<EditorSnapshot>({
    blocks: initialBlocks,
    assets: initialAssets,
    selectedBlockId: initialBlocks[0]?.id ?? "",
  });
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const activeTextHistoryRef = useRef(new Set<string>());
  const [editing, setEditing] = useState(true);
  const dragStateRef = useRef<DragState | null>(null);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(true);
  const [toolbarPosition, setToolbarPosition] = useState(getInitialToolbarPosition);
  const toolbarDragStateRef = useRef<ToolbarDragState | null>(null);
  const figureCardDragStateRef = useRef<FigureCardDragState | null>(null);
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
  const wordCount = textBlocks
    .map((block) => block.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  useLayoutEffect(() => {
    documentStateRef.current = { blocks, assets, selectedBlockId };
  }, [assets, blocks, selectedBlockId]);

  useLayoutEffect(() => {
    function handleKeyboardUndoRedo(event: KeyboardEvent) {
      const isUndoOrRedo =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        !event.altKey &&
        !event.repeat;
      if (!isUndoOrRedo) return;
      const targetIsEditable = isContentEditableTarget(event.target);
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
    }

    window.addEventListener("keydown", handleKeyboardUndoRedo, true);
    return () => window.removeEventListener("keydown", handleKeyboardUndoRedo, true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBundledExample() {
      const response = await fetch("/examples/rich-self-editable.htmlx");
      if (!response.ok || cancelled) return;
      await openDocumentBytes(new Uint8Array(await response.arrayBuffer()), false);
    }
    void loadBundledExample();
    return () => {
      cancelled = true;
    };
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

  function recordHistory() {
    undoStackRef.current = [...undoStackRef.current, documentStateRef.current].slice(
      -HISTORY_LIMIT,
    );
    redoStackRef.current = [];
  }

  function restoreSnapshot(snapshot: EditorSnapshot) {
    textDraftsRef.current.clear();
    activeTextHistoryRef.current.clear();
    dragStateRef.current = null;
    figureCardDragStateRef.current = null;
    setAssets(snapshot.assets);
    setBlocks(snapshot.blocks);
    setSelectedBlockId(snapshot.selectedBlockId);
  }

  function undoDocument() {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, documentStateRef.current].slice(
      -HISTORY_LIMIT,
    );
    restoreSnapshot(previous);
  }

  function redoDocument() {
    const next = redoStackRef.current.at(-1);
    if (!next) return;
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, documentStateRef.current].slice(
      -HISTORY_LIMIT,
    );
    restoreSnapshot(next);
  }

  function updateTextBlock(blockId: string, text: string) {
    const existing = documentStateRef.current.blocks.find(
      (block): block is TextBlock => block.id === blockId && isTextBlock(block),
    );
    if (existing?.text === text) {
      textDraftsRef.current.delete(blockId);
      return;
    }
    recordHistory();
    textDraftsRef.current.delete(blockId);
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockId && isTextBlock(block) ? { ...block, text } : block,
      ),
    );
  }

  function rememberTextDraft(blockId: string, text: string) {
    const current = documentStateRef.current;
    const existing = current.blocks.find(
      (block): block is TextBlock => block.id === blockId && isTextBlock(block),
    );
    if (!existing || existing.text === text) return;
    if (!activeTextHistoryRef.current.has(blockId)) {
      recordHistory();
      activeTextHistoryRef.current.add(blockId);
    }
    textDraftsRef.current.set(blockId, text);
    documentStateRef.current = {
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId && isTextBlock(block) ? { ...block, text } : block,
      ),
    };
  }

  function commitTextDraft(blockId: string) {
    if (!textDraftsRef.current.has(blockId)) return;
    textDraftsRef.current.delete(blockId);
    activeTextHistoryRef.current.delete(blockId);
    setBlocks(documentStateRef.current.blocks);
  }

  function getDomSyncedBlocks(): EditorBlock[] {
    const stage = stageRef.current;
    if (!stage) return blocks;
    const textById = new Map<string, string>();
    stage.querySelectorAll<HTMLElement>('[data-htmlx-editable="text"]').forEach((element) => {
      const id = element.dataset.htmlxBlockId;
      if (id) textById.set(id, element.innerText.trim());
    });
    return blocks.map((block) =>
      isTextBlock(block)
        ? {
            ...block,
            text: textById.get(block.id) ?? textDraftsRef.current.get(block.id) ?? block.text,
          }
        : block,
    );
  }

  async function openDocumentBytes(bytes: Uint8Array, record = true) {
    const { openHtmlx, decodeText } = await import("@openwebdoc/core");
    const htmlxPackage = await openHtmlx(bytes);
    const nextAssets = await packageAssetsToState(htmlxPackage.files, htmlxPackage.manifest);
    const html = decodeText(htmlxPackage.files.get(htmlxPackage.manifest.entry)!);
    const stylesheetPath = htmlxPackage.manifest.styles?.[0] ?? "styles/document.css";
    const css = decodeText(htmlxPackage.files.get(stylesheetPath) ?? new Uint8Array());
    const parsedBlocks = parseEditableBlocks(html, nextAssets);
    if (parsedBlocks.length === 0) {
      setIssues([
        {
          severity: "error",
          code: "editor.no_editable_blocks",
          message: "No self-editable HTMLX blocks were found.",
          path: htmlxPackage.manifest.entry,
        },
      ]);
      setDrawer("info");
      return;
    }
    if (record) recordHistory();
    textDraftsRef.current.clear();
    setAssets(nextAssets.length ? nextAssets : initialAssets);
    setBlocks(parsedBlocks);
    setDocumentCss(css);
    setSelectedBlockId("");
    setLastManifest(htmlxPackage.manifest);
    setIssues(htmlxPackage.validation.issues);
  }

  async function openDocument(file: File) {
    await openDocumentBytes(new Uint8Array(await file.arrayBuffer()), true);
  }

  function addParagraph() {
    const id = createBlockId();
    recordHistory();
    setBlocks((current) => [
      ...current,
      {
        id,
        type: "paragraph",
        text: "New paragraph",
        x: 64,
        y: nextParagraphY(current),
        width: 720,
        fontSize: 16,
        lineHeight: 1.5,
      },
    ]);
    setSelectedBlockId(id);
  }

  async function addImage(file: File) {
    const asset = await fileToAsset(file);
    const id = createBlockId();
    recordHistory();
    setAssets((current) => [...current, asset]);
    setBlocks((current) => [
      ...current,
      { id, type: "image", assetId: asset.id, alt: file.name, x: 560, y: 180, width: 300 },
    ]);
    setSelectedBlockId(id);
  }

  async function replaceSelectedImage(file: File) {
    const selected = selectedBlock;
    if (!selected || selected.type !== "image") return;
    const asset = await fileToAsset(file);
    recordHistory();
    setAssets((current) => [...current, asset]);
    setBlocks((current) =>
      current.map((block) =>
        block.id === selected.id && block.type === "image"
          ? { ...block, assetId: asset.id, alt: file.name }
          : block,
      ),
    );
  }

  function addShape() {
    const id = createBlockId();
    recordHistory();
    setBlocks((current) => {
      const y = Math.min(DESIGN_HEIGHT - 140, nextParagraphY(current));
      return [
        ...current,
        {
          id,
          type: "shape",
          shape: "rectangle",
          x: 68,
          y,
          width: 180,
          height: 96,
          fill: "#dbeafe",
        },
      ];
    });
    setSelectedBlockId(id);
  }

  function addTable() {
    const id = createBlockId();
    recordHistory();
    setBlocks((current) => [
      ...current,
      {
        id,
        type: "table",
        title: "Editable table",
        caption: "A semantic HTML table block.",
        x: 80,
        y: nextParagraphY(current) + 120,
        width: 760,
        columns: ["Item", "Owner", "Status"],
        rows: [
          ["Document", "Editor", "ready"],
          ["Validation", "Core", "required"],
          ["Export", "CLI", "checked"],
        ],
      },
    ]);
    setSelectedBlockId(id);
  }

  function deleteSelectedBlock() {
    const selected = selectedBlock;
    if (!selected) return;
    if (
      selected.type === "paragraph" &&
      blocks.filter((block) => block.type === "paragraph").length === 1
    ) {
      updateTextBlock(selected.id, "");
      return;
    }
    recordHistory();
    setBlocks((current) => {
      const next = current.filter((block) => block.id !== selected.id);
      setSelectedBlockId(next[0]?.id ?? "");
      return next;
    });
  }

  function updateSelectedShapeFill(fill: string) {
    const selected = selectedBlock;
    if (!selected || selected.type !== "shape") return;
    if (selected.fill === fill) return;
    recordHistory();
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
    const syncedBlocks = getDomSyncedBlocks();
    setBlocks(syncedBlocks);
    const { archive, manifest } = await buildPackage(syncedBlocks, assets);
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
    const syncedBlocks = getDomSyncedBlocks();
    setBlocks(syncedBlocks);
    const { archive, manifest } = await buildPackage(syncedBlocks, assets);
    const { validateHtmlx } = await import("@openwebdoc/core");
    const validation = await validateHtmlx(archive);
    setIssues(validation.issues);
    setLastManifest(manifest);
    setDrawer("info");
  }

  return (
    <main className="self-editing-shell">
      <FloatingControls
        editing={editing}
        collapsed={toolbarCollapsed}
        position={toolbarPosition}
        selectedBlock={selectedBlock}
        onToggleEditing={() => setEditing((value) => !value)}
        onToggleCollapsed={() => setToolbarCollapsed((value) => !value)}
        onAddParagraph={addParagraph}
        onAddImage={addImage}
        onReplaceImage={replaceSelectedImage}
        onAddShape={addShape}
        onAddTable={addTable}
        onOpenDocument={openDocument}
        onValidate={() => void validateCurrentPackage()}
        onExport={() => void exportPackage()}
        onShowInfo={() => setDrawer("info")}
        onDeleteSelected={deleteSelectedBlock}
        onShapeFillChange={updateSelectedShapeFill}
        onToolbarPointerDown={startToolbarDrag}
        onToolbarPointerMove={updateToolbarDrag}
        onToolbarPointerUp={stopToolbarDrag}
      />

      <section className="document-stage-wrap" aria-label="Self-editable HTMLX document">
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
              setSelectedBlockId("");
            }
          }}
        >
          {documentCss ? <style>{scopeDocumentCssForEditor(documentCss)}</style> : null}
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
              />
            ))}
          </section>
        </main>
      </section>

      {drawer === "info" ? (
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

function EditableTextBlock({
  block,
  editing,
  selected,
  onSelect,
  onDraft,
  onCommit,
}: {
  block: TextBlock;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onDraft: (blockId: string, text: string) => void;
  onCommit: (blockId: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    if (element.innerText !== block.text) element.innerText = block.text;
  }, [block.id, block.text]);

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
    onInput: (event: FormEvent<HTMLElement>) => onDraft(block.id, event.currentTarget.innerText),
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
  editing,
  collapsed,
  position,
  selectedBlock,
  onToggleEditing,
  onToggleCollapsed,
  onAddParagraph,
  onAddImage,
  onReplaceImage,
  onAddShape,
  onAddTable,
  onOpenDocument,
  onValidate,
  onExport,
  onShowInfo,
  onDeleteSelected,
  onShapeFillChange,
  onToolbarPointerDown,
  onToolbarPointerMove,
  onToolbarPointerUp,
}: {
  editing: boolean;
  collapsed: boolean;
  position: ToolbarPosition;
  selectedBlock: EditorBlock | undefined;
  onToggleEditing: () => void;
  onToggleCollapsed: () => void;
  onAddParagraph: () => void;
  onAddImage: (file: File) => Promise<void>;
  onReplaceImage: (file: File) => Promise<void>;
  onAddShape: () => void;
  onAddTable: () => void;
  onOpenDocument: (file: File) => Promise<void>;
  onValidate: () => void;
  onExport: () => void;
  onShowInfo: () => void;
  onDeleteSelected: () => void;
  onShapeFillChange: (fill: string) => void;
  onToolbarPointerDown: (event: PointerEvent<HTMLElement>, source: "menu" | "grip") => void;
  onToolbarPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onToolbarPointerUp: () => void;
}) {
  const isImageSelected = selectedBlock?.type === "image";
  const isShapeSelected = selectedBlock?.type === "shape";
  const placement = getToolbarPlacement(position);
  const controlsClassName = [
    "floating-controls",
    collapsed ? "collapsed" : "expanded",
    placement.openLeft ? "open-left" : "open-right",
    placement.openUp ? "open-up" : "open-down",
  ].join(" ");

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
        <span className="brand-chip" title="HTMLX Document Package">
          <FileText size={15} />
          <span>HTMLX</span>
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
            {isShapeSelected ? (
              <label className="color-control" aria-label="Shape color" title="Shape color">
                <input
                  type="color"
                  value={selectedBlock.fill}
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
          <div className="toolbar-button-grid">
            <button
              type="button"
              className={editing ? "overlay-button active" : "overlay-button"}
              onClick={onToggleEditing}
              aria-label={editing ? "Switch to reading mode" : "Switch to editing mode"}
              title={editing ? "Reading mode" : "Editing mode"}
            >
              <MousePointer2 size={17} />
            </button>
            <label className="overlay-button" aria-label="Open .htmlx document" title="Open .htmlx">
              <Upload size={17} />
              <input
                type="file"
                accept=".htmlx,application/vnd.openwebdoc.htmlx+zip"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void onOpenDocument(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="overlay-button"
              onClick={onAddParagraph}
              aria-label="Add paragraph"
              title="Paragraph"
            >
              <Type size={17} />
            </button>
            <label className="overlay-button" aria-label="Add image" title="Image">
              <ImagePlus size={17} />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void onAddImage(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="overlay-button"
              onClick={onAddShape}
              aria-label="Add rectangle"
              title="Rectangle"
            >
              <Square size={17} />
            </button>
            <button
              type="button"
              className="overlay-button"
              onClick={onAddTable}
              aria-label="Add table"
              title="Table"
            >
              <Table2 size={17} />
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
              aria-label="Export .htmlx"
              title="Export .htmlx"
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
    </aside>
  );
}

function createInitialBlocks(): EditorBlock[] {
  return [
    {
      id: "block-title",
      type: "heading",
      text: "Untitled HTMLX Document",
      x: 64,
      y: 64,
      width: 640,
      fontSize: 36,
      lineHeight: 1.08,
    },
    {
      id: "block-1",
      type: "paragraph",
      text: "Open a .htmlx package or use the bundled example package.",
      x: 64,
      y: 140,
      width: 620,
      fontSize: 16,
      lineHeight: 1.5,
    },
  ];
}

async function buildPackage(blocks: EditorBlock[], assets: AssetState[]) {
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
    createdBy: "@openwebdoc/editor",
    createdAt: now,
    editorMode: "self-editable-document",
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

function buildHtml(blocks: EditorBlock[], assets: AssetState[]): string {
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

function blockToHtml(block: EditorBlock, assets: AssetState[]): string {
  if (block.type === "heading") {
    return `<h1 id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-text", "htmlx-heading", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="heading" data-htmlx-editable="text" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-font-size="${block.fontSize}" data-htmlx-line-height="${block.lineHeight}">${escapeHtml(block.text)}</h1>`;
  }
  if (block.type === "paragraph") {
    return `<p id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-text", "htmlx-paragraph", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="paragraph" data-htmlx-editable="text" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-font-size="${block.fontSize}" data-htmlx-line-height="${block.lineHeight}">${escapeHtml(block.text)}</p>`;
  }
  if (block.type === "image") {
    const asset = assets.find((item) => item.id === block.assetId);
    if (!asset) return "";
    return `<figure id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-object", "htmlx-image", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="image" data-htmlx-editable="object" data-htmlx-asset-id="${escapeHtmlAttribute(block.assetId)}" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-height="${estimateObjectHeight(block)}"><img src="${escapeHtmlAttribute(asset.path)}" alt="${escapeHtmlAttribute(block.alt)}"></figure>`;
  }
  if (block.type === "shape") {
    return `<div id="${block.id}" class="${escapeHtmlAttribute(classNames("htmlx-object", "htmlx-shape", "htmlx-shape-rectangle", block.sourceClassName))}" data-htmlx-block-id="${block.id}" data-htmlx-kind="shape" data-htmlx-editable="object" data-htmlx-shape="rectangle" data-htmlx-x="${block.x}" data-htmlx-y="${block.y}" data-htmlx-width="${block.width}" data-htmlx-height="${block.height}" data-htmlx-fill="${escapeHtmlAttribute(block.fill)}" aria-label="Rectangle shape"></div>`;
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

function buildDocumentCss(blocks: EditorBlock[]): string {
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

function buildLlmMetadata(blocks: EditorBlock[]): HtmlxLlmMetadata {
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

function buildEditingMetadata(blocks: EditorBlock[], assets: AssetState[]): HtmlxEditingMetadata {
  return {
    $schema: HTMLX_EDITING_METADATA_SCHEMA_URL,
    schemaVersion: "0.1.0",
    mode: "self-editable-document",
    runtime: "@openwebdoc/editor",
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

function parseEditableBlocks(html: string, assets: AssetState[]): EditorBlock[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const parsed: Array<EditorBlock | null> = Array.from(
    document.querySelectorAll<HTMLElement>("[data-htmlx-block-id]"),
  ).map((element): EditorBlock | null => {
    const id = element.dataset.htmlxBlockId;
    const kind = element.dataset.htmlxKind;
    if (!id || !kind) return null;
    const x = readNumber(element.dataset.htmlxX, 64);
    const y = readNumber(element.dataset.htmlxY, 64);
    const width = readNumber(element.dataset.htmlxWidth, 720);
    if (kind === "heading" || kind === "paragraph") {
      return {
        id,
        type: kind,
        text: normalizeEditableText(element.innerText),
        x,
        y,
        width,
        sourceClassName: element.className,
        fontSize: readNumber(element.dataset.htmlxFontSize, kind === "heading" ? 34 : 16),
        lineHeight: readNumber(element.dataset.htmlxLineHeight, kind === "heading" ? 1.08 : 1.5),
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
      return {
        id,
        type: "shape",
        shape: "rectangle",
        x,
        y,
        width,
        height: readNumber(element.dataset.htmlxHeight, 96),
        fill: element.dataset.htmlxFill || "#dbeafe",
        sourceClassName: element.className,
      };
    }
    if (kind === "table") {
      return {
        id,
        type: "table",
        title: element.querySelector("figcaption strong")?.textContent?.trim() || "Table",
        caption: element.querySelector("figcaption span")?.textContent?.trim() || "",
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
      return {
        id,
        type: "figure",
        title: element.querySelector("figcaption strong")?.textContent?.trim() || "Figure",
        caption: element.querySelector("figcaption span")?.textContent?.trim() || "",
        variant: (element.dataset.htmlxVariant as FigureVariant) || "cards",
        cards: Array.from(element.querySelectorAll(".figure-card")).map((card) => {
          const src = card.querySelector("img")?.getAttribute("src") ?? "";
          const asset = assets.find((item) => item.path === src);
          return {
            title: card.querySelector("strong")?.textContent?.trim() || "",
            body: card.querySelector("span")?.textContent?.trim() || "",
            iconAssetId: asset?.id,
            x: readNumber((card as HTMLElement).dataset.htmlxCardX, 0),
            y: readNumber((card as HTMLElement).dataset.htmlxCardY, 0),
            width: readNumber((card as HTMLElement).dataset.htmlxCardWidth, 170),
            height: readNumber((card as HTMLElement).dataset.htmlxCardHeight, 110),
          };
        }),
        x,
        y,
        width,
        height: readNumber(element.dataset.htmlxHeight, 440),
        sourceClassName: element.className,
      };
    }
    return null;
  });
  return parsed.filter((block): block is EditorBlock => Boolean(block));
}

function normalizeEditableText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function scopeDocumentCssForEditor(css: string): string {
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

function objectRule(block: EditorBlock): string {
  if (isTextBlock(block)) {
    return `#${block.id} { left: ${toPercent(block.x, DESIGN_WIDTH)}%; top: ${toPercent(block.y, DESIGN_HEIGHT)}%; width: ${toPercent(block.width, DESIGN_WIDTH)}%; font-size: ${toPercent(block.fontSize, DESIGN_WIDTH)}cqw; line-height: ${block.lineHeight}; }`;
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

function summarizeBlock(block: EditorBlock): string {
  if (isTextBlock(block)) return block.text.trim() || block.type;
  if (block.type === "image") return `Image: ${block.alt}`;
  if (block.type === "shape") return "Rectangle shape";
  if (block.type === "table") return `${block.title}: ${block.caption}`;
  return `${block.title}: ${block.caption}`;
}

function estimateTokens(block: EditorBlock): number {
  return Math.max(16, Math.ceil(summarizeBlock(block).split(/\s+/).filter(Boolean).length * 1.4));
}

function editableType(
  block: EditorBlock,
): "heading" | "paragraph" | "image" | "shape" | "table" | "figure" {
  return block.type;
}

function getTitle(blocks: EditorBlock[]) {
  return (
    blocks.find((block): block is TextBlock => block.type === "heading")?.text.trim() ||
    "Untitled HTMLX Document"
  );
}

function nextParagraphY(blocks: EditorBlock[]) {
  const maxY = blocks.reduce(
    (value, block) => Math.max(value, block.y + estimateBlockHeight(block)),
    0,
  );
  return Math.min(DESIGN_HEIGHT - 120, maxY + 72);
}

function estimateBlockHeight(block: EditorBlock) {
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

function isTextBlock(block: EditorBlock): block is TextBlock {
  return block.type === "heading" || block.type === "paragraph";
}

function isObjectBlock(block: EditorBlock): block is ObjectBlock {
  return (
    block.type === "image" ||
    block.type === "shape" ||
    block.type === "table" ||
    block.type === "figure"
  );
}

function isContentEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('[contenteditable="true"]'));
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

createRoot(document.getElementById("root")!).render(<EditorApp />);
