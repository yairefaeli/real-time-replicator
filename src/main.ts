import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Ensure NestJS lifecycle hooks (OnModuleDestroy, etc.) fire on
  // SIGTERM / SIGINT — critical for graceful shutdown in containers.
  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Real-Time Replicator listening on port ${port}`);
}

bootstrap();
