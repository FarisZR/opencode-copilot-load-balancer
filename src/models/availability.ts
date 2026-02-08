import type { CopilotAccount } from '../accounts/types.ts';

type CacheEntry = {
  models: string[];
  expiresAt: number;
};

export class ModelAvailabilityCache {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly config: { modelCacheTtlMs: number }) {}

  get(account: CopilotAccount): string[] | null {
    const entry = this.cache.get(account.id);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(account.id);
      return null;
    }
    return entry.models;
  }

  set(account: CopilotAccount, models: string[]) {
    this.cache.set(account.id, {
      models,
      expiresAt: Date.now() + this.config.modelCacheTtlMs,
    });
  }

  markUnsupported(account: CopilotAccount, modelId: string) {
    const entry = this.cache.get(account.id);
    if (!entry) return;
    entry.models = entry.models.filter((model) => model !== modelId);
  }
}
