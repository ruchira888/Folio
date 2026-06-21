import { FileRecord } from '../types';

export {FileRecord} from '../types'

export abstract class StorageProvider{
  abstract getBuffer(fileId:string): Promise<Buffer>
   abstract delete(fileId:string): Promise<void>
    abstract listExpired(before:Date): Promise<FileRecord[]>
    abstract getRecord(fileId:string): FileRecord|undefined
     abstract saveRecord(record:FileRecord): void
  
  
  
  
}