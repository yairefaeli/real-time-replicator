import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { RedisClientService } from './../src/layers/store/redis-client.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  const originalLayers = process.env['LAYERS'];
  const redisClientService = {
    ping: jest.fn<Promise<void>, []>(),
  };

  beforeEach(async () => {
    process.env['LAYERS'] = JSON.stringify([
      {
        id: 'roads',
        intervalMs: 10000,
        enabled: false,
      },
    ]);
    redisClientService.ping.mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisClientService)
      .useValue(redisClientService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();

    if (originalLayers === undefined) {
      delete process.env['LAYERS'];
    } else {
      process.env['LAYERS'] = originalLayers;
    }
  });

  it('/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'ok',
        checks: {
          redis: 'ok',
        },
      });
  });

  it('/health/ready (GET) returns unavailable when Redis cannot be reached', () => {
    redisClientService.ping.mockRejectedValueOnce(
      new Error('Redis unavailable'),
    );

    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({
        status: 'error',
        checks: {
          redis: 'error',
        },
      });
  });
});
