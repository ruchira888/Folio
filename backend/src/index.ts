import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import {uploadRouter} from './routes/upload'
import {pdfRouter} from 'routes/pdf'
import {errorHandler} from './middleware/errorHandler'

dotenv.config()

const app=express()

const PORT=process.env.PORT||3001

app.use(express.json())

app.use('/api/upload',uploadRouter)

app.use('/api/pdf',pdfRouter)

app.use(errorHandler)

app.listen(PORT,()=>{
  console.log(`Backend runnin on port ${PORT}`)
})