import { Injectable } from '@nestjs/common';
import { LogLevel } from '@nestjs/common/services/logger.service.js';
import { LayerConfig } from '../types/layer.types.js';

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_INTERVAL_MS = 3000;
const DEFAULT_REDIS_HOST = '127.0.0.1';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_RETRY_DELAY_MS = 500;
const DEFAULT_REDIS_MAX_RETRY_DELAY_MS = 60_000;
const DEFAULT_REDIS_MAX_RETRIES_PER_REQUEST = 3;
const DEFAULT_PORT = 3000;
const DEFAULT_MOCK_API_BASE_URL = 'http://localhost:4001';
const DEFAULT_LOG_LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug'];
const LOG_LEVELS: readonly LogLevel[] = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
  'fatal',
];

export interface RedisConfig {
  host: string;
  port: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  maxRetriesPerRequest: number;
}

export interface LayerFetcherConfig {
  url: string;
  apiKey?: string;
}

export interface WeatherLayerFetcherConfig extends LayerFetcherConfig {
  stable: boolean;
}

/**
 * Provides layer configuration to the rest of the application.
 */
@Injectable()
export class ConfigService {
  private layers?: LayerConfig[];

  /** Return all configured layers (enabled and disabled). */
  getLayers(): LayerConfig[] {
    this.layers ??= this.loadLayers();
    return this.layers;
  }

  /** Return only layers that are actively enabled for polling. */
  getEnabledLayers(): LayerConfig[] {
    return this.getLayers().filter((layer) => layer.enabled);
  }

  /** Find a layer by its unique id, or undefined if not found. */
  getLayerById(id: string): LayerConfig | undefined {
    return this.getLayers().find((layer) => layer.id === id);
  }

  getRedisConfig(): RedisConfig {
    return {
      host: this.getEnv('REDIS_HOST') ?? DEFAULT_REDIS_HOST,
      port: this.parseOptionalPositiveInteger('REDIS_PORT', DEFAULT_REDIS_PORT),
      retryDelayMs: this.parseOptionalPositiveInteger(
        'REDIS_RETRY_DELAY_MS',
        DEFAULT_REDIS_RETRY_DELAY_MS,
      ),
      maxRetryDelayMs: this.parseOptionalPositiveInteger(
        'REDIS_MAX_RETRY_DELAY_MS',
        DEFAULT_REDIS_MAX_RETRY_DELAY_MS,
      ),
      maxRetriesPerRequest: this.parseOptionalNonNegativeInteger(
        'REDIS_MAX_RETRIES_PER_REQUEST',
        DEFAULT_REDIS_MAX_RETRIES_PER_REQUEST,
      ),
    };
  }

  getPort(): number {
    return this.parseOptionalPositiveInteger('PORT', DEFAULT_PORT);
  }

  getLogLevels(): LogLevel[] {
    const rawLogLevels = this.getEnv('LOG_LEVELS');

    if (!rawLogLevels) {
      return DEFAULT_LOG_LEVELS;
    }

    const logLevels = rawLogLevels
      .split(',')
      .map((level) => level.trim())
      .filter((level) => level.length > 0);

    for (const level of logLevels) {
      if (!LOG_LEVELS.includes(level as LogLevel)) {
        throw new Error(
          `Invalid LOG_LEVELS value "${level}". Expected one of: ${LOG_LEVELS.join(', ')}.`,
        );
      }
    }

    return logLevels as LogLevel[];
  }

  getRoadsLayerFetcherConfig(): LayerFetcherConfig {
    return this.getRestLayerFetcherConfig('ROADS', '/mock/roads');
  }

  getVehiclesLayerFetcherConfig(): LayerFetcherConfig {
    return this.getRestLayerFetcherConfig('VEHICLES', '/mock/vehicles');
  }

  getWeatherLayerFetcherConfig(): WeatherLayerFetcherConfig {
    return {
      url:
        this.getEnv('LAYER_WEATHER_URL') ??
        `${this.getMockApiBaseUrl()}/graphql`,
      apiKey: this.getEnv('LAYER_WEATHER_API_KEY'),
      stable: this.getEnv('LAYER_WEATHER_STABLE') === 'true',
    };
  }

