import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, protectPdf } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import ToolModal from './ToolModal';
import ModalOverlay from './ModalOverlay';
import { X, Download, Lock, Eye, EyeOff } from 'lucide-react';

interface ProtectPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProtectResult {
  fileUrl: string;
  fileName: string;
}

export default function ProtectPdfModal({ isOpen, onClose }: ProtectPdfModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: upload done, waiting for password
  const [fileId, setFileId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phase 2: protection complete, show result
  const [result, setResult] = useState<ProtectResult | null>(null);

  // ── Phase 0: upload ───────────────────────────────────────────────────────

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('protect', files);
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

  // ── Phase 1: protect ──────────────────────────────────────────────────────

  const handleProtect = async () => {
    if (!fileId) return;

    if (!password.trim()) {
      setError('Please enter a password.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    try {
      const res = await protectPdf(fileId, password);
      setResult({ fileUrl: res.fileUrl, fileName: `protected.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to protect PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Close / reset ─────────────────────────────────────────────────────────

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setFileId(null);
    setPassword('');
    setShowPassword(false);
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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFE4E4]">
              <Lock className="h-8 w-8 text-[#F43F5E]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              PDF Protected!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your password-protected PDF is ready to download.
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <a
              href={result.fileUrl}
              download={result.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#F43F5E] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#E11D48]"
            >
              <Download className="h-4 w-4" />
              Download Protected PDF
            </a>
          </div>

          <div className="border-t border-[#FFE4E4] bg-[#FFF8F8] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
              Your files are secure and private. We never store your documents.
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Password-input view (after upload) ────────────────────────────────────

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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFE4E4]">
              <Lock className="h-8 w-8 text-[#F43F5E]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Set a password
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Choose a strong password to protect your PDF.
            </p>
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleProtect()}
                placeholder="Enter password…"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-[15px] text-slate-800 placeholder-slate-300 focus:border-[#F43F5E]/60 focus:outline-none focus:ring-2 focus:ring-[#F43F5E]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleProtect}
              className="mt-4 w-full rounded-xl bg-[#F43F5E] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#E11D48] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isProcessing ? 'Protecting PDF…' : 'Protect PDF'}
            </button>
          </div>

          <div className="border-t border-[#FFE4E4] bg-[#FFF8F8] px-6 py-4 text-center sm:px-10">
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
      toolType="protect"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
