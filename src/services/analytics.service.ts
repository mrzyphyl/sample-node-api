import Redis from 'ioredis';

export interface EndpointMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  lastUpdated: string;
}

export interface AggregatedMetrics {
  totalRequests: number;
  totalErrors: number;
  overallErrorRate: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  topSlowEndpoints: EndpointMetrics[];
  topErrorEndpoints: EndpointMetrics[];
  topTrafficEndpoints: EndpointMetrics[];
  uptime: string;
}

class AnalyticsService {
  private redis: Redis;
  private metricsPrefix = 'analytics:metrics';
  private responseTimesPrefix = 'analytics:response_times';
  private readonly ttl = 3600;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async connect() {
    await this.redis.connect();
  }

  private getEndpointKey(method: string, endpoint: string): string {
    const normalizedEndpoint = this.normalizeEndpoint(endpoint);
    return `${this.metricsPrefix}:${method}:${normalizedEndpoint}`;
  }

  private normalizeEndpoint(endpoint: string): string {
    return endpoint
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  async trackRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    responseTime: number,
    userId?: string
  ): Promise<void> {
    const key = this.getEndpointKey(method, endpoint);
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);

    const pipeline = this.redis.pipeline();

    pipeline.hincrby(key, 'totalRequests', 1);
    pipeline.hincrby(key, 'lastUpdated', now);

    if (statusCode >= 200 && statusCode < 400) {
      pipeline.hincrby(key, 'successfulRequests', 1);
    } else {
      pipeline.hincrby(key, 'failedRequests', 1);
    }

    pipeline.zadd(`${this.responseTimesPrefix}:${method}:${this.normalizeEndpoint(endpoint)}`, responseTime, `${now}:${Math.random()}`);

    pipeline.zadd(`${this.metricsPrefix}:requests:${minute}`, 1, `${key}:${Math.random()}`);
    pipeline.expire(`${this.metricsPrefix}:requests:${minute}`, 120);

    if (userId) {
      pipeline.sadd(`${this.metricsPrefix}:users:${hour}`, userId);
      pipeline.expire(`${this.metricsPrefix}:users:${hour}`, 86400);
    }

    await pipeline.exec();
  }

  async getEndpointMetrics(method: string, endpoint: string): Promise<EndpointMetrics | null> {
    const key = this.getEndpointKey(method, endpoint);
    const data = await this.redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    const responseTimeKey = `${this.responseTimesPrefix}:${method}:${this.normalizeEndpoint(endpoint)}`;
    const responseTimes = await this.redis.zrange(responseTimeKey, 0, -1);

    const times = responseTimes.map((rt) => parseInt(rt.split(':')[0], 10));
    const sortedTimes = times.sort((a, b) => a - b);

    const totalRequests = parseInt(data.totalRequests || '0', 10);
    const successfulRequests = parseInt(data.successfulRequests || '0', 10);
    const failedRequests = parseInt(data.failedRequests || '0', 10);

    const getPercentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    const minuteKey = Math.floor(Date.now() / 60000);
    const requestsThisMinute = await this.redis.zcount(`${this.metricsPrefix}:requests:${minuteKey}`, '-inf', '+inf');

    return {
      endpoint: this.normalizeEndpoint(endpoint),
      method,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: parseInt(data.averageResponseTime || '0', 10),
      minResponseTime: sortedTimes.length > 0 ? sortedTimes[0] : 0,
      maxResponseTime: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0,
      p50ResponseTime: getPercentile(sortedTimes, 50),
      p95ResponseTime: getPercentile(sortedTimes, 95),
      p99ResponseTime: getPercentile(sortedTimes, 99),
      requestsPerMinute: requestsThisMinute,
      errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
      lastUpdated: new Date(parseInt(data.lastUpdated || Date.now(), 10)).toISOString(),
    };
  }

  async getAllMetrics(): Promise<EndpointMetrics[]> {
    const keys = await this.redis.keys(`${this.metricsPrefix}:*`);
    const metricsMap = new Map<string, EndpointMetrics>();

    for (const key of keys) {
      if (key.includes('response_times') || key.includes('requests:') || key.includes('users:')) {
        continue;
      }

      const parts = key.replace(`${this.metricsPrefix}:`, '').split(':');
      if (parts.length >= 2) {
        const method = parts[0];
        const endpoint = parts.slice(1).join(':');
        const metrics = await this.getEndpointMetrics(method, endpoint);
        if (metrics) {
          const mapKey = `${method}:${metrics.endpoint}`;
          metricsMap.set(mapKey, metrics);
        }
      }
    }

    return Array.from(metricsMap.values());
  }

  async getAggregatedMetrics(): Promise<AggregatedMetrics> {
    const allMetrics = await this.getAllMetrics();

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
    const totalResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime * m.totalRequests, 0);

    const topSlow = [...allMetrics]
      .sort((a, b) => b.p95ResponseTime - a.p95ResponseTime)
      .slice(0, 5);

    const topErrors = [...allMetrics]
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);

    const topTraffic = [...allMetrics]
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 5);

    return {
      totalRequests,
      totalErrors,
      overallErrorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      averageResponseTime: totalRequests > 0 ? Math.round(totalResponseTime / totalRequests) : 0,
      requestsPerMinute: allMetrics.reduce((sum, m) => sum + m.requestsPerMinute, 0),
      topSlowEndpoints: topSlow,
      topErrorEndpoints: topErrors,
      topTrafficEndpoints: topTraffic,
      uptime: process.uptime().toString(),
    };
  }

  async getMetricsByTimeRange(minutes: number): Promise<Record<string, number>> {
    const now = Date.now();
    const startTime = now - minutes * 60 * 1000;
    const data: Record<string, number> = {};

    for (let i = 0; i < minutes; i++) {
      const minuteKey = Math.floor((now - i * 60000) / 60000);
      const requests = await this.redis.zcount(
        `${this.metricsPrefix}:requests:${minuteKey}`,
        '-inf',
        '+inf'
      );
      data[new Date(minuteKey * 60000).toISOString()] = requests;
    }

    return data;
  }

  async getErrorBreakdown(): Promise<Record<string, number>> {
    const allMetrics = await this.getAllMetrics();
    const breakdown: Record<string, number> = {
      '400': 0,
      '401': 0,
      '403': 0,
      '404': 0,
      '500': 0,
      '502': 0,
      '503': 0,
      'other': 0,
    };

    for (const metric of allMetrics) {
      breakdown['400'] += metric.failedRequests;
    }

    return breakdown;
  }

  async clearMetrics(): Promise<void> {
    const keys = await this.redis.keys(`${this.metricsPrefix}:*`);
    const responseTimeKeys = await this.redis.keys(`${this.responseTimesPrefix}:*`);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    if (responseTimeKeys.length > 0) {
      await this.redis.del(...responseTimeKeys);
    }
  }
}

export const analyticsService = new AnalyticsService();
