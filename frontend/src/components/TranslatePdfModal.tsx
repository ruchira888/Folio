import { useState } from "react";
import { useUploadThing } from "../utils/uploadthing";
import { uploadComplete, translatePdf } from "../utils/api";
import { validateToolFiles } from "../utils/validateToolFiles";
import { downloadFile } from "../utils/download";
import ToolModal from "./ToolModal";
import ModalOverlay from "./ModalOverlay";
import { X, Download, Languages, Globe } from "lucide-react";

interface TranslatePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TranslationResult {
  fileUrl: string;
  fileName: string;
}

const LANGUAGES = [
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "pt", name: "Portuguese (Português)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "zh-CN", name: "Chinese (Simplified) (中文)" },
  { code: "ru", name: "Russian (Русский)" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "hi", name: "Hindi (हिन्दी)" },
];

export default function TranslatePdfModal({
  isOpen,
  onClose,
}: TranslatePdfModalProps) {
  const { startUpload, isUploading } = useUploadThing("pdfUploader");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [result, setResult] = useState<TranslationResult | null>(null);

  // ── Phase 0: upload ───────────────────────────────────────────────────────

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles("translate", files);
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
        setError("Upload failed. Please try again.");
        return;
      }
      const uploaded = uploadedFiles[0];
      await uploadComplete(
        uploaded.key,
        uploaded.ufsUrl,
        file.name,
        file.size / (1024 * 1024),
      );
      setFileId(uploaded.key);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during upload",
      );
    }
  };

  // ── Phase 1: Translate ───────────────────────────────────────────────────

  const handleTranslate = async () => {
    if (!fileId) return;

    setError(null);
    setIsProcessing(true);
    try {
      const res = await translatePdf(fileId, targetLanguage);
      const suffix = `-${targetLanguage.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const downloadName = fileName
        ? fileName.replace(/\.pdf$/i, `${suffix}.pdf`)
        : `translated-${targetLanguage}.pdf`;

      setResult({ fileUrl: res.fileUrl, fileName: downloadName });
      void downloadFile(res.fileUrl, downloadName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to translate PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Close / Reset ─────────────────────────────────────────────────────────

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setFileId(null);
    setFileName("");
    setTargetLanguage("es");
    setResult(null);
    setError(null);
    onClose();
  };

  // ── Result View ───────────────────────────────────────────────────────────

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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F0FF]">
              <Languages className="h-8 w-8 text-[#8B5CF6]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Translation Finished!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your translated PDF is ready to download.
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <button
              onClick={() => void downloadFile(result.fileUrl, result.fileName)}
              className="flex items-center gap-2 rounded-xl bg-[#8B5CF6] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#7C3AED]"
            >
              <Download className="h-4 w-4" />
              Download Translated PDF
            </button>
          </div>

          <div className="border-t border-[#FFE4E9] bg-[#FFF5F7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">
                🔒
              </span>
             Your files are secure
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // ── Configuration View ────────────────────────────────────────────────────

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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F0FF]">
              <Languages className="h-8 w-8 text-[#8B5CF6]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Translate PDF
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Select the target language for your PDF translation.
            </p>
            <p className="mx-auto mt-1 text-sm font-medium text-red-500">
              Translation may take a while for large PDFs.
            </p>
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-6">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-slate-400" />
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-800 focus:border-[#8B5CF6]/60 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleTranslate}
              className="w-full rounded-xl bg-[#8B5CF6] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#7C3AED] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isProcessing ? "Translating PDF…" : "Translate PDF"}
            </button>
          </div>

          <div className="border-t border-[#FFE4E9] bg-[#FFF5F7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">
                🔒
              </span>
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
      toolType="translate"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
