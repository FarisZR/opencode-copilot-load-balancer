import type { CopilotAccountManager } from '../accounts/manager.ts';
import { createLogger } from '../utils/logging.ts';

const log = createLogger('auth');

export async function listAccounts(manager: CopilotAccountManager): Promise<string> {
  const accounts = manager.listAccounts();
  if (accounts.length === 0) return 'No Copilot accounts configured.';
  return accounts
    .map((account, index) => {
      const status = account.enabled ? 'enabled' : 'disabled';
      return `${index + 1}. ${account.label} (${account.host}) [${status}] id=${account.id}`;
    })
    .join('\n');
}

export async function disableAccount(manager: CopilotAccountManager, id: string): Promise<string> {
  await manager.disableAccount(id);
  log.info('account disabled', { id });
  return `Disabled account ${id}`;
}

export async function enableAccount(manager: CopilotAccountManager, id: string): Promise<string> {
  await manager.enableAccount(id);
  log.info('account enabled', { id });
  return `Enabled account ${id}`;
}
