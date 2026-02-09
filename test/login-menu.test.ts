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

  it('returns empty list for empty input', () => {
    expect(toMenuAccounts([])).toEqual([]);
  });

  it('maps multiple accounts including cooldown and disabled state', () => {
    const menuAccounts = toMenuAccounts([
      {
        id: 'first-account',
        label: 'personal',
        host: 'github.com',
        refresh: 'refresh-1',
        access: 'access-1',
        expires: 0,
        enabled: true,
        cooldownUntil: 500,
      },
      {
        id: 'second-account',
        label: 'work',
        host: 'company.ghe.com',
        refresh: 'refresh-2',
        access: 'access-2',
        expires: 0,
        enabled: false,
        lastUsed: 250,
      },
    ]);

    expect(menuAccounts).toEqual([
      {
        id: 'first-account',
        label: 'personal',
        host: 'github.com',
        enabled: true,
        lastUsed: undefined,
        cooldownUntil: 500,
      },
      {
        id: 'second-account',
        label: 'work',
        host: 'company.ghe.com',
        enabled: false,
        lastUsed: 250,
        cooldownUntil: undefined,
      },
    ]);
  });
});
