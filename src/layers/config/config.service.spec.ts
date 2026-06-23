import { ConfigService } from './config.service.js';

describe('ConfigService', () => {
  const originalLayers = process.env['LAYERS'];

  afterEach(() => {
    if (originalLayers === undefined) {
      delete process.env['LAYERS'];
    } else {
      process.env['LAYERS'] = originalLayers;
    }
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

    expect(() => new ConfigService()).toThrow('Invalid LAYERS[0].retryCount');
  });
});
