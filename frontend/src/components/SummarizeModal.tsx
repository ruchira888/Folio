import { useState } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, summarizePdf } from '../utils/api';
import { validateToolFiles } from '../utils/validateToolFiles';
import ToolModal from './ToolModal';
import SummaryResult from './SummaryResult';

interface SummarizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SummarizeModal({ isOpen, onClose }: SummarizeModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    fileName: string;
    pages: number;
    content: string;
  } | null>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);

    try {
      const uploadedFiles = await startUpload([file]);

      if (!uploadedFiles || uploadedFiles.length === 0) {
        setError('Upload failed. Please try again.');
        return;
      }

      const uploadedFile = uploadedFiles[0];
      const fileKey = uploadedFile.key;
      const fileUrl = uploadedFile.ufsUrl;
      const fileSizeMb = file.size / (1024 * 1024);

      setIsProcessing(true);

      const fileRecord = await uploadComplete(
        fileKey,
        fileUrl,
        file.name,
        fileSizeMb,
      );

      const summaryData = await summarizePdf(fileRecord.id);

      setSummary({
        fileName: file.name,
        pages: summaryData.pages,
        content: summaryData.summary,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Process failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('summarize', files);
    if (validationError) {
      setError(validationError);
      return;
    }

    void handleFileSelect(files[0]);
  };

  const handleCloseSummary = () => {
    setSummary(null);
    setError(null);
    onClose();
  };

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    setError(null);
    onClose();
  };

  if (summary) {
    return (
      <SummaryResult
        fileName={summary.fileName}
        pages={summary.pages}
        summary={summary.content}
        onClose={handleCloseSummary}
      />
    );
  }

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType="summarize"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
