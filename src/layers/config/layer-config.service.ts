import { Injectable } from '@nestjs/common';
import { LayerConfig } from '../types/layer.types.js';

/**
 * Provides layer configuration to the rest of the application.
 *
 * Currently loads from a hardcoded config array. In the future this
 * can be replaced with environment variables, a config file, or a
 * remote configuration service without changing the consumer API.
 */
@Injectable()
export class LayerConfigService {
  private readonly mockApiBaseUrl =
    process.env['MOCK_API_BASE_URL'] ?? 'http://localhost:4001';

  private readonly layers: LayerConfig[] = [
    {
      id: 'roads',
      url:
        process.env['LAYER_ROADS_URL'] ?? `${this.mockApiBaseUrl}/mock/roads`,
      intervalMs: 10000,
      enabled: true,
    },
    // {
    //   id: 'weather',
    //   url:
    //     process.env['LAYER_WEATHER_URL'] ??
    //     `${this.mockApiBaseUrl}/mock/weather`,
    //   intervalMs: 50000,
    //   enabled: true,
    // },
    // {
    //   id: 'vehicles',
    //   url:
    //     process.env['LAYER_VEHICLES_URL'] ??
    //     `${this.mockApiBaseUrl}/mock/vehicles`,
    //   intervalMs: 10000,
    //   enabled: true,
    // },
  ];

  /** Return all configured layers (enabled and disabled). */
  getLayers(): LayerConfig[] {
    return this.layers;
  }

  /** Return only layers that are actively enabled for polling. */
  getEnabledLayers(): LayerConfig[] {
    return this.layers.filter((l) => l.enabled);
  }

  /** Find a layer by its unique id, or undefined if not found. */
  getLayerById(id: string): LayerConfig | undefined {
    return this.layers.find((l) => l.id === id);
  }
}
