import { logger } from "../logger";

const GEMINI_URL=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`

export const callGemini=async(prompt:string):Promise<string>=>{
  const res=await fetch(GEMINI_URL,{
    method:'POST',
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      contents:[{parts:[{text:prompt}]}], generationConfig: {
        maxOutputTokens: 1024, 
        temperature: 0.3 // lower = more factual, less creative
      }
    })

  })
  if(res.status==429)//too many req
  {
    throw new Error('RATE_LIMITED')
  }
  if(!res.ok){//equi to status btwn 200 n 300
     const err = await res.json()
    logger.error('Gemini error', err)
    throw new Error('Gemini API call failed')
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) throw new Error('Empty response from Gemini')
  return text
}