import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService, EndpointMetrics, AggregatedMetrics } from '../services/analytics.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { Permission } from '../enums/index';

interface QueryParams {
  method?: string;
  endpoint?: string;
  limit?: string;
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get<{
    Querystring: QueryParams;
  }>('/summary', {
    preHandler: [requirePermission(Permission.AUDIT_VIEW)],
    schema: {
      tags: ['Analytics'],
      summary: 'Get aggregated analytics summary',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            totalRequests: { type: 'number' },
            totalErrors: { type: 'number' },
            overallErrorRate: { type: 'number' },
            averageResponseTime: { type: 'number' },
            requestsPerMinute: { type: 'number' },
            topSlowEndpoints: { type: 'array' },
            topErrorEndpoints: { type: 'array' },
            topTrafficEndpoints: { type: 'array' },
            uptime: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const metrics = await analyticsService.getAggregatedMetrics();
    return reply.send(metrics);
  });

  fastify.get<{
    Querystring: QueryParams;
  }>('/endpoints', {
    preHandler: [requirePermission(Permission.AUDIT_VIEW)],
    schema: {
      tags: ['Analytics'],
      summary: 'Get metrics for all endpoints',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', default: '50' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit || '50', 10);
    const allMetrics = await analyticsService.getAllMetrics();

    const sorted = allMetrics.sort((a, b) => b.totalRequests - a.totalRequests);

    return reply.send({
      total: sorted.length,
      endpoints: sorted.slice(0, limit),
    });
  });

  fastify.get<{
    Querystring: QueryParams;
  }>('/endpoints/:method/:endpoint', {
    preHandler: [requirePermission(Permission.AUDIT_VIEW)],
    schema: {
      tags: ['Analytics'],
      summary: 'Get metrics for specific endpoint',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
          endpoint: { type: 'string' },
        },
        required: ['method', 'endpoint'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { method: string; endpoint: string } }>, reply: FastifyReply) => {
    const { method, endpoint } = request.params;
    const metrics = await analyticsService.getEndpointMetrics(method, endpoint);

    if (!metrics) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No metrics found for this endpoint',
      });
    }

    return reply.send(metrics);
  });

  fastify.get<{
    Querystring: QueryParams;
  }>('/timeseries', {
    preHandler: [requirePermission(Permission.AUDIT_VIEW)],
    schema: {
      tags: ['Analytics'],
      summary: 'Get request metrics over time',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          minutes: { type: 'string', default: '60' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { minutes?: string } }>, reply: FastifyReply) => {
    const minutes = parseInt(request.query.minutes || '60', 10);
    const data = await analyticsService.getMetricsByTimeRange(minutes);

    return reply.send({
      timeframe: `${minutes} minutes`,
      data,
    });
  });

  fastify.get<{
    Querystring: QueryParams;
  }>('/errors', {
    preHandler: [requirePermission(Permission.AUDIT_VIEW)],
    schema: {
      tags: ['Analytics'],
      summary: 'Get error breakdown',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const breakdown = await analyticsService.getErrorBreakdown();

    return reply.send({
      breakdown,
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get('/health', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get analytics service health',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await analyticsService.getAggregatedMetrics();

    return reply.send({
      status: 'healthy',
      metrics: {
        totalRequests: metrics.totalRequests,
        errorRate: metrics.overallErrorRate.toFixed(2) + '%',
        avgResponseTime: metrics.averageResponseTime + 'ms',
      },
    });
  });

  fastify.delete<{
    Querystring: QueryParams;
  }>('/clear', {
    preHandler: [requirePermission(Permission.AUDIT_VIEW)],
    schema: {
      tags: ['Analytics'],
      summary: 'Clear all analytics data',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    await analyticsService.clearMetrics();

    return reply.send({
      statusCode: 200,
      message: 'Analytics data cleared successfully',
    });
  });
}
