import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, mergePdfs, type PdfFileResult } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import { downloadFile } from '../utils/download';
import ModalOverlay from './ModalOverlay';
import { X, Download, GitMerge, Loader2, AlertTriangle, CheckCircle, CloudUpload } from 'lucide-react';

interface MergePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Stage = 'upload' | 'processing' | 'done' | 'error';

export default function MergePdfModal({ isOpen, onClose }: MergePdfModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('upload');
  const [result, setResult] = useState<PdfFileResult | null>(null);
  const [fileCount, setFileCount] = useState(0);

  const isBusy = isUploading || isProcessing;

  const handleClose = () => {
    if (isBusy) return;
    setStage('upload');
    setError(null);
    setResult(null);
    setFileCount(0);
    onClose();
  };

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('merge', files);
    if (validationError) {
      setError(validationError);
      return;
    }
    void handleUploadAndMerge(files);
  };

  const handleUploadAndMerge = async (files: File[]) => {
    setError(null);
    setFileCount(files.length);

    try {
      const uploadedFiles = await startUpload(files);
      if (!uploadedFiles || uploadedFiles.length !== files.length) {
        setError('Upload failed. Please try again.');
        setStage('error');
        return;
      }

      await Promise.all(
        uploadedFiles.map((uploadedFile, index) =>
          uploadComplete(
            uploadedFile.key,
            uploadedFile.ufsUrl,
            files[index].name,
            files[index].size / (1024 * 1024),
          ),
        ),
      );

      setStage('processing');
      setIsProcessing(true);

      const fileIds = uploadedFiles.map((f) => f.key);
      const merged = await mergePdfs(fileIds);
      setResult(merged);
      setStage('done');
      void downloadFile(merged.fileUrl, 'merged.pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge PDFs');
      setStage('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (isBusy) return;
    setStage('upload');
    setError(null);
    setResult(null);
    setFileCount(0);
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose}>
      <div className="relative w-full max-w-[min(850px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          disabled={isBusy}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAFBF0]">
            <GitMerge className="h-8 w-8 text-[#22C55E]" />
          </div>
          <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
            Merge PDF
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
            Upload up to 10 PDFs (25MB each) and combine them into one file.
          </p>
        </div>

        <div className="px-6 pb-8 sm:px-10">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            </div>
          )}

          {stage === 'upload' && (
            <div
              onClick={() => !isBusy && document.getElementById('merge-file-input')?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (!isBusy) handleFilesSelected(Array.from(e.dataTransfer.files));
              }}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed border-[#E0FFE8] bg-[#F0FFF4] px-6 py-10 sm:py-12 transition-all duration-200 ${isBusy ? 'cursor-not-allowed opacity-80' : 'hover:border-[#22C55E]/40 hover:shadow-sm'}`}
            >
              <input
                id="merge-file-input"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
              />

              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#DCFCE7]">
                  {isUploading ? <Loader2 className="h-7 w-7 animate-spin text-[#22C55E]" /> : <CloudUpload className="h-7 w-7 text-[#22C55E]" />}
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('merge-file-input')?.click();
                  }}
                  className="mb-4 w-full max-w-xs rounded-xl bg-[#22C55E] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#1BA14D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUploading ? 'Uploading…' : 'Select Multiple PDFs'}
                </button>

                <p className="text-sm font-medium text-slate-500">or drag & drop PDFs here</p>
                <p className="mt-2 text-xs font-medium text-slate-600">PDF • 2 to 10 files • Max 25MB each</p>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="flex flex-col items-center gap-6 py-10">
              <Loader2 className="h-10 w-10 animate-spin text-[#22C55E]" />
              <div className="text-center">
                <p className="text-base font-semibold text-[#0F172A]">Merging {fileCount} PDFs…</p>
                <p className="mt-1 text-sm text-slate-500">generating your merged file.</p>
              </div>
            </div>
          )}

          {stage === 'done' && result && (
            <div className="flex flex-col items-center gap-6 py-6">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <div className="text-center">
                <p className="text-base font-semibold text-[#0F172A]">Merged PDF is ready!</p>
                <p className="mt-1 text-sm text-slate-500">Downloaded as merged.pdf</p>
              </div>
              <button
                onClick={() => void downloadFile(result.fileUrl, 'merged.pdf')}
                className="flex items-center gap-2 rounded-xl bg-[#22C55E] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#1BA14D]"
              >
                <Download className="h-4 w-4" />
                Download Merged PDF
              </button>
              <button onClick={handleReset} className="text-xs text-slate-500 underline hover:text-slate-700">
                Merge more files
              </button>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <button
                onClick={handleReset}
                className="rounded-xl border border-slate-300 px-6 py-2 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-800"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-[#E0FFE8] bg-[#F7FFF9] px-6 py-4 text-center sm:px-10">
          <p className="text-[13px] font-medium leading-relaxed text-slate-500">
            <span aria-hidden className="mr-1.5">🔒</span>
            Your files are secure and private. We never store your documents.
          </p>
        </div>
      </div>
    </ModalOverlay>
  );
}
