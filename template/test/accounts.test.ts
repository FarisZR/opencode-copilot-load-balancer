import { describe, expect, it } from 'vitest';
import { CopilotAccountManager } from '../src/accounts/manager.ts';
import type { CopilotMultiConfig } from '../src/config/load.ts';

const config: CopilotMultiConfig = {
  accountsPath: 'memory',
  modelCacheTtlMs: 1000,
  strategy: 'hybrid',
  visibility: { toast: false, toastCooldownMs: 0, log: false, header: true },
  rateLimit: { defaultBackoffMs: 1000, maxBackoffMs: 10_000 },
};

const notifier = {
  accountSelected: async () => undefined,
};

describe('CopilotAccountManager', () => {
  it('selects eligible account for model', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'github.com',
      host: 'github.com',
      refresh: 'refresh',
      access: 'access',
      expires: 0,
      models: ['gpt-5-mini'],
    });

    const selection = manager.selectAccount('gpt-5-mini', 'github.com');
    expect(selection?.account.label).toBe('github.com');
  });

  it('skips accounts without model', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'github.com',
      host: 'github.com',
      refresh: 'refresh',
      access: 'access',
      expires: 0,
      models: ['gpt-5-mini'],
    });
    const selection = manager.selectAccount('claude-3', 'github.com');
    expect(selection).toBeNull();
  });
});
