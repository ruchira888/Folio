import { X, Copy, Check, Download } from 'lucide-react';
import { useState } from 'react';
import ModalOverlay from './ModalOverlay';

interface SummaryResultProps {
  fileName: string;
  pages: number;
  summary: string;
  onClose: () => void;
}

export default function SummaryResult({
  fileName,
  pages,
  summary,
  onClose,
}: SummaryResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([summary], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${fileName.replace('.pdf', '')}-summary.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <ModalOverlay isOpen onClose={onClose}>
      <div className="relative flex max-h-[90vh] w-full max-w-[min(850px,90vw)] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.18),0_8px_32px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-slate-100 px-6 pb-5 pt-10 sm:px-10 sm:pt-12">
          <h2 className="font-serif text-[26px] font-semibold text-[#0F172A]">Summary</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {fileName} • {pages} page{pages !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700">
            {summary}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5 sm:px-10">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#E05297] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#c94385]"
          >
            Summarize Another
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
