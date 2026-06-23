import { Logger } from '@nestjs/common';
import { RedisClientService } from './redis-client.service.js';
import { LayerUpdateBus } from './layer-update-bus.service.js';

describe('LayerUpdateBus', () => {
  let redis: RedisClientService;
  let publishMock: jest.Mock;
  let subscribeMock: jest.Mock;
  let unsubscribeMock: jest.Mock;
  let onMock: jest.Mock;

  beforeEach(() => {
    publishMock = jest.fn().mockResolvedValue(1);
    subscribeMock = jest.fn().mockResolvedValue(1);
    unsubscribeMock = jest.fn().mockResolvedValue('OK');
    onMock = jest.fn();

    redis = {
      command: {
        publish: publishMock,
      },
      subscriber: {
        on: onMock,
        subscribe: subscribeMock,
        unsubscribe: unsubscribeMock,
      },
      subscriptionRetryDelayMs: 1000,
    } as unknown as RedisClientService;

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('publishes layer updates on the command client', async () => {
    const bus = new LayerUpdateBus(redis);
    const message = {
      layerId: 'roads',
      data: { ok: true },
      timestamp: '2026-06-23T00:00:00.000Z',
    };

    await bus.publishLayerUpdate('roads', message);

    expect(publishMock).toHaveBeenCalledWith(
      'layer:roads:updates',
      JSON.stringify(message),
    );
  });

  it('retries Redis Pub/Sub subscription failures in the background', async () => {
    jest.useFakeTimers();
    subscribeMock
      .mockRejectedValueOnce(new Error('Reached max retries per request'))
      .mockResolvedValueOnce(1);
    const bus = new LayerUpdateBus(redis);

    bus.subscribeToLayerUpdates(['roads'], jest.fn());
    await jest.advanceTimersByTimeAsync(0);

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledWith('layer:roads:updates');

    await jest.advanceTimersByTimeAsync(1000);

    expect(subscribeMock).toHaveBeenCalledTimes(2);
  });

  it('ignores duplicate subscription requests while a retry is pending', async () => {
    jest.useFakeTimers();
    subscribeMock.mockRejectedValue(new Error('Redis unavailable'));
    const bus = new LayerUpdateBus(redis);

    bus.subscribeToLayerUpdates(['roads'], jest.fn());
    bus.subscribeToLayerUpdates(['weather'], jest.fn());
    await jest.advanceTimersByTimeAsync(0);

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledWith('layer:roads:updates');
  });
});
