import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from './layers/config/config.service.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const bootstrapConfig = new ConfigService();
  const app = await NestFactory.create(AppModule, {
    logger: bootstrapConfig.getLogLevels(),
  });

  // Ensure NestJS lifecycle hooks (OnModuleDestroy, etc.) fire on
  // SIGTERM / SIGINT — critical for graceful shutdown in containers.
  app.enableShutdownHooks();

  const port = app.get(ConfigService).getPort();
  await app.listen(port);

  logger.log(`🚀 Real-Time Replicator listening on port ${port}`);
}

void bootstrap();
