import type { OpencodeClient } from '@opencode-ai/sdk';
import type { CopilotAccountManager } from '../accounts/manager.ts';

export async function ensureProviderAuth(client: OpencodeClient, manager: CopilotAccountManager) {
  const accounts = manager.listAccounts();
  if (accounts.length === 0) return;
  const first = accounts[0];
  await client.auth.set({
    path: { id: 'github-copilot' },
    body: {
      type: 'oauth',
      refresh: first.refresh,
      access: first.access,
      expires: first.expires,
    },
  });
}
