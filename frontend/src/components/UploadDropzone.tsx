import { useRef, useState } from 'react';
import { CloudUpload, Loader2 } from 'lucide-react';
import type { ToolModalConfig } from '../config/toolConfigs';

interface UploadDropzoneProps {
  config: ToolModalConfig;
  isUploading?: boolean;
  isProcessing?: boolean;
  error?: string | null;
  onFilesSelected: (files: File[]) => void;
}

export default function UploadDropzone({
  config,
  isUploading = false,
  isProcessing = false,
  error,
  onFilesSelected,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = isUploading || isProcessing;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    onFilesSelected(Array.from(fileList));
  };

  const openFilePicker = () => {
    if (isBusy) return;
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <div
        onClick={openFilePicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!isBusy) handleFiles(event.dataTransfer.files);
        }}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 sm:py-12
          transition-all duration-200
          ${config.dropzoneBg} ${config.dropzoneBorder}
          ${isDragging ? 'scale-[1.01] shadow-md' : ''}
          ${isBusy ? 'cursor-not-allowed opacity-80' : 'hover:shadow-sm'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          multiple={config.multiple}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full ${config.iconBg}`}
          >
            {isBusy ? (
              <Loader2 className={`h-7 w-7 animate-spin ${config.iconColor}`} />
            ) : (
              <CloudUpload className={`h-7 w-7 ${config.iconColor}`} />
            )}
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={(event) => {
              event.stopPropagation();
              openFilePicker();
            }}
            className={`
              mb-4 w-full max-w-xs rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white
              transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70
              ${config.accentButton} ${config.accentButtonHover}
            `}
          >
            {isProcessing
              ? 'Processing...'
              : isUploading
                ? 'Uploading...'
                : config.buttonText}
          </button>

          <p className="text-sm font-medium text-slate-500">{config.dropHint}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">
            {config.formatsLabel} • Max {config.maxSizeMb}MB
          </p>
        </div>
      </div>
    </div>
  );
}
