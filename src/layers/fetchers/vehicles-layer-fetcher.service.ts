import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { ConfigService } from '../config/config.service.js';
import { LayerDataFetcher } from './layer-data-fetcher.interface.js';

const DEFAULT_TIMEOUT_MS = 10_000;

@Injectable()
export class VehiclesLayerFetcherService implements LayerDataFetcher {
  readonly layerId = 'vehicles';

  private readonly logger = new Logger(VehiclesLayerFetcherService.name);
  private readonly url: string;
  private readonly apiKey?: string;

  constructor(configService: ConfigService) {
    const config = configService.getVehiclesLayerFetcherConfig();
    this.url = config.url;
    this.apiKey = config.apiKey;
  }

  async fetchLayerData(): Promise<unknown> {
    try {
      const response = await axios.get(this.url, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        timeout: DEFAULT_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 'N/A';
        const message = `Failed to fetch "${this.layerId}" layer data from ${this.url} - HTTP ${status}: ${error.message}`;
        this.logger.error(message);
        throw new Error(message);
      }

      throw error;
    }
  }
}
