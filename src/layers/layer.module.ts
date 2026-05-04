import { Module } from '@nestjs/common';
import { ExternalLayerClientService } from './external-layer-client.service.js';
import { LayerConfigService } from './config/layer-config.service.js';
import { LayerGateway } from './layer-gateway.js';
import { LayerPollerService } from './layer-poller.service.js';
import { StoreService } from './store/store.service.js';

@Module({
  providers: [
    LayerConfigService,
    ExternalLayerClientService,
    StoreService,
    LayerPollerService,
    LayerGateway,
  ],
  exports: [LayerConfigService, StoreService],
})
export class LayerModule {}
