import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { StoreService } from './layers/store/store.service.js';

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
  constructor(private readonly store: StoreService) {}

  @Get('live')
  getLiveness(): HealthStatus {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessStatus> {
    try {
      await this.store.ping();
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
