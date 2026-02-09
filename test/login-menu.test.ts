import { describe, expect, it } from 'vitest';
import { toMenuAccounts } from '../src/auth/login-menu.ts';

describe('login menu helpers', () => {
  it('maps account fields for menu display', () => {
    const menuAccounts = toMenuAccounts([
      {
        id: 'abc123def456',
        label: 'personal',
        host: 'github.com',
        refresh: 'refresh',
        access: 'access',
        expires: 0,
        enabled: true,
        lastUsed: 100,
      },
    ]);

    expect(menuAccounts).toEqual([
      {
        id: 'abc123def456',
        label: 'personal',
        host: 'github.com',
        enabled: true,
        lastUsed: 100,
        cooldownUntil: undefined,
      },
    ]);
  });
});
