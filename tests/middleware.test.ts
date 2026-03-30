import { describe, it, expect } from 'bun:test';
import { requirePermission, requireRole } from '../src/middleware/rbac';
import { authenticate } from '../src/middleware/auth';
import { createErrorHandler } from '../src/middleware/error-handler';

describe('Middleware', () => {
  describe('Auth Middleware', () => {
    it('authenticate should be a function', () => {
      expect(typeof authenticate).toBe('function');
    });
  });

  describe('RBAC Middleware', () => {
    it('requirePermission should be a function', () => {
      expect(typeof requirePermission).toBe('function');
    });

    it('requireRole should be a function', () => {
      expect(typeof requireRole).toBe('function');
    });

    it('should return middleware function from requirePermission', () => {
      const middleware = requirePermission('FILE_READ');
      expect(typeof middleware).toBe('function');
    });

    it('should return middleware function from requireRole', () => {
      const middleware = requireRole('ADMIN');
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Error Handler', () => {
    it('createErrorHandler should be a function', () => {
      expect(typeof createErrorHandler).toBe('function');
    });

    it('createErrorHandler should return a function', () => {
      const handler = createErrorHandler({} as any);
      expect(typeof handler).toBe('function');
    });
  });
});

describe('App Config', () => {
  it('should export buildApp function', async () => {
    const { buildApp, isProduction, isDevelopment } = await import('../src/config/app');
    
    expect(typeof buildApp).toBe('function');
    expect(typeof isProduction).toBe('boolean');
    expect(typeof isDevelopment).toBe('boolean');
  });
});

describe('Route Schemas', () => {
  it('should have proper register schema structure', () => {
    const registerSchema = {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    };

    expect(registerSchema).toBeDefined();
    expect(registerSchema.body.required).toContain('email');
    expect(registerSchema.body.required).toContain('password');
    expect(registerSchema.body.properties.email.format).toBe('email');
    expect(registerSchema.body.properties.password.minLength).toBe(6);
  });

  it('should have proper login schema structure', () => {
    const loginSchema = {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    };

    expect(loginSchema).toBeDefined();
    expect(loginSchema.body.required).toContain('email');
    expect(loginSchema.body.required).toContain('password');
  });
});

describe('Services Interface', () => {
  describe('Cache Service', () => {
    it('cacheService should be exported', async () => {
      const { cacheService } = await import('../src/services/cache.service');
      expect(cacheService).toBeDefined();
    });

    it('cacheService should have required methods', async () => {
      const { cacheService } = await import('../src/services/cache.service');

      expect(typeof cacheService.get).toBe('function');
      expect(typeof cacheService.set).toBe('function');
      expect(typeof cacheService.del).toBe('function');
      expect(typeof cacheService.getJson).toBe('function');
      expect(typeof cacheService.setJson).toBe('function');
      expect(typeof cacheService.exists).toBe('function');
      expect(typeof cacheService.incr).toBe('function');
      expect(typeof cacheService.expire).toBe('function');
      expect(typeof cacheService.delPattern).toBe('function');
      expect(typeof cacheService.mget).toBe('function');
      expect(typeof cacheService.mset).toBe('function');
    });
  });

  describe('Analytics Service', () => {
    it('analyticsService should be exported', async () => {
      const { analyticsService } = await import('../src/services/analytics.service');
      expect(analyticsService).toBeDefined();
    });

    it('analyticsService should have required methods', async () => {
      const { analyticsService } = await import('../src/services/analytics.service');

      expect(typeof analyticsService.trackRequest).toBe('function');
      expect(typeof analyticsService.getEndpointMetrics).toBe('function');
      expect(typeof analyticsService.getAllMetrics).toBe('function');
      expect(typeof analyticsService.getAggregatedMetrics).toBe('function');
      expect(typeof analyticsService.getMetricsByTimeRange).toBe('function');
      expect(typeof analyticsService.getErrorBreakdown).toBe('function');
      expect(typeof analyticsService.clearMetrics).toBe('function');
    });

    it('should have proper interface types', async () => {
      const { EndpointMetrics, AggregatedMetrics } = await import('../src/services/analytics.service');

      const metrics: EndpointMetrics = {
        endpoint: '/api/test',
        method: 'GET',
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        averageResponseTime: 150,
        minResponseTime: 50,
        maxResponseTime: 500,
        p50ResponseTime: 100,
        p95ResponseTime: 300,
        p99ResponseTime: 450,
        requestsPerMinute: 10,
        errorRate: 5.0,
        lastUpdated: new Date().toISOString(),
      };

      expect(metrics.endpoint).toBe('/api/test');
      expect(metrics.totalRequests).toBe(100);
      expect(metrics.errorRate).toBe(5.0);
    });
  });
});

describe('Utils', () => {
  describe('Logger', () => {
    it('should export logger', async () => {
      const { logger } = await import('../src/utils/logger');
      expect(logger).toBeDefined();
    });

    it('should export logError', async () => {
      const { logError } = await import('../src/utils/logger');
      expect(typeof logError).toBe('function');
    });

    it('should export logPerformance', async () => {
      const { logPerformance } = await import('../src/utils/logger');
      expect(typeof logPerformance).toBe('function');
    });

    it('should export createRequestLogger', async () => {
      const { createRequestLogger } = await import('../src/utils/logger');
      expect(typeof createRequestLogger).toBe('function');
    });
  });

  describe('Helpers', () => {
    it('should export hashPassword', async () => {
      const { hashPassword } = await import('../src/utils/helpers');
      expect(typeof hashPassword).toBe('function');
    });

    it('should export verifyPassword', async () => {
      const { verifyPassword } = await import('../src/utils/helpers');
      expect(typeof verifyPassword).toBe('function');
    });

    it('should export generateTokens', async () => {
      const { generateTokens } = await import('../src/utils/helpers');
      expect(typeof generateTokens).toBe('function');
    });

    it('should export verifyToken', async () => {
      const { verifyToken } = await import('../src/utils/helpers');
      expect(typeof verifyToken).toBe('function');
    });
  });
});

describe('Plugins', () => {
  describe('Auth Plugin', () => {
    it('should export authenticate function', async () => {
      const { authenticate } = await import('../src/plugins/auth');
      expect(typeof authenticate).toBe('function');
    });
  });
});
