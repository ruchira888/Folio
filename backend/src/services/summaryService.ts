import { logger } from "../logger";
import { callGemini } from "./geminiService";

const PAGES_PER_CHUNK=Number(process.env.PAGES_PER_CHUNK || 3)

/**
 * Split text into chunks based on approximate page count
 * Each chunk represents ~PAGES_PER_CHUNK pages
 */
const splitIntoChunks = (text: string, totalPages: number): string[] => {
  const numChunks = Math.ceil(totalPages / PAGES_PER_CHUNK)
  if (numChunks <= 1) {
    return [text]
  }

  const chunkSize = Math.ceil(text.length / numChunks)
  const chunks: string[] = []

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, text.length)
    
    // Avoid cutting off in middle of word - find next space
    let actualEnd = end
    if (end < text.length) {
      const nextSpace = text.indexOf(' ', end)
      if (nextSpace !== -1 && nextSpace - end < 100) {
        actualEnd = nextSpace
      }
    }

    chunks.push(text.substring(start, actualEnd).trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}

export const summarizePdf=async(
  text:string,
  totalPages:number
):Promise<string>=>{
  logger.info(`summarizePdf called: totalPages=${totalPages}, textLength=${text.length}`)

//small pdf
  if(totalPages<=10){
      logger.info(`Small PDF (${totalPages} pages) — single call strategy`)

      const prompt=`Summarize the following PDF content into a clean, structured brief. Use clear headings and bullet points. Be concise but cover all key points.

Content:
${text}`

      logger.info(`Sending prompt to Groq (${text.length} chars)`)
      const result = await callGemini(prompt)
      logger.info(`Received summary from Groq (${result.length} chars)`)
      return result
  }

  logger.info(`Large PDF (${totalPages} pages) — chunking strategy`)
  const chunks=splitIntoChunks(text,totalPages)
  logger.info(`Split into ${chunks.length} chunks`)
  
  const chunkSummaries:string[]=[]

  for(let i=0;i<chunks.length;i++){
    const chunkText = chunks[i]
    logger.info(`Processing chunk ${i + 1}/${chunks.length} (${chunkText.length} chars)`)
    
    const prompt=`Summarize this section (chunk ${i + 1} of ${chunks.length}). Keep it concise with bullet points.

Content:
${chunkText}`
    
    try {
      const summary=await callGemini(prompt)
      if (!summary || summary.trim().length === 0) {
        logger.error(`Chunk ${i + 1} returned empty summary!`)
        throw new Error(`Chunk ${i + 1} summary is empty`)
      }
      logger.info(`Chunk ${i + 1} summary received (${summary.length} chars)`)
      chunkSummaries.push(summary)
    } catch (err) {
      logger.error(`Error processing chunk ${i + 1}:`, err)
      throw err
    }
  }

  if (chunkSummaries.length === 0) {
    throw new Error('No chunk summaries generated')
  }

  logger.info(`All chunks processed. Creating final summary from ${chunkSummaries.length} chunks`)
  
  const finalPrompt=`Combine these ${chunkSummaries.length} chunk summaries into one final, comprehensive summary. Merge similar points, avoid duplication, and create a coherent brief with clear sections.

${chunkSummaries.map((s, i) => `CHUNK ${i + 1}:\n${s}`).join('\n\n---\n\n')}`

  logger.info(`Final prompt length: ${finalPrompt.length} chars`)
  const finalSummary=await callGemini(finalPrompt)
  logger.info(`Final summary received (${finalSummary.length} chars)`)

  return finalSummary
}