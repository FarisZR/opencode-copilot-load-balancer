import type { CopilotAccountManager } from '../accounts/manager.ts';
import type { CopilotMultiConfig } from '../config/load.ts';
import type { UsageNotifier } from '../observe/usage.ts';
import { createLogger } from '../utils/logging.ts';
import { COPILOT_CLIENT_ID } from '../auth/constants.ts';

type FetchDeps = {
  config: CopilotMultiConfig;
  manager: CopilotAccountManager;
  notifier: UsageNotifier;
};

type ParsedRequest = {
  modelId?: string;
  isAgent: boolean;
  isVision: boolean;
};

const log = createLogger('fetch');

type CopilotRequestInit = {
  body?: string;
  headers?: HeadersInit;
  method?: string;
  signal?: AbortSignal;
};

type CopilotRequestInfo = string | URL;

function parseRequest(init?: CopilotRequestInit): ParsedRequest {
  if (!init?.body || typeof init.body !== 'string') {
    return { isAgent: false, isVision: false };
  }
  try {
    const body = JSON.parse(init.body);
    if (body?.messages) {
      const last = body.messages[body.messages.length - 1];
      return {
        modelId: body.model,
        isAgent: last?.role !== 'user',
        isVision: body.messages.some((msg: unknown) => {
          if (!msg || typeof msg !== 'object') return false;
          const content = (msg as { content?: unknown }).content;
          if (!Array.isArray(content)) return false;
          return content.some((part: unknown) => {
            return typeof part === 'object' && (part as { type?: string }).type === 'image_url';
          });
        }),
      };
    }
    if (body?.input) {
      const last = body.input[body.input.length - 1];
      return {
        modelId: body.model,
        isAgent: last?.role !== 'user',
        isVision: body.input.some((item: unknown) => {
          if (!item || typeof item !== 'object') return false;
          const content = (item as { content?: unknown }).content;
          if (!Array.isArray(content)) return false;
          return content.some((part: unknown) => {
            return typeof part === 'object' && (part as { type?: string }).type === 'input_image';
          });
        }),
      };
    }
  } catch {
    return { isAgent: false, isVision: false };
  }
  return { isAgent: false, isVision: false };
}

function buildHeaders(base: HeadersInit | undefined, auth: string, parsed: ParsedRequest) {
  const headers = new Headers(base);
  headers.set('authorization', `Bearer ${auth}`);
  headers.set('x-initiator', parsed.isAgent ? 'agent' : 'user');
  if (parsed.isVision) {
    headers.set('Copilot-Vision-Request', 'true');
  }
  headers.delete('x-api-key');
  return headers;
}

function getRetryAfter(response: Response, fallback: number) {
  const retryAfterMs = response.headers.get('retry-after-ms');
  if (retryAfterMs) {
    const parsed = Number.parseInt(retryAfterMs, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const parsed = Number.parseInt(retryAfter, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed * 1000;
  }
  return fallback;
}

async function refreshToken(host: string, refresh: string) {
  const domain = host === 'github.com' ? 'github.com' : host;
  const response = await fetch(`https://${domain}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: COPILOT_CLIENT_ID,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  return {
    access: data.access_token,
    refresh: data.refresh_token ?? refresh,
    expires: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export function createCopilotFetch({ config, manager, notifier }: FetchDeps) {
  return async (request: CopilotRequestInfo, init?: CopilotRequestInit) => {
    const parsed = parseRequest(init);
    const url = request instanceof URL ? request.toString() : request.toString();
    const host = url.includes('copilot-api.')
      ? (url.split('copilot-api.')[1]?.split('/')[0] ?? 'github.com')
      : 'github.com';

    const modelId = parsed.modelId ?? 'unknown';
    const selection = manager.selectAccount(modelId, host);
    if (!selection) {
      throw new Error(`No eligible Copilot accounts available for ${modelId}`);
    }

    if (selection.account.expires > 0 && selection.account.expires < Date.now()) {
      const refreshed = await refreshToken(host, selection.account.refresh);
      if (refreshed) {
        await manager.updateAccountTokens(
          selection.account.id,
          refreshed.access,
          refreshed.refresh,
          refreshed.expires,
        );
        selection.account.access = refreshed.access;
        selection.account.refresh = refreshed.refresh;
        selection.account.expires = refreshed.expires;
      }
    }

    await manager.notifySelection(selection, modelId);
    const headers = buildHeaders(init?.headers, selection.account.access, parsed);

    const response = await fetch(request, {
      ...init,
      headers,
    });

    if (response.status === 404 || response.status === 400) {
      const bodyText = await response
        .clone()
        .text()
        .catch(() => '');
      if (
        bodyText.toLowerCase().includes('model') &&
        bodyText.toLowerCase().includes('not found')
      ) {
        await manager.markModelUnsupported(selection.account.id, modelId);
      }
    }

    if (response.status === 401 || response.status === 403) {
      await manager.markFailure(selection.account.id, config.rateLimit.defaultBackoffMs);
      log.warn('auth failure detected', { account: selection.account.label, modelId });
      const fallback = manager.selectAccount(modelId, host);
      if (!fallback) return response;
      await notifier.accountSelected(fallback.account, modelId, 'fallback');
      const retryHeaders = buildHeaders(init?.headers, fallback.account.access, parsed);
      return fetch(request, { ...init, headers: retryHeaders });
    }

    if (response.status === 429 || response.status === 503) {
      const backoff = getRetryAfter(response, config.rateLimit.defaultBackoffMs);
      await manager.markFailure(
        selection.account.id,
        Math.min(backoff, config.rateLimit.maxBackoffMs),
      );
      log.warn('rate limit detected', { account: selection.account.label, modelId });
      const fallback = manager.selectAccount(modelId, host);
      if (!fallback) return response;
      await notifier.accountSelected(fallback.account, modelId, 'fallback');
      const retryHeaders = buildHeaders(init?.headers, fallback.account.access, parsed);
      return fetch(request, { ...init, headers: retryHeaders });
    }

    await manager.markSuccess(selection.account.id);
    return response;
  };
}
