import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, OPS, TextLayer, version } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import ToolModal from './ToolModal';

GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

interface DarkModePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const textOperations = new Set<number>([
  OPS.beginText,
  OPS.endText,
  OPS.setCharSpacing,
  OPS.setWordSpacing,
  OPS.setHScale,
  OPS.setLeading,
  OPS.setFont,
  OPS.setTextRenderingMode,
  OPS.setTextRise,
  OPS.moveText,
  OPS.setLeadingMoveText,
  OPS.setTextMatrix,
  OPS.nextLine,
  OPS.showText,
  OPS.showSpacedText,
  OPS.nextLineShowText,
  OPS.nextLineSetSpacingShowText,
]);

function DarkModePage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let textLayer: TextLayer | undefined;

    void (async () => {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.35 });
      const operatorList = await page.getOperatorList();
      if (cancelled || !canvasRef.current || !textLayerRef.current) return;

      setSize({ width: viewport.width, height: viewport.height });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: true });
      if (!context) throw new Error('Could not create PDF canvas');
      context.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        background: 'rgba(0,0,0,0)',
        operationsFilter: (index) => !textOperations.has(operatorList.fnArray[index]),
      }).promise;

      if (cancelled) return;
      const container = textLayerRef.current;
      container.replaceChildren();
      container.style.setProperty('--total-scale-factor', String(viewport.scale));
      textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport,
      });
      await textLayer.render();
    })().catch((error) => console.error('Dark-mode page render failed:', error));

    return () => {
      cancelled = true;
      textLayer?.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <div
      className="dark-pdf-page relative mx-auto overflow-hidden shadow-xl"
      style={{ width: size.width, height: size.height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={textLayerRef} className="dark-pdf-text-layer textLayer" />
    </div>
  );
}

export default function DarkModePdfModal({ isOpen, onClose }: DarkModePdfModalProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const close = () => {
    void pdf?.destroy();
    setPdf(null);
    setError(null);
    onClose();
  };

  const openPdf = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    try {
      void pdf?.destroy();
      const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      setPdf(document);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolModal
      isOpen={isOpen}
      onClose={close}
      toolType="dark-mode"
      isProcessing={isProcessing}
      error={error}
      onFilesSelected={(files) => void openPdf(files)}
    >
      {pdf && (
        <div className="mt-5 max-h-[70vh] space-y-5 overflow-auto rounded-2xl bg-[#121212] p-4">
          {Array.from({ length: pdf.numPages }, (_, index) => (
            <DarkModePage key={index + 1} pdf={pdf} pageNumber={index + 1} />
          ))}
        </div>
      )}
    </ToolModal>
  );
}
