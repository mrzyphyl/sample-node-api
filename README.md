# File Storage & Conversion API

A scalable file storage webapp with PDF/image to Word conversion built with Fastify, Bun, Prisma, Supabase, and BullMQ.

## Features

- **File Storage**: Supabase Storage for uploads/downloads
- **Conversions**: PDF to Word (.docx) and Image to Word (.docx) with download endpoint
- **Authentication**: JWT with refresh tokens and RBAC
- **Role Management**: Admin endpoints for user role assignment
- **Caching**: Redis with local memory fallback
- **Queue**: BullMQ for async conversion jobs
- **Logging**: Pino structured logging
- **Analytics**: Per-endpoint metrics (response times, error rates)
- **Error Handling**: Global handler with custom error messages
- **API Docs**: Scalar interactive documentation
- **Docker**: Ready for deployment

## Tech Stack

- **Runtime**: Bun
- **Framework**: Fastify + TypeScript
- **ORM**: Prisma
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Cache/Queue**: Redis + BullMQ
- **Docx Generation**: docx

## Quick Start

### Prerequisites

- [Supabase](https://supabase.com) account (free tier)
- Bun runtime
- Redis

### Setup

```bash
# Install dependencies
bun install

# Configure environment
cp example .env
cp .env.development .env  # For development

# Edit .env with your Supabase credentials:
# DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET

# Initialize database
bun prisma generate
bun prisma migrate dev

# Create storage bucket in Supabase Dashboard > Storage
```

### Run

```bash
# Development
bun run dev

# Production
bun run build && bun run start
```

## Environment Variables

```env
# Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_BUCKET=files

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=15m

# App
NODE_ENV=development|production
LOG_LEVEL=debug|info|warn
ENABLE_DOCS=true|false
```

### Environment Load Order

1. `.env` always loaded (production defaults)
2. `.env.development` loaded if `NODE_ENV=development` (overrides .env)

## Project Structure

```
src/
├── config/app.ts          # App configuration
├── enums/                 # TypeScript enums (Role, Permission)
├── plugins/               # Fastify plugins (prisma, redis, queue, supabase, auth, docs)
├── routes/                # API endpoints
├── services/              # Business logic
├── middleware/            # Auth, RBAC, error handling, analytics
├── errors/                # Custom error classes
├── utils/                 # Helpers, logger
└── workers/               # Background workers (conversion)
```

## RBAC Roles

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | All permissions |
| ADMIN | User/file management, conversions, role management |
| EDITOR | File operations, conversions |
| USER | Basic file ops, basic conversion |
| GUEST | Read-only access |

## API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh token |
| POST | `/api/v1/auth/logout` | Logout |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users/me` | User | Get current user profile |
| PUT | `/api/v1/users/me` | User | Update profile |
| PUT | `/api/v1/users/password` | User | Change password |
| DELETE | `/api/v1/users/me` | User | Delete account |
| GET | `/api/v1/users/roles` | Admin | List all users |
| GET | `/api/v1/users/roles/:userId` | Admin | Get user by ID |
| PUT | `/api/v1/users/roles/:userId` | Admin | Update user role |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/files` | Upload file |
| GET | `/api/v1/files` | List files |
| GET | `/api/v1/files/:id` | Get file |
| DELETE | `/api/v1/files/:id` | Delete file |
| GET | `/api/v1/files/:id/download` | Download file |

### Folders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/folders` | Create folder |
| GET | `/api/v1/folders` | List folders |
| GET | `/api/v1/folders/:id` | Get folder |
| DELETE | `/api/v1/folders/:id` | Delete folder |

### Conversions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/conversions/pdf-to-word` | Queue PDF conversion |
| POST | `/api/v1/conversions/image-to-word` | Queue image conversion |
| GET | `/api/v1/conversions` | List conversion jobs |
| GET | `/api/v1/conversions/:jobId` | Get job status |
| GET | `/api/v1/conversions/:jobId/download` | Download converted .docx |

### Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/analytics/summary` | Admin | Aggregated metrics |
| GET | `/api/v1/analytics/endpoints` | Admin | Per-endpoint metrics |
| GET | `/api/v1/analytics/timeseries` | Admin | Request trends |
| GET | `/api/v1/analytics/errors` | Admin | Error breakdown |

### Docs

- `GET /docs` - Scalar API documentation
- `GET /openapi.json` - OpenAPI spec

## Testing

```bash
bun test              # Run all tests
bun test --coverage   # With coverage
```

## Docker

```bash
bun run docker:build
bun run docker:up
bun run docker:down
bun run docker:logs
```

## License

MIT
