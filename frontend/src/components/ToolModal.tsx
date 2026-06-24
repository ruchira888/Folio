import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import ModalOverlay from './ModalOverlay';
import UploadDropzone from './UploadDropzone';
import { TOOL_MODAL_CONFIG, type ToolType } from '../config/toolConfigs';

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolType: ToolType;
  isUploading?: boolean;
  isProcessing?: boolean;
  error?: string | null;
  onFilesSelected: (files: File[]) => void;
  children?: ReactNode;
}

export default function ToolModal({
  isOpen,
  onClose,
  toolType,
  isUploading = false,
  isProcessing = false,
  error = null,
  onFilesSelected,
  children,
}: ToolModalProps) {
  const config = TOOL_MODAL_CONFIG[toolType];
  const Icon = config.icon;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="relative w-full max-w-[min(850px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}
          >
            <Icon className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
            {config.title}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
            {config.description}
          </p>
        </div>

        <div className="px-6 pb-8 sm:px-10">
          <UploadDropzone
            config={config}
            isUploading={isUploading}
            isProcessing={isProcessing}
            error={error}
            onFilesSelected={onFilesSelected}
          />
          {children}
        </div>

        <div className="border-t border-[#FFE4E9] bg-[#FFF5F7] px-6 py-4 text-center sm:px-10">
          <p className="text-[13px] font-medium leading-relaxed text-slate-500">
            <span aria-hidden className="mr-1.5">
              🔒
            </span>
            Your files are secure and private. We never store your documents.
          </p>
        </div>
      </div>
    </ModalOverlay>
  );
}
