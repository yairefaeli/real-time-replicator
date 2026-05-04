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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LayerGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const layer_config_service_js_1 = require("./layer-config.service.js");
const layer_store_service_js_1 = require("./layer-store.service.js");
let LayerGateway = LayerGateway_1 = class LayerGateway {
    configService;
    store;
    logger = new common_1.Logger(LayerGateway_1.name);
    server;
    constructor(configService, store) {
        this.configService = configService;
        this.store = store;
    }
    async onModuleInit() {
        const enabledLayers = this.configService.getEnabledLayers();
        const layerIds = enabledLayers.map((l) => l.id);
        if (layerIds.length === 0) {
            this.logger.warn('No enabled layers — skipping Redis Pub/Sub subscription.');
            return;
        }
        await this.store.subscribeToLayerUpdates(layerIds, (message) => this.onLayerUpdate(message));
        this.logger.log(`Gateway listening for updates on ${layerIds.length} layer(s).`);
    }
    async handleSubscribe(payload, client) {
        if (!payload ||
            typeof payload !== 'object' ||
            !('layerId' in payload) ||
            typeof payload['layerId'] !== 'string') {
            client.emit('layer.error', {
                layerId: null,
                message: 'Invalid payload: expected { layerId: string }.',
            });
            return;
        }
        const { layerId } = payload;
        const layer = this.configService.getLayerById(layerId);
        if (!layer) {
            client.emit('layer.error', {
                layerId,
                message: `Unknown layer: "${layerId}"`,
            });
            return;
        }
        const room = `layer:${layerId}`;
        await client.join(room);
        this.logger.debug?.(`Client ${client.id} joined room ${room}`);
        try {
            const snapshot = await this.store.getLatest(layerId);
            if (snapshot) {
                client.emit('layer.snapshot', snapshot);
            }
        }
        catch (error) {
            this.logger.error(`Failed to fetch latest snapshot for "${layerId}": ${error.message}`);
            client.emit('layer.error', {
                layerId,
                message: 'Failed to retrieve latest snapshot.',
            });
        }
    }
    async handleUnsubscribe(payload, client) {
        if (!payload ||
            typeof payload !== 'object' ||
            !('layerId' in payload) ||
            typeof payload['layerId'] !== 'string') {
            client.emit('layer.error', {
                layerId: null,
                message: 'Invalid payload: expected { layerId: string }.',
            });
            return;
        }
        const { layerId } = payload;
        const room = `layer:${layerId}`;
        await client.leave(room);
        this.logger.debug?.(`Client ${client.id} left room ${room}`);
    }
    onLayerUpdate(message) {
        const room = `layer:${message.layerId}`;
        this.server.to(room).emit('layer.updated', message);
        this.logger.debug?.(`Broadcast layer.updated to room ${room}`);
    }
};
exports.LayerGateway = LayerGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], LayerGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('layer.subscribe'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], LayerGateway.prototype, "handleSubscribe", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('layer.unsubscribe'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], LayerGateway.prototype, "handleUnsubscribe", null);
exports.LayerGateway = LayerGateway = LayerGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [layer_config_service_js_1.LayerConfigService,
        layer_store_service_js_1.LayerStoreService])
], LayerGateway);
//# sourceMappingURL=layer-gateway.js.map