import { describe, expect, it } from 'vitest';
import { ModelAvailabilityCache } from '../src/models/availability.ts';
import type { CopilotMultiConfig } from '../src/config/load.ts';
import type { CopilotAccount } from '../src/accounts/types.ts';

const config: CopilotMultiConfig = {
  accountsPath: 'memory',
  modelCacheTtlMs: 50,
  strategy: 'hybrid',
  visibility: { toast: false, toastCooldownMs: 0, log: false, header: true },
  rateLimit: { defaultBackoffMs: 1000, maxBackoffMs: 10_000 },
};

const account: CopilotAccount = {
  id: 'acc',
  label: 'github.com',
  host: 'github.com',
  refresh: 'refresh',
  access: 'access',
  expires: 0,
  enabled: true,
};

describe('ModelAvailabilityCache', () => {
  it('expires cached models', async () => {
    const cache = new ModelAvailabilityCache(config);
    cache.set(account, ['gpt-5-mini']);
    expect(cache.get(account)).toEqual(['gpt-5-mini']);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(cache.get(account)).toBeNull();
  });
});
