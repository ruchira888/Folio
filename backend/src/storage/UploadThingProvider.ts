import  {UTApi} from 'uploadthing/server'
import  {StorageProvider} from './StorageProvider'
import { FileRecord } from '../types'
import { logger } from '../logger'
import { response } from 'express'

//in-mem sto asof now late will repl w db
const fileStore=new Map<string,FileRecord>()

export class UploadThingProvider extends StorageProvider{
  private utapi:UTApi

  constructor(){
    super()
    this.utapi=new UTApi()
  }
  getRecord(fileId: string): FileRecord | undefined {
    return fileStore.get(fileId)
  }
  saveRecord(record: FileRecord): void {
     fileStore.set(record.id, record)
  }
  async getBuffer(fileId: string): Promise<Buffer> {//get file id download pdf then return bytes so to perff furt op
    const record=fileStore.get(fileId)
    if(!record) throw new Error('File not found or expired')
    const response=await fetch(record.url)
    if(!response.ok) throw new Error
    const arrayBuffer = await response.arrayBuffer()
    logger
    .info(`Fetched buffer for file:${fileId}`)
    return Buffer.from(arrayBuffer)
  }
  async delete(fileId: string): Promise<void> {
    await this.utapi.deleteFiles(fileId)
    fileStore.delete(fileId)
    logger.info(`Deleted File: ${fileId}`)
  }
  async listExpired(before: Date): Promise<FileRecord[]> {
    const expired:FileRecord[]=[]
    for(const record of fileStore.values()){
      if(record.expiresAt<before) expired.push(record)
    }
  return expired
  }
}