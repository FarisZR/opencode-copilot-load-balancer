import type { CopilotAccount } from '../accounts/types.ts';

type CacheEntry = {
  models: string[] | null;
  unsupportedModels: string[];
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

  isUnsupported(account: CopilotAccount, modelId: string): boolean {
    const entry = this.cache.get(account.id);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(account.id);
      return false;
    }
    return entry.unsupportedModels.includes(modelId);
  }

  set(account: CopilotAccount, models: string[]) {
    this.cache.set(account.id, {
      models,
      unsupportedModels: [],
      expiresAt: Date.now() + this.config.modelCacheTtlMs,
    });
  }

  markUnsupported(account: CopilotAccount, modelId: string) {
    const entry = this.cache.get(account.id);
    if (!entry || entry.expiresAt < Date.now()) {
      this.cache.set(account.id, {
        models: null,
        unsupportedModels: [modelId],
        expiresAt: Date.now() + this.config.modelCacheTtlMs,
      });
      return;
    }

    if (entry.models) {
      entry.models = entry.models.filter((model) => model !== modelId);
    }
    if (!entry.unsupportedModels.includes(modelId)) {
      entry.unsupportedModels.push(modelId);
    }
  }
}
