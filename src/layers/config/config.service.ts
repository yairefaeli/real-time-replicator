import { Injectable } from '@nestjs/common';
import { LayerConfig } from '../types/layer.types.js';

/**
 * Provides layer configuration to the rest of the application.
 */
@Injectable()
export class ConfigService {
  private readonly layers: LayerConfig[] = this.loadLayers();

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

  private loadLayers(): LayerConfig[] {
    const layersJson = process.env['LAYERS'];

    if (!layersJson) {
      return this.getDefaultLayers();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(layersJson);
    } catch (error) {
      throw new Error(
        `Invalid LAYERS environment variable: ${(error as Error).message}`,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        'Invalid LAYERS environment variable: expected an array.',
      );
    }

    return parsed.map((layer, index) => this.parseLayer(layer, index));
  }

  private parseLayer(layer: unknown, index: number): LayerConfig {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
      throw new Error(`Invalid LAYERS[${index}]: expected an object.`);
    }

    const rawLayer = layer as Record<string, unknown>;
    const id = rawLayer['id'];
    const intervalMs = rawLayer['intervalMs'];
    const enabled = rawLayer['enabled'];
    const changeDetection = rawLayer['changeDetection'];

    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(
        `Invalid LAYERS[${index}].id: expected a non-empty string.`,
      );
    }

    if (
      typeof intervalMs !== 'number' ||
      !Number.isFinite(intervalMs) ||
      intervalMs <= 0
    ) {
      throw new Error(
        `Invalid LAYERS[${index}].intervalMs: expected a positive number.`,
      );
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new Error(
        `Invalid LAYERS[${index}].enabled: expected a boolean when provided.`,
      );
    }

    if (changeDetection !== undefined && typeof changeDetection !== 'boolean') {
      throw new Error(
        `Invalid LAYERS[${index}].changeDetection: expected a boolean when provided.`,
      );
    }

    return {
      id,
      intervalMs,
      enabled: enabled ?? true,
      changeDetection: changeDetection ?? true,
    };
  }

  private getDefaultLayers(): LayerConfig[] {
    return [
      {
        id: 'roads',
        intervalMs: 10000,
        enabled: true,
        changeDetection: true,
      },
      {
        id: 'weather',
        intervalMs: 50000,
        enabled: true,
        changeDetection: true,
      },
      {
        id: 'vehicles',
        intervalMs: 10000,
        enabled: true,
        changeDetection: true,
      },
    ];
  }
}
