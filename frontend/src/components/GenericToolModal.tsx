import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import type { ToolType } from '../config/toolConfigs';
import ToolModal from './ToolModal';

interface GenericToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolType: Exclude<ToolType, 'summarize'>;
}

export default function GenericToolModal({
  isOpen,
  onClose,
  toolType,
}: GenericToolModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setError(null);
    onClose();
  };

  const handleFilesSelected = async (files: File[]) => {
    const validationError = validateToolFiles(toolType, files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      setIsProcessing(true);

      const uploadedFiles = await startUpload(files);

      if (!uploadedFiles || uploadedFiles.length === 0) {
        setError('Upload failed. Please try again.');
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

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Upload failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType={toolType}
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={(files) => {
        void handleFilesSelected(files);
      }}
    />
  );
}
