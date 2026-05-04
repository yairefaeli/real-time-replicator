import { OnModuleInit } from '@nestjs/common';
import { Socket } from 'socket.io';
import { LayerConfigService } from './layer-config.service.js';
import { LayerStoreService } from './layer-store.service.js';
export declare class LayerGateway implements OnModuleInit {
    private readonly configService;
    private readonly store;
    private readonly logger;
    private server;
    constructor(configService: LayerConfigService, store: LayerStoreService);
    onModuleInit(): Promise<void>;
    handleSubscribe(payload: unknown, client: Socket): Promise<void>;
    handleUnsubscribe(payload: unknown, client: Socket): Promise<void>;
    private onLayerUpdate;
}
