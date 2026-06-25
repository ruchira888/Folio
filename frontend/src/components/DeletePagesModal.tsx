import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, deletePages } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import ToolModal from './ToolModal';
import ModalOverlay from './ModalOverlay';
import { X, Download, Scissors } from 'lucide-react';

interface DeletePagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteResult {
  fileUrl: string;
  fileName: string;
}

export default function DeletePagesModal({ isOpen, onClose }: DeletePagesModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: upload done, waiting for page input
  const [fileId, setFileId] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState('');

  // Phase 2: deletion complete, show result
  const [result, setResult] = useState<DeleteResult | null>(null);

  // ── Phase 1: upload ───────────────────────────────────────────────────────

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('delete-pages', files);
    if (validationError) {
      setError(validationError);
      return;
    }
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

  // ── Phase 2: delete pages ─────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!fileId) return;

    const parsed = pageInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);

    if (parsed.length === 0) {
      setError('Please enter at least one valid page number (e.g. 2, 4, 7).');
      return;
    }

    setError(null);
    setIsProcessing(true);
    try {
      const res = await deletePages(fileId, parsed);
      setResult({ fileUrl: res.fileUrl, fileName: `deleted-pages.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pages');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Close / reset ─────────────────────────────────────────────────────────

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setFileId(null);
    setPageInput('');
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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFEAD5]">
              <Scissors className="h-8 w-8 text-[#F97316]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Pages Deleted!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your modified PDF is ready to download.
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <a
              href={result.fileUrl}
              download={result.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#F97316] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#EA6C00]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>

          <div className="border-t border-[#FFEAD5] bg-[#FFFBF7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
              Your files are secure and private. We never store your documents.
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Page-input view (after upload) ────────────────────────────────────────

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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFEAD5]">
              <Scissors className="h-8 w-8 text-[#F97316]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Which pages to delete?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Enter page numbers separated by commas (e.g. <span className="font-semibold text-slate-700">2, 4, 7</span>).
            </p>
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}
            <input
              type="text"
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              placeholder="e.g. 2, 4, 7"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-800 placeholder-slate-300 focus:border-[#F97316]/60 focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 transition-all"
            />
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDelete}
              className="mt-4 w-full rounded-xl bg-[#F97316] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#EA6C00] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isProcessing ? 'Deleting pages…' : 'Delete Pages'}
            </button>
          </div>

          <div className="border-t border-[#FFEAD5] bg-[#FFFBF7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
              Your files are secure and private. We never store your documents.
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
      toolType="delete-pages"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
