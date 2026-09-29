import Anthropic from '@anthropic-ai/sdk';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.js';
import { type AIProvider, type AnswerInput, ProviderError } from './types.js';

interface ClaudeProviderOptions {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
}

/**
 * Anthropic adapter.
 *
 * Note on server-side refusal fallbacks: they are deliberately NOT enabled.
 * A fallback would silently answer with a different model, and this service
 * attributes every answer to a named model — a rescued answer would make the
 * comparison wrong. A refusal is reported as a provider failure instead.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  readonly model: string;

  private readonly client: Anthropic;
  private readonly maxOutputTokens: number;

  constructor(options: ClaudeProviderOptions, client?: Anthropic) {
    this.model = options.model;
    this.maxOutputTokens = options.maxOutputTokens;
    this.client =
      client ??
      new Anthropic({
        apiKey: options.apiKey,
        timeout: options.timeoutMs,
        maxRetries: 1,
      });
  }

  async answer(input: AnswerInput): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxOutputTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
        // Short factual answers: the lowest effort level is the right spend.
        output_config: { effort: 'low' },
      });

      if (response.stop_reason === 'refusal') {
        throw new ProviderError('PROVIDER_REFUSED', 'Claude declined to answer.');
      }

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      if (text.length === 0) {
        throw new ProviderError('EMPTY_ANSWER', 'Claude returned an empty answer.');
      }

      return text;
    } catch (error) {
      throw ProviderError.fromUnknown('Claude', error);
    }
  }
}
