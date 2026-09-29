import { GoogleGenAI } from '@google/genai';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js';
import { type AIProvider, type AnswerInput, ProviderError } from './types.js';

interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
}

/** Google Gemini adapter. */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly model: string;

  private readonly client: GoogleGenAI;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;

  constructor(options: GeminiProviderOptions, client?: GoogleGenAI) {
    this.model = options.model;
    this.maxOutputTokens = options.maxOutputTokens;
    this.timeoutMs = options.timeoutMs;
    this.client = client ?? new GoogleGenAI({ apiKey: options.apiKey });
  }

  async answer(input: AnswerInput): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildUserPrompt(input),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: this.maxOutputTokens,
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });

      const text = (response.text ?? '').trim();

      if (text.length === 0) {
        throw new ProviderError('EMPTY_ANSWER', 'Gemini returned an empty answer.');
      }

      return text;
    } catch (error) {
      throw ProviderError.fromUnknown('Gemini', error);
    }
  }
}
