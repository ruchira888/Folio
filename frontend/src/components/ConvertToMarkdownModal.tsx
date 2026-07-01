import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, convertPdfToMarkdown } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import { downloadFile } from '../utils/download';
import ToolModal from './ToolModal';
import ModalOverlay from './ModalOverlay';
import { X, Download, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface ConvertToMarkdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConvertResult {
  fileUrl: string;
  fileName: string;
}

export default function ConvertToMarkdownModal({ isOpen, onClose }: ConvertToMarkdownModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setError(null);
    setResult(null);
    onClose();
  };

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('convert', files);
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

      setIsProcessing(true);
      try {
        const res = await convertPdfToMarkdown(uploaded.key);
        const downloadName = file.name.replace(/\.pdf$/i, '-markdown.md');
        setResult({ fileUrl: res.fileUrl, fileName: downloadName });
        void downloadFile(res.fileUrl, downloadName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to convert PDF';
        if (msg.includes('Scanned') || msg.includes('image-only') || msg.includes('text-based PDF')) {
          setError('This PDF appears to be scanned or image-only. Markdown export currently supports text-based PDFs only.');
        } else {
          setError(msg);
        }
      } finally {
        setIsProcessing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    void downloadFile(result.fileUrl, result.fileName);
  };

  const handleReset = () => {
    setError(null);
    setResult(null);
  };

  const isBusy = isUploading || isProcessing;

  if (result) {
    return (
      <ModalOverlay isOpen={isOpen} onClose={handleClose}>
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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E0F4FF]">
              <FileText className="h-8 w-8 text-[#0EA5E9]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Markdown Ready!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your Markdown file is ready to download.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 px-6 pb-10 sm:px-10">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl bg-[#0EA5E9] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0284C7]"
            >
              <Download className="h-4 w-4" />
              Download Markdown
            </button>
            <button
              onClick={handleReset}
              className="text-xs text-slate-500 underline hover:text-slate-700"
            >
              Convert another file
            </button>
          </div>

          <div className="border-t border-[#E0F4FF] bg-[#F5FBFF] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">📝</span>
              Text, headings, bullets and simple tables are preserved when possible.
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  if (error) {
    return (
      <ModalOverlay isOpen={isOpen} onClose={handleClose}>
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
              <AlertTriangle className="h-8 w-8 text-[#F43F5E]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Conversion failed
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              {error}
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <button
              onClick={handleReset}
              className="rounded-xl bg-[#0EA5E9] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0284C7]"
            >
              Try Again
            </button>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType="convert"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={null}
      onFilesSelected={handleFilesSelected}
    >
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
        <span>{isBusy ? 'Processing PDF...' : 'Text-based PDFs only • Markdown export'}</span>
      </div>
    </ToolModal>
  );
}
