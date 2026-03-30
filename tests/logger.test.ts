import { describe, it, expect } from 'bun:test';
import { logger, logError, logPerformance, createRequestLogger } from '../src/utils/logger';

describe('Logger', () => {
  describe('logger object', () => {
    it('should have all required methods', () => {
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should have context methods', () => {
      expect(typeof logger.child).toBe('function');
      expect(typeof logger.withContext).toBe('function');
      expect(typeof logger.requestId).toBe('function');
      expect(typeof logger.setContext).toBe('function');
      expect(typeof logger.getContext).toBe('function');
      expect(typeof logger.runWithContext).toBe('function');
    });

    it('should create child logger', () => {
      const child = logger.child({ testKey: 'testValue' });
      expect(child).toBeDefined();
    });

    it('should create logger with context', () => {
      const logged = logger.withContext({ userId: '123', requestId: '456' });
      expect(logged).toBeDefined();
    });

    it('should generate requestId', () => {
      const requestId = logger.requestId();
      expect(typeof requestId).toBe('string');
      expect(requestId.length).toBeGreaterThan(0);
    });

    it('should generate unique requestIds', () => {
      const id1 = logger.requestId();
      const id2 = logger.requestId();
      expect(id1).not.toBe(id2);
    });

    it('should run function with context', () => {
      const result = logger.runWithContext({ userId: '123' }, () => {
        return 'test result';
      });
      expect(result).toBe('test result');
    });

    it('should call log methods without error', () => {
      expect(() => logger.info('Test info')).not.toThrow();
      expect(() => logger.warn('Test warn')).not.toThrow();
      expect(() => logger.error('Test error')).not.toThrow();
    });
  });

  describe('createRequestLogger', () => {
    it('should be a function', () => {
      expect(typeof createRequestLogger).toBe('function');
    });

    it('should return a function', () => {
      const requestLogger = createRequestLogger();
      expect(typeof requestLogger).toBe('function');
    });
  });

  describe('logError', () => {
    it('should be a function', () => {
      expect(typeof logError).toBe('function');
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      expect(() => logError(error)).not.toThrow();
    });

    it('should handle errors with context', () => {
      const error = new Error('Test error');
      expect(() => logError(error, { requestId: '123' })).not.toThrow();
    });

    it('should handle errors with all context properties', () => {
      const error = new Error('Test error');
      const context = {
        requestId: 'req-123',
        userId: 'user-456',
        method: 'GET',
        url: '/api/test',
        statusCode: 500,
      };

      expect(() => logError(error, context)).not.toThrow();
    });
  });

  describe('logPerformance', () => {
    it('should be a function', () => {
      expect(typeof logPerformance).toBe('function');
    });

    it('should log operation performance', () => {
      expect(() => logPerformance('database query', 100)).not.toThrow();
    });

    it('should log slow operations', () => {
      expect(() => logPerformance('slow operation', 2000)).not.toThrow();
    });

    it('should handle operation with context', () => {
      expect(() =>
        logPerformance('file upload', 500, { fileId: 'file-123', size: 1024 })
      ).not.toThrow();
    });

    it('should mark operations as slow when over 1000ms', () => {
      expect(() => logPerformance('database query', 1500)).not.toThrow();
    });
  });

  describe('Log levels', () => {
    it('trace should be callable', () => {
      expect(() => logger.trace('trace message')).not.toThrow();
    });

    it('debug should be callable', () => {
      expect(() => logger.debug('debug message')).not.toThrow();
    });

    it('info should be callable', () => {
      expect(() => logger.info('info message')).not.toThrow();
    });

    it('warn should be callable', () => {
      expect(() => logger.warn('warn message')).not.toThrow();
    });

    it('error should be callable', () => {
      expect(() => logger.error('error message')).not.toThrow();
    });

    it('fatal should be callable', () => {
      expect(() => logger.fatal('fatal message')).not.toThrow();
    });

    it('should accept object with additional data', () => {
      expect(() => logger.info('message', { key: 'value' })).not.toThrow();
    });
  });
});
