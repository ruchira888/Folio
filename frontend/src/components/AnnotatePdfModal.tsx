import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Download,
  MousePointer2,
  PenTool,
  Stamp,
  Plus,
  Trash2,
  Loader2,
  Type,
  Upload,
  Pen,
  ZoomIn,
  ZoomOut,
  Check,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import ModalOverlay from "./ModalOverlay";
import ToolModal from "./ToolModal";
import { validateToolFiles } from "../utils/validateToolFiles";
import { extractPdfTextBlocks } from "../utils/pdfTextExtract";

// ─── PDF.js worker setup ───────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// ─── Types ─────────────────────────────────────────────────────────────────────
type EditorMode = "selection" | "edit" | "textbox" | "signature" | "highlight";

interface TextAnnotation {
  id: string;
  pageIndex: number;
  /** X position in PDF points from left */
  x: number;
  /** Y position in PDF points from top */
  y: number;
  /** Width in PDF points */
  width: number;
  /** Height in PDF points */
  height: number;
  /** Replacement text */
  text: string;
  /** Font size in PDF points */
  fontSize: number;
  /** Hex colour */
  color: string;
  /**
   * Best-effort background colour under the original text (used to "cover" the old
   * text when writing the replacement back into the PDF).
   *
   * If not present, we try to sample it from the rendered canvas at apply time.
   */
  coverColor?: string;
  /** Parsed from the PDF text layer */
  isExtracted?: boolean;
  /** Original text before user edits */
  originalText?: string;
  /** Baseline Y in PDF coords (origin bottom-left) */
  pdfBaselineY?: number;
}

type MarkupKind = "highlight" | "underline" | "strikeout" | "squiggly";

interface MarkupAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: MarkupKind;
  color: string; // hex
  opacity: number; // 0..1
}

interface SignatureAnnotation {
  id: string;
  pageIndex: number;
  /** X position in PDF points from left */
  x: number;
  /** Y position in PDF points from top */
  y: number;
  /** Width in PDF points */
  width: number;
  /** Height in PDF points */
  height: number;
  /** Base64 PNG data URL */
  imageDataUrl: string;
}

interface SavedSignature {
  id: string;
  /** Base64 PNG data URL */
  imageDataUrl: string;
  label: string;
  createdAt: number;
}

interface TextboxDraft {
  pageIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  viewport: pdfjsLib.PageViewport;
}

interface TextLayerItem {
  text: string;
  left: number;
  top: number;
  fontSize: number;
  width: number;
}

interface DragSelectionRect {
  pageIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface HighlightPreviewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert PDF-point coordinates to CSS pixels in the page container.
 * Annotations are stored in PDF points; the canvas is rendered at RENDER_SCALE.
 */
function pdfPointsToCss(pdfPoints: number, displayScale: number): number {
  return pdfPoints * displayScale;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const RENDER_SCALE = 1.5;
const STORAGE_KEY = "folio_saved_signatures";
const HIGHLIGHT_PASTEL_COLORS = [
  "#FBCFE8", // pastel pink
  "#FDBA74", // pastel orange
  "#FDE68A", // pastel yellow
  "#BBF7D0", // pastel green
  "#A7F3D0", // pastel mint
  "#A5F3FC", // pastel cyan
  "#BFDBFE", // pastel blue
  "#C7D2FE", // pastel indigo
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
  return buffer.slice(0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hexToPdfRgb(hex: string) {
  if (
    !hex ||
    typeof hex !== "string" ||
    !hex.startsWith("#") ||
    hex.length !== 7
  ) {
    return rgb(0, 0, 0);
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  );
}

function hexToRgbChannels(
  hex: string,
): { r: number; g: number; b: number } | null {
  if (
    !hex ||
    typeof hex !== "string" ||
    !hex.startsWith("#") ||
    hex.length !== 7
  ) {
    return null;
  }
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function quantizeRgbToKey(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
}

function quantizedKeyToHex(key: number): string {
  const r = ((key >> 8) & 0xf) * 17;
  const g = ((key >> 4) & 0xf) * 17;
  const b = (key & 0xf) * 17;
  const toHex2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/**
 * Samples the most common colour in a region of a rendered PDF canvas.
 * This is a best-effort heuristic used to preserve highlight/box backgrounds
 * when we redraw edited text back into the PDF.
 */
function sampleDominantHexColorFromCanvas(
  canvas: HTMLCanvasElement,
  regionPx: { x: number; y: number; width: number; height: number },
): string | null {
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  } as any) as CanvasRenderingContext2D | null;
  if (!ctx) return null;

  const x0 = Math.floor(regionPx.x);
  const y0 = Math.floor(regionPx.y);
  const w0 = Math.ceil(regionPx.width);
  const h0 = Math.ceil(regionPx.height);

  const sx = clamp(x0, 0, Math.max(0, canvas.width - 1));
  const sy = clamp(y0, 0, Math.max(0, canvas.height - 1));
  const sw = clamp(w0, 1, canvas.width - sx);
  const sh = clamp(h0, 1, canvas.height - sy);

  const histogram = new Map<number, number>();

  // Quantize to 4 bits/channel (0-15) for stability across anti-aliasing.
  const addPatch = (px: number, py: number, pw: number, ph: number) => {
    const ax = clamp(Math.floor(px), 0, Math.max(0, canvas.width - 1));
    const ay = clamp(Math.floor(py), 0, Math.max(0, canvas.height - 1));
    const aw = clamp(Math.ceil(pw), 1, canvas.width - ax);
    const ah = clamp(Math.ceil(ph), 1, canvas.height - ay);

    let patch: ImageData;
    try {
      patch = ctx.getImageData(ax, ay, aw, ah);
    } catch {
      return;
    }

    const data = patch.data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 0;
      if (a < 200) continue;
      const rQ = (data[i] ?? 0) >> 4;
      const gQ = (data[i + 1] ?? 0) >> 4;
      const bQ = (data[i + 2] ?? 0) >> 4;
      const key = (rQ << 8) | (gQ << 4) | bQ;
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  };

  /**
   * Important: the bounding boxes we use are often tight around the glyphs.
   * If we sample the whole region, the "dominant" colour can become the text
   * colour (e.g. white text on a blue background) which causes the white-blob bug.
   *
   * So we sample small patches near the corners (where background is most likely),
   * plus a thin outer margin when possible.
   */
  const minSide = Math.min(sw, sh);
  const patchSize = clamp(Math.floor(minSide * 0.35), 4, 14);
  const cornerInset = clamp(Math.floor(minSide * 0.12), 1, 8);

  // Corner patches (inside region)
  addPatch(sx + cornerInset, sy + cornerInset, patchSize, patchSize); // TL
  addPatch(
    sx + sw - cornerInset - patchSize,
    sy + cornerInset,
    patchSize,
    patchSize,
  ); // TR
  addPatch(
    sx + cornerInset,
    sy + sh - cornerInset - patchSize,
    patchSize,
    patchSize,
  ); // BL
  addPatch(
    sx + sw - cornerInset - patchSize,
    sy + sh - cornerInset - patchSize,
    patchSize,
    patchSize,
  ); // BR

  // Thin outer frame (outside region), helps for solid highlight/box backgrounds
  const outer = 3;
  addPatch(sx - outer, sy - outer, sw + outer * 2, outer); // top
  addPatch(sx - outer, sy + sh, sw + outer * 2, outer); // bottom
  addPatch(sx - outer, sy, outer, sh); // left
  addPatch(sx + sw, sy, outer, sh); // right

  let bestKey: number | null = null;
  let bestCount = 0;
  for (const [key, count] of histogram.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  if (bestKey === null) return null;
  return quantizedKeyToHex(bestKey);
}

function sampleForegroundHexColorFromCanvas(
  canvas: HTMLCanvasElement,
  regionPx: { x: number; y: number; width: number; height: number },
  backgroundHex?: string,
): string | null {
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  } as any) as CanvasRenderingContext2D | null;
  if (!ctx) return null;

  const x = clamp(Math.floor(regionPx.x), 0, Math.max(0, canvas.width - 1));
  const y = clamp(Math.floor(regionPx.y), 0, Math.max(0, canvas.height - 1));
  const width = clamp(Math.ceil(regionPx.width), 1, canvas.width - x);
  const height = clamp(Math.ceil(regionPx.height), 1, canvas.height - y);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(x, y, width, height);
  } catch {
    return null;
  }

  const bg = backgroundHex ? hexToRgbChannels(backgroundHex) : null;
  const histogram = new Map<number, number>();
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a < 200) continue;

    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;

    if (bg) {
      const distance =
        Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
      if (distance < 60) continue;
    }

    const key = quantizeRgbToKey(r, g, b);
    histogram.set(key, (histogram.get(key) ?? 0) + 1);
  }

