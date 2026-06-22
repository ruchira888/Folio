import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createRouteHandler } from 'uploadthing/express'
import { ourFileRouter } from './uploadthing'
import {uploadRouter} from './routes/upload'
import {pdfRouter} from 'routes/pdf'
import {errorHandler} from './middleware/errorHandler'
import { UploadThingProvider } from './storage/UploadThingProvider'
import { FileReconciler } from './Reconciler/fileReconciler'
import { logger } from './logger'

dotenv.config()

export const storage=new UploadThingProvider()

const reconciler=new FileReconciler(storage)
reconciler.start()
const app=express()

const PORT=process.env.PORT||3001

app.use(cors())
app.use(express.json())

app.use('/api/uploadthing', createRouteHandler({ router: ourFileRouter }))

app.use('/api/upload',uploadRouter)

app.use('/api/pdf',pdfRouter)

app.use(errorHandler)

app.listen(PORT,()=>{
  console.log(`Backend runnin on port ${PORT}`)
})