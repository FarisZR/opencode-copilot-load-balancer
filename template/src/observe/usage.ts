import type { OpencodeClient } from '@opencode-ai/sdk';
import type { CopilotMultiConfig } from '../config/load.ts';
import type { CopilotAccount } from '../accounts/types.ts';
import { createLogger } from '../utils/logging.ts';

export type UsageNotifier = {
  accountSelected: (
    account: CopilotAccount,
    modelId: string,
    reason: string,
  ) => Promise<void>;
};

export function createUsageNotifier(
  client: OpencodeClient,
  config: CopilotMultiConfig,
): UsageNotifier {
  const log = createLogger('usage');
  let lastToastAt = 0;

  const maybeToast = async (message: string) => {
    if (!config.visibility.toast) return;
    const now = Date.now();
    if (
      config.visibility.toastCooldownMs > 0 &&
      now - lastToastAt < config.visibility.toastCooldownMs
    )
      return;
    lastToastAt = now;
    await client.tui
      .showToast({
        body: {
          message,
          variant: 'info',
        },
      })
      .catch(() => undefined);
  };

  return {
    async accountSelected(account, modelId, reason) {
      if (config.visibility.log) {
        log.info('account selected', {
          label: account.label,
          id: account.id,
          modelId,
          reason,
        });
      }
      const shortId = account.id.slice(0, 6);
      await maybeToast(`Copilot: ${account.label}#${shortId} (${modelId})`);
    },
  };
}
