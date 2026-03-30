import { config } from 'dotenv';

const env = process.env.NODE_ENV || 'production';

config({ path: '.env' });

if (env === 'development') {
  config({ path: '.env.development', override: true });
}

import { buildApp } from './config/app';
import { logger } from './utils/logger';

const start = async () => {
  try {
    const app = await buildApp();

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    const isDevelopment = process.env.NODE_ENV === 'development';

    logger.info(`Server running at http://${host}:${port}`);
    
    if (isDevelopment) {
      logger.info(`API Documentation: http://localhost:${port}/docs`);
      logger.info('Development mode active');
    } else {
      logger.info('Production mode active');
    }
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

start();
