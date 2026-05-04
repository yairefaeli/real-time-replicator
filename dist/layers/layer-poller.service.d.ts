import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ExternalLayerClientService } from './external-layer-client.service.js';
import { LayerConfigService } from './layer-config.service.js';
import { LayerStoreService } from './layer-store.service.js';
export declare class LayerPollerService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly externalClient;
    private readonly store;
    private readonly logger;
    private readonly destroy$;
    private readonly subscriptions;
    private readonly instanceId;
    constructor(configService: LayerConfigService, externalClient: ExternalLayerClientService, store: LayerStoreService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private startLayerPolling;
    private pollLayer;
}
