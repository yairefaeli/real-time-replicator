import { Logger } from '@nestjs/common';
import { ConfigService } from './config/config.service.js';
import { LayerDataFetcher } from './fetchers/layer-data-fetcher.interface.js';
import { LayerDataFetcherRegistry } from './fetchers/layer-data-fetcher.registry.js';
import { LayerPollerService } from './layer-poller.service.js';
import { LayerLockStore } from './store/layer-lock.store.js';
import { LayerSnapshotStore } from './store/layer-snapshot.store.js';
import { LayerUpdateBus } from './store/layer-update-bus.service.js';
import { LayerConfig } from './types/layer.types.js';

describe('LayerPollerService', () => {
  const layer: LayerConfig = {
    id: 'roads',
    intervalMs: 10000,
    enabled: true,
    changeDetection: false,
    retryCount: 2,
    retryIntervalMs: 100,
  };

  let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    jest.useFakeTimers();
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries failed fetches, waits between attempts, and logs each failure', async () => {
    const fetchLayerDataMock: jest.MockedFunction<
      LayerDataFetcher['fetchLayerData']
    > = jest
      .fn()
      .mockRejectedValueOnce(new Error('upstream unavailable'))
      .mockRejectedValueOnce(new Error('gateway timeout'))
      .mockResolvedValueOnce({ ok: true });
    const publishLayerUpdateMock: jest.MockedFunction<
      LayerUpdateBus['publishLayerUpdate']
    > = jest.fn().mockResolvedValue(undefined);

    const poller = createPoller(fetchLayerDataMock, publishLayerUpdateMock);

    poller.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(layer.retryIntervalMs);
    await jest.advanceTimersByTimeAsync(layer.retryIntervalMs);

    expect(fetchLayerDataMock).toHaveBeenCalledTimes(3);
    expect(publishLayerUpdateMock).toHaveBeenCalledTimes(1);
    expect(getFetchFailureLogs()).toEqual([
      'Failed to fetch layer "roads" on attempt 1/3: upstream unavailable',
      'Failed to fetch layer "roads" on attempt 2/3: gateway timeout',
    ]);

    poller.onModuleDestroy();
  });

  it('stops retrying after all retry attempts fail', async () => {
    const fetchLayerDataMock: jest.MockedFunction<
      LayerDataFetcher['fetchLayerData']
    > = jest.fn().mockRejectedValue(new Error('still down'));
    const publishLayerUpdateMock: jest.MockedFunction<
      LayerUpdateBus['publishLayerUpdate']
    > = jest.fn().mockResolvedValue(undefined);

    const poller = createPoller(fetchLayerDataMock, publishLayerUpdateMock);

    poller.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(layer.retryIntervalMs);
    await jest.advanceTimersByTimeAsync(layer.retryIntervalMs);

    expect(fetchLayerDataMock).toHaveBeenCalledTimes(3);
    expect(publishLayerUpdateMock).not.toHaveBeenCalled();
    expect(getFetchFailureLogs()).toEqual([
      'Failed to fetch layer "roads" on attempt 1/3: still down',
      'Failed to fetch layer "roads" on attempt 2/3: still down',
      'Failed to fetch layer "roads" on attempt 3/3: still down',
    ]);

    poller.onModuleDestroy();
  });

  function createPoller(
    fetchLayerDataMock: jest.MockedFunction<LayerDataFetcher['fetchLayerData']>,
    publishLayerUpdateMock: jest.MockedFunction<
      LayerUpdateBus['publishLayerUpdate']
    >,
  ): LayerPollerService {
    const fetcher: LayerDataFetcher = {
      layerId: 'roads',
      fetchLayerData: fetchLayerDataMock,
    };
    const configService = {
      getEnabledLayers: jest.fn(() => [layer]),
    } as unknown as ConfigService;
    const layerDataFetchers = {
      getFetcher: jest.fn(() => fetcher),
    } as unknown as LayerDataFetcherRegistry;
    const locks = {
      tryAcquireOrRenewLayerLock: jest.fn().mockResolvedValue(true),
    } as unknown as LayerLockStore;
    const snapshots = {
      setLatest: jest.fn().mockResolvedValue(undefined),
      getHash: jest.fn().mockResolvedValue(null),
      setHash: jest.fn().mockResolvedValue(undefined),
    } as unknown as LayerSnapshotStore;
    const updates = {
      publishLayerUpdate: publishLayerUpdateMock,
    } as unknown as LayerUpdateBus;

    return new LayerPollerService(
      configService,
      layerDataFetchers,
      locks,
      snapshots,
      updates,
    );
  }

  function getFetchFailureLogs(): string[] {
    return loggerErrorSpy.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.startsWith('Failed to fetch layer'));
  }
});
