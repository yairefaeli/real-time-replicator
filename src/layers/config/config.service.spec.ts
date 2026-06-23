import { ConfigService } from './config.service.js';

describe('ConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('applies default retry settings when they are not configured', () => {
    process.env['LAYERS'] = JSON.stringify([
      {
        id: 'roads',
        intervalMs: 10000,
      },
    ]);

    const [layer] = new ConfigService().getLayers();

    expect(layer).toMatchObject({
      retryCount: 3,
      retryIntervalMs: 3000,
    });
  });

  it('parses configured retry settings', () => {
    process.env['LAYERS'] = JSON.stringify([
      {
        id: 'roads',
        intervalMs: 10000,
        retryCount: 5,
        retryIntervalMs: 1500,
      },
    ]);

    const [layer] = new ConfigService().getLayers();

    expect(layer).toMatchObject({
      retryCount: 5,
      retryIntervalMs: 1500,
    });
  });

  it('rejects invalid retry settings', () => {
    process.env['LAYERS'] = JSON.stringify([
      {
        id: 'roads',
        intervalMs: 10000,
        retryCount: -1,
      },
    ]);

    expect(() => new ConfigService().getLayers()).toThrow(
      'Invalid LAYERS[0].retryCount',
    );
  });

  it('provides Redis defaults', () => {
    expect(new ConfigService().getRedisConfig()).toEqual({
      host: '127.0.0.1',
      port: 6379,
    });
  });

  it('parses Redis config', () => {
    process.env['REDIS_HOST'] = 'redis.internal';
    process.env['REDIS_PORT'] = '6380';

    expect(new ConfigService().getRedisConfig()).toEqual({
      host: 'redis.internal',
      port: 6380,
    });
  });

  it('rejects invalid Redis port', () => {
    process.env['REDIS_PORT'] = '6379abc';

    expect(() => new ConfigService().getRedisConfig()).toThrow(
      'Invalid REDIS_PORT environment variable',
    );
  });

  it('provides default fetcher config', () => {
    const configService = new ConfigService();

    expect(configService.getRoadsLayerFetcherConfig()).toEqual({
      url: 'http://localhost:4001/mock/roads',
      apiKey: undefined,
    });
    expect(configService.getVehiclesLayerFetcherConfig()).toEqual({
      url: 'http://localhost:4001/mock/vehicles',
      apiKey: undefined,
    });
    expect(configService.getWeatherLayerFetcherConfig()).toEqual({
      url: 'http://localhost:4001/graphql',
      apiKey: undefined,
      stable: false,
    });
  });

  it('parses fetcher overrides', () => {
    process.env['MOCK_API_BASE_URL'] = 'http://mock-api:4001';
    process.env['LAYER_ROADS_API_KEY'] = 'roads-key';
    process.env['LAYER_VEHICLES_URL'] = 'http://external/vehicles';
    process.env['LAYER_WEATHER_STABLE'] = 'true';

    const configService = new ConfigService();

    expect(configService.getRoadsLayerFetcherConfig()).toEqual({
      url: 'http://mock-api:4001/mock/roads',
      apiKey: 'roads-key',
    });
    expect(configService.getVehiclesLayerFetcherConfig()).toEqual({
      url: 'http://external/vehicles',
      apiKey: undefined,
    });
    expect(configService.getWeatherLayerFetcherConfig()).toMatchObject({
      stable: true,
    });
  });

  it('parses app port and log levels', () => {
    process.env['PORT'] = '3001';
    process.env['LOG_LEVELS'] = 'error,warn';

    const configService = new ConfigService();

    expect(configService.getPort()).toBe(3001);
    expect(configService.getLogLevels()).toEqual(['error', 'warn']);
  });

  it('rejects invalid log levels', () => {
    process.env['LOG_LEVELS'] = 'debug,nope';

    expect(() => new ConfigService().getLogLevels()).toThrow(
      'Invalid LOG_LEVELS value "nope"',
    );
  });
});
