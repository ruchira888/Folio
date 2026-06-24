import { logger } from "../logger";

export const callGemini=async(prompt:string):Promise<string>=>{
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set in environment')
  }

  // Using Groq API (OpenAI-compatible)
  const url = `https://api.groq.com/openai/v1/chat/completions`
  
  const res=await fetch(url,{
    method:'POST',
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body:JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1024
    })
  })

  if(res.status==429)//too many req
  {
    throw new Error('RATE_LIMITED')
  }
  if(!res.ok){
    let errorDetails = 'Unknown error'
    try {
      const err = await res.json()
      errorDetails = JSON.stringify(err)
      logger.error(`Groq API error (${res.status}):`, err)
    } catch (e) {
      const text = await res.text()
      errorDetails = text
      logger.error(`Groq API error (${res.status}):`, text)
    }
    throw new Error(`Groq API failed: ${errorDetails}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content

  if (!text) {
    logger.error(`Groq returned empty content. Response:`, JSON.stringify(data))
    throw new Error('Empty response from Groq: ' + JSON.stringify(data))
  }
  
  logger.info(`Groq response received: ${text.substring(0, 100)}...`)
  return text
}