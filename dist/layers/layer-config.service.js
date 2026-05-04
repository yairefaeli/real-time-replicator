"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayerConfigService = void 0;
const common_1 = require("@nestjs/common");
let LayerConfigService = class LayerConfigService {
    mockApiBaseUrl = process.env['MOCK_API_BASE_URL'] ?? 'http://localhost:4001';
    layers = [
        {
            id: 'roads',
            url: process.env['LAYER_ROADS_URL'] ??
                `${this.mockApiBaseUrl}/mock/roads`,
            intervalMs: 60000,
            enabled: true,
        },
        {
            id: 'weather',
            url: process.env['LAYER_WEATHER_URL'] ??
                `${this.mockApiBaseUrl}/mock/weather`,
            intervalMs: 60000,
            enabled: true,
        },
        {
            id: 'vehicles',
            url: process.env['LAYER_VEHICLES_URL'] ??
                `${this.mockApiBaseUrl}/mock/vehicles`,
            intervalMs: 60000,
            enabled: true,
        },
    ];
    getLayers() {
        return this.layers;
    }
    getEnabledLayers() {
        return this.layers.filter((l) => l.enabled);
    }
    getLayerById(id) {
        return this.layers.find((l) => l.id === id);
    }
};
exports.LayerConfigService = LayerConfigService;
exports.LayerConfigService = LayerConfigService = __decorate([
    (0, common_1.Injectable)()
], LayerConfigService);
//# sourceMappingURL=layer-config.service.js.map