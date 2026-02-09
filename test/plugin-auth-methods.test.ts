import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/load.ts', () => ({
  loadConfig: async () => ({
    accountsPath: 'memory',
    modelCacheTtlMs: 1000,
    strategy: 'hybrid',
    visibility: { toast: false, toastCooldownMs: 0, log: false, header: true },
    rateLimit: { defaultBackoffMs: 1000, maxBackoffMs: 10_000 },
  }),
}));

const managerStub = {
  seedFromAuth: async () => undefined,
  getActiveAuth: async () => null,
  listAccounts: () => [],
  removeAccount: async () => undefined,
  disableAccount: async () => undefined,
  enableAccount: async () => undefined,
  updateAccountTokens: async () => undefined,
  addAccount: async () => undefined,
};

vi.mock('../src/accounts/manager.ts', () => ({
  CopilotAccountManager: {
    load: async () => managerStub,
  },
}));

vi.mock('../src/auth/opencode-auth.ts', () => ({
  ensureProviderAuth: async () => undefined,
}));

vi.mock('../src/observe/usage.ts', () => ({
  createUsageNotifier: () => ({
    accountSelected: async () => undefined,
  }),
}));

import { CopilotMultiAccountPlugin } from '../src/plugin.ts';

describe('CopilotMultiAccountPlugin auth methods', () => {
  it('registers manage accounts as a third GitHub Copilot method', async () => {
    const hooks = await CopilotMultiAccountPlugin({
      client: {} as never,
      project: {} as never,
      directory: process.cwd(),
      worktree: process.cwd(),
      $: {} as never,
    });

    const labels = hooks.auth?.methods.map((method) => method.label) ?? [];
    expect(labels).toEqual([
      'Login with GitHub Copilot (GitHub.com)',
      'Login with GitHub Copilot (Enterprise)',
      'Manage Accounts',
    ]);
  });
});
