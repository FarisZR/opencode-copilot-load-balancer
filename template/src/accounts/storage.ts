import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import type { AccountStore } from './types.ts';

const STORE_VERSION = 1 as const;

const StoreSchema = z.object({
  version: z.literal(STORE_VERSION),
  accounts: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        host: z.string(),
        refresh: z.string(),
        access: z.string(),
        expires: z.number(),
        enabled: z.boolean(),
        models: z.array(z.string()).optional(),
        lastUsed: z.number().optional(),
        cooldownUntil: z.number().optional(),
        consecutiveFailures: z.number().optional(),
      }),
    )
    .default([]),
  lastIndex: z.number().int().default(0),
  lastIndexByHost: z.record(z.string(), z.number()).default({}),
});

export type StorePath = {
  path: string;
  source: 'config' | 'default';
};

export function resolveAccountsPath(configPath?: string): StorePath {
  if (configPath) return { path: configPath, source: 'config' };
  return {
    path: path.join(os.homedir(), '.config', 'opencode', 'copilot-accounts.json'),
    source: 'default',
  };
}

export async function loadStore(configPath?: string): Promise<AccountStore> {
  const resolved = resolveAccountsPath(configPath);
  const file = Bun.file(resolved.path);
  if (!(await file.exists())) {
    return { version: STORE_VERSION, accounts: [], lastIndex: 0, lastIndexByHost: {} };
  }
  const json = await file.json().catch(() => null);
  const parsed = StoreSchema.safeParse(json);
  if (!parsed.success) {
    return { version: STORE_VERSION, accounts: [], lastIndex: 0, lastIndexByHost: {} };
  }
  return parsed.data;
}

export async function saveStore(store: AccountStore, configPath?: string): Promise<void> {
  const resolved = resolveAccountsPath(configPath);
  await Bun.write(resolved.path, JSON.stringify(store, null, 2), { mode: 0o600 });
}
