import OpenAI from 'openai';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js';
import { type AIProvider, type AnswerInput, ProviderError } from './types.js';

interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
}

/** OpenAI adapter, presented in the UI as "ChatGPT". */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model: string;

  private readonly client: OpenAI;
  private readonly maxOutputTokens: number;

  constructor(options: OpenAIProviderOptions, client?: OpenAI) {
    this.model = options.model;
    this.maxOutputTokens = options.maxOutputTokens;
    this.client =
      client ??
      new OpenAI({
        apiKey: options.apiKey,
        timeout: options.timeoutMs,
        maxRetries: 1,
      });
  }

  async answer(input: AnswerInput): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: this.maxOutputTokens,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
      });

      const choice = response.choices[0];

      if (choice?.finish_reason === 'content_filter') {
        throw new ProviderError('PROVIDER_REFUSED', 'ChatGPT declined to answer.');
      }

      const text = (choice?.message.content ?? '').trim();

      if (text.length === 0) {
        throw new ProviderError('EMPTY_ANSWER', 'ChatGPT returned an empty answer.');
      }

      return text;
    } catch (error) {
      throw ProviderError.fromUnknown('ChatGPT', error);
    }
  }
}
