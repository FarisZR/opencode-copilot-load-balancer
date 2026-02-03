export type CopilotAccount = {
  id: string;
  label: string;
  host: string;
  refresh: string;
  access: string;
  expires: number;
  enabled: boolean;
  models?: string[];
  lastUsed?: number;
  cooldownUntil?: number;
  consecutiveFailures?: number;
};

export type AccountStore = {
  version: 1;
  accounts: CopilotAccount[];
  lastIndex: number;
  lastIndexByHost: Record<string, number>;
};

export type AccountSelection = {
  account: CopilotAccount;
  index: number;
  reason: 'sticky' | 'round-robin' | 'hybrid' | 'fallback';
};
