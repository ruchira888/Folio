import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { addPageNumbers, uploadComplete } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import { downloadFile } from '../utils/download';
import ToolModal from './ToolModal';
import ModalOverlay from './ModalOverlay';
import { X, Download, Hash } from 'lucide-react';

interface PageNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageNumbersResult {
  fileUrl: string;
  fileName: string;
}

export default function PageNumbersModal({ isOpen, onClose }: PageNumbersModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<PageNumbersResult | null>(null);

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('page-numbers', files);
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
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    }
  };

  const handleAddPageNumbers = async () => {
    if (!fileId) return;

    setError(null);
    setIsProcessing(true);
    try {
      const res = await addPageNumbers(fileId);
      const downloadName = fileName ? fileName.replace(/\.pdf$/i, '-numbered.pdf') : 'numbered.pdf';
      setResult({ fileUrl: res.fileUrl, fileName: downloadName });
      void downloadFile(res.fileUrl, downloadName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add page numbers');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setFileId(null);
    setFileName('');
    setResult(null);
    setError(null);
    onClose();
  };

  if (result) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative w-full max-w-[min(600px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF]">
              <Hash className="h-8 w-8 text-[#4F46E5]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Page Numbers Added!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your numbered PDF is ready to download.
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <button
              onClick={() => void downloadFile(result.fileUrl, result.fileName)}
              className="flex items-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#4338CA]"
            >
              <Download className="h-4 w-4" />
              Download Numbered PDF
            </button>
          </div>

          <div className="border-t border-[#E0E7FF] bg-[#F5F7FF] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
             Your files are secure
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  if (fileId) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative w-full max-w-[min(600px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF2FF]">
              <Hash className="h-8 w-8 text-[#4F46E5]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Add Page Numbers
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Page numbers will be added at the bottom center of every page.
            </p>
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleAddPageNumbers}
              className="w-full rounded-xl bg-[#4F46E5] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#4338CA] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isProcessing ? 'Adding Page Numbers…' : 'Add Page Numbers'}
            </button>
          </div>

          <div className="border-t border-[#E0E7FF] bg-[#F5F7FF] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
             Your files are secure
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType="page-numbers"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
