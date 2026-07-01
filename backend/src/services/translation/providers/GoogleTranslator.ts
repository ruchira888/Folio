import { translate } from '@vitalets/google-translate-api';
import { Translator } from '../Translator';

export class GoogleTranslator implements Translator {
  async translate(text: string, targetLanguage: string): Promise<string> {
    const result = await translate(text, { to: targetLanguage });
    return result.text;
  }
}
