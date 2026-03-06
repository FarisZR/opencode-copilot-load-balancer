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

  it('avoids accounts where model was marked unsupported', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'a',
      host: 'github.com',
      refresh: 'refresh-a',
      access: 'access-a',
      expires: 0,
    });
    await manager.addAccount({
      label: 'b',
      host: 'github.com',
      refresh: 'refresh-b',
      access: 'access-b',
      expires: 0,
    });

    const first = manager.selectAccount('gpt-5-mini', 'github.com');
    expect(first).not.toBeNull();

    await manager.markModelUnsupported(first!.account.id, 'gpt-5-mini');

    const second = manager.selectAccount('gpt-5-mini', 'github.com');
    expect(second).not.toBeNull();
    expect(second!.account.id).not.toBe(first!.account.id);
  });

  it('treats empty explicit model list as no supported models', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'github.com',
      host: 'github.com',
      refresh: 'refresh',
      access: 'access',
      expires: 0,
      models: ['gpt-5-mini'],
    });

    const account = manager.listAccounts().find((item) => item.label === 'github.com');
    expect(account).toBeDefined();
    await manager.markModelUnsupported(account!.id, 'gpt-5-mini');

    const selection = manager.selectAccount('gpt-5-mini', 'github.com');
    expect(selection).toBeNull();
  });
});
