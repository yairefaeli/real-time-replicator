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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LayerStoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerStoreService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let LayerStoreService = LayerStoreService_1 = class LayerStoreService {
    logger = new common_1.Logger(LayerStoreService_1.name);
    redis;
    redisSub;
    isSubscribed = false;
    constructor() {
        const host = process.env['REDIS_HOST'] ?? '127.0.0.1';
        const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);
        this.redis = new ioredis_1.default({ host, port, lazyConnect: false });
        this.redisSub = new ioredis_1.default({ host, port, lazyConnect: false });
        this.redis.on('error', (err) => this.logger.error(`Redis command client error: ${err.message}`));
        this.redisSub.on('error', (err) => this.logger.error(`Redis subscriber client error: ${err.message}`));
    }
    async getLatest(layerId) {
        const raw = await this.redis.get(`layer:${layerId}:latest`);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    async setLatest(layerId, snapshot) {
        await this.redis.set(`layer:${layerId}:latest`, JSON.stringify(snapshot));
    }
    async getHash(layerId) {
        return this.redis.get(`layer:${layerId}:hash`);
    }
    async setHash(layerId, hash) {
        await this.redis.set(`layer:${layerId}:hash`, hash);
    }
    async tryAcquireLayerLock(layerId, instanceId, ttlMs) {
        const result = await this.redis.set(`layer:${layerId}:lock`, instanceId, 'PX', ttlMs, 'NX');
        return result === 'OK';
    }
    async publishLayerUpdate(layerId, message) {
        await this.redis.publish(`layer:${layerId}:updates`, JSON.stringify(message));
    }
    async subscribeToLayerUpdates(layerIds, handler) {
        if (layerIds.length === 0)
            return;
        if (this.isSubscribed) {
            this.logger.warn('subscribeToLayerUpdates called multiple times — ignoring duplicate call.');
            return;
        }
        this.isSubscribed = true;
        const channels = layerIds.map((id) => `layer:${id}:updates`);
        this.redisSub.on('message', (_channel, raw) => {
            try {
                const parsed = JSON.parse(raw);
                handler(parsed);
            }
            catch (err) {
                this.logger.error(`Failed to parse layer update message: ${err.message}`);
            }
        });
        await this.redisSub.subscribe(...channels);
        this.logger.log(`Subscribed to Redis channels: ${channels.join(', ')}`);
    }
    async onModuleDestroy() {
        this.logger.log('Disconnecting Redis clients…');
        if (this.isSubscribed) {
            try {
                await this.redisSub.unsubscribe();
            }
            catch {
            }
        }
        await this.redisSub.quit();
        await this.redis.quit();
    }
};
exports.LayerStoreService = LayerStoreService;
exports.LayerStoreService = LayerStoreService = LayerStoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LayerStoreService);
//# sourceMappingURL=layer-store.service.js.map