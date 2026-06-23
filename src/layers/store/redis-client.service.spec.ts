import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../config/config.service.js';
import { RedisClientService } from './redis-client.service.js';

const mockRedisInstances: Array<{
  disconnect: jest.Mock;
  on: jest.Mock;
  ping: jest.Mock;
}> = [];

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    const instance = {
      disconnect: jest.fn(),
      on: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    mockRedisInstances.push(instance);
    return instance;
  }),
}));

describe('RedisClientService', () => {
  const redisMock = Redis as unknown as jest.Mock;

  beforeEach(() => {
    redisMock.mockClear();
    mockRedisInstances.length = 0;
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('configures Redis connection retries for command and subscriber clients', () => {
    new RedisClientService(createConfigService());

    expect(redisMock).toHaveBeenCalledTimes(2);

    const [options] = redisMock.mock.calls[0] as [
      {
        host: string;
        port: number;
        lazyConnect: boolean;
        maxRetriesPerRequest: number;
        retryStrategy: (times: number) => number;
      },
    ];

    expect(options).toMatchObject({
      host: 'redis.internal',
      port: 6380,
      lazyConnect: false,
      maxRetriesPerRequest: 5,
    });
    expect(options.retryStrategy(1)).toBe(250);
    expect(options.retryStrategy(4)).toBe(1000);
    expect(options.retryStrategy(99)).toBe(1000);

    const [subscriberOptions] = redisMock.mock.calls[1] as [
      {
        host: string;
        port: number;
        lazyConnect: boolean;
        maxRetriesPerRequest: number;
      },
    ];

    expect(subscriberOptions).toMatchObject({
      host: 'redis.internal',
      port: 6380,
      lazyConnect: false,
      maxRetriesPerRequest: 5,
    });
  });

  it('pings through the command client', async () => {
    const redis = new RedisClientService(createConfigService());

    await redis.ping();

    expect(mockRedisInstances[0].ping).toHaveBeenCalledTimes(1);
  });

  it('force-closes both Redis clients during shutdown', () => {
    const redis = new RedisClientService(createConfigService());

    redis.onModuleDestroy();

    expect(mockRedisInstances[0].disconnect).toHaveBeenCalledWith(false);
    expect(mockRedisInstances[1].disconnect).toHaveBeenCalledWith(false);
  });

  function createConfigService(): ConfigService {
    return {
      getRedisConfig: jest.fn(() => ({
        host: 'redis.internal',
        port: 6380,
        retryDelayMs: 250,
        maxRetryDelayMs: 1000,
        maxRetriesPerRequest: 5,
      })),
    } as unknown as ConfigService;
  }
});
