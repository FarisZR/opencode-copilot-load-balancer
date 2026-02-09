import { randomUUID } from 'node:crypto';
import type { CopilotMultiConfig } from '../config/load.ts';
import type { CopilotAccount, AccountSelection } from './types.ts';
import { loadStoreWithMetadata, saveStore } from './storage.ts';
import { noop } from '../utils/noop.ts';
import type { UsageNotifier } from '../observe/usage.ts';
import { ModelAvailabilityCache } from '../models/availability.ts';

export type AuthInfo = {
  access: string;
  refresh: string;
  expires: number;
  host: string;
  baseURL?: string;
  type: 'oauth';
  enterpriseUrl?: string;
};

export class CopilotAccountManager {
  private accounts: CopilotAccount[] = [];
  private lastIndex = 0;
  private lastIndexByHost: Record<string, number> = {};
  private lastUsed?: CopilotAccount;
  private storeExists = false;

  private readonly availability: ModelAvailabilityCache;

  private constructor(
    private readonly config: CopilotMultiConfig,
    private readonly _notifier: UsageNotifier
  ) {
    this.availability = new ModelAvailabilityCache(config);
  }

  static async load(config: CopilotMultiConfig, notifier: UsageNotifier) {
    const manager = new CopilotAccountManager(config, notifier);
    if (config.accountsPath === 'memory') {
      manager.accounts = [];
      manager.lastIndex = 0;
      manager.lastIndexByHost = {};
      manager.storeExists = false;
      return manager;
    }
    const { store, exists } = await loadStoreWithMetadata(config.accountsPath);
    manager.accounts = store.accounts;
    manager.lastIndex = store.lastIndex;
    manager.lastIndexByHost = store.lastIndexByHost;
    manager.storeExists = exists;
    return manager;
  }

  getLastUsedAccount() {
    return this.lastUsed;
  }

  async addAccount(input: Omit<CopilotAccount, 'id' | 'enabled'> & { enabled?: boolean }) {
    const account: CopilotAccount = {
      ...input,
      id: randomUUID(),
      enabled: input.enabled ?? true,
      lastUsed: input.lastUsed ?? Date.now(),
    };
    this.accounts.push(account);
    await this.persist();
  }

  async seedFromAuth(getAuth: () => Promise<AuthInfo | null>) {
    if (this.accounts.length > 0) return;
    if (this.storeExists) return;
    const auth = await getAuth();
    if (!auth || auth.type !== 'oauth') return;
    const host = auth.enterpriseUrl ? auth.enterpriseUrl : 'github.com';
    await this.addAccount({
      label: host,
      host,
      refresh: auth.refresh,
      access: auth.access,
      expires: auth.expires,
    });
  }

  listAccounts() {
    return [...this.accounts];
  }

  async disableAccount(id: string) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.enabled = false;
    await this.persist();
  }

  async enableAccount(id: string) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.enabled = true;
    await this.persist();
  }

  async removeAccount(id: string) {
    const index = this.accounts.findIndex((item) => item.id === id);
    if (index < 0) return;
    this.accounts.splice(index, 1);
    if (this.lastUsed?.id === id) {
      this.lastUsed = undefined;
    }
    await this.persist();
  }

  async updateAccountModels(id: string, models: string[]) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.models = models;
    this.availability.set(account, models);
    await this.persist();
  }

  async markModelUnsupported(id: string, model: string) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.models = Array.isArray(account.models)
      ? account.models.filter((item) => item !== model)
      : [];
    this.availability.markUnsupported(account, model);
    await this.persist();
  }

  async markFailure(id: string, cooldownMs: number) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.consecutiveFailures = (account.consecutiveFailures ?? 0) + 1;
    account.cooldownUntil = Date.now() + cooldownMs;
    await this.persist();
  }

  async updateAccountTokens(id: string, access: string, refresh: string, expires: number) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.access = access;
    account.refresh = refresh;
    account.expires = expires;
    await this.persist();
  }

  async markSuccess(id: string) {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) return;
    account.consecutiveFailures = 0;
    account.cooldownUntil = undefined;
    account.lastUsed = Date.now();
    await this.persist();
  }

  async getActiveAuth(getAuth: () => Promise<AuthInfo | null>): Promise<AuthInfo | null> {
    const hasEnabled = this.accounts.some((account) => account.enabled);
    if (!hasEnabled) return null;
    const auth = await getAuth();
    if (!auth || auth.type !== 'oauth') return null;
    return {
      access: auth.access,
      refresh: auth.refresh,
      expires: auth.expires,
      host: auth.enterpriseUrl ? auth.enterpriseUrl : 'github.com',
      baseURL: auth.enterpriseUrl ? `https://copilot-api.${auth.enterpriseUrl}` : undefined,
      type: 'oauth',
      enterpriseUrl: auth.enterpriseUrl,
    };
  }

  selectAccount(modelId: string, host: string): AccountSelection | null {
    const eligible = this.accounts.filter((account) => {
      if (!account.enabled) return false;
      if (account.host !== host) return false;
      if (account.cooldownUntil && account.cooldownUntil > Date.now()) return false;
      const cached = this.availability.get(account);
      const models = cached ?? account.models;
      if (!models || models.length === 0) return true;
      return models.includes(modelId);
    });

    if (eligible.length === 0) return null;

    if (this.config.strategy === 'round-robin') {
      const index = this.lastIndex % eligible.length;
      const account = eligible[index];
      this.lastIndex = (this.lastIndex + 1) % eligible.length;
      this.lastIndexByHost[host] = this.lastIndex;
      this.lastUsed = account;
      return { account, index, reason: 'round-robin' };
    }

    if (this.config.strategy === 'hybrid') {
      const scored = eligible.map((account, index) => {
        const score = (account.consecutiveFailures ?? 0) * -10 - (account.lastUsed ?? 0);
        return { index, account, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const chosen = scored[0];
      if (chosen) {
        this.lastUsed = chosen.account;
        return { account: chosen.account, index: chosen.index, reason: 'hybrid' };
      }
    }

    const sticky = eligible[0];
    if (sticky) {
      this.lastUsed = sticky;
      return { account: sticky, index: 0, reason: 'sticky' };
    }

    return null;
  }

  async notifySelection(selection: AccountSelection, modelId: string) {
    await this._notifier.accountSelected(selection.account, modelId, selection.reason);
  }

  private async persist() {
    if (this.config.accountsPath === 'memory') {
      noop();
      return;
    }
    await saveStore(
      {
        version: 1,
        accounts: this.accounts,
        lastIndex: this.lastIndex,
        lastIndexByHost: this.lastIndexByHost,
      },
      this.config.accountsPath
    );
    this.storeExists = true;
  }
}
