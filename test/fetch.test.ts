import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no eligible account', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    const fetcher = createCopilotFetch({ config, manager, notifier });
    await expect(fetcher('https://copilot-api.github.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-5-mini', messages: [{ role: 'user', content: 'hi' }] }),
    })).rejects.toThrow('No eligible Copilot accounts');
  });

  it('supports requests without a parsed model id for web flows', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'github.com',
      host: 'github.com',
      refresh: 'refresh',
      access: 'access',
      expires: 0,
      models: ['gpt-5-mini'],
    });

    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);

    const fetcher = createCopilotFetch({ config, manager, notifier });
    const result = await fetcher('https://copilot-api.github.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
