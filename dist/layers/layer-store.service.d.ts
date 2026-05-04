import { OnModuleDestroy } from '@nestjs/common';
import { LayerSnapshot, LayerUpdateMessage } from './layer.types.js';
export declare class LayerStoreService implements OnModuleDestroy {
    private readonly logger;
    private readonly redis;
    private readonly redisSub;
    private isSubscribed;
    constructor();
    getLatest(layerId: string): Promise<LayerSnapshot | null>;
    setLatest(layerId: string, snapshot: LayerSnapshot): Promise<void>;
    getHash(layerId: string): Promise<string | null>;
    setHash(layerId: string, hash: string): Promise<void>;
    tryAcquireLayerLock(layerId: string, instanceId: string, ttlMs: number): Promise<boolean>;
    publishLayerUpdate(layerId: string, message: LayerUpdateMessage): Promise<void>;
    subscribeToLayerUpdates(layerIds: string[], handler: (message: LayerUpdateMessage) => void): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
