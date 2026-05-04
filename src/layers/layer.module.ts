import { Module } from '@nestjs/common';
import { ExternalLayerClientService } from './external-layer-client.service.js';
import { LayerConfigService } from './layer-config.service.js';
import { LayerGateway } from './layer-gateway.js';
import { LayerPollerService } from './layer-poller.service.js';
import { LayerStoreService } from './layer-store.service.js';

@Module({
  providers: [
    LayerConfigService,
    ExternalLayerClientService,
    LayerStoreService,
    LayerPollerService,
    LayerGateway,
  ],
  exports: [LayerConfigService, LayerStoreService],
})
export class LayerModule {}
