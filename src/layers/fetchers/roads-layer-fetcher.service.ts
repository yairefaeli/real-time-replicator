import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { LayerDataFetcher } from './layer-data-fetcher.interface.js';

const DEFAULT_TIMEOUT_MS = 10_000;

@Injectable()
export class RoadsLayerFetcherService implements LayerDataFetcher {
  readonly layerId = 'roads';

  private readonly logger = new Logger(RoadsLayerFetcherService.name);
  private readonly mockApiBaseUrl =
    process.env['MOCK_API_BASE_URL'] ?? 'http://localhost:4001';
  private readonly url =
    process.env['LAYER_ROADS_URL'] ?? `${this.mockApiBaseUrl}/mock/roads`;
  private readonly apiKey = process.env['LAYER_ROADS_API_KEY'];

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
