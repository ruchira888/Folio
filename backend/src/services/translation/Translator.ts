export interface Translator {
  translate(text: string, targetLanguage: string): Promise<string>;
}
