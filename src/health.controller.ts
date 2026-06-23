import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisClientService } from './layers/store/redis-client.service.js';

type HealthStatus = {
  status: 'ok';
};

type ReadinessStatus = {
  status: 'ok' | 'error';
  checks: {
    redis: 'ok' | 'error';
  };
};

@Controller('health')
export class HealthController {
  constructor(private readonly redis: RedisClientService) {}

  @Get('live')
  getLiveness(): HealthStatus {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessStatus> {
    try {
      await this.redis.ping();
      return {
        status: 'ok',
        checks: {
          redis: 'ok',
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          redis: 'error',
        },
      });
    }
  }
}
