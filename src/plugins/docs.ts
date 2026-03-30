import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';

const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'File Storage & Conversion API',
    description: 'A scalable file storage API with PDF/Image to Word conversion capabilities',
    version: '1.0.0',
    contact: {
      name: 'API Support',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Users', description: 'User management endpoints' },
    { name: 'Files', description: 'File management endpoints' },
    { name: 'Folders', description: 'Folder management endpoints' },
    { name: 'Conversions', description: 'File conversion endpoints' },
    { name: 'Analytics', description: 'Analytics and monitoring endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' },
          path: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'USER', 'GUEST'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'integer' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
        response: {
          201: { type: 'object' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: { $ref: '#/components/schemas/TokenResponse' },
        },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: '#/components/schemas/User' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update current user profile',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
        response: {
          200: { $ref: '#/components/schemas/User' },
        },
      },
    },
    '/api/v1/files': {
      get: {
        tags: ['Files'],
        summary: 'List user files',
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: '#/components/schemas/PaginatedResponse' },
        },
      },
      post: {
        tags: ['Files'],
        summary: 'Upload a file',
        security: [{ bearerAuth: [] }],
        response: {
          201: { type: 'object' },
        },
      },
    },
    '/api/v1/files/{id}': {
      get: {
        tags: ['Files'],
        summary: 'Get file by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
      delete: {
        tags: ['Files'],
        summary: 'Delete a file',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    '/api/v1/folders': {
      get: {
        tags: ['Folders'],
        summary: 'List folders',
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: '#/components/schemas/PaginatedResponse' },
        },
      },
      post: {
        tags: ['Folders'],
        summary: 'Create a folder',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            parentId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          201: { type: 'object' },
        },
      },
    },
    '/api/v1/folders/{id}': {
      get: {
        tags: ['Folders'],
        summary: 'Get folder by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
      delete: {
        tags: ['Folders'],
        summary: 'Delete a folder',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    '/api/v1/conversions/pdf-to-word': {
      post: {
        tags: ['Conversions'],
        summary: 'Convert PDF to Word',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileId'],
          properties: {
            fileId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          202: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    '/api/v1/conversions/image-to-word': {
      post: {
        tags: ['Conversions'],
        summary: 'Convert Image to Word',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileId'],
          properties: {
            fileId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          202: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    '/api/v1/conversions/{jobId}': {
      get: {
        tags: ['Conversions'],
        summary: 'Get conversion job status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: { type: 'object' },
        },
      },
    },
    '/api/v1/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Get aggregated analytics summary',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              totalRequests: { type: 'integer' },
              totalErrors: { type: 'integer' },
              overallErrorRate: { type: 'number' },
              averageResponseTime: { type: 'integer' },
            },
          },
        },
      },
    },
    '/api/v1/analytics/endpoints': {
      get: {
        tags: ['Analytics'],
        summary: 'Get metrics for all endpoints',
        security: [{ bearerAuth: [] }],
        response: {
          200: { type: 'object' },
        },
      },
    },
  },
};

export async function docsPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: openApiDocument,
    hideUntagged: true,
  });

  await fastify.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      title: 'File Storage & Conversion API',
      theme: 'purple',
      showSidebar: true,
      defaultOpenAllTags: false,
      hideModels: false,
      hideDownloadButton: false,
      hideImportButton: false,
      searchHotKey: 'k',
      metaData: {
        description: 'API documentation for File Storage & Conversion API',
      },
    },
  });

  fastify.get('/openapi.json', async () => openApiDocument);
}

export default fp(docsPlugin, {
  name: 'docs',
});
