import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { ConfigService, RedisConfig } from '../config/config.service.js';

/**
 * Owns the physical Redis clients used by the layer subsystem.
 *
 * Redis Pub/Sub needs its own connection once SUBSCRIBE is called, so the app
 * keeps one command client and one dedicated subscriber client per process.
 */
@Injectable()
export class RedisClientService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClientService.name);
  readonly command: Redis;
  readonly subscriber: Redis;
  readonly subscriptionRetryDelayMs: number;

  constructor(configService: ConfigService) {
    const redisConfig = configService.getRedisConfig();
    const redisOptions = this.createRedisOptions(redisConfig);
    this.subscriptionRetryDelayMs = redisConfig.maxRetryDelayMs;

    this.command = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);

    this.command.on('error', (err) =>
      this.logger.error(`Redis command client error: ${err.message}`),
    );
    this.subscriber.on('error', (err) =>
      this.logger.error(`Redis subscriber client error: ${err.message}`),
    );
  }

  async ping(): Promise<void> {
    await this.command.ping();
  }

  onModuleDestroy(): void {
    this.logger.log('Disconnecting Redis clients...');
    this.subscriber.disconnect(false);
    this.command.disconnect(false);
  }

  private createRedisOptions(config: RedisConfig): RedisOptions {
    return {
      host: config.host,
      port: config.port,
      lazyConnect: false,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      retryStrategy: (times) =>
        Math.min(config.retryDelayMs * times, config.maxRetryDelayMs),
    };
  }
}
