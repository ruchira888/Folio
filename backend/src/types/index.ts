export type UploadedFile={
  id:string
  originalName:string
  uploadedAt:Date
  path:string
  sizeMb:number
}
export type ApiResponse<T>={
  success:boolean
  data?:T
  error?:string
}

export type FabricAnnotation={
  type:'highlight'|'shape'|'freehand'|'strikethrough'|'underline'|'tick'
  fabricJSON:object
  page:number
}
export type SaveAnnotationsBody={
  fileId:string
  annotations:FabricAnnotation[]
}