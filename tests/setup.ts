import { beforeAll, afterAll } from 'bun:test';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'test-bucket';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-minimum-32-characters';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '52428800';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.NODE_ID = process.env.NODE_ID || 'test-server';

beforeAll(() => {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
});

afterAll(() => {});
