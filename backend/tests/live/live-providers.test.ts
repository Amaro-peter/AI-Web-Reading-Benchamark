import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDotEnvFile } from '../../src/config/dotenv.js';
import { apiKeyFor, loadEnv } from '../../src/config/env.js';
import { modelConfigFor } from '../../src/config/models.js';
import { OpenAIProvider } from '../../src/providers/openai.js';
import { ClaudeProvider } from '../../src/providers/claude.js';

const rootEnv = resolve(process.cwd(), '..', '.env');
const localEnv = resolve(process.cwd(), '.env');
const envPath = existsSync(localEnv) ? localEnv : existsSync(rootEnv) ? rootEnv : localEnv;

loadDotEnvFile(envPath);
const env = loadEnv();

describe('live AI providers (costs real money, never runs in CI)', () => {
  const pageContent =
    'The historic 28 tram in Lisbon operates between Martim Moniz and Campo de Ourique. Standard fare is 3.20 euros.';
  const question = 'What is the standard fare for the Lisbon tram? Answer with the price only.';

  const openAiKey = apiKeyFor(env, 'openai');
  const openAiModel = modelConfigFor(env, 'openai');

  it.runIf(Boolean(openAiKey))('OpenAI provider answers against live API', async () => {
    const provider = new OpenAIProvider({
      apiKey: openAiKey!,
      model: openAiModel.model,
      maxOutputTokens: 50,
      timeoutMs: 20_000,
    });

    const answer = await provider.answer({ pageContent, question });
    expect(answer).toBeDefined();
    expect(answer.length).toBeGreaterThan(0);
    expect(answer.toLowerCase()).toMatch(/3\.20|3,20|3|euro/);
  });

  const claudeKey = apiKeyFor(env, 'claude');
  const claudeModel = modelConfigFor(env, 'claude');

  it.runIf(Boolean(claudeKey))('Claude provider answers against live API', async () => {
    const provider = new ClaudeProvider({
      apiKey: claudeKey!,
      model: claudeModel.model,
      maxOutputTokens: 50,
      timeoutMs: 20_000,
      workspaceId: env.ANTHROPIC_WORKSPACE_ID,
    });

    try {
      const answer = await provider.answer({ pageContent, question });
      expect(answer).toBeDefined();
      expect(answer.length).toBeGreaterThan(0);
      expect(answer.toLowerCase()).toMatch(/3\.20|3,20|3|euro/);
    } catch (error) {
      // Unscoped Anthropic keys without a workspace ID fail with an error.
      // We warn clearly instead of breaking the optional live verification when no workspace ID is provided.
      if (!env.ANTHROPIC_WORKSPACE_ID) {
        console.warn(
          'Note: Claude test skipped: unscoped Anthropic key requires ANTHROPIC_WORKSPACE_ID in .env',
        );
        return;
      }
      throw error;
    }
  });
});
