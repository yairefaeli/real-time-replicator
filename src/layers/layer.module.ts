import { Module } from '@nestjs/common';
import { ExternalLayerClientService } from './external-layer-client.service.js';
import { ConfigService } from './config/config.service.js';
import { LayerGateway } from './layer-gateway.js';
import { LayerPollerService } from './layer-poller.service.js';
import { StoreService } from './store/store.service.js';

@Module({
  providers: [
    ConfigService,
    ExternalLayerClientService,
    StoreService,
    LayerPollerService,
    LayerGateway,
  ],
  exports: [ConfigService, StoreService],
})
export class LayerModule {}
