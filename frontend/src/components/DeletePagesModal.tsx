import { useState, useEffect, useRef } from 'react';
import { useUploadThing } from '../utils/uploadthing';
import { uploadComplete, deletePages } from '../utils/api';
import { generatePdfThumbnails, type PdfThumbnail } from '../utils/pdfThumbnails';
import { validateToolFiles } from '../utils/validateToolFiles';
import ToolModal from './ToolModal';
import ModalOverlay from './ModalOverlay';
import { X, Download, Scissors, Check, Info, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeletePagesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteResult {
  fileUrl: string;
  fileName: string;
}

export default function DeletePagesModal({ isOpen, onClose }: DeletePagesModalProps) {
  const { startUpload, isUploading } = useUploadThing('pdfUploader');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileId, setFileId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [thumbnails, setThumbnails] = useState<PdfThumbnail[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [renderedCount, setRenderedCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageInput, setPageInput] = useState('');

  const [result, setResult] = useState<DeleteResult | null>(null);
  const renderGenerationRef = useRef(0);

  // Render thumbnails locally when a file is uploaded
  useEffect(() => {
    if (!uploadedFile) return;

    const generation = ++renderGenerationRef.current;
    setThumbnails([]);
    setTotalPages(0);
    setRenderedCount(0);
    setIsLoadingThumbnails(true);
    setError(null);

    void generatePdfThumbnails(uploadedFile, (thumb, pageCount) => {
      if (generation !== renderGenerationRef.current) return;
      setTotalPages(pageCount);
      setThumbnails(prev => {
        const next = [...prev, thumb];
        next.sort((a, b) => a.pageNumber - b.pageNumber);
        return next;
      });
      setRenderedCount(prev => prev + 1);
    })
      .catch(err => {
        if (generation !== renderGenerationRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load thumbnails');
      })
      .finally(() => {
        if (generation !== renderGenerationRef.current) return;
        setIsLoadingThumbnails(false);
      });
  }, [uploadedFile]);

  // Sync selectedPages -> pageInput
  useEffect(() => {
    const sorted = [...selectedPages].sort((a, b) => a - b);
    setPageInput(sorted.join(', '));
  }, [selectedPages]);

  // Helper to parse page ranges (e.g., 1, 3, 5-7)
  const parsePages = (input: string): number[] => {
    const pages: number[] = [];
    const parts = input.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim(), 10));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
        }
      } else {
        const p = parseInt(trimmed, 10);
        if (!isNaN(p)) pages.push(p);
      }
    }
    return [...new Set(pages)]
      .filter(n => n > 0 && n <= (totalPages || thumbnails.length))
      .sort((a, b) => a - b);
  };

  // Handle manual input change
  const handleManualInputChange = (value: string) => {
    setPageInput(value);
    const parsed = parsePages(value);
    
    const currentSorted = [...selectedPages].sort((a, b) => a - b).join(',');
    const newSorted = parsed.join(',');
    
    if (currentSorted !== newSorted) {
      setSelectedPages(parsed);
    }
  };

  const togglePage = (pageNumber: number) => {
    setSelectedPages(prev => 
      prev.includes(pageNumber) 
        ? prev.filter(p => p !== pageNumber)
        : [...prev, pageNumber].sort((a, b) => a - b)
    );
  };

  const handleFilesSelected = (files: File[]) => {
    const validationError = validateToolFiles('delete-pages', files);
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
      setUploadedFile(file);
      setFileId(uploaded.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async () => {
    if (!fileId || selectedPages.length === 0) return;

    setError(null);
    setIsProcessing(true);
    try {
      const res = await deletePages(fileId, selectedPages);
      setResult({ fileUrl: res.fileUrl, fileName: `deleted-pages.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pages');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isUploading || isProcessing) return;
    renderGenerationRef.current += 1;
    setFileId(null);
    setUploadedFile(null);
    setThumbnails([]);
    setTotalPages(0);
    setRenderedCount(0);
    setSelectedPages([]);
    setPageInput('');
    setResult(null);
    setError(null);
    onClose();
  };

  if (result) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative w-full max-w-[min(850px,90vw)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pb-2 pt-10 text-center sm:px-10 sm:pt-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFEAD5]">
              <Scissors className="h-8 w-8 text-[#F97316]" />
            </div>
            <h2 className="font-serif text-[26px] font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
              Pages Deleted!
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
              Your modified PDF is ready to download.
            </p>
          </div>

          <div className="flex justify-center px-6 pb-10 sm:px-10">
            <a
              href={result.fileUrl}
              download={result.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#F97316] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#EA6C00]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>

          <div className="border-t border-[#FFEAD5] bg-[#FFFBF7] px-6 py-4 text-center sm:px-10">
            <p className="text-[13px] font-medium leading-relaxed text-slate-500">
              <span aria-hidden className="mr-1.5">🔒</span>
              Your files are secure and private. We never store your documents.
            </p>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  if (fileId) {
    return (
      <ModalOverlay isOpen onClose={handleClose}>
        <div className="relative flex h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFEAD5]">
                <Scissors className="h-5 w-5 text-[#F97316]" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Remove pages</h2>
            </div>
            <button
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Side: Thumbnail Grid */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
              {isLoadingThumbnails && thumbnails.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-10 w-10 animate-spin text-[#F97316]" />
                  <p className="text-sm font-medium text-slate-500">Loading PDF pages...</p>
                </div>
              ) : (
                <>
                  {isLoadingThumbnails && totalPages > 0 && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" />
                      Rendering pages {renderedCount} of {totalPages}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  <AnimatePresence mode="popLayout">
                    {thumbnails.map((thumb) => {
                      const isSelected = selectedPages.includes(thumb.pageNumber);
                      return (
                        <motion.div
                          key={thumb.pageNumber}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileHover={{ y: -6 }}
                          onClick={() => togglePage(thumb.pageNumber)}
                          className={`group relative cursor-pointer rounded-2xl bg-white p-3 shadow-sm transition-all duration-300 hover:shadow-xl ${
                            isSelected 
                              ? 'ring-2 ring-blue-500 ring-offset-4' 
                              : 'ring-1 ring-slate-200/60'
                          }`}
                        >
                          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
                            <img
                              src={thumb.thumbnailUrl}
                              alt={`Page ${thumb.pageNumber}`}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            {/* Selection Overlay */}
                            <div className={`absolute inset-0 transition-all duration-300 ${
                              isSelected 
                                ? 'bg-blue-500/10 opacity-100' 
                                : 'bg-black/0 opacity-0 group-hover:bg-black/5 opacity-100'
                            }`} />
                            
                            {/* Checkmark in blue rounded box */}
                            <div className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all duration-300 ${
                              isSelected 
                                ? 'bg-blue-500 border-blue-500 scale-100 shadow-lg shadow-blue-500/30' 
                                : 'bg-white/95 border-slate-200 scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100'
                            }`}>
                              <Check className={`h-4 w-4 transition-all duration-300 ${isSelected ? 'text-white' : 'text-slate-300'}`} strokeWidth={4} />
                            </div>
                          </div>
                          <div className="mt-3 text-center">
                            <span className={`text-[13px] font-bold tracking-tight transition-colors duration-200 ${
                              isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-800'
                            }`}>
                              Page {thumb.pageNumber}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  </div>
                </>
              )}
            </div>

            {/* Right Side: Sidebar */}
            <div className="w-80 flex flex-col border-l border-slate-100 bg-white">
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Summary Section */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Summary</h3>
                  <div className="rounded-2xl bg-blue-50/50 p-4 border border-blue-100/50">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100/80 shrink-0">
                        <Info className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="text-[13px] leading-relaxed text-blue-800 font-medium">
                        Click on pages to select them for removal. Selected pages will be deleted from your new document.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5 border border-slate-100">
                    <span className="text-sm font-semibold text-slate-500">Total pages</span>
                    <span className="text-sm font-bold text-slate-900">{totalPages || thumbnails.length}</span>
                  </div>
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3.5 border transition-colors duration-200 ${
                    selectedPages.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span className="text-sm font-semibold text-slate-500">To remove</span>
                    <span className={`text-sm font-bold ${selectedPages.length > 0 ? 'text-[#F97316]' : 'text-slate-900'}`}>
                      {selectedPages.length} pages
                    </span>
                  </div>
                </div>

                {/* Pages Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Pages to remove</label>
                    <span className="text-[11px] font-bold text-slate-400">e.g. 1, 3, 5-7</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={pageInput}
                      onChange={(e) => handleManualInputChange(e.target.value)}
                      placeholder="example: 1, 3-5"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-5 py-4 text-[14px] font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-6 border-t border-slate-50 bg-slate-50/30">
                {error && (
                  <div className="mb-4 rounded-xl bg-red-50 p-4 text-[13px] font-bold text-red-600 border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                    {error}
                  </div>
                )}
                <button
                  onClick={handleDelete}
                  disabled={isProcessing || selectedPages.length === 0}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#F97316] py-5 text-base font-bold text-white shadow-xl shadow-orange-500/20 transition-all hover:bg-[#EA6C00] hover:shadow-orange-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isProcessing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <span>Remove {selectedPages.length || ''} pages</span>
                      <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={handleClose}
      toolType="delete-pages"
      isUploading={isUploading}
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={handleFilesSelected}
    />
  );
}
