import { LayerConfig } from './layer.types.js';
export declare class LayerConfigService {
    private readonly mockApiBaseUrl;
    private readonly layers;
    getLayers(): LayerConfig[];
    getEnabledLayers(): LayerConfig[];
    getLayerById(id: string): LayerConfig | undefined;
}
