"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerModule = void 0;
const common_1 = require("@nestjs/common");
const external_layer_client_service_js_1 = require("./external-layer-client.service.js");
const layer_config_service_js_1 = require("./layer-config.service.js");
const layer_gateway_js_1 = require("./layer-gateway.js");
const layer_poller_service_js_1 = require("./layer-poller.service.js");
const layer_store_service_js_1 = require("./layer-store.service.js");
let LayerModule = class LayerModule {
};
exports.LayerModule = LayerModule;
exports.LayerModule = LayerModule = __decorate([
    (0, common_1.Module)({
        providers: [
            layer_config_service_js_1.LayerConfigService,
            external_layer_client_service_js_1.ExternalLayerClientService,
            layer_store_service_js_1.LayerStoreService,
            layer_poller_service_js_1.LayerPollerService,
            layer_gateway_js_1.LayerGateway,
        ],
        exports: [layer_config_service_js_1.LayerConfigService, layer_store_service_js_1.LayerStoreService],
    })
], LayerModule);
//# sourceMappingURL=layer.module.js.map