export type FileRecord = {
  id: string; // UploadThing file key
  originalName: string;
  url: string; // UploadThing public URL
  uploadedAt: Date;
  expiresAt: Date;

  sizeMb: number;
};
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type FabricAnnotation = {
  type:
    "highlight" | "shape" | "freehand" | "strikethrough" | "underline" | "tick";
  fabricJSON: Record<string, unknown>;
  page: number;
};
export type AnnotateRequestBody = {
  fileId: string;
  annotations: FabricAnnotation[];
};
export type SummarizeRequestBody = {
  fileId: string;
};

export type DeletePagesRequestBody = {
  fileId: string;
  pagesToDelete: number[];
};

export type ProtectPdfRequestBody = {
  fileId: string;
  password: string;
};

export type MarkdownExportRequestBody = {
  fileId: string;
};

export type DarkModeRequestBody = {
  fileId: string;
};

export type DarkModeResult = {
  fileUrl: string;
  fileKey: string;
};

export type MarkdownExportResult = {
  fileUrl: string;
  fileKey: string;
};

export type ThumbnailsRequestBody = {
  fileId: string;
};

export type ThumbnailData = {
  pageNumber: number;
  thumbnailUrl: string;
};

export type ThumbnailsResponse = {
  pages: ThumbnailData[];
};

export type WatermarkPdfRequestBody = {
  fileId: string;
  text: string;
  color: string;
  transparency: number;
  fontSize: number;
  position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center"
    | "diagonal";
};

export type WatermarkPdfResult = {
  fileUrl: string;
  fileKey: string;
};

export type PageNumbersRequestBody = {
  fileId: string;
};

export type PageNumbersResult = {
  fileUrl: string;
  fileKey: string;
};

export type TranslatePdfRequestBody = {
  fileId: string;
  targetLanguage: string;
};

export type TranslatePdfResult = {
  fileUrl: string;
  fileKey: string;
};

export type MergePdfRequestBody = {
  fileIds: string[];
};

export type MergePdfResult = {
  fileUrl: string;
  fileKey: string;
};
