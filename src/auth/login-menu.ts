import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { CopilotAccount } from '../accounts/types.ts';

const ANSI = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
} as const;

export type AccountStatus = 'active' | 'rate-limited';

export type LoginMenuAction = { type: 'add' } | { type: 'manage' } | { type: 'cancel' };

export type AccountAction = 'back' | 'toggle' | 'remove' | 'cancel';

export type ManageMenuAction =
  | { type: 'account'; accountId: string }
  | { type: 'remove-all' }
  | { type: 'back' };

export type LoginMenuAccount = {
  id: string;
  label: string;
  host: string;
  enabled: boolean;
  lastUsed?: number;
  cooldownUntil?: number;
};

function supportsColor(): boolean {
  return Boolean(output.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!supportsColor()) return text;
  return `${color}${text}${ANSI.reset}`;
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (timestamp == null) return 'never';
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getAccountStatus(account: LoginMenuAccount): AccountStatus {
  if (account.cooldownUntil && account.cooldownUntil > Date.now()) return 'rate-limited';
  return 'active';
}

function formatAccountLine(account: LoginMenuAccount, index: number): string {
  const status = getAccountStatus(account);
  const statusTag =
    status === 'active'
      ? colorize('[active]', ANSI.green)
      : colorize('[rate-limited]', ANSI.yellow);
  const disabledTag = account.enabled ? '' : ` ${colorize('[disabled]', ANSI.red)}`;
  const shortId = account.id.slice(0, 6);
  const lastUsed = account.lastUsed ? ` used ${formatRelativeTime(account.lastUsed)}` : '';
  const idTag = colorize(`id=${shortId}`, ANSI.dim);
  return `${index + 1}. ${account.label} (${account.host}) ${statusTag}${disabledTag} ${idTag}${lastUsed}`;
}

export async function promptLoginMenu(accounts: LoginMenuAccount[]): Promise<LoginMenuAction> {
  const rl = createInterface({ input, output });
  try {
    if (accounts.length === 0) {
      output.write(`${colorize('No accounts configured yet.', ANSI.yellow)}\n`);
      return { type: 'add' };
    }

    output.write(`\n${colorize(`${accounts.length} account(s) saved:`, ANSI.bold)}\n`);
    accounts.forEach((account, index) => {
      output.write(`  ${formatAccountLine(account, index)}\n`);
    });
    output.write('\n');

    while (true) {
      const answer = await rl.question('(s)ign in, (m)anage, (c)ancel? [s/m/c]: ');
      const normalized = answer.trim().toLowerCase();

      if (normalized === 's' || normalized === 'sign' || normalized === 'signin') {
        return { type: 'add' };
      }
      if (normalized === 'm' || normalized === 'manage') {
        return { type: 'manage' };
      }
      if (normalized === 'c' || normalized === 'cancel') {
        return { type: 'cancel' };
      }

      output.write(`${colorize("Please enter 's', 'm', or 'c'.", ANSI.yellow)}\n`);
    }
  } finally {
    rl.close();
  }
}

export async function promptManageMenu(accounts: LoginMenuAccount[]): Promise<ManageMenuAction> {
  const rl = createInterface({ input, output });
  try {
    if (accounts.length === 0) {
      output.write(`${colorize('No accounts to manage.', ANSI.yellow)}\n`);
      return { type: 'back' };
    }

    output.write(`\n${colorize('Manage Accounts', ANSI.cyan)}\n`);
    accounts.forEach((account, index) => {
      const status = account.enabled
        ? colorize('[enabled]', ANSI.green)
        : colorize('[disabled]', ANSI.red);
      const shortId = account.id.slice(0, 6);
      const idTag = colorize(`id=${shortId}`, ANSI.dim);
      output.write(`  ${index + 1}. ${account.label} (${account.host}) ${status} ${idTag}\n`);
    });
    output.write('\n');

    while (true) {
      const answer = await rl.question(
        'Select account number, (a)ll to remove all, or press enter to exit: '
      );
      const normalized = answer.trim().toLowerCase();
      if (!normalized) return { type: 'back' };
      if (normalized === 'a' || normalized === 'all') {
        return { type: 'remove-all' };
      }
      const index = Number.parseInt(normalized, 10);
      if (!Number.isNaN(index) && index > 0 && index <= accounts.length) {
        const account = accounts[index - 1];
        if (account) return { type: 'account', accountId: account.id };
      }
      output.write(`${colorize('Invalid account number.', ANSI.yellow)}\n`);
    }
  } finally {
    rl.close();
  }
}

export async function promptAccountAction(account: LoginMenuAccount): Promise<AccountAction> {
  const rl = createInterface({ input, output });
  try {
    const shortId = account.id.slice(0, 6);
    const idTag = colorize(`id=${shortId}`, ANSI.dim);
    output.write(
      `\n${colorize('Account:', ANSI.bold)} ${account.label} (${account.host}) ${idTag}\n`
    );
    const toggleLabel = account.enabled ? 'disable' : 'enable';
    const toggleKey = toggleLabel[0] ?? 't';
    while (true) {
      const answer = await rl.question(`(${toggleLabel}) (r)emove (b)ack? [${toggleKey}/r/b]: `);
      const normalized = answer.trim().toLowerCase();
      if (normalized === toggleKey || normalized === toggleLabel) {
        return 'toggle';
      }
      if (normalized === 'r' || normalized === 'remove') {
        return 'remove';
      }
      if (normalized === 'b' || normalized === 'back') {
        return 'back';
      }
      output.write(`${colorize('Please enter a valid option.', ANSI.yellow)}\n`);
    }
  } finally {
    rl.close();
  }
}

export function toMenuAccounts(accounts: CopilotAccount[]): LoginMenuAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    label: account.label,
    host: account.host,
    enabled: account.enabled,
    lastUsed: account.lastUsed,
    cooldownUntil: account.cooldownUntil,
  }));
}
