import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, darkModePdf } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import { downloadFile } from '../utils/download';
import ModalOverlay from './ModalOverlay';
import { X, Download, Moon, Loader2, AlertTriangle, CheckCircle, CloudUpload } from 'lucide-react';

interface DarkModePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DarkModeResult {
  fileUrl: string;
  fileKey: string;
}

type Stage = 'upload' | 'processing' | 'done' | 'error';

export default function DarkModePdfModal({ isOpen, onClose }: DarkModePdfModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<DarkModeResult | null>(null);

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setStage('upload');
    setError(null);
    setResult(null);
    setFileName('');
    onClose();
  };

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('dark-mode', files);
    if (validationError) {
      setError(validationError);
      return;
    }
    void handleUpload(files[0]);
  };

  const handleUpload = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const uploadedFiles = await startUpload([file]);
      if (!uploadedFiles || uploadedFiles.length === 0) {
        setError('Upload failed. Please try again.');
        return;
      }
      const uploaded = uploadedFiles[0];
      await uploadComplete(uploaded.key, uploaded.ufsUrl, file.name, file.size / (1024 * 1024));

      // Now call dark mode conversion
      setStage('processing');
      setIsProcessing(true);
      try {
        const res = await darkModePdf(uploaded.key);
        setResult(res);
        setStage('done');
        const downloadName = file.name ? file.name.replace(/\.pdf$/i, '-dark.pdf') : 'dark.pdf';
        void downloadFile(res.fileUrl, downloadName);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : 'Failed to convert PDF';
        if (msg.includes('Scanned') || msg.includes('image-only') || msg.includes('not supported')) {
          setError('This PDF appears to be scanned or image-only. Dark mode conversion only works with text-based PDFs.');
        } else {
          setError(msg);
        }
        setStage('error');
      } finally {
        setIsProcessing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStage('error');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const downloadName = fileName ? fileName.replace(/\.pdf$/i, '-dark.pdf') : 'dark.pdf';
    void downloadFile(result.fileUrl, downloadName);
  };

  const handleReset = () => {
    setStage('upload');
    setError(null);
    setResult(null);
    setFileName('');
  };

  // Dark theme colors
  const isBusy = isUploading || isProcessing;

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose}>
      <div className="relative w-full max-w-[min(850px,90vw)] overflow-hidden rounded-3xl bg-[#1a1a1a] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.6)]">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          disabled={isBusy}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-[#1a1a1a] text-slate-400 transition-all hover:scale-105 hover:border-slate-400 hover:text-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#2a1a0a]">
            <Moon className="h-8 w-8 text-[#F59E0B]" />
          </div>
          <h2 className="font-serif text-[26px] font-semibold tracking-tight text-white sm:text-[28px]">
            Dark Mode PDF
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-400">
            Convert your text-based PDF to a comfortable dark theme. Images are preserved.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-8 sm:px-10">
          {error && (
            <div className="mb-4 rounded-xl border border-red-800/50 bg-red-950/40 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm font-medium text-red-300">{error}</p>
              </div>
            </div>
          )}

          {stage === 'upload' && (
            <div
              onClick={() => !isBusy && document.getElementById('darkmode-file-input')?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (!isBusy) handleFilesSelected(Array.from(e.dataTransfer.files));
              }}
              className={`
                relative cursor-pointer rounded-2xl border-2 border-dashed border-[#3a2a1a] bg-[#232323] px-6 py-10 sm:py-12
                transition-all duration-200
                ${isBusy ? 'cursor-not-allowed opacity-80' : 'hover:border-[#F59E0B]/40 hover:shadow-sm'}
              `}
            >
              <input
                id="darkmode-file-input"
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
              />

              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#2a1a0a]">
                  {isUploading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-[#F59E0B]" />
                  ) : (
                    <CloudUpload className="h-7 w-7 text-[#F59E0B]" />
                  )}
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('darkmode-file-input')?.click();
                  }}
                  className="mb-4 w-full max-w-xs rounded-xl bg-[#F59E0B] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#D97706] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUploading ? 'Uploading…' : 'Select PDF File'}
                </button>

                <p className="text-sm font-medium text-slate-500">or drag & drop PDF here</p>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  PDF • Max 20MB • Text-based PDFs only
                </p>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center gap-6 py-10">
              <Loader2 className="h-10 w-10 animate-spin text-[#F59E0B]" />
              <div className="text-center">
                <p className="text-base font-semibold text-white">Converting to dark mode…</p>
                <p className="mt-1 text-sm text-slate-400">
                  This may take a moment for larger files.
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full animate-pulse rounded-full bg-[#F59E0B]" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          )}

          {stage === 'done' && result && (
            <div className="flex flex-col items-center gap-6 py-6">
              <CheckCircle className="h-12 w-12 text-emerald-400" />
              <div className="text-center">
                <p className="text-base font-semibold text-white">Your dark-mode PDF is ready!</p>
                <p className="mt-1 text-sm text-slate-400">
                  {fileName.replace(/\.pdf$/i, '-dark.pdf')}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl bg-[#F59E0B] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#D97706]"
              >
                <Download className="h-4 w-4" />
                Download Dark PDF
              </button>
              <button
                onClick={handleReset}
                className="text-xs text-slate-500 underline hover:text-slate-300"
              >
                Process another file
              </button>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <button
                onClick={handleReset}
                className="rounded-xl border border-slate-600 px-6 py-2 text-sm text-slate-300 hover:border-slate-400 hover:text-white"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 bg-[#141414] px-6 py-4 text-center sm:px-10">
          <p className="text-[13px] font-medium leading-relaxed text-slate-500">
            <span aria-hidden className="mr-1.5">🔒</span>
            Your files are secure and private. We never store your documents.
          </p>
        </div>
      </div>
    </ModalOverlay>
  );
}
