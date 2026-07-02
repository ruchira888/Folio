import type { PDFPageProxy } from 'pdfjs-dist';

type TextFragment = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

type TextLine = {
  fragments: TextFragment[];
  text: string;
  x: number;
  y: number;
  fontSize: number;
};

export type ExtractedTextBlock = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  pdfBaselineY: number;
};

function clampSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function groupFragmentsIntoLines(fragments: TextFragment[]): TextLine[] {
  const ordered = [...fragments].sort((left, right) => {
    const yDelta = right.y - left.y;
    if (Math.abs(yDelta) > 1) return yDelta;
    return left.x - right.x;
  });

  const groups: TextFragment[][] = [];
  let currentGroup: TextFragment[] = [];
  let currentY: number | null = null;

  for (const fragment of ordered) {
    if (currentGroup.length === 0) {
      currentGroup = [fragment];
      currentY = fragment.y;
      continue;
    }

    const threshold = Math.max(2, fragment.fontSize * 0.35);
    if (currentY !== null && Math.abs(fragment.y - currentY) <= threshold) {
      currentGroup.push(fragment);
      currentY = (currentY * (currentGroup.length - 1) + fragment.y) / currentGroup.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [fragment];
      currentY = fragment.y;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups.map((group) => {
    const sorted = [...group].sort((left, right) => left.x - right.x);
    const text = clampSpace(sorted.map((fragment) => fragment.text).join(' '));
    const fontSize = Math.max(...sorted.map((fragment) => fragment.fontSize), 0);
    return {
      fragments: sorted,
      text,
      x: Math.min(...sorted.map((fragment) => fragment.x)),
      y: sorted[0]?.y ?? 0,
      fontSize,
    };
  });
}

async function extractPageLines(page: PDFPageProxy): Promise<TextLine[]> {
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableCombineTextItems: false,
  } as Parameters<PDFPageProxy['getTextContent']>[0]);

  const fragments: TextFragment[] = [];

  for (const item of textContent.items ?? []) {
    const textItem = item as {
      str?: string;
      transform?: number[];
      width?: number;
    };
    if (!textItem?.str || typeof textItem.str !== 'string') continue;

    const transform = Array.isArray(textItem.transform)
      ? textItem.transform
      : [1, 0, 0, 1, 0, 0];
    const fontSize = Math.max(
      4,
      Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0),
    );
    fragments.push({
      text: textItem.str,
      x: Number(transform[4]) || 0,
      y: Number(transform[5]) || 0,
      width: Number(textItem.width) || 0,
      fontSize,
    });
  }

  return groupFragmentsIntoLines(fragments);
}

/**
 * Extract editable text blocks from every page of a PDF.
 * Coordinates use PDF points with origin at top-left (matching the annotate editor).
 */
export async function extractPdfTextBlocks(
  getPage: (pageNumber: number) => Promise<PDFPageProxy>,
  numPages: number,
): Promise<ExtractedTextBlock[]> {
  const blocks: ExtractedTextBlock[] = [];

  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    const page = await getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const lines = await extractPageLines(page);

    for (const line of lines) {
      if (!line.text.trim()) continue;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const fragment of line.fragments) {
        const [vx, vyBaseline] = viewport.convertToViewportPoint(fragment.x, fragment.y);
        const top = vyBaseline - fragment.fontSize * 0.85;
        const bottom = vyBaseline + fragment.fontSize * 0.25;
        minX = Math.min(minX, vx);
        maxX = Math.max(maxX, vx + fragment.width);
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);
      }

      blocks.push({
        pageIndex,
        x: minX - 1,
        y: Math.max(0, minY),
        width: maxX - minX + 4,
        height: Math.max(maxY - minY, line.fontSize * 1.1),
        text: line.text,
        fontSize: line.fontSize,
        pdfBaselineY: line.y,
      });
    }
  }

  return blocks;
}
