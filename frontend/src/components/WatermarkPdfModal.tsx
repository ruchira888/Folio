import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, watermarkPdf } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import { downloadFile } from '../utils/download';
import ToolModal from './ToolModal';
import ModalOverlay from './ModalOverlay';
import { X, Download, Type, Sliders, Layout, Percent, Type as FontIcon } from 'lucide-react';

interface WatermarkPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WatermarkResult {
  fileUrl: string;
  fileName: string;
}

export default function WatermarkPdfModal({ isOpen, onClose }: WatermarkPdfModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('CONFIDENTIAL');
  const [color, setColor] = useState('#e67610');
  const [transparency, setTransparency] = useState(0.3);
  const [fontSize, setFontSize] = useState(48);
  const [position, setPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'diagonal'>('diagonal');

  // Result state
  const [result, setResult] = useState<WatermarkResult | null>(null);

  // ── Phase 0: upload ───────────────────────────────────────────────────────

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('watermark', files);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFileName(files[0].name);
    void handleUpload(files[0]);
  };

  const handleUpload = async (file: File) => {
    setError(null);
    try {
      const uploadedFiles = await startUpload([file]);
      if (!uploadedFiles || uploadedFiles.length === 0) {
        setError('Upload failed. Please try again.');
        return;
      }
      const uploaded = uploadedFiles[0];
      await uploadComplete(uploaded.key, uploaded.ufsUrl, file.name, file.size / (1024 * 1024));
      setFileId(uploaded.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // ── Phase 1: Apply Watermark ────────────────────────────────────────────────

  const handleApplyWatermark = async () => {
    if (!fileId) return;

    if (!text.trim()) {
      setError('Watermark text must not be empty.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    try {
      const res = await watermarkPdf(fileId, {
        text,
        color,
        transparency,
        fontSize,
        position,
      });
      const downloadName = fileName ? fileName.replace(/\.pdf$/i, '-watermarked.pdf') : 'watermarked.pdf';
      setResult({ fileUrl: res.fileUrl, fileName: downloadName });
      void downloadFile(res.fileUrl, downloadName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply watermark');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Close / reset ─────────────────────────────────────────────────────────

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setFileId(null);
    setFileName('');
    setText('CONFIDENTIAL');
    setColor('#e67610');
    setTransparency(0.3);
    setFontSize(48);
    setPosition('diagonal');
    setResult(null);
    setError(null);
    onClose();
  };

  // ── Result view ───────────────────────────────────────────────────────────

  if (result) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative w-full max-w-[min(850px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Type className="h-8 w-8 text-[#22C55E]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Watermark Added!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your watermarked PDF is ready to download.
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <button
              onClick={() => void downloadFile(result.fileUrl, result.fileName)}
              className="flex items-center gap-2 rounded-xl bg-[#22C55E] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#1BA14D]"
            >
              <Download className="h-4 w-4" />
              Download Watermarked PDF
            </button>
          </div>

          <div className="border-t border-[#FFE4E9] bg-[#FFF5F7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
             Your files are secure
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Configuration view ─────────────────────────────────────────────────────

  if (fileId) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative w-full max-w-[min(850px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E0FFE8]">
              <Type className="h-8 w-8 text-[#22C55E]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Watermark Settings
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Configure your custom text watermark style.
            </p>
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Text Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Type className="h-4 w-4 text-slate-400" />
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] text-slate-800 placeholder-slate-300 focus:border-[#22C55E]/60 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all"
                />
              </div>

              {/* Position */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layout className="h-4 w-4 text-slate-400" />
                  Position
                </label>
                <select
                  value={position}
                  onChange={e => setPosition(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] text-slate-800 focus:border-[#22C55E]/60 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all cursor-pointer"
                >
                  <option value="diagonal">Diagonal</option>
                  <option value="center">Center</option>
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <FontIcon className="h-4 w-4 text-slate-400" />
                  Font Size ({fontSize}px)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="12"
                    max="120"
                    step="2"
                    value={fontSize}
                    onChange={e => setFontSize(parseInt(e.target.value))}
                    className="flex-grow accent-[#22C55E]"
                  />
                  <input
                    type="number"
                    min="12"
                    max="120"
                    value={fontSize}
                    onChange={e => setFontSize(Math.min(120, Math.max(12, parseInt(e.target.value) || 12)))}
                    className="w-16 rounded-xl border border-slate-200 text-center py-1 text-sm font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* Transparency */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Percent className="h-4 w-4 text-slate-400" />
                  Opacity ({Math.round(transparency * 100)}%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={transparency}
                    onChange={e => setTransparency(parseFloat(e.target.value))}
                    className="flex-grow accent-[#22C55E]"
                  />
                  <input
                    type="number"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={transparency}
                    onChange={e => setTransparency(Math.min(1, Math.max(0.05, parseFloat(e.target.value) || 0.05)))}
                    className="w-16 rounded-xl border border-slate-200 text-center py-1 text-sm font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* Color */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-slate-400" />
                  Color and alpha
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative h-10 w-16 overflow-hidden rounded-xl border border-slate-200">
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0"
                    />
                  </div>
                  <span className="text-sm font-mono text-slate-500 uppercase">{color}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleApplyWatermark}
              className="mt-6 w-full rounded-xl bg-[#22C55E] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#1BA14D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isProcessing ? 'Applying Watermark…' : 'Add Watermark'}
            </button>
          </div>

          <div className="border-t border-[#FFE4E9] bg-[#FFF5F7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
             Your files are secure
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Phase 0: upload view ──────────────────────────────────────────────────

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType="watermark"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
