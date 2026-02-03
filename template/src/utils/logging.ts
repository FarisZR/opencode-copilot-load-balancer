export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
};

let silent = false;

function format(
  level: LogLevel,
  service: string,
  message: string,
  data?: Record<string, unknown>,
): string {
  const payload = data ? ` ${JSON.stringify(data)}` : '';
  return `[${level.toUpperCase()}] [${service}] ${message}${payload}`;
}

export function createLogger(service: string): Logger {
  const emit = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    if (silent) return;
    process.stdout.write(`${format(level, service, message, data)}\n`);
  };

  return {
    debug: (message, data) => emit('debug', message, data),
    info: (message, data) => emit('info', message, data),
    warn: (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
  };
}

export function setLoggerSilent(value: boolean) {
  silent = value;
}
