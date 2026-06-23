import { Module } from '@nestjs/common';
import { ConfigService } from './config/config.service.js';
import {
  LAYER_DATA_FETCHERS,
  LayerDataFetcher,
} from './fetchers/layer-data-fetcher.interface.js';
import { LayerDataFetcherRegistry } from './fetchers/layer-data-fetcher.registry.js';
import { RoadsLayerFetcherService } from './fetchers/roads-layer-fetcher.service.js';
import { VehiclesLayerFetcherService } from './fetchers/vehicles-layer-fetcher.service.js';
import { WeatherLayerFetcherService } from './fetchers/weather-layer-fetcher.service.js';
import { LayerGateway } from './layer-gateway.js';
import { LayerPollerService } from './layer-poller.service.js';
import { LayerLockStore } from './store/layer-lock.store.js';
import { LayerSnapshotStore } from './store/layer-snapshot.store.js';
import { LayerUpdateBus } from './store/layer-update-bus.service.js';
import { RedisClientService } from './store/redis-client.service.js';

@Module({
  providers: [
    ConfigService,
    RoadsLayerFetcherService,
    WeatherLayerFetcherService,
    VehiclesLayerFetcherService,
    {
      provide: LAYER_DATA_FETCHERS,
      useFactory: (
        roadsLayerFetcher: RoadsLayerFetcherService,
        weatherLayerFetcher: WeatherLayerFetcherService,
        vehiclesLayerFetcher: VehiclesLayerFetcherService,
      ): LayerDataFetcher[] => [
        roadsLayerFetcher,
        weatherLayerFetcher,
        vehiclesLayerFetcher,
      ],
      inject: [
        RoadsLayerFetcherService,
        WeatherLayerFetcherService,
        VehiclesLayerFetcherService,
      ],
    },
    LayerDataFetcherRegistry,
    RedisClientService,
    LayerSnapshotStore,
    LayerLockStore,
    LayerUpdateBus,
    LayerPollerService,
    LayerGateway,
  ],
  exports: [ConfigService, RedisClientService],
})
export class LayerModule {}
