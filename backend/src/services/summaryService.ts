import { logger } from "../logger";
import { callGemini } from "./geminiService";

const PAGES_PER_CHUNK=Number(process.env.PAGES_PER_CHUNK || 3)

export const summarizePdf=async(
  text:string,
  totalPages:number
):Promise<string>=>{
//small pdf
  if(totalPages<=10){
      logger.info(`Small PDF (${totalPages} pages) — single call strategy`)

      const prompt=`Summarize the following PDF content into a clean, structured brief.Use clear headings and bullet points. Be concise but cover all key points.
      Content:
${text}`

    return await callGemini(prompt)
  }
const chunks=splitIntoChunks(text,totalPages)
const chunkSummaries:string[]=[]

  for(let i=0;i<chunks.length;i++){
    const prompt=`Summarize this section.
    Content:${chunks[i]}`
    const summary=await callGemini(prompt)
    chunkSummaries.push(summary)
    

  }
  const finalPrompt=`Combine these summaries into final summary
  
  ${chunkSummaries.join('\n\n')}`

  const finalSummary=await callGemini(finalPrompt)

  return finalSummary
}