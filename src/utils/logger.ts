import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface LogContext {
  requestId: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip?: string;
}

const contextStorage = new AsyncLocalStorage<LogContext>();

const createTransport = () => {
  const targets: pino.LoggerOptions[] = [];

  if (process.env.NODE_ENV !== 'test') {
    targets.push({
      target: 'pino/file',
      options: { destination: 1 },
      level: 'info',
    });
  }

  if (process.env.LOG_FILE_PATH) {
    targets.push({
      target: 'pino/file',
      options: { destination: process.env.LOG_FILE_PATH },
      level: 'debug',
    });
  }

  return {
    targets: targets.length > 0 ? targets : undefined,
  };
};

const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: {
    env: process.env.NODE_ENV || 'development',
    service: process.env.APP_NAME || 'file-storage-api',
    version: process.env.APP_VERSION || '1.0.0',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.routerPath,
      parameters: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-request-id': req.headers['x-request-id'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: (err) => ({
      name: err.name,
      message: err.message,
      stack: err.stack,
      type: err.type,
      code: err.code,
    }),
  },
};

const baseLogger = pino(loggerConfig);

export const logger = {
  child(bindings: Record<string, unknown>) {
    return baseLogger.child(bindings);
  },

  withContext(context: Partial<LogContext>) {
    return baseLogger.child({
      ...getContext(),
      ...context,
    });
  },

  trace(message: string, obj?: Record<string, unknown>) {
    const ctx = getContext();
    if (obj) {
      baseLogger.trace({ ...ctx, ...obj }, message);
    } else {
      baseLogger.trace({ ...ctx }, message);
    }
  },

  debug(message: string, obj?: Record<string, unknown>) {
    const ctx = getContext();
    if (obj) {
      baseLogger.debug({ ...ctx, ...obj }, message);
    } else {
      baseLogger.debug({ ...ctx }, message);
    }
  },

  info(message: string, obj?: Record<string, unknown>) {
    const ctx = getContext();
    if (obj) {
      baseLogger.info({ ...ctx, ...obj }, message);
    } else {
      baseLogger.info({ ...ctx }, message);
    }
  },

  warn(message: string, obj?: Record<string, unknown>) {
    const ctx = getContext();
    if (obj) {
      baseLogger.warn({ ...ctx, ...obj }, message);
    } else {
      baseLogger.warn({ ...ctx }, message);
    }
  },

  error(message: string, obj?: Record<string, unknown>) {
    const ctx = getContext();
    if (obj?.err) {
      baseLogger.error(obj, message);
    } else if (obj) {
      baseLogger.error({ ...ctx, ...obj }, message);
    } else {
      baseLogger.error({ ...ctx }, message);
    }
  },

  fatal(message: string, obj?: Record<string, unknown>) {
    const ctx = getContext();
    if (obj) {
      baseLogger.fatal({ ...ctx, ...obj }, message);
    } else {
      baseLogger.fatal({ ...ctx }, message);
    }
  },

  requestId() {
    return getContext()?.requestId || randomUUID();
  },

  setContext(context: Partial<LogContext>) {
    return contextStorage.enterWith({ ...getContext(), ...context });
  },

  getContext() {
    return getContext();
  },

  runWithContext<T>(context: Partial<LogContext>, fn: () => T): T {
    return contextStorage.run({ ...getContext(), ...context }, fn);
  },
};

function getContext(): LogContext {
  return contextStorage.getStore() || { requestId: randomUUID() };
}

export const createRequestLogger = () => {
  return async function requestLogger(
    request: { id: string; method: string; url: string; headers: Record<string, string | undefined>; ip?: string },
    reply: { statusCode: number; getResponseTime: () => number }
  ) {
    const startTime = Date.now();
    const context: LogContext = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.headers['x-forwarded-for'] as string,
    };

    contextStorage.enterWith(context);

    reply.addHook('onSend', async () => {
      const responseTime = Date.now() - startTime;
      const finalContext = {
        ...context,
        statusCode: reply.statusCode,
        responseTime,
      };

      const logData = {
        ...finalContext,
        timestamp: new Date().toISOString(),
        level: reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info',
      };

      if (reply.statusCode >= 500) {
        baseLogger.error(logData, `${request.method} ${request.url} ${reply.statusCode}`);
      } else if (reply.statusCode >= 400) {
        baseLogger.warn(logData, `${request.method} ${request.url} ${reply.statusCode}`);
      } else {
        baseLogger.info(logData, `${request.method} ${request.url} ${reply.statusCode}`);
      }
    });
  };
};

export const logError = (
  error: Error,
  context?: Partial<LogContext>
) => {
  const errorContext = {
    ...getContext(),
    ...context,
    err: error,
    errorType: error.name,
    errorMessage: error.message,
    stack: error.stack,
  };

  baseLogger.error(errorContext, `Error: ${error.message}`);

  if (process.env.NODE_ENV === 'production') {
    baseLogger.error({
      ...errorContext,
      errorId: randomUUID(),
      occurredAt: new Date().toISOString(),
    }, 'Error details captured');
  }
};

export const logPerformance = (
  operation: string,
  duration: number,
  context?: Record<string, unknown>
) => {
  baseLogger.info({
    ...getContext(),
    ...context,
    operation,
    duration,
    durationMs: duration,
    slowThreshold: 1000,
    isSlow: duration > 1000,
  }, `Performance: ${operation} took ${duration}ms`);
};
