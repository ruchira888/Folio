import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import {v4 as uuidv4} from 'uuid'
import rateLimit from 'express-rate-limit'
import { ApiResponse,UploadedFile } from '../types'


export const uploadRouter=express.Router()
//Create the path to the uploads folder relative to the current file.
 const UPLOADS_DIR=path.join(__dirname,'../../uploads')
 
 if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR,{recursive:true})

  //rate limi
  const uploadRateLimit=rateLimit({
    windowMs:24*60*60*1000,
    max:7,
    message:{
      success:false,
      error:'Daily upload limit reached.Upgrade to Pro for unlimited uploads'
    },
    standardHeaders:true,
    legacyHeaders:false//dont send older X-RateLimit header

  })
const storage=multer.diskStorage//disksto used to config storage
({
  destination:UPLOADS_DIR,
  filename:(req,file,cb)=>{
    const id=uuidv4()
    cb(null,`${id}.pdf`)//expec 2 arg error,result
  }
})
const upload=multer({
  storage,
  limits:{fileSize:Number(process.env.MAX_FILE_SIZE_MB || 50)*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(file.mimetype !== 'application/pdf'){
      cb(new Error('Only PDF files are allowed'))
      return
    }
    cb(null,true)
  }
})

//post route rate limi
uploadRouter.post('/',uploadRateLimit,upload.single('pdf'),(req,res)=>{
  if(!req.file){
    res.status(400).json({success:false,error:'No file uploaded'})
    return
  }
  const fileId=path.basename(req.file.filename,'.pdf')

  const response:ApiResponse<UploadedFile>={
    success:true,
    data:{
      id:fileId,
      originalName:req.file.originalname,
      path:req.file.path,
      uploadedAt:new Date(),
      sizeMb:req.file.size/(1024*1024),

    }
  }
  res.json(response)
})
uploadRouter.get('/:id', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, `${req.params.id}.pdf`)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found or expired' })
    return
  }
  res.sendFile(filePath)
})