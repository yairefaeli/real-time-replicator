"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LayerPollerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerPollerService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const external_layer_client_service_js_1 = require("./external-layer-client.service.js");
const layer_hash_util_js_1 = require("./layer-hash.util.js");
const layer_config_service_js_1 = require("./layer-config.service.js");
const layer_store_service_js_1 = require("./layer-store.service.js");
function normalizeLayer(data) {
    return data;
}
let LayerPollerService = LayerPollerService_1 = class LayerPollerService {
    configService;
    externalClient;
    store;
    logger = new common_1.Logger(LayerPollerService_1.name);
    destroy$ = new rxjs_1.Subject();
    subscriptions = [];
    instanceId = (0, crypto_1.randomUUID)();
    constructor(configService, externalClient, store) {
        this.configService = configService;
        this.externalClient = externalClient;
        this.store = store;
    }
    onModuleInit() {
        this.logger.log(`Poller instance ID: ${this.instanceId}`);
        const enabledLayers = this.configService.getEnabledLayers();
        if (enabledLayers.length === 0) {
            this.logger.warn('No enabled layers configured — nothing to poll.');
            return;
        }
        for (const layer of enabledLayers) {
            this.startLayerPolling(layer);
        }
        this.logger.log(`Started polling for ${enabledLayers.length} layer(s): ${enabledLayers.map((l) => l.id).join(', ')}`);
    }
    onModuleDestroy() {
        this.logger.log('Shutting down layer pollers…');
        this.destroy$.next();
        this.destroy$.complete();
        this.subscriptions.forEach((s) => s.unsubscribe());
    }
    startLayerPolling(layer) {
        const lockTtlMs = layer.intervalMs * 2;
        const sub = (0, rxjs_1.timer)(0, layer.intervalMs)
            .pipe((0, operators_1.exhaustMap)(() => (0, rxjs_1.from)(this.pollLayer(layer, lockTtlMs)).pipe((0, operators_1.catchError)((err) => {
            this.logger.error(`Unhandled error in poll stream for "${layer.id}": ${err.message}`);
            return rxjs_1.EMPTY;
        }))), (0, operators_1.takeUntil)(this.destroy$))
            .subscribe();
        this.subscriptions.push(sub);
    }
    async pollLayer(layer, lockTtlMs) {
        try {
            const acquired = await this.store.tryAcquireOrRenewLayerLock(layer.id, this.instanceId, lockTtlMs);
            if (!acquired) {
                this.logger.debug(`Layer "${layer.id}" lock not acquired — another pod is handling this layer.`);
                return;
            }
            const rawData = await this.externalClient.fetchLayerData(layer.url);
            const normalized = normalizeLayer(rawData);
            const newHash = (0, layer_hash_util_js_1.computeLayerHash)(normalized);
            const existingHash = await this.store.getHash(layer.id);
            if (newHash === existingHash) {
                this.logger.debug?.(`Layer "${layer.id}" unchanged — skipping publish.`);
                return;
            }
            const now = new Date().toISOString();
            const snapshot = {
                layerId: layer.id,
                data: normalized,
                timestamp: now,
            };
            await this.store.setLatest(layer.id, snapshot);
            await this.store.setHash(layer.id, newHash);
            const message = {
                layerId: layer.id,
                data: normalized,
                timestamp: now,
            };
            await this.store.publishLayerUpdate(layer.id, message);
            this.logger.log(`Layer "${layer.id}" updated and published.`);
        }
        catch (error) {
            this.logger.error(`Error polling layer "${layer.id}": ${error.message}`);
        }
    }
};
exports.LayerPollerService = LayerPollerService;
exports.LayerPollerService = LayerPollerService = LayerPollerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [layer_config_service_js_1.LayerConfigService,
        external_layer_client_service_js_1.ExternalLayerClientService,
        layer_store_service_js_1.LayerStoreService])
], LayerPollerService);
//# sourceMappingURL=layer-poller.service.js.map