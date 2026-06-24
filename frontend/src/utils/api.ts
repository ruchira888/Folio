const BASE_URL=import.meta.env.VITE_API_BASE_URL

export async function uploadComplete(fileKey:string
  ,url:string,originalName:string,sizeMb:number){
    const response=await fetch(
      `${BASE_URL}/upload/complete`,{
        method:'POST',
      
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        fileKey,
  url,originalName,sizeMb
      
      })
    }
  )
  if(!response.ok){
    throw new Error('Upload registration failed')
  }
  return response.json()
}
export async function getFileMetadata(fileId:string){
  const metadata=await fetch(`${BASE_URL}/upload/${fileId}`,{
   
    method:'GET'
  }
  )

  if(!metadata.ok){
    throw new Error('fetchin  metadata failed')
  }
  return metadata.json()
}
export async function summarize(fileId:string) {
  const summarize=await fetch(`${BASE_URL}/pdf/${fileId}/summarize`,
    
    {
      method:'POST'
    })
   if(!summarize.ok){
    throw new Error('PDF summarization failed')
  }
  return summarize.json()
}