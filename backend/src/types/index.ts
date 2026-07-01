export type FileRecord={
   id: string           // UploadThing file key
  originalName: string
  url: string          // UploadThing public URL
  uploadedAt: Date
  expiresAt: Date
  
  sizeMb: number
}
export type ApiResponse<T>={
  success:boolean
  data?:T
  error?:string
}

export type FabricAnnotation={
  type:'highlight'|'shape'|'freehand'|'strikethrough'|'underline'|'tick'
  fabricJSON:Record<string,unknown>
  page:number
}
export type AnnotateRequestBody={
  fileId:string
  annotations:FabricAnnotation[]
}
export type SummarizeRequestBody={
  fileId: string

}

export type DeletePagesRequestBody = {
  fileId: string
  pagesToDelete: number[]
}

export type ProtectPdfRequestBody = {
  fileId: string
  password: string
}

export type MarkdownExportRequestBody = {
  fileId: string
}

export type DarkModeRequestBody = {
  fileId: string
}

export type DarkModeResult = {
  fileUrl: string
  fileKey: string
}

export type MarkdownExportResult = {
  fileUrl: string
  fileKey: string
}

export type ThumbnailsRequestBody = {
  fileId: string
}

export type ThumbnailData = {
  pageNumber: number
  thumbnailUrl: string
}

export type ThumbnailsResponse = {
  pages: ThumbnailData[]
}