  private loadLayers(): LayerConfig[] {
    const layersJson = this.getEnv('LAYERS');

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
    const retryCount = rawLayer['retryCount'];
    const retryIntervalMs = rawLayer['retryIntervalMs'];

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

    if (
      retryCount !== undefined &&
      (typeof retryCount !== 'number' ||
        !Number.isInteger(retryCount) ||
        retryCount < 0)
    ) {
      throw new Error(
        `Invalid LAYERS[${index}].retryCount: expected a non-negative integer when provided.`,
      );
    }

    if (
      retryIntervalMs !== undefined &&
      (typeof retryIntervalMs !== 'number' ||
        !Number.isFinite(retryIntervalMs) ||
        retryIntervalMs < 0)
    ) {
      throw new Error(
        `Invalid LAYERS[${index}].retryIntervalMs: expected a non-negative number when provided.`,
      );
    }

    const parsedRetryCount =
      retryCount === undefined ? DEFAULT_RETRY_COUNT : retryCount;
    const parsedRetryIntervalMs =
      retryIntervalMs === undefined
        ? DEFAULT_RETRY_INTERVAL_MS
        : retryIntervalMs;

    return {
      id,
      intervalMs,
      enabled: enabled ?? true,
      changeDetection: changeDetection ?? true,
      retryCount: parsedRetryCount,
      retryIntervalMs: parsedRetryIntervalMs,
    };
  }

  private getDefaultLayers(): LayerConfig[] {
    return [
      {
        id: 'roads',
        intervalMs: 10000,
        enabled: true,
        changeDetection: true,
        retryCount: DEFAULT_RETRY_COUNT,
        retryIntervalMs: DEFAULT_RETRY_INTERVAL_MS,
      },
      {
        id: 'weather',
        intervalMs: 50000,
        enabled: true,
        changeDetection: true,
        retryCount: DEFAULT_RETRY_COUNT,
        retryIntervalMs: DEFAULT_RETRY_INTERVAL_MS,
      },
      {
        id: 'vehicles',
        intervalMs: 10000,
        enabled: true,
        changeDetection: true,
        retryCount: DEFAULT_RETRY_COUNT,
        retryIntervalMs: DEFAULT_RETRY_INTERVAL_MS,
      },
    ];
  }

  private getRestLayerFetcherConfig(
    layerName: 'ROADS' | 'VEHICLES',
    defaultPath: string,
  ): LayerFetcherConfig {
    return {
      url:
        this.getEnv(`LAYER_${layerName}_URL`) ??
        `${this.getMockApiBaseUrl()}${defaultPath}`,
      apiKey: this.getEnv(`LAYER_${layerName}_API_KEY`),
    };
  }

  private getMockApiBaseUrl(): string {
    return this.getEnv('MOCK_API_BASE_URL') ?? DEFAULT_MOCK_API_BASE_URL;
  }

  private parseOptionalPositiveInteger(name: string, defaultValue: number) {
    const rawValue = this.getEnv(name);

    if (rawValue === undefined) {
      return defaultValue;
    }

    const parsedValue = Number.parseInt(rawValue, 10);

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue <= 0 ||
      parsedValue.toString() !== rawValue
    ) {
      throw new Error(
        `Invalid ${name} environment variable: expected a positive integer.`,
      );
    }

    return parsedValue;
  }

  private parseOptionalNonNegativeInteger(name: string, defaultValue: number) {
    const rawValue = this.getEnv(name);

    if (rawValue === undefined) {
      return defaultValue;
    }

    const parsedValue = Number.parseInt(rawValue, 10);

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue < 0 ||
      parsedValue.toString() !== rawValue
    ) {
      throw new Error(
        `Invalid ${name} environment variable: expected a non-negative integer.`,
      );
    }

    return parsedValue;
  }

  private getEnv(name: string): string | undefined {
    return process.env[name];
  }
}
