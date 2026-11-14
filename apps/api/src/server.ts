import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { seedDatabase } from './config/seed.js';

async function bootstrap() {
  if (env.NODE_ENV === 'development') {
    await seedDatabase();
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Sure REST API v1 listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start Sure API', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
