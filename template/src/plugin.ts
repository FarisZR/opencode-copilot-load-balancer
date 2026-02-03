import type { Hooks, PluginInput } from '@opencode-ai/plugin';
import { initLogger, setLoggerSilent } from './utils/logging.ts';
import { loadConfig } from './config/load.ts';
import { CopilotAccountManager } from './accounts/manager.ts';
import { createCopilotFetch } from './fetch/copilot-fetch.ts';
import { createDeviceFlowMethod, createEnterpriseFlowMethod } from './auth/device-flow.ts';
import { ensureProviderAuth } from './auth/opencode-auth.ts';
import { tool } from '@opencode-ai/plugin';
import { listAccounts, disableAccount, enableAccount } from './auth/cli.ts';
import { createUsageNotifier } from './observe/usage.ts';

export async function CopilotMultiAccountPlugin(input: PluginInput): Promise<Hooks> {
  const config = await loadConfig(input.directory);
  initLogger(input.client);
  setLoggerSilent(!config.visibility.log);
  const notifier = createUsageNotifier(input.client, config);
  const manager = await CopilotAccountManager.load(config, notifier);

  return {
    tool: {
      'copilot-accounts-list': tool({
        description: 'List configured Copilot accounts',
        args: {},
        async execute() {
          return listAccounts(manager);
        },
      }),
      'copilot-accounts-disable': tool({
        description: 'Disable a Copilot account by id',
        args: {
          id: tool.schema.string(),
        },
        async execute(args) {
          return disableAccount(manager, args.id);
        },
      }),
      'copilot-accounts-enable': tool({
        description: 'Enable a Copilot account by id',
        args: {
          id: tool.schema.string(),
        },
        async execute(args) {
          return enableAccount(manager, args.id);
        },
      }),
    },
    auth: {
      provider: 'github-copilot',
      async loader(getAuth, provider) {
        await manager.seedFromAuth(getAuth as () => Promise<any>);
        await ensureProviderAuth(input.client, manager);
        const info = await manager.getActiveAuth(getAuth as () => Promise<any>);
        if (!info) return {};

        if (provider && provider.models) {
          for (const model of Object.values(provider.models)) {
            model.cost = {
              input: 0,
              output: 0,
              cache_read: 0,
              cache_write: 0,
            };
            if (model.provider?.npm) {
              model.provider.npm = '@ai-sdk/github-copilot';
            }
          }
        }

        return {
          baseURL: info.baseURL,
          apiKey: 'opencode-oauth-dummy-key',
          fetch: createCopilotFetch({
            config,
            manager,
            notifier,
          }),
        };
      },
      methods: [
        createDeviceFlowMethod({ manager }),
        createEnterpriseFlowMethod({ manager }),
      ],
    },
  };
}

export default CopilotMultiAccountPlugin;
