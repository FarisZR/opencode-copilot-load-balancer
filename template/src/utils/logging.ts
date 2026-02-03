export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
};

type LoggerApp = {
  log?: (input: {
    body: {
      service: string;
      level: LogLevel;
      message: string;
      extra?: Record<string, unknown>;
    };
  }) => Promise<unknown>;
};

type LoggerClient = {
  app?: LoggerApp;
};

const ENV_CONSOLE_LOG = 'OPENCODE_COPILOT_MULTI_CONSOLE_LOG';
const CONSOLE_PREFIX = '[copilot-multi]';
let silent = false;
let client: LoggerClient | null = null;

function isConsoleLogEnabled(): boolean {
  const val = process.env[ENV_CONSOLE_LOG];
  return val === '1' || val?.toLowerCase() === 'true';
}

export function initLogger(value: LoggerClient): void {
  client = value;
}

export function createLogger(module: string): Logger {
  const service = `copilot-multi.${module}`;
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    if (silent) return;
    const app = client?.app;
    if (app && typeof app.log === 'function') {
      app
        .log({
          body: {
            service,
            level,
            message,
            extra: data,
          },
        })
        .catch(() => undefined);
      return;
    }

    if (!isConsoleLogEnabled()) return;
    const payload = data ? ` ${JSON.stringify(data)}` : '';
    process.stdout.write(`${CONSOLE_PREFIX} [${service}] ${message}${payload}\n`);
  };

  return {
    debug: (message, data) => log('debug', message, data),
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),
  };
}

export function setLoggerSilent(value: boolean) {
  silent = value;
}
