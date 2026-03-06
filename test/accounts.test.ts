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

  it('remembers unsupported models for unknown accounts without blocking other models', async () => {
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

    const work = manager.listAccounts().find((account) => account.label === 'work');
    expect(work).toBeDefined();

    await manager.markModelUnsupported(work!.id, 'gpt-5.4');

    expect(manager.isAccountEligible(work!, 'gpt-5.4', 'github.com')).toBe(false);
    expect(manager.isAccountEligible(work!, 'gpt-4.1', 'github.com')).toBe(true);
    expect(manager.selectAccount('gpt-5.4', 'github.com')?.account.label).toBe('personal');
  });

  it('keeps persisted model lists unchanged when marking a model unsupported', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'personal',
      host: 'github.com',
      refresh: 'personal-refresh',
      access: 'personal-access',
      expires: 0,
      models: ['gpt-5.4'],
    });

    const personal = manager.listAccounts()[0];
    expect(personal?.models).toEqual(['gpt-5.4']);

    await manager.markModelUnsupported(personal!.id, 'gpt-5.4');

    expect(manager.listAccounts()[0]?.models).toEqual(['gpt-5.4']);
    expect(manager.isAccountEligible(personal!, 'gpt-5.4', 'github.com')).toBe(false);
  });

  it('treats an explicit empty model list as supports nothing', async () => {
    const manager = await CopilotAccountManager.load(config, notifier);
    await manager.addAccount({
      label: 'empty',
      host: 'github.com',
      refresh: 'empty-refresh',
      access: 'empty-access',
      expires: 0,
      models: [],
    });

    const empty = manager.listAccounts()[0];
    expect(manager.isAccountEligible(empty!, 'gpt-5.4', 'github.com')).toBe(false);
    expect(manager.selectAccount('gpt-5.4', 'github.com')).toBeNull();
  });
});
