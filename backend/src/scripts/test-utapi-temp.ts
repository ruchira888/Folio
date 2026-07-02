import { UTApi } from 'uploadthing/server'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function run() {
  console.log('UPLOADTHING_TOKEN defined:', !!process.env.UPLOADTHING_TOKEN)
  const utapi = new UTApi()
  
  // Create a dummy file buffer
  const buffer = Buffer.from('hello world from folio test script')
  const file = new File([buffer as any], 'test-temp.txt', { type: 'text/plain' })
  
  try {
    console.log('Uploading test file...')
    const uploaded = await utapi.uploadFiles(file)
    console.log('Upload result:', JSON.stringify(uploaded, null, 2))
    
    if (uploaded.error) {
      console.error('Upload failed:', uploaded.error)
      return
    }
    
    const key = uploaded.data.key
    console.log(`Uploaded file key: ${key}`)
    
    console.log('Deleting test file...')
    const deleted = await utapi.deleteFiles(key)
    console.log('Delete result:', JSON.stringify(deleted, null, 2))
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

run()
