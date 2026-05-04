"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var ExternalLayerClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalLayerClientService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importStar(require("axios"));
const DEFAULT_TIMEOUT_MS = 10_000;
let ExternalLayerClientService = ExternalLayerClientService_1 = class ExternalLayerClientService {
    logger = new common_1.Logger(ExternalLayerClientService_1.name);
    async fetchLayerData(url) {
        try {
            const response = await axios_1.default.get(url, {
                timeout: DEFAULT_TIMEOUT_MS,
            });
            return response.data;
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                const status = error.response?.status ?? 'N/A';
                const message = `Failed to fetch layer data from ${url} — HTTP ${status}: ${error.message}`;
                this.logger.error(message);
                throw new Error(message);
            }
            throw error;
        }
    }
};
exports.ExternalLayerClientService = ExternalLayerClientService;
exports.ExternalLayerClientService = ExternalLayerClientService = ExternalLayerClientService_1 = __decorate([
    (0, common_1.Injectable)()
], ExternalLayerClientService);
//# sourceMappingURL=external-layer-client.service.js.map