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
  geminiKey: string  // user's own key
}