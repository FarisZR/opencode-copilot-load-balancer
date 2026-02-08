import { describe, expect, it } from 'vitest';
import { createCopilotFetch } from '../src/fetch/copilot-fetch.ts';
import type { CopilotMultiConfig } from '../src/config/load.ts';
import { CopilotAccountManager } from '../src/accounts/manager.ts';

const config: CopilotMultiConfig = {
  accountsPath: 'memory',
  modelCacheTtlMs: 1000,
  strategy: 'sticky',
  visibility: { toast: false, toastCooldownMs: 0, log: false, header: true },
  rateLimit: { defaultBackoffMs: 1000, maxBackoffMs: 10_000 },
};

const notifier = {
  accountSelected: async () => undefined,
};

describe('createCopilotFetch', () => {
  it('throws when no eligible account', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    const fetcher = createCopilotFetch({ config, manager, notifier });
    await expect(fetcher('https://copilot-api.github.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-5-mini', messages: [{ role: 'user', content: 'hi' }] }),
    })).rejects.toThrow('No eligible Copilot accounts');
  });
});
