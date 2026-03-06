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
  accountSelected: vi.fn(async () => undefined),
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function createRequest(modelId: string) {
  return {
    method: 'POST',
    headers: {
      'x-initiator': 'agent',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  };
}

function getAuthorizationHeader(init: unknown) {
  const headers = (init as RequestInit | undefined)?.headers;
  return new Headers(headers).get('authorization');
}

describe('createCopilotFetch', () => {
  it('throws when no eligible account', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    const fetcher = createCopilotFetch({ config, manager, notifier });
    await expect(
      fetcher('https://copilot-api.github.com/v1/chat/completions', createRequest('gpt-5-mini'))
    ).rejects.toThrow('No eligible Copilot accounts');
  });

  it('retries once on model-unavailable responses and sticks to the supporting account', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'work',
      host: 'github.com',
      refresh: 'work-refresh',
      access: 'work-access',
      expires: 0,
    });
    await manager.addAccount({
      label: 'personal',
      host: 'github.com',
      refresh: 'personal-refresh',
      access: 'personal-access',
      expires: 0,
      models: ['gpt-5.4'],
    });

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('Model gpt-5.4 is not supported on this account', { status: 404 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const fetcher = createCopilotFetch({ config, manager, notifier });
    const request = createRequest('gpt-5.4');

    const firstResponse = await fetcher(
      'https://copilot-api.github.com/v1/chat/completions',
      request
    );
    expect(firstResponse.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    expect(getAuthorizationHeader(fetchSpy.mock.calls[0]?.[1])).toBe('Bearer work-access');
    expect(getAuthorizationHeader(fetchSpy.mock.calls[1]?.[1])).toBe('Bearer personal-access');

    expect(notifier.accountSelected).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'personal' }),
      'gpt-5.4',
      'fallback',
      'Copilot: sticking to personal for gpt-5.4; work does not support that model'
    );

    const secondResponse = await fetcher(
      'https://copilot-api.github.com/v1/chat/completions',
      request
    );
    expect(secondResponse.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    expect(getAuthorizationHeader(fetchSpy.mock.calls[2]?.[1])).toBe('Bearer personal-access');
  });

  it('does not retry on unrelated 404 responses', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'work',
      host: 'github.com',
      refresh: 'work-refresh',
      access: 'work-access',
      expires: 0,
    });
    await manager.addAccount({
      label: 'personal',
      host: 'github.com',
      refresh: 'personal-refresh',
      access: 'personal-access',
      expires: 0,
    });

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('Route not found', { status: 404 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const fetcher = createCopilotFetch({ config, manager, notifier });
    const response = await fetcher(
      'https://copilot-api.github.com/v1/chat/completions',
      createRequest('gpt-5.4')
    );

    expect(response.status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
