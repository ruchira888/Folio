import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Download, MousePointer2, PenTool, Stamp, Plus, Trash2,
  Loader2, Type, Upload, Pen,
  ZoomIn, ZoomOut, Check,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import ModalOverlay from './ModalOverlay';
import ToolModal from './ToolModal';
import { validateToolFiles } from '../utils/validateToolFiles';

// ─── PDF.js worker setup ───────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

// ─── Types ─────────────────────────────────────────────────────────────────────
type EditorMode = 'selection' | 'edit' | 'signature';

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

interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  viewport: pdfjsLib.PageViewport;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const RENDER_SCALE = 1.5;
const STORAGE_KEY = 'folio_saved_signatures';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
type SigTab = 'draw' | 'type' | 'upload';

function SignatureCreator({
  onSave,
  onClose,
}: {
  onSave: (dataUrl: string, label: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<SigTab>('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Drawing
  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
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
      const ctx = canvas.getContext('2d')!;
      const rect = canvas.getBoundingClientRect();
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a1a2e';
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
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      onSave(canvas.toDataURL('image/png'), 'Drawn Signature');
    } else if (tab === 'type') {
      if (!typedName.trim()) return;
      // Render typed name to canvas with cursive font
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 120;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.font = 'italic 48px "Georgia", "Times New Roman", serif';
      ctx.fillStyle = '#1a1a2e';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 16, 60);
      onSave(c.toDataURL('image/png'), typedName);
    } else if (tab === 'upload') {
      if (!uploadPreview) return;
      onSave(uploadPreview, 'Uploaded Signature');
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
    { id: 'draw', label: 'Draw', icon: Pen },
    { id: 'type', label: 'Type', icon: Type },
    { id: 'upload', label: 'Upload', icon: Upload },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">Create Signature</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
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
                  ? 'border-[#007AFF] text-[#007AFF]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === 'draw' && (
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
                style={{ touchAction: 'none' }}
              />
              <button
                onClick={clearCanvas}
                className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          {tab === 'type' && (
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
          {tab === 'upload' && (
            <div>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 transition-colors hover:border-[#007AFF]/40 hover:bg-[#007AFF]/5">
                <Upload className="h-8 w-8 text-slate-400" />
                <span className="text-sm font-medium text-slate-500">Click to upload signature image</span>
                <span className="text-xs text-slate-400">PNG, JPG up to 2MB</span>
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>
              {uploadPreview && (
                <div className="mt-3 flex justify-center rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <img src={uploadPreview} alt="Signature preview" className="max-h-24 object-contain" />
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
              (tab === 'draw' && !hasDrawn) ||
              (tab === 'type' && !typedName.trim()) ||
              (tab === 'upload' && !uploadPreview)
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

export default function AnnotatePdfModal({ isOpen, onClose }: AnnotatePdfModalProps) {
  // ── Upload phase ──
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── PDF document state ──
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Editor state ──
  const [mode, setMode] = useState<EditorMode>('selection');
  const [scale, setScale] = useState(1.0);
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [signatureAnnotations, setSignatureAnnotations] = useState<SignatureAnnotation[]>([]);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // ── Signature state ──
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>(loadSavedSignatures);
  const [showSignatureCreator, setShowSignatureCreator] = useState(false);
  const [draggingSignature, setDraggingSignature] = useState<SavedSignature | null>(null);

  // ── Refs ──
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Load PDF from file ──
  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('annotate', files);
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
      setPdfBytes(buffer);
      try {
        const doc = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
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
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
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

        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport } as any).promise;
      }
    };

    renderPages();
    return () => { cancelled = true; };
  }, [pdfDoc, pages, scale]);

  // ── Handle click on page (Edit Mode) ──
  const handlePageClick = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      if (mode !== 'edit') return;

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const displayScale = RENDER_SCALE * scale;

      // Position in PDF points
      const clickX = (e.clientX - rect.left) / displayScale;
      const clickY = (e.clientY - rect.top) / displayScale;

      // Check if clicking on an existing annotation
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

      // Create a new text annotation
      const newAnnotation: TextAnnotation = {
        id: generateId(),
        pageIndex,
        x: clickX,
        y: clickY,
        width: 150,
        height: 24,
        text: '',
        fontSize: 12,
        color: '#000000',
      };
      setTextAnnotations((prev) => [...prev, newAnnotation]);
      setEditingAnnotation(newAnnotation.id);
    },
    [mode, scale, textAnnotations],
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

  // ── Handle signature drag on page (reposition) ──
  const handleSignatureDrag = useCallback(
    (annotationId: string, e: React.MouseEvent, pageIndex: number) => {
      if (mode !== 'signature') return;
      e.stopPropagation();
      e.preventDefault();

      const container = pageContainerRefs.current[pageIndex];
      if (!container) return;

      const displayScale = RENDER_SCALE * scale;
      const startX = e.clientX;
      const startY = e.clientY;
      const annotation = signatureAnnotations.find((a) => a.id === annotationId);
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
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
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
      const annotation = signatureAnnotations.find((a) => a.id === annotationId);
      if (!annotation) return;
      const origW = annotation.width;
      const origH = annotation.height;

      const onMove = (me: MouseEvent) => {
        const dx = (me.clientX - startX) / displayScale;
        const dy = (me.clientY - startY) / displayScale;
        setSignatureAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotationId
              ? { ...a, width: Math.max(30, origW + dx), height: Math.max(15, origH + dy) }
              : a,
          ),
        );
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
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
      const doc = await PDFDocument.load(pdfBytes);
      const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);
      const pdfPages = doc.getPages();

      // Apply text annotations
      for (const ann of textAnnotations) {
        if (!ann.text.trim()) continue;
        const page = pdfPages[ann.pageIndex];
        if (!page) continue;

        const pageHeight = page.getHeight();

        // Draw white cover rectangle (to hide original text)
        page.drawRectangle({
          x: ann.x,
          y: pageHeight - ann.y - ann.height,
          width: ann.width,
          height: ann.height,
          color: rgb(1, 1, 1),
        });

        // Draw replacement text
        const hexToRgb = (hex: string) => {
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;
          return rgb(r, g, b);
        };

        page.drawText(ann.text, {
          x: ann.x + 2,
          y: pageHeight - ann.y - ann.height + 4,
          size: ann.fontSize,
          font: helveticaFont,
          color: hexToRgb(ann.color),
        });
      }

      // Apply signature annotations
      for (const sig of signatureAnnotations) {
        const page = pdfPages[sig.pageIndex];
        if (!page) continue;

        const pageHeight = page.getHeight();

        // Convert data URL to bytes
        const base64Data = sig.imageDataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        let image;
        if (sig.imageDataUrl.includes('image/png')) {
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
      const blob = new Blob([modifiedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName
        ? fileName.replace(/\.pdf$/i, '-annotated.pdf')
        : 'annotated.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 200);

      setApplying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
      setApplying(false);
    }
  };

  // ── Close / Reset ──
  const handleClose = () => {
    if (applying) return;
    setPdfBytes(null);
    setPdfDoc(null);
    setPages([]);
    setFileName('');
    setMode('selection');
    setScale(1.0);
    setTextAnnotations([]);
    setSignatureAnnotations([]);
    setEditingAnnotation(null);
    setError(null);
    setApplying(false);
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
  const hasAnnotations = textAnnotations.length > 0 || signatureAnnotations.length > 0;

  const modes: { id: EditorMode; label: string; icon: typeof MousePointer2 }[] = [
    { id: 'selection', label: 'Select', icon: MousePointer2 },
    { id: 'edit', label: 'Edit Text', icon: PenTool },
    { id: 'signature', label: 'Signature', icon: Stamp },
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
                {pages.length} page{pages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100/80 p-1">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  setEditingAnnotation(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                  mode === m.id
                    ? 'bg-white text-[#007AFF] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

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
              disabled={applying || !hasAnnotations}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                hasAnnotations
                  ? 'bg-[#007AFF] hover:bg-[#0062CC]'
                  : 'bg-slate-300'
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

        {/* ── Error bar ── */}
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
        )}

        {/* ── Main Content ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Signature Sidebar (only in signature mode) ── */}
          {mode === 'signature' && (
            <div className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200/80 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">My Signatures</h3>
                <p className="text-xs text-slate-400 mt-0.5">Drag onto PDF to place</p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {savedSignatures.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Stamp className="h-8 w-8 text-slate-300" />
                    <p className="text-xs text-slate-400">No saved signatures</p>
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
            className="flex-1 overflow-auto bg-slate-100/60"
            style={{
              cursor:
                mode === 'edit'
                  ? 'text'
                  : mode === 'signature' && draggingSignature
                    ? 'copy'
                    : 'default',
            }}
          >
            <div className="flex flex-col items-center gap-6 p-6">
              {pages.map((pageInfo, pageIndex) => {
                const w = pageInfo.width * (scale);
                const h = pageInfo.height * (scale);

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
                      ref={(el) => { pageContainerRefs.current[pageIndex] = el; }}
                      className="relative rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white"
                      style={{ width: w, height: h }}
                      onClick={(e) => handlePageClick(e, pageIndex)}
                      onDragOver={(e) => {
                        if (mode === 'signature') e.preventDefault();
                      }}
                      onDrop={(e) => handlePageDrop(e, pageIndex)}
                    >
                      {/* PDF Canvas */}
                      <canvas
                        ref={(el) => { canvasRefs.current[pageIndex] = el; }}
                        style={{
                          width: w,
                          height: h,
                          display: 'block',
                        }}
                      />

                      {/* ── Text Annotation Overlays ── */}
                      {textAnnotations
                        .filter((a) => a.pageIndex === pageIndex)
                        .map((ann) => {
                          const isEditing = editingAnnotation === ann.id;
                          return (
                            <div
                              key={ann.id}
                              style={{
                                position: 'absolute',
                                left: ann.x * displayScale / RENDER_SCALE,
                                top: ann.y * displayScale / RENDER_SCALE,
                                width: ann.width * displayScale / RENDER_SCALE,
                                minHeight: ann.height * displayScale / RENDER_SCALE,
                              }}
                              className={`group ${
                                isEditing
                                  ? 'z-20'
                                  : 'z-10 cursor-pointer'
                              }`}
                            >
                              {isEditing ? (
                                <div className="relative">
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
                                    onBlur={() => setEditingAnnotation(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') setEditingAnnotation(null);
                                    }}
                                    className="w-full min-h-[24px] resize-both rounded border-2 border-[#007AFF] bg-white/90 px-1.5 py-1 text-sm text-slate-800 outline-none backdrop-blur-sm"
                                    style={{
                                      fontSize: `${ann.fontSize * displayScale / RENDER_SCALE}px`,
                                      color: ann.color,
                                      fontFamily: 'Helvetica, Arial, sans-serif',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  {/* Annotation controls */}
                                  <div className="absolute -top-8 left-0 flex items-center gap-1 rounded-lg bg-white p-1 shadow-lg border border-slate-200">
                                    <input
                                      type="color"
                                      value={ann.color}
                                      onChange={(e) =>
                                        setTextAnnotations((prev) =>
                                          prev.map((a) =>
                                            a.id === ann.id
                                              ? { ...a, color: e.target.value }
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
                                                  fontSize: parseInt(e.target.value),
                                                }
                                              : a,
                                          ),
                                        )
                                      }
                                      className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-600 outline-none"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(
                                        (s) => (
                                          <option key={s} value={s}>
                                            {s}pt
                                          </option>
                                        ),
                                      )}
                                    </select>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTextAnnotations((prev) =>
                                          prev.filter((a) => a.id !== ann.id),
                                        );
                                        setEditingAnnotation(null);
                                      }}
                                      className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                      title="Delete annotation"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="rounded border border-transparent bg-yellow-100/50 px-1.5 py-0.5 transition-all hover:border-[#007AFF]/30 hover:bg-yellow-100/80"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (mode === 'edit') setEditingAnnotation(ann.id);
                                  }}
                                  style={{
                                    fontSize: `${ann.fontSize * displayScale / RENDER_SCALE}px`,
                                    color: ann.color,
                                    fontFamily: 'Helvetica, Arial, sans-serif',
                                  }}
                                >
                                  {ann.text || (
                                    <span className="italic text-slate-400 text-xs">
                                      Click to edit
                                    </span>
                                  )}
                                </div>
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
                            style={{
                              position: 'absolute',
                              left: sig.x * displayScale / RENDER_SCALE,
                              top: sig.y * displayScale / RENDER_SCALE,
                              width: sig.width * displayScale / RENDER_SCALE,
                              height: sig.height * displayScale / RENDER_SCALE,
                            }}
                            className={`z-10 ${
                              mode === 'signature'
                                ? 'cursor-grab border-2 border-dashed border-[#007AFF]/40 rounded-lg hover:border-[#007AFF] group'
                                : 'pointer-events-none'
                            }`}
                            onMouseDown={(e) =>
                              mode === 'signature' &&
                              handleSignatureDrag(sig.id, e, pageIndex)
                            }
                          >
                            <img
                              src={sig.imageDataUrl}
                              alt="Signature"
                              className="h-full w-full object-contain"
                              draggable={false}
                            />
                            {mode === 'signature' && (
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
                                  onMouseDown={(e) => handleSignatureResize(sig.id, e)}
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
              {textAnnotations.length} text edit{textAnnotations.length !== 1 ? 's' : ''}
            </span>
            <span className="text-slate-200">•</span>
            <span>
              {signatureAnnotations.length} signature
              {signatureAnnotations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {mode === 'edit' && 'Click anywhere on the page to add text'}
            {mode === 'signature' && 'Drag a signature from the sidebar onto the page'}
            {mode === 'selection' && 'Scroll to view pages'}
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
