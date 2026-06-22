import express from 'express'
import rateLimit from 'express-rate-limit'
import {storage} from '../index'
import { ApiResponse, FileRecord} from '../types'
import { logger } from '../logger'

export const uploadRouter=express.Router()

  //rate limi
  const uploadRateLimit=rateLimit({
    windowMs:24*60*60*1000,
    max:7,
    message:{
      success:false,
      error:'Daily upload limit reached.Upgrade to Pro for unlimited uploads'
    },

  })
// called by da fronten AFTER UploadThing completes the uploa
// frontend sends us the file key n url from onUploadComplete
uploadRouter.post('/complete',uploadRateLimit,async(req,res,next)=>{
  const {fileKey,url,originalName,sizeMb,}=req.body
try{
  if(!fileKey||!url){
    return res.status(400).json({
      success:false,
      error:'Missing fileKey or url'
    }
    )

  }
  const now=new Date()

  const record:FileRecord={
    id:fileKey,
     originalName,
    url,
    uploadedAt:now,
    expiresAt:new Date(now.getTime()+Number(process.env.FILE_LIFETIME_MINUTES || 30)*60*1000),
    sizeMb
  }
  storage.saveRecord(record)
  logger.info(`Registered file:${fileKey}`)
  res.json({success:true,data:record} as ApiResponse<FileRecord>)
} catch(err){
  next(err)
}
})

//file metdata
uploadRouter.get('/:id',(req,res)=>{
  const record=storage.getRecord(req.params.id)
  if(!record){
    res.status(404).json({success:false,error:'File not found or expired'})
    return
  }
  res.json({success:true,data:record})
})