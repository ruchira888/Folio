import { Translator } from "../Translator";

const TRANSLATE_PLUS_URL = "https://api.translateplus.io/v2/translate";
const MAX_TEXT_LENGTH = 5000;

function getApiKey(): string {
  const key = process.env.translate_api_key || process.env.TRANSLATE_API_KEY;
  if (!key || !key.trim()) {
    throw new Error("translate_api_key is not set in environment variables");
  }
  return key.trim();
}

function chunkByLine(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (!current) {
      if (line.length <= maxLength) {
        current = line;
      } else {
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
      }
      continue;
    }

    const candidate = `${current}\n${line}`;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    if (line.length <= maxLength) {
      current = line;
    } else {
      for (let i = 0; i < line.length; i += maxLength) {
        const slice = line.slice(i, i + maxLength);
        if (slice.length === maxLength) {
          chunks.push(slice);
        } else {
          current = slice;
        }
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(
  apiKey: string,
  text: string,
  targetLanguage: string,
): Promise<string> {
  const response = await fetch(TRANSLATE_PLUS_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      source: "auto",
      target: targetLanguage,
    }),
  });

  const payload: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      payload?.detail ||
      `TranslatePlus request failed with status ${response.status}`;
    throw new Error(detail);
  }

  const translated = payload?.translations?.translation;
  if (typeof translated !== "string") {
    throw new Error("TranslatePlus response missing translations.translation");
  }

  return translated;
}

export class TranslatePlusTranslator implements Translator {
  async translate(text: string, targetLanguage: string): Promise<string> {
    if (!text.trim()) return text;

    const apiKey = getApiKey();
    const chunks = chunkByLine(text, MAX_TEXT_LENGTH);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const translated = await translateChunk(apiKey, chunk, targetLanguage);
      translatedChunks.push(translated);
    }

    return translatedChunks.join("\n");
  }
}