  let bestKey: number | null = null;
  let bestCount = 0;
  for (const [key, count] of histogram.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  if (bestKey === null) return null;
  return quantizedKeyToHex(bestKey);
}

function drawSquigglyLine(
  page: any,
  startX: number,
  endX: number,
  baseY: number,
  colorHex: string,
  opacity: number,
) {
  const wavelength = 6;
  const amplitude = 1.4;
  const step = 2;

  let prevX = startX;
  let prevY = baseY;

  for (let x = startX + step; x <= endX; x += step) {
    const phase = ((x - startX) % wavelength) / wavelength;
    const y = baseY + Math.sin(phase * Math.PI * 2) * amplitude;

    page.drawLine({
      start: { x: prevX, y: prevY },
      end: { x, y },
      thickness: 1.2,
      color: hexToPdfRgb(colorHex),
      opacity,
    } as any);

    prevX = x;
    prevY = y;
  }
}

function applyMarkupAnnotationToPdfPage(
  page: any,
  pageHeight: number,
  mark: MarkupAnnotation,
) {
  const lineThickness = clamp(mark.height * 0.07, 1.2, 2.2);

  if (mark.kind === "highlight") {
    page.drawRectangle({
      x: mark.x,
      y: pageHeight - mark.y - mark.height,
      width: mark.width,
      height: mark.height,
      color: hexToPdfRgb(mark.color),
      opacity: mark.opacity,
    } as any);
    return;
  }

  if (mark.kind === "underline") {
    const underlineY = pageHeight - mark.y - mark.height + 1;
    page.drawLine({
      start: { x: mark.x, y: underlineY },
      end: { x: mark.x + mark.width, y: underlineY },
      thickness: lineThickness,
      color: hexToPdfRgb(mark.color),
      opacity: mark.opacity,
    } as any);
    return;
  }

  if (mark.kind === "strikeout") {
    const strikeY = pageHeight - mark.y - mark.height * 0.5;
    page.drawLine({
      start: { x: mark.x, y: strikeY },
      end: { x: mark.x + mark.width, y: strikeY },
      thickness: lineThickness,
      color: hexToPdfRgb(mark.color),
      opacity: mark.opacity,
    } as any);
    return;
  }

  const squiggleY = pageHeight - mark.y - mark.height + 1.5;
  drawSquigglyLine(
    page,
    mark.x,
    mark.x + mark.width,
    squiggleY,
    mark.color,
    mark.opacity,
  );
}

function loadSavedSignatures(): SavedSignature[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSignatures(sigs: SavedSignature[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sigs));
}

// ─── Signature Creator Sub-Component ───────────────────────────────────────────
type SigTab = "draw" | "type" | "upload";

function SignatureCreator({
  onSave,
  onClose,
}: {
  onSave: (dataUrl: string, label: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SigTab>("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Drawing
  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      (e.clientX - rect.left) * (canvas.width / rect.width),
      (e.clientY - rect.top) * (canvas.height / rect.height),
    );
    setIsDrawing(true);
  }, []);

  const draw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const rect = canvas.getBoundingClientRect();
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineTo(
        (e.clientX - rect.left) * (canvas.width / rect.width),
        (e.clientY - rect.top) * (canvas.height / rect.height),
      );
      ctx.stroke();
      setHasDrawn(true);
    },
    [isDrawing],
  );

  const endDraw = useCallback(() => setIsDrawing(false), []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (tab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      onSave(canvas.toDataURL("image/png"), "Drawn Signature");
    } else if (tab === "type") {
      if (!typedName.trim()) return;
      // Render typed name to canvas with cursive font
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 120;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.font = 'italic 48px "Georgia", "Times New Roman", serif';
      ctx.fillStyle = "#1a1a2e";
      ctx.textBaseline = "middle";
      ctx.fillText(typedName, 16, 60);
      onSave(c.toDataURL("image/png"), typedName);
    } else if (tab === "upload") {
      if (!uploadPreview) return;
      onSave(uploadPreview, "Uploaded Signature");
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const tabs: { id: SigTab; label: string; icon: typeof Pen }[] = [
    { id: "draw", label: "Draw", icon: Pen },
    { id: "type", label: "Type", icon: Type },
    { id: "upload", label: "Upload", icon: Upload },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">
            Create Signature
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all border-b-2 ${
                tab === t.id
                  ? "border-[#007AFF] text-[#007AFF]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === "draw" && (
            <div>
              <canvas
                ref={canvasRef}
                width={460}
                height={140}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                className="w-full cursor-crosshair rounded-xl border-2 border-dashed border-slate-200 bg-slate-50"
                style={{ touchAction: "none" }}
              />
              <button
                onClick={clearCanvas}
                className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          {tab === "type" && (
            <div>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-serif italic text-slate-800 placeholder-slate-300 focus:border-[#007AFF]/50 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
              />
              {typedName && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-center text-3xl font-serif italic text-slate-800">
                    {typedName}
                  </p>
                </div>
              )}
            </div>
          )}
          {tab === "upload" && (
            <div>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 transition-colors hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5">
                <Upload className="h-8 w-8 text-slate-400" />
                <span className="text-sm font-medium text-slate-500">
                  Click to upload signature image
                </span>
                <span className="text-xs text-slate-400">
                  PNG, JPG up to 2MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
              {uploadPreview && (
                <div className="mt-3 flex justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <img
                    src={uploadPreview}
                    alt="Signature preview"
                    className="max-h-24 object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              (tab === "draw" && !hasDrawn) ||
              (tab === "type" && !typedName.trim()) ||
              (tab === "upload" && !uploadPreview)
            }
            className="flex items-center gap-2 rounded-xl bg-[#007AFF] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0062CC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Save Signature
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
interface AnnotatePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnnotatePdfModal({
  isOpen,
  onClose,
}: AnnotatePdfModalProps) {
  // ── Upload phase ──
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── PDF document state ──
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Editor state ──
  const [mode, setMode] = useState<EditorMode>("selection");
  const [scale, setScale] = useState(1.0);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [signatureAnnotations, setSignatureAnnotations] = useState<
    SignatureAnnotation[]
  >([]);
  const [markupAnnotations, setMarkupAnnotations] = useState<
    MarkupAnnotation[]
  >([]);
  const [activeMarkupKind, setActiveMarkupKind] =
    useState<MarkupKind>("highlight");
  const [activeMarkupColor, setActiveMarkupColor] = useState(
    HIGHLIGHT_PASTEL_COLORS[0],
  );
  const [activeMarkupOpacity, setActiveMarkupOpacity] = useState(0.35);
  const customHighlightColorRef = useRef<HTMLInputElement | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(
    null,
  );
  const [textLayerByPage, setTextLayerByPage] = useState<
    Record<number, TextLayerItem[]>
  >({});
  const [undoStack, setUndoStack] = useState<MarkupAnnotation[][]>([]);
  const [redoStack, setRedoStack] = useState<MarkupAnnotation[][]>([]);
  const [textboxUndoStack, setTextboxUndoStack] = useState<TextAnnotation[][]>(
    [],
  );
  const [textboxRedoStack, setTextboxRedoStack] = useState<TextAnnotation[][]>(
    [],
  );
  const [applying, setApplying] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [editSessionActive, setEditSessionActive] = useState(false);
  const [applyingEditSession, setApplyingEditSession] = useState(false);
  const textExtractedRef = useRef(false);

  // ── Signature state ──
  const [savedSignatures, setSavedSignatures] =
    useState<SavedSignature[]>(loadSavedSignatures);
  const [showSignatureCreator, setShowSignatureCreator] = useState(false);
  const [draggingSignature, setDraggingSignature] =
    useState<SavedSignature | null>(null);
  const [textboxDraft, setTextboxDraft] = useState<TextboxDraft | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelectionRect | null>(
    null,
  );
  const [highlightPreviewByPage, setHighlightPreviewByPage] = useState<
    Record<number, HighlightPreviewRect[]>
  >({});

  // ── Refs ──
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const reloadPdfFromBytes = useCallback(async (bytes: ArrayBuffer) => {
    setLoading(true);
    try {
      const viewerBuffer = cloneArrayBuffer(bytes);
      const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(viewerBuffer),
        useSystemFonts: true,
      }).promise;
      setPdfDoc(doc);

      const pageInfos: PageInfo[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        pageInfos.push({
          pageNumber: i,
          width: viewport.width,
          height: viewport.height,
          viewport,
        });
      }
      setPages(pageInfos);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
      setLoading(false);
    }
  }, []);

  // ── Load PDF from file ──
  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles("annotate", files);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    const file = files[0];
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const buffer = reader.result as ArrayBuffer;
      const editorBuffer = cloneArrayBuffer(buffer);
      const viewerBuffer = cloneArrayBuffer(buffer);
      setPdfBytes(editorBuffer);
      try {
        const doc = await pdfjsLib.getDocument({
          data: new Uint8Array(viewerBuffer),
          useSystemFonts: true,
        }).promise;
        setPdfDoc(doc);

        const pageInfos: PageInfo[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });
          pageInfos.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            viewport,
          });
        }
        setPages(pageInfos);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const applyExtractedTextEditsToPdf = useCallback(
    async (sourceBytes: ArrayBuffer, extractedEdits: TextAnnotation[]) => {
      const sourceBuffer = cloneArrayBuffer(sourceBytes);
      const doc = await PDFDocument.load(sourceBuffer);
      const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);
      const pdfPages = doc.getPages();
      const displayScale = RENDER_SCALE * scale;

      // Cover old text first
      for (const ann of extractedEdits) {
        if (!ann.isExtracted) continue;
        if (ann.text === ann.originalText) continue;

        const page = pdfPages[ann.pageIndex];
        if (!page) continue;
        const pageHeight = page.getHeight();

        const canvas = canvasRefs.current[ann.pageIndex];
        const sampledCover = canvas
          ? sampleDominantHexColorFromCanvas(canvas, {
              x: ann.x * displayScale,
              y: ann.y * displayScale,
              width: ann.width * displayScale,
              height: ann.height * displayScale,
            })
          : null;
        const coverHex = ann.coverColor ?? sampledCover ?? "#ffffff";

        const padX = clamp(ann.fontSize * 0.18, 0.5, 4);
        const padTop = clamp(ann.fontSize * 0.18, 0.5, 4);
        const padBottom = clamp(ann.fontSize * 0.32, 1, 6);

        page.drawRectangle({
          x: ann.x - padX,
          y: pageHeight - (ann.y + ann.height + padBottom),
          width: ann.width + padX * 2,
          height: ann.height + padTop + padBottom,
          color: hexToPdfRgb(coverHex),
        });
      }

      // Apply markup marks
      for (const mark of markupAnnotations) {
        const page = pdfPages[mark.pageIndex];
        if (!page) continue;
        const pageHeight = page.getHeight();
        applyMarkupAnnotationToPdfPage(page, pageHeight, mark);
      }

      // Draw replacement text last (on top)
      for (const ann of extractedEdits) {
        if (!ann.isExtracted) continue;
        if (ann.text === ann.originalText) continue;
        const hasReplacementText = ann.text.trim().length > 0;
        if (!hasReplacementText) continue;

        const page = pdfPages[ann.pageIndex];
        if (!page) continue;
        const pageHeight = page.getHeight();

        const textY =
          ann.pdfBaselineY !== undefined
            ? ann.pdfBaselineY
            : pageHeight - ann.y - ann.height + 4;

        page.drawText(ann.text, {
          x: ann.x + 2,
          y: textY,
          size: ann.fontSize,
          font: helveticaFont,
          color: hexToPdfRgb(ann.color),
        });
      }

      const modifiedBytes = await doc.save();
      const pdfBuffer = new ArrayBuffer(modifiedBytes.byteLength);
      new Uint8Array(pdfBuffer).set(modifiedBytes);
      return pdfBuffer;
    },
    [scale, markupAnnotations],
  );

  const handleDiscardEditSession = () => {
    setTextAnnotations((prev) => prev.filter((a) => !a.isExtracted));
    setEditingAnnotation(null);
    setError(null);
    setExtractingText(false);
    setEditSessionActive(false);
    textExtractedRef.current = false;
    setMode("selection");
  };

  const handleApplyEditSession = async () => {
    if (!pdfBytes) return;
    if (extractingText || applyingEditSession) return;

    const extractedEdits = textAnnotations.filter((a) => a.isExtracted);
    const hasEdits = extractedEdits.some((a) => a.text !== a.originalText);

    if (!hasEdits) {
      handleDiscardEditSession();
      return;
    }

    setApplyingEditSession(true);
    setError(null);
    try {
      const updatedBuffer = await applyExtractedTextEditsToPdf(
        pdfBytes,
        extractedEdits,
      );
      setPdfBytes(updatedBuffer);
      await reloadPdfFromBytes(updatedBuffer);
      setTextAnnotations((prev) => prev.filter((a) => !a.isExtracted));
      setEditingAnnotation(null);
      setExtractingText(false);
      setEditSessionActive(false);
      textExtractedRef.current = false;
      setMode("selection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply changes");
    } finally {
      setApplyingEditSession(false);
    }
  };

  // ── Render PDF pages to canvases ──
  useEffect(() => {
    if (!pdfDoc || pages.length === 0) return;
    let cancelled = false;

    const renderPages = async () => {
      for (let i = 0; i < pages.length; i++) {
        if (cancelled) break;
        const page = await pdfDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale: RENDER_SCALE * scale });
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport } as any).promise;
      }
    };

    renderPages();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pages, scale]);

  // ── Extract existing PDF text when entering Edit mode ──
  useEffect(() => {
    if (mode !== "edit" || !pdfDoc || textExtractedRef.current) return;

    let cancelled = false;

    const extract = async () => {
      setExtractingText(true);
      setError(null);
      try {
        const blocks = await extractPdfTextBlocks(
          (pageNumber) => pdfDoc.getPage(pageNumber),
          pdfDoc.numPages,
        );

        if (cancelled) return;

        if (blocks.length === 0) {
          setError(
            "No editable text found. This PDF may be scanned or image-based.",
          );
        }

        const extracted: TextAnnotation[] = blocks.map((block) => {
          const canvas = canvasRefs.current[block.pageIndex];
          const regionPx = {
            x: block.x * RENDER_SCALE * scale,
            y: block.y * RENDER_SCALE * scale,
            width: block.width * RENDER_SCALE * scale,
            height: block.height * RENDER_SCALE * scale,
          };
          const coverColor = canvas
            ? (sampleDominantHexColorFromCanvas(canvas, regionPx) ?? "#ffffff")
            : "#ffffff";
          const textColor = canvas
            ? (sampleForegroundHexColorFromCanvas(
                canvas,
                regionPx,
                coverColor,
              ) ?? "#000000")
            : "#000000";

          return {
            id: generateId(),
            pageIndex: block.pageIndex,
            x: block.x,
            y: block.y,
            width: block.width,
            height: block.height,
            text: block.text,
            originalText: block.text,
            fontSize: block.fontSize,
            color: textColor,
            coverColor,
            isExtracted: true,
            pdfBaselineY: block.pdfBaselineY,
          };
        });

        setTextAnnotations((prev) => {
          const userAdded = prev.filter((a) => !a.isExtracted);
          return [...extracted, ...userAdded];
        });
        textExtractedRef.current = true;
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to extract PDF text",
          );
        }
      } finally {
        if (!cancelled) setExtractingText(false);
      }
    };

    extract();
    return () => {
      cancelled = true;
    };
  }, [mode, pdfDoc]);

  useEffect(() => {
    if (mode !== "highlight" || !pdfDoc) return;

    let cancelled = false;

    const loadTextLayer = async () => {
      const next: Record<number, TextLayerItem[]> = {};

      for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const textContent = await page.getTextContent();

        next[pageNumber - 1] = (textContent.items as any[])
          .filter((item) => item?.str && String(item.str).trim().length > 0)
          .map((item) => {
            const tx = (pdfjsLib as any).Util.transform(
              viewport.transform,
              item.transform,
            );
            const fontSize = Math.hypot(tx[0], tx[1]) || 12;
            const left = tx[4];
            const top = tx[5] - fontSize * 0.85;

            return {
              text: String(item.str),
              left,
              top,
              fontSize,
              width: (Number(item.width) || 0) * RENDER_SCALE,
            } as TextLayerItem;
          });
      }

      if (!cancelled) {
        setTextLayerByPage(next);
      }
    };

    void loadTextLayer();

    return () => {
      cancelled = true;
    };
  }, [mode, pdfDoc]);

  const pushMarkupState = useCallback(
    (next: MarkupAnnotation[]) => {
      setUndoStack((prev) => [...prev, markupAnnotations]);
      setRedoStack([]);
      setMarkupAnnotations(next);
    },
    [markupAnnotations],
  );

  const getUserTextboxes = useCallback(
    () => textAnnotations.filter((a) => !a.isExtracted).map((a) => ({ ...a })),
    [textAnnotations],
  );

  const setUserTextboxes = useCallback((userBoxes: TextAnnotation[]) => {
    setTextAnnotations((prev) => {
      const extracted = prev.filter((a) => !!a.isExtracted);
      return [...extracted, ...userBoxes];
    });
  }, []);

  const pushTextboxState = useCallback(
    (nextUserBoxes: TextAnnotation[]) => {
      setTextboxUndoStack((prev) => [...prev, getUserTextboxes()]);
      setTextboxRedoStack([]);
      setUserTextboxes(nextUserBoxes);
    },
    [getUserTextboxes, setUserTextboxes],
  );

  const deleteTextboxWithHistory = useCallback(
    (id: string) => {
      const current = getUserTextboxes();
      if (!current.some((a) => a.id === id)) return;
      const next = current.filter((a) => a.id !== id);
      pushTextboxState(next);
      setEditingAnnotation((prev) => (prev === id ? null : prev));
    },
    [getUserTextboxes, pushTextboxState],
  );

  const handleUndoTextbox = useCallback(() => {
    if (textboxUndoStack.length === 0) return;
    const previous = textboxUndoStack[textboxUndoStack.length - 1];
    setTextboxUndoStack((prev) => prev.slice(0, -1));
    setTextboxRedoStack((prev) => [...prev, getUserTextboxes()]);
    setUserTextboxes(previous);
    setEditingAnnotation(null);
  }, [textboxUndoStack, getUserTextboxes, setUserTextboxes]);

  const handleRedoTextbox = useCallback(() => {
    if (textboxRedoStack.length === 0) return;
    const next = textboxRedoStack[textboxRedoStack.length - 1];
    setTextboxRedoStack((prev) => prev.slice(0, -1));
    setTextboxUndoStack((prev) => [...prev, getUserTextboxes()]);
    setUserTextboxes(next);
    setEditingAnnotation(null);
  }, [textboxRedoStack, getUserTextboxes, setUserTextboxes]);

  const handleUndoMarkup = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, markupAnnotations]);
    setMarkupAnnotations(previous);
  }, [undoStack, markupAnnotations]);

  const handleRedoMarkup = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, markupAnnotations]);
    setMarkupAnnotations(next);
  }, [redoStack, markupAnnotations]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey;
      const isRedo =
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey));

      if (isUndo) {
        e.preventDefault();
        handleUndoMarkup();
      } else if (isRedo) {
        e.preventDefault();
        handleRedoMarkup();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndoMarkup, handleRedoMarkup]);

  // ── Handle click on page (Edit Mode) ──
  const handlePageClick = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      if (mode === "highlight") {
        return;
      }

      if (mode !== "edit" || extractingText) return;

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const displayScale = RENDER_SCALE * scale;
      const clickX = (e.clientX - rect.left) / displayScale;
      const clickY = (e.clientY - rect.top) / displayScale;

      const existing = textAnnotations.find(
        (a) =>
          a.pageIndex === pageIndex &&
          clickX >= a.x &&
          clickX <= a.x + a.width &&
          clickY >= a.y &&
          clickY <= a.y + a.height,
      );

      if (existing) {
        setEditingAnnotation(existing.id);
        return;
      }

      setEditingAnnotation(null);
    },
    [mode, scale, textAnnotations, extractingText],
  );

  const intersectingTextRects = useCallback(
    (
      pageIndex: number,
      rect: { left: number; top: number; right: number; bottom: number },
    ): HighlightPreviewRect[] => {
      const items = textLayerByPage[pageIndex] ?? [];
      const output: HighlightPreviewRect[] = [];

      for (const item of items) {
        const width = Math.max(
          2,
          item.width || item.text.length * item.fontSize * 0.5,
        );
        const height = Math.max(4, item.fontSize * 1.15);
        const left = item.left;
        const top = item.top;
        const right = left + width;
        const bottom = top + height;

        const intersects =
          left <= rect.right &&
          right >= rect.left &&
          top <= rect.bottom &&
          bottom >= rect.top;

        if (intersects) {
          output.push({ x: left, y: top, width, height });
        }
      }

      return output;
    },
    [textLayerByPage],
  );

  const handleHighlightPointerDown = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      if (mode !== "highlight") return;

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      e.preventDefault();
      e.stopPropagation();

      window.getSelection()?.removeAllRanges();

      const rect = container.getBoundingClientRect();
      const pageWidth = rect.width / scale;
      const pageHeight = rect.height / scale;

      const startX = clamp((e.clientX - rect.left) / scale, 0, pageWidth);
      const startY = clamp((e.clientY - rect.top) / scale, 0, pageHeight);

      let currentX = startX;
      let currentY = startY;

      setDragSelection({ pageIndex, startX, startY, currentX, currentY });
      setHighlightPreviewByPage((prev) => ({ ...prev, [pageIndex]: [] }));

      const onMove = (me: MouseEvent) => {
        window.getSelection()?.removeAllRanges();

        currentX = clamp((me.clientX - rect.left) / scale, 0, pageWidth);
        currentY = clamp((me.clientY - rect.top) / scale, 0, pageHeight);

        setDragSelection((prev) =>
          prev ? { ...prev, currentX, currentY } : prev,
        );

        const selectionRect = {
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
          right: Math.max(startX, currentX),
          bottom: Math.max(startY, currentY),
        };

        const preview = intersectingTextRects(pageIndex, selectionRect);
        setHighlightPreviewByPage((prev) => ({
          ...prev,
          [pageIndex]: preview,
        }));
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        window.getSelection()?.removeAllRanges();

        const selectionRect = {
          left: Math.min(startX, currentX),
          top: Math.min(startY, currentY),
          right: Math.max(startX, currentX),
          bottom: Math.max(startY, currentY),
        };

        const hitRects = intersectingTextRects(pageIndex, selectionRect);

        if (hitRects.length > 0) {
          const added: MarkupAnnotation[] = hitRects.map((r) => ({
            id: generateId(),
            pageIndex,
            x: r.x / RENDER_SCALE,
            y: r.y / RENDER_SCALE,
            width: r.width / RENDER_SCALE,
            height: r.height / RENDER_SCALE,
            kind: activeMarkupKind,
            color: activeMarkupColor,
            opacity: activeMarkupOpacity,
          }));

          pushMarkupState([...markupAnnotations, ...added]);
        }

        setDragSelection(null);
        setHighlightPreviewByPage((prev) => ({ ...prev, [pageIndex]: [] }));
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      mode,
      scale,
      activeMarkupKind,
      activeMarkupColor,
      activeMarkupOpacity,
      intersectingTextRects,
      markupAnnotations,
      pushMarkupState,
    ],
  );

  // ── Handle signature drop on page ──
  const handlePageDrop = useCallback(
    (e: React.DragEvent, pageIndex: number) => {
      e.preventDefault();
      if (!draggingSignature) return;

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const displayScale = RENDER_SCALE * scale;

      const dropX = (e.clientX - rect.left) / displayScale;
      const dropY = (e.clientY - rect.top) / displayScale;

      const newSigAnnotation: SignatureAnnotation = {
        id: generateId(),
        pageIndex,
        x: dropX - 50, // Center the signature
        y: dropY - 20,
        width: 100,
        height: 40,
        imageDataUrl: draggingSignature.imageDataUrl,
      };

      setSignatureAnnotations((prev) => [...prev, newSigAnnotation]);
      setDraggingSignature(null);
    },
    [draggingSignature, scale],
  );

  // ── Handle drag-to-place text boxes on page ──
  const handleTextboxPointerDown = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      if (mode !== "textbox") return;

      const target = e.target as HTMLElement;
      if (target.closest('[data-annotation-overlay="true"]')) return;

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      e.preventDefault();
      e.stopPropagation();
      setEditingAnnotation(null);

      const rect = container.getBoundingClientRect();
      const displayScale = RENDER_SCALE * scale;
      const pageWidth = rect.width / displayScale;
      const pageHeight = rect.height / displayScale;

      const startX = clamp(
        (e.clientX - rect.left) / displayScale,
        0,
        pageWidth,
      );
      const startY = clamp(
        (e.clientY - rect.top) / displayScale,
        0,
        pageHeight,
      );

      let currentX = startX;
      let currentY = startY;

      setTextboxDraft({
        pageIndex,
        startX,
        startY,
        currentX,
        currentY,
      });

      const onMove = (me: MouseEvent) => {
        currentX = clamp((me.clientX - rect.left) / displayScale, 0, pageWidth);
        currentY = clamp((me.clientY - rect.top) / displayScale, 0, pageHeight);
        setTextboxDraft((prev) =>
          prev
            ? {
                ...prev,
                currentX,
                currentY,
              }
            : prev,
        );
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setTextboxDraft(null);

        const draggedDistance = Math.max(
          Math.abs(currentX - startX),
          Math.abs(currentY - startY),
        );

        const annotationWidth =
          draggedDistance < 6
            ? 180
            : Math.max(120, Math.abs(currentX - startX));
        const annotationHeight =
          draggedDistance < 6 ? 32 : Math.max(32, Math.abs(currentY - startY));
        const annotationX =
          draggedDistance < 6 ? startX : Math.min(startX, currentX);
        const annotationY =
          draggedDistance < 6 ? startY : Math.min(startY, currentY);

        const newAnnotation: TextAnnotation = {
          id: generateId(),
          pageIndex,
          x: clamp(annotationX, 0, Math.max(0, pageWidth - annotationWidth)),
          y: clamp(annotationY, 0, Math.max(0, pageHeight - annotationHeight)),
          width: annotationWidth,
          height: annotationHeight,
          text: "",
          fontSize: 12,
          color: "#000000",
        };

        pushTextboxState([...getUserTextboxes(), newAnnotation]);
        setEditingAnnotation(newAnnotation.id);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [mode, scale, pushTextboxState, getUserTextboxes],
  );

  // ── Handle signature drag on page (reposition) ──
  const handleSignatureDrag = useCallback(
    (annotationId: string, e: React.MouseEvent, pageIndex: number) => {
      if (mode !== "signature") return;
      e.stopPropagation();
      e.preventDefault();

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      const displayScale = RENDER_SCALE * scale;
      const startX = e.clientX;
      const startY = e.clientY;
      const annotation = signatureAnnotations.find(
        (a) => a.id === annotationId,
      );
      if (!annotation) return;
      const origX = annotation.x;
      const origY = annotation.y;

      const onMove = (me: MouseEvent) => {
        const dx = (me.clientX - startX) / displayScale;
        const dy = (me.clientY - startY) / displayScale;
        setSignatureAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotationId ? { ...a, x: origX + dx, y: origY + dy } : a,
          ),
        );
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [mode, scale, signatureAnnotations],
  );

  // ── Handle signature resize ──
  const handleSignatureResize = useCallback(
    (annotationId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const displayScale = RENDER_SCALE * scale;
      const startX = e.clientX;
      const startY = e.clientY;
      const annotation = signatureAnnotations.find(
        (a) => a.id === annotationId,
      );
      if (!annotation) return;
      const origW = annotation.width;
      const origH = annotation.height;

      const onMove = (me: MouseEvent) => {
        const dx = (me.clientX - startX) / displayScale;
        const dy = (me.clientY - startY) / displayScale;
        setSignatureAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotationId
              ? {
                  ...a,
                  width: Math.max(30, origW + dx),
                  height: Math.max(15, origH + dy),
                }
              : a,
          ),
        );
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [scale, signatureAnnotations],
  );

  // ── Save signature to localStorage ──
  const handleSaveSignature = (dataUrl: string, label: string) => {
    const newSig: SavedSignature = {
      id: generateId(),
      imageDataUrl: dataUrl,
      label,
      createdAt: Date.now(),
    };
    const updated = [...savedSignatures, newSig];
    setSavedSignatures(updated);
    persistSignatures(updated);
    setShowSignatureCreator(false);
  };

  const handleDeleteSavedSignature = (id: string) => {
    const updated = savedSignatures.filter((s) => s.id !== id);
    setSavedSignatures(updated);
    persistSignatures(updated);
  };

  // ── Apply Changes: Merge with pdf-lib ──
  const handleApplyChanges = async () => {
    if (!pdfBytes) return;
    setApplying(true);
    setError(null);

    try {
      const sourceBuffer = cloneArrayBuffer(pdfBytes);
      const doc = await PDFDocument.load(sourceBuffer);
      const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);
      const pdfPages = doc.getPages();

      // 1) Cover original text for extracted edits (so we don't see overlay)
      for (const ann of textAnnotations) {
        if (!ann.isExtracted) continue;
        if (ann.text === ann.originalText) continue;

        const page = pdfPages[ann.pageIndex];
        if (!page) continue;
        const pageHeight = page.getHeight();

        const displayScale = RENDER_SCALE * scale;
        const canvas = canvasRefs.current[ann.pageIndex];
        const sampledCover = canvas
          ? sampleDominantHexColorFromCanvas(canvas, {
              x: ann.x * displayScale,
              y: ann.y * displayScale,
              width: ann.width * displayScale,
              height: ann.height * displayScale,
            })
          : null;
        const coverHex = ann.coverColor ?? sampledCover ?? "#ffffff";

        const padX = clamp(ann.fontSize * 0.18, 0.5, 4);
        const padTop = clamp(ann.fontSize * 0.18, 0.5, 4);
        const padBottom = clamp(ann.fontSize * 0.32, 1, 6);

        page.drawRectangle({
          x: ann.x - padX,
          y: pageHeight - (ann.y + ann.height + padBottom),
          width: ann.width + padX * 2,
          height: ann.height + padTop + padBottom,
          color: hexToPdfRgb(coverHex),
        });
      }

      // 2) Apply markup marks (behind text)
      for (const mark of markupAnnotations) {
        const page = pdfPages[mark.pageIndex];
        if (!page) continue;
        const pageHeight = page.getHeight();
        applyMarkupAnnotationToPdfPage(page, pageHeight, mark);
      }

      // 3) Draw replacement / inserted text on top
      for (const ann of textAnnotations) {
        const hasReplacementText = ann.text.trim().length > 0;
        if (!ann.isExtracted && !hasReplacementText) continue;
        if (ann.isExtracted && ann.text === ann.originalText) continue;
        if (!hasReplacementText) continue;

        const page = pdfPages[ann.pageIndex];
        if (!page) continue;
        const pageHeight = page.getHeight();

        const textY =
          ann.pdfBaselineY !== undefined
            ? ann.pdfBaselineY
            : pageHeight - ann.y - ann.height + 4;

        page.drawText(ann.text, {
          x: ann.x + 2,
          y: textY,
          size: ann.fontSize,
          font: helveticaFont,
          color: hexToPdfRgb(ann.color),
        });
      }

      // Apply signature annotations
      for (const sig of signatureAnnotations) {
        const page = pdfPages[sig.pageIndex];
        if (!page) continue;

        const pageHeight = page.getHeight();

        // Convert data URL to bytes
        const base64Data = sig.imageDataUrl.split(",")[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        let image;
        if (sig.imageDataUrl.includes("image/png")) {
          image = await doc.embedPng(bytes);
        } else {
          image = await doc.embedJpg(bytes);
        }

        page.drawImage(image, {
          x: sig.x,
          y: pageHeight - sig.y - sig.height,
          width: sig.width,
          height: sig.height,
        });
      }

      // Generate and download
      const modifiedBytes = await doc.save();
      const pdfBuffer = new ArrayBuffer(modifiedBytes.byteLength);
      new Uint8Array(pdfBuffer).set(modifiedBytes);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName
        ? fileName.replace(/\.pdf$/i, "-annotated.pdf")
        : "annotated.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);

      setApplying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply changes");
      setApplying(false);
    }
  };

  // ── Close / Reset ──
  const handleClose = () => {
    if (applying || applyingEditSession) return;
    setPdfBytes(null);
    setPdfDoc(null);
    setPages([]);
    setFileName("");
    setMode("selection");
    setScale(1.0);
    setTextAnnotations([]);
    setSignatureAnnotations([]);
    setMarkupAnnotations([]);
    setActiveMarkupKind("highlight");
    setActiveMarkupColor(HIGHLIGHT_PASTEL_COLORS[0]);
    setActiveMarkupOpacity(0.35);
    setEditingAnnotation(null);
    setTextLayerByPage({});
    setUndoStack([]);
    setRedoStack([]);
    setTextboxUndoStack([]);
    setTextboxRedoStack([]);
    setTextboxDraft(null);
    setDragSelection(null);
    setHighlightPreviewByPage({});
    setExtractingText(false);
    setEditSessionActive(false);
    textExtractedRef.current = false;
    setError(null);
    setApplying(false);
    setApplyingEditSession(false);
    onClose();
  };

  // ── Phase 0: Upload ──
  if (!pdfBytes) {
    return (
      <ToolModal
        isOpen={isOpen}
        onClose={handleClose}
        toolType="annotate"
        isUploading={false}
        isProcessing={loading}
        error={error}
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-white p-16 shadow-2xl">
          <Loader2 className="h-10 w-10 animate-spin text-[#007AFF]" />
          <p className="text-sm font-medium text-slate-500">Loading PDF…</p>
        </div>
      </ModalOverlay>
    );
  }

  // ── Phase 1: Editor ──
  const displayScale = RENDER_SCALE * scale;
  const changedTextCount = textAnnotations.filter((a) =>
    !a.isExtracted ? a.text.trim().length > 0 : a.text !== a.originalText,
  ).length;
  const hasChanges =
    changedTextCount > 0 ||
    signatureAnnotations.length > 0 ||
    markupAnnotations.length > 0;

  const modes: { id: EditorMode; label: string; icon: typeof MousePointer2 }[] =
    [
      { id: "selection", label: "Select", icon: MousePointer2 },
      { id: "edit", label: "Edit PDF", icon: PenTool },
      { id: "signature", label: "Signature", icon: Stamp },
      { id: "textbox", label: "Text", icon: Type },
      { id: "highlight", label: "Highlight", icon: Pen },
    ];

  return (
    <ModalOverlay isOpen onClose={handleClose}>
      <div
        className="relative flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden rounded-3xl bg-[#f8f9fb] shadow-[0_32px_100px_-16px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Toolbar ── */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Close */}
            <button
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>

            {/* File name */}
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">
                {fileName}
              </p>
              <p className="text-xs text-slate-400">
                {pages.length} page{pages.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100/80 p-1">
            {modes.map((m) =>
              (() => {
                const locked =
                  mode === "edit" && editSessionActive && m.id !== "edit";
                return (
                  <button
                    key={m.id}
                    disabled={locked}
                    onClick={() => {
                      if (locked) return;
                      if (m.id === "edit") setEditSessionActive(true);
                      setMode(m.id);
                      setEditingAnnotation(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      mode === m.id
                        ? "bg-white text-[#007AFF] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    <m.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                );
              })(),
            )}
          </div>

          {mode === "edit" && editSessionActive && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyEditSession}
                disabled={extractingText || applyingEditSession}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply changes
              </button>
              <button
                onClick={handleDiscardEditSession}
                disabled={extractingText || applyingEditSession}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-all hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard changes
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-1">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center text-xs font-medium text-slate-500">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Apply */}
            <button
              onClick={handleApplyChanges}
              disabled={
                applying ||
                !hasChanges ||
                extractingText ||
                (mode === "edit" && editSessionActive)
              }
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                hasChanges ? "bg-[#007AFF] hover:bg-[#0062CC]" : "bg-slate-300"
              }`}
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Apply & Download
                </>
              )}
            </button>
          </div>
        </div>

        {mode === "highlight" && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white px-5 py-2.5">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  { id: "highlight", label: "Text highlight" },
                  { id: "underline", label: "Underline" },
                  { id: "squiggly", label: "Squiggly" },
                  { id: "strikeout", label: "Strikeout" },
                ] as { id: MarkupKind; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMarkupKind(item.id)}
                  className={`rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    activeMarkupKind === item.id
                      ? "bg-white text-[#007AFF] shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              {HIGHLIGHT_PASTEL_COLORS.map((color) => {
                const selected =
                  activeMarkupColor.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setActiveMarkupColor(color)}
                    className={`flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
                      selected ? "border-slate-400" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Use color ${color}`}
                    title={color}
                  >
                    {selected && <Check className="h-3 w-3 text-slate-700" />}
                  </button>
                );
              })}

              <input
                ref={customHighlightColorRef}
                type="color"
                className="sr-only"
                value={activeMarkupColor}
                onChange={(e) => setActiveMarkupColor(e.target.value)}
              />
              <button
                type="button"
                onClick={() => customHighlightColorRef.current?.click()}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 transition-colors hover:text-slate-700"
                aria-label="Pick custom color"
                title="Custom color"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={handleUndoMarkup}
                disabled={undoStack.length === 0}
                className="rounded px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleRedoMarkup}
                disabled={redoStack.length === 0}
                className="rounded px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Redo
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-600">
                Opacity
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(activeMarkupOpacity * 100)}
                onChange={(e) =>
                  setActiveMarkupOpacity(Number(e.target.value) / 100)
                }
                className="h-1.5 w-24 cursor-pointer accent-[#007AFF]"
              />
              <span className="w-9 text-right text-xs font-semibold text-slate-600">
                {Math.round(activeMarkupOpacity * 100)}%
              </span>
            </div>
          </div>
        )}

        {mode === "textbox" && (
          <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-5 py-2.5">
            <button
              type="button"
              onClick={handleUndoTextbox}
              disabled={textboxUndoStack.length === 0}
              className="rounded px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleRedoTextbox}
              disabled={textboxRedoStack.length === 0}
              className="rounded px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Redo
            </button>
          </div>
        )}

        {/* ── Error bar ── */}
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        {/* ── Main Content ── */}
        <div className="flex flex-1 overflow-hidden">
          {mode === "signature" && (
            <div className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200/80 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  My Signatures
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drag onto PDF to place
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {savedSignatures.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Stamp className="h-8 w-8 text-slate-300" />
                    <p className="text-xs text-slate-400">
                      No saved signatures
                    </p>
                    <p className="text-xs text-slate-400">Create one below</p>
                  </div>
                )}

                {savedSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    draggable
                    onDragStart={() => setDraggingSignature(sig)}
                    onDragEnd={() => setDraggingSignature(null)}
                    className="group relative cursor-grab rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all hover:border-[#007AFF]/30 hover:shadow-sm active:cursor-grabbing"
                  >
                    <img
                      src={sig.imageDataUrl}
                      alt={sig.label}
                      className="mx-auto max-h-12 object-contain"
                      draggable={false}
                    />
                    <p className="mt-1.5 text-center text-[10px] font-medium text-slate-400 truncate">
                      {sig.label}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSavedSignature(sig.id);
                      }}
                      className="absolute right-1.5 top-1.5 hidden rounded-full p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block transition-colors"
                      aria-label="Delete signature"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 p-3">
                <button
                  onClick={() => setShowSignatureCreator(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500 transition-all hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5 hover:text-[#007AFF]"
                >
                  <Plus className="h-4 w-4" />
                  New Signature
                </button>
              </div>

              {/* Placed signatures on PDF */}
              {signatureAnnotations.length > 0 && (
                <div className="border-t border-slate-100 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Placed ({signatureAnnotations.length})
                  </p>
                  <div className="space-y-1.5">
                    {signatureAnnotations.map((sa) => (
                      <div
                        key={sa.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <span className="text-xs text-slate-500">
                          Page {sa.pageIndex + 1}
                        </span>
                        <button
                          onClick={() =>
                            setSignatureAnnotations((prev) =>
                              prev.filter((a) => a.id !== sa.id),
                            )
                          }
                          className="text-slate-300 hover:text-red-500 transition-colors"
                          aria-label="Remove placed signature"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PDF Viewport ── */}
          <div
            ref={scrollContainerRef}
            className="relative flex-1 overflow-auto bg-slate-100/60"
            style={{
              cursor: extractingText
                ? "wait"
                : mode === "edit"
                  ? "text"
                  : mode === "textbox"
                    ? "crosshair"
                    : mode === "signature" && draggingSignature
                      ? "copy"
                      : "default",
            }}
          >
            {extractingText && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-lg border border-slate-200">
                  <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
                  <span className="text-sm font-medium text-slate-600">
                    Detecting editable text…
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col items-center gap-6 p-6">
              {pages.map((pageInfo, pageIndex) => {
                const w = pageInfo.width * scale;
                const h = pageInfo.height * scale;

                return (
                  <div key={pageIndex} className="relative">
                    {/* Page number */}
                    <div className="mb-2 text-center">
                      <span className="text-xs font-medium text-slate-400">
                        Page {pageIndex + 1}
                      </span>
                    </div>

                    {/* Page container */}
                    <div
                      ref={(el) => {
                        pageContainerRefs.current[pageIndex] = el;
                      }}
                      className="relative rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white"
                      style={{ width: w, height: h }}
                      onClick={(e) => handlePageClick(e, pageIndex)}
                      onMouseDown={(e) => {
                        if (mode === "highlight") {
                          handleHighlightPointerDown(e, pageIndex);
                          return;
                        }
                        handleTextboxPointerDown(e, pageIndex);
                      }}
                      onDragOver={(e) => {
                        if (mode === "signature") e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (mode === "signature") {
                          handlePageDrop(e, pageIndex);
                        }
                      }}
                    >
                      {/* PDF Canvas */}
                      <canvas
                        ref={(el) => {
                          canvasRefs.current[pageIndex] = el;
                        }}
                        style={{
                          width: w,
                          height: h,
                          display: "block",
                        }}
                      />

                      {mode === "highlight" && (
                        <div
                          className="absolute inset-0 z-20 select-none"
                          style={{
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                          }}
                        >
                          {(textLayerByPage[pageIndex] ?? []).map(
                            (item, idx) => (
                              <span
                                key={`${pageIndex}-${idx}`}
                                style={{
                                  position: "absolute",
                                  left: item.left,
                                  top: item.top,
                                  fontSize: `${item.fontSize}px`,
                                  width:
                                    item.width > 0
                                      ? `${item.width}px`
                                      : undefined,
                                  color: "rgba(15,23,42,0.01)",
                                  whiteSpace: "pre",
                                  lineHeight: 1,
                                  userSelect: "none",
                                  WebkitUserSelect: "none",
                                }}
                              >
                                {item.text}
                              </span>
                            ),
                          )}
                        </div>
                      )}

                      {/* ── Drag selection preview (rectangle-based highlight selection) ── */}
                      {mode === "highlight" &&
                        dragSelection?.pageIndex === pageIndex && (
                          <div
                            className="pointer-events-none absolute z-[25] rounded-md border border-[#007AFF]/60 bg-[#007AFF]/10"
                            style={{
                              left:
                                Math.min(
                                  dragSelection.startX,
                                  dragSelection.currentX,
                                ) * scale,
                              top:
                                Math.min(
                                  dragSelection.startY,
                                  dragSelection.currentY,
                                ) * scale,
                              width: Math.max(
                                1,
                                Math.abs(
                                  dragSelection.currentX - dragSelection.startX,
                                ) * scale,
                              ),
                              height: Math.max(
                                1,
                                Math.abs(
                                  dragSelection.currentY - dragSelection.startY,
                                ) * scale,
                              ),
                            }}
                          />
                        )}

                      {mode === "highlight" &&
                        (highlightPreviewByPage[pageIndex] ?? []).map(
                          (r, idx) => (
                            <div
                              key={`preview-${pageIndex}-${idx}`}
                              className="pointer-events-none absolute z-[25] rounded-[2px]"
                              style={{
                                left: r.x * scale,
                                top: r.y * scale,
                                width: r.width * scale,
                                height: r.height * scale,
                                background: activeMarkupColor,
                                opacity: Math.min(
                                  activeMarkupOpacity + 0.12,
                                  0.65,
                                ),
                              }}
                            />
                          ),
                        )}

                      {/* ── Textbox placement preview ── */}
                      {textboxDraft?.pageIndex === pageIndex && (
                        <div
                          className="pointer-events-none absolute z-20 rounded-md border-2 border-dashed border-[#007AFF] bg-[#007AFF]/10"
                          style={{
                            left: pdfPointsToCss(
                              Math.min(
                                textboxDraft.startX,
                                textboxDraft.currentX,
                              ),
                              displayScale,
                            ),
                            top: pdfPointsToCss(
                              Math.min(
                                textboxDraft.startY,
                                textboxDraft.currentY,
                              ),
                              displayScale,
                            ),
                            width: Math.max(
                              2,
                              pdfPointsToCss(
                                Math.abs(
                                  textboxDraft.currentX - textboxDraft.startX,
                                ),
                                displayScale,
                              ),
                            ),
                            height: Math.max(
                              2,
                              pdfPointsToCss(
                                Math.abs(
                                  textboxDraft.currentY - textboxDraft.startY,
                                ),
                                displayScale,
                              ),
                            ),
                          }}
                        />
                      )}

                      {/* ── Dedicated highlight overlay layer (above text layer) ── */}
                      <div className="pointer-events-none absolute inset-0 z-30">
                        {markupAnnotations
                          .filter((m) => m.pageIndex === pageIndex)
                          .map((m) => (
                            <div
                              key={m.id}
                              className="pointer-events-none absolute"
                              style={{
                                left: pdfPointsToCss(m.x, displayScale),
                                top: pdfPointsToCss(m.y, displayScale),
                                width: pdfPointsToCss(m.width, displayScale),
                                height: pdfPointsToCss(m.height, displayScale),
                              }}
                            >
                              {m.kind === "highlight" && (
                                <div
                                  className="h-full w-full rounded-[2px]"
                                  style={{
                                    background: m.color,
                                    opacity: m.opacity,
                                  }}
                                />
                              )}

                              {m.kind === "underline" && (
                                <div
                                  className="absolute left-0 right-0"
                                  style={{
                                    bottom: 1,
                                    height: 2,
                                    background: m.color,
                                    opacity: m.opacity,
                                  }}
                                />
                              )}

                              {m.kind === "strikeout" && (
                                <div
                                  className="absolute left-0 right-0"
                                  style={{
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    height: 2,
                                    background: m.color,
                                    opacity: m.opacity,
                                  }}
                                />
                              )}

                              {m.kind === "squiggly" && (
                                <div
                                  className="absolute bottom-0 left-0 right-0 h-[6px] overflow-hidden"
                                  style={{ opacity: m.opacity }}
                                >
                                  <svg
                                    width="100%"
                                    height="6"
                                    viewBox="0 0 100 6"
                                    preserveAspectRatio="none"
                                  >
                                    <path
                                      d="M0 4 Q2 0 4 4 T8 4 T12 4 T16 4 T20 4 T24 4 T28 4 T32 4 T36 4 T40 4 T44 4 T48 4 T52 4 T56 4 T60 4 T64 4 T68 4 T72 4 T76 4 T80 4 T84 4 T88 4 T92 4 T96 4 T100 4"
                                      fill="none"
                                      stroke={m.color}
                                      strokeWidth="1.4"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>

                      {/* ── Text Annotation Overlays ── */}
                      {(mode === "edit" || mode === "textbox") &&
                        textAnnotations
                          .filter((a) => {
                            if (a.pageIndex !== pageIndex) return false;
                            if (mode === "textbox") return !a.isExtracted;
                            return true; // edit mode
                          })
                          .map((ann) => {
                            const isEditing = editingAnnotation === ann.id;
                            const isChanged =
                              !ann.isExtracted || ann.text !== ann.originalText;
                            const showReplacementOverlay =
                              !ann.isExtracted || isEditing || isChanged;
                            return (
                              <div
                                key={ann.id}
                                data-annotation-overlay="true"
                                style={{
                                  position: "absolute",
                                  left: pdfPointsToCss(ann.x, displayScale),
                                  top: pdfPointsToCss(ann.y, displayScale),
                                  width: pdfPointsToCss(
                                    ann.width,
                                    displayScale,
                                  ),
                                  minHeight: pdfPointsToCss(
                                    ann.height,
                                    displayScale,
                                  ),
                                  ...(ann.isExtracted
                                    ? {}
                                    : {
                                        height: pdfPointsToCss(
                                          ann.height,
                                          displayScale,
                                        ),
                                      }),
                                }}
                                className={`group ${isEditing ? "z-30" : "z-10"} ${isEditing ? "" : "cursor-text"}`}
                              >
                                {isEditing ? (
                                  <div className="relative">
                                    {/* Mask original canvas text so textarea does not create double-text */}
                                    {ann.isExtracted && (
                                      <span
                                        className="pointer-events-none absolute inset-0 z-0 rounded-[3px]"
                                        style={{
                                          background:
                                            ann.coverColor ?? "#ffffff",
                                          opacity: 1,
                                        }}
                                      />
                                    )}
                                    <textarea
                                      autoFocus
                                      value={ann.text}
                                      onChange={(e) =>
                                        setTextAnnotations((prev) =>
                                          prev.map((a) =>
                                            a.id === ann.id
                                              ? { ...a, text: e.target.value }
                                              : a,
                                          ),
                                        )
                                      }
                                      onBlur={() => {
                                        if (
                                          !ann.isExtracted &&
                                          !ann.text.trim()
                                        ) {
                                          deleteTextboxWithHistory(ann.id);
                                          return;
                                        }
                                        setEditingAnnotation(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                          setEditingAnnotation(null);
                                          return;
                                        }

                                        // Delete the entire textbox even if it has text.
                                        // Keeps normal Delete behavior unless Ctrl/Cmd is held.
                                        if (
                                          !ann.isExtracted &&
                                          e.key === "Delete" &&
                                          (e.ctrlKey || e.metaKey)
                                        ) {
                                          e.preventDefault();
                                          deleteTextboxWithHistory(ann.id);
                                          return;
                                        }

                                        if (
                                          !ann.isExtracted &&
                                          !ann.text &&
                                          (e.key === "Backspace" ||
                                            e.key === "Delete")
                                        ) {
                                          e.preventDefault();
                                          deleteTextboxWithHistory(ann.id);
                                        }
                                      }}
                                      className="relative z-10 h-full w-full min-h-[24px] resize-none rounded-[3px] border-2 border-[#007AFF] bg-transparent px-[2px] py-0 outline-none"
                                      style={{
                                        fontSize: `${pdfPointsToCss(ann.fontSize, displayScale)}px`,
                                        color: ann.color,
                                        fontFamily:
                                          "Helvetica, Arial, sans-serif",
                                        lineHeight: 1.2,
                                        caretColor: "#007AFF",
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    {/* Annotation controls (user-added text only) */}
                                    {!ann.isExtracted && (
                                      <div
                                        className="absolute -top-8 left-0 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                                        onMouseDown={(e) => {
                                          // Prevent textarea blur before control click handlers run.
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                      >
                                        <input
                                          type="color"
                                          value={ann.color}
                                          onChange={(e) =>
                                            setTextAnnotations((prev) =>
                                              prev.map((a) =>
                                                a.id === ann.id
                                                  ? {
                                                      ...a,
                                                      color: e.target.value,
                                                    }
                                                  : a,
                                              ),
                                            )
                                          }
                                          className="h-5 w-5 cursor-pointer rounded border-0"
                                          title="Text color"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <select
                                          value={ann.fontSize}
                                          onChange={(e) =>
                                            setTextAnnotations((prev) =>
                                              prev.map((a) =>
                                                a.id === ann.id
                                                  ? {
                                                      ...a,
                                                      fontSize: parseInt(
                                                        e.target.value,
                                                      ),
                                                    }
                                                  : a,
                                              ),
                                            )
                                          }
                                          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-600 outline-none"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {[
                                            8, 10, 12, 14, 16, 18, 20, 24, 28,
                                            32, 36, 48,
                                          ].map((s) => (
                                            <option key={s} value={s}>
                                              {s}pt
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTextboxWithHistory(ann.id);
                                          }}
                                          className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                          title="Delete annotation"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    {showReplacementOverlay ? (
                                      ann.isExtracted ? (
                                        <button
                                          type="button"
                                          className="relative h-full w-full bg-transparent text-left transition-all"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAnnotation(ann.id);
                                          }}
                                          aria-label={`Edit text: ${ann.text}`}
                                        >
                                          <span
                                            className="pointer-events-none absolute -inset-[2px]"
                                            style={{
                                              background:
                                                ann.coverColor ?? "#ffffff",
                                              opacity: 1,
                                            }}
                                          />
                                          <span className="pointer-events-none absolute inset-0 z-10 rounded-[3px] border-2 border-[#007AFF]/70 transition-all group-hover:border-[#007AFF]" />
                                          <span
                                            className="relative z-20 block h-full w-full overflow-hidden px-[2px] py-0"
                                            style={{
                                              fontSize: `${pdfPointsToCss(ann.fontSize, displayScale)}px`,
                                              color: ann.color,
                                              fontFamily:
                                                "Helvetica, Arial, sans-serif",
                                              lineHeight: 1.1,
                                            }}
                                          >
                                            {ann.text}
                                          </span>
                                        </button>
                                      ) : (
                                        <div
                                          className="h-full rounded-md px-2 py-1 transition-all"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAnnotation(ann.id);
                                          }}
                                          style={{
                                            fontSize: `${pdfPointsToCss(ann.fontSize, displayScale)}px`,
                                            color: ann.color,
                                            fontFamily:
                                              "Helvetica, Arial, sans-serif",
                                            lineHeight: 1.2,
                                          }}
                                        >
                                          {ann.text || (
                                            <span className="text-xs text-slate-400">
                                              Insert text here
                                            </span>
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        className="h-full w-full rounded-[3px] border border-dashed border-[#007AFF]/50 bg-transparent transition-all hover:border-[#007AFF]/80"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingAnnotation(ann.id);
                                        }}
                                        aria-label={`Edit text: ${ann.text}`}
                                      />
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}

                      {/* ── Signature Annotation Overlays ── */}
                      {signatureAnnotations
                        .filter((a) => a.pageIndex === pageIndex)
                        .map((sig) => (
                          <div
                            key={sig.id}
                            data-annotation-overlay="true"
                            style={{
                              position: "absolute",
                              left: pdfPointsToCss(sig.x, displayScale),
                              top: pdfPointsToCss(sig.y, displayScale),
                              width: pdfPointsToCss(sig.width, displayScale),
                              height: pdfPointsToCss(sig.height, displayScale),
                            }}
                            className={`z-10 ${
                              mode === "signature"
                                ? "cursor-grab border-2 border-dashed border-[#007AFF]/40 rounded-lg hover:border-[#007AFF] group"
                                : "pointer-events-none"
                            }`}
                            onMouseDown={(e) =>
                              mode === "signature" &&
                              handleSignatureDrag(sig.id, e, pageIndex)
                            }
                          >
                            <img
                              src={sig.imageDataUrl}
                              alt="Signature"
                              className="h-full w-full object-contain"
                              draggable={false}
                            />
                            {mode === "signature" && (
                              <>
                                {/* Delete button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSignatureAnnotations((prev) =>
                                      prev.filter((a) => a.id !== sig.id),
                                    );
                                  }}
                                  className="absolute -right-2 -top-2 hidden rounded-full bg-red-500 p-1 text-white shadow-md group-hover:block transition-all"
                                  aria-label="Remove signature"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                {/* Resize handle */}
                                <div
                                  onMouseDown={(e) =>
                                    handleSignatureResize(sig.id, e)
                                  }
                                  className="absolute -bottom-1.5 -right-1.5 hidden h-4 w-4 cursor-se-resize rounded-full border-2 border-[#007AFF] bg-white shadow-sm group-hover:block"
                                />
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom Status Bar ── */}
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-white px-5 py-2">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              {changedTextCount} change{changedTextCount !== 1 ? "s" : ""}
            </span>
            <span className="text-slate-200">•</span>
            <span>
              {signatureAnnotations.length} signature
              {signatureAnnotations.length !== 1 ? "s" : ""}
            </span>
            {markupAnnotations.length > 0 && (
              <>
                <span className="text-slate-200">•</span>
                <span>
                  {markupAnnotations.length} mark
                  {markupAnnotations.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {mode === "edit" && textAnnotations.length > 0 && (
              <>
                <span className="text-slate-200">•</span>
                <span>{textAnnotations.length} editable blocks</span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {extractingText && "Detecting text blocks…"}
            {!extractingText &&
              mode === "edit" &&
              "Click existing PDF text to edit or delete"}
            {!extractingText &&
              mode === "textbox" &&
              "Drag on the page to place a text box, then type inside it"}
            {!extractingText &&
              mode === "highlight" &&
              "Click and drag to select text, then release to add highlight"}
            {!extractingText &&
              mode === "signature" &&
              "Drag a signature from the sidebar onto the page"}
            {!extractingText && mode === "selection" && "Scroll to view pages"}
          </div>
        </div>

        {/* ── Signature Creator Modal ── */}
        {showSignatureCreator && (
          <SignatureCreator
            onSave={handleSaveSignature}
            onClose={() => setShowSignatureCreator(false)}
          />
        )}
      </div>
    </ModalOverlay>
  );
}
