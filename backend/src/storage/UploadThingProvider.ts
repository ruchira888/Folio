import  {UTApi} from 'uploadthing/server'
import  {StorageProvider} from './StorageProvider'
import { FileRecord } from '../types'
import { logger } from '../logger'
import fs from 'fs'
import path from 'path'

const STORE_FILE = path.resolve(__dirname, '../../filestore.json')

function loadStore(): Map<string, FileRecord> {
  const map = new Map<string, FileRecord>()
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8')
      const data = JSON.parse(raw)
      for (const [key, val] of Object.entries(data)) {
        const record = val as any
        if (record.uploadedAt) record.uploadedAt = new Date(record.uploadedAt)
        if (record.expiresAt) record.expiresAt = new Date(record.expiresAt)
        map.set(key, record as FileRecord)
      }
    }
  } catch (err) {
    logger.error('Failed to load filestore.json', err)
  }
  return map
}

function saveStore(map: Map<string, FileRecord>): void {
  try {
    const obj: Record<string, FileRecord> = {}
    for (const [key, val] of map.entries()) {
      obj[key] = val
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2), 'utf8')
  } catch (err) {
    logger.error('Failed to save filestore.json', err)
  }
}

const fileStore = loadStore()

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
     saveStore(fileStore)
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
    saveStore(fileStore)
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