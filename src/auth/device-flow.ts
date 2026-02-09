import { CopilotAccountManager } from '../accounts/manager.ts';
import { promptManageMenu, promptAccountAction, toMenuAccounts } from './login-menu.ts';
import { COPILOT_CLIENT_ID } from './constants.ts';
const CLIENT_ID = COPILOT_CLIENT_ID;
const OAUTH_POLLING_SAFETY_MARGIN_MS = 3000;

function normalizeDomain(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function getUrls(domain: string) {
  return {
    deviceCodeUrl: `https://${domain}/login/device/code`,
    accessTokenUrl: `https://${domain}/login/oauth/access_token`,
  };
}

async function pollAccessToken(url: string, deviceCode: string, interval: number) {
  while (true) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!response.ok) return { type: 'failed' as const };
    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      interval?: number;
    };

    if (data.access_token) {
      return {
        type: 'success' as const,
        refresh: data.access_token,
        access: data.access_token,
        expires: 0,
      };
    }

    if (data.error === 'authorization_pending') {
      await Bun.sleep(interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS);
      continue;
    }

    if (data.error === 'slow_down') {
      const nextInterval = data.interval ? data.interval * 1000 : (interval + 5) * 1000;
      await Bun.sleep(nextInterval + OAUTH_POLLING_SAFETY_MARGIN_MS);
      continue;
    }

    if (data.error) return { type: 'failed' as const };

    await Bun.sleep(interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS);
  }
}

type MethodDeps = {
  manager: CopilotAccountManager;
};

export function createDeviceFlowMethod({ manager }: MethodDeps) {
  return {
    type: 'oauth' as const,
    label: 'Login with GitHub Copilot (GitHub.com)',
    prompts: [
      {
        type: 'text',
        key: 'label',
        message: 'Account label (e.g., personal, work)',
        placeholder: 'personal',
        validate: (value: string) => {
          if (!value) return 'Label is required';
          if (!value.trim()) return 'Label cannot be blank';
          return undefined;
        },
      },
    ],
    async authorize(inputs = {}) {
      const labelInput = (inputs as { label?: string }).label;
      const label = labelInput && labelInput.trim() ? labelInput.trim() : 'github.com';
      const urls = getUrls('github.com');
      const deviceResponse = await fetch(urls.deviceCodeUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          scope: 'read:user',
        }),
      });

      if (!deviceResponse.ok) {
        throw new Error('Failed to initiate device authorization');
      }

      const deviceData = (await deviceResponse.json()) as {
        verification_uri: string;
        user_code: string;
        device_code: string;
        interval: number;
      };

      return {
        url: deviceData.verification_uri,
        instructions: `Enter code: ${deviceData.user_code}`,
        method: 'auto' as const,
        async callback() {
          const result = await pollAccessToken(
            urls.accessTokenUrl,
            deviceData.device_code,
            deviceData.interval
          );

          if (result.type !== 'success') return result;

          const existing = manager
            .listAccounts()
            .find((account) => account.refresh === result.refresh && account.host === 'github.com');
          if (existing) {
            await manager.updateAccountTokens(
              existing.id,
              result.access,
              result.refresh,
              result.expires
            );
          } else {
            await manager.addAccount({
              label,
              host: 'github.com',
              refresh: result.refresh,
              access: result.access,
              expires: result.expires,
            });
          }

          return result;
        },
      };
    },
  };
}

export function createEnterpriseFlowMethod({ manager }: MethodDeps) {
  return {
    type: 'oauth' as const,
    label: 'Login with GitHub Copilot (Enterprise)',
    prompts: [
      {
        type: 'text',
        key: 'enterpriseUrl',
        message: 'Enter your GitHub Enterprise URL or domain',
        placeholder: 'company.ghe.com or https://company.ghe.com',
        validate: (value: string) => {
          if (!value) return 'URL or domain is required';
          try {
            const url = value.includes('://') ? new URL(value) : new URL(`https://${value}`);
            if (!url.hostname) return 'Please enter a valid URL or domain';
            return undefined;
          } catch {
            return 'Please enter a valid URL (e.g., company.ghe.com or https://company.ghe.com)';
          }
        },
      },
    ],
    async authorize(inputs = {}) {
      const enterpriseUrl = (inputs as { enterpriseUrl?: string }).enterpriseUrl;
      const domain = normalizeDomain(String(enterpriseUrl));
      const urls = getUrls(domain);
      const deviceResponse = await fetch(urls.deviceCodeUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          scope: 'read:user',
        }),
      });

      if (!deviceResponse.ok) {
        throw new Error('Failed to initiate device authorization');
      }

      const deviceData = (await deviceResponse.json()) as {
        verification_uri: string;
        user_code: string;
        device_code: string;
        interval: number;
      };

      return {
        url: deviceData.verification_uri,
        instructions: `Enter code: ${deviceData.user_code}`,
        method: 'auto' as const,
        async callback() {
          const result = await pollAccessToken(
            urls.accessTokenUrl,
            deviceData.device_code,
            deviceData.interval
          );

          if (result.type !== 'success') return result;

          const existing = manager
            .listAccounts()
            .find((account) => account.refresh === result.refresh && account.host === domain);
          if (existing) {
            await manager.updateAccountTokens(
              existing.id,
              result.access,
              result.refresh,
              result.expires
            );
          } else {
            await manager.addAccount({
              label: domain,
              host: domain,
              refresh: result.refresh,
              access: result.access,
              expires: result.expires,
            });
          }

          return {
            ...result,
            provider: 'github-copilot-enterprise',
            enterpriseUrl: domain,
          } as const;
        },
      };
    },
  };
}

export function createManageAccountsMethod({ manager }: MethodDeps) {
  return {
    type: 'oauth' as const,
    label: 'Manage Accounts',
    async authorize() {
      await handleManageMenu(manager);
      return {
        url: '',
        instructions: 'Account management complete.',
        method: 'auto' as const,
        callback: async () => ({ type: 'failed' as const }),
      };
    },
  };
}

async function handleManageMenu(manager: CopilotAccountManager): Promise<void> {
  while (true) {
    const accounts = toMenuAccounts(manager.listAccounts());
    const manageAction = await promptManageMenu(accounts);
    if (manageAction.type === 'back') return;
    if (manageAction.type === 'remove-all') {
      for (const account of accounts) {
        await manager.removeAccount(account.id);
      }
      continue;
    }

    const account = accounts.find((item) => item.id === manageAction.accountId);
    if (!account) continue;

    const result = await promptAccountAction(account);
    if (result === 'toggle') {
      if (account.enabled) {
        await manager.disableAccount(manageAction.accountId);
      } else {
        await manager.enableAccount(manageAction.accountId);
      }
      continue;
    }
    if (result === 'remove') {
      await manager.removeAccount(manageAction.accountId);
      continue;
    }
  }
}
