import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { LayerDataFetcher } from './layer-data-fetcher.interface.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const WEATHER_QUERY = `
  query WeatherLayer($stable: Boolean) {
    weather(stable: $stable) {
      layerId
      version
      timestamp
      features {
        id
        condition
        temperatureC
        humidity
        windSpeedKmh
      }
    }
  }
`;

interface WeatherGraphqlResponse {
  data?: {
    weather?: unknown;
  };
  errors?: Array<{ message?: string }>;
}

@Injectable()
export class WeatherLayerFetcherService implements LayerDataFetcher {
  readonly layerId = 'weather';

  private readonly logger = new Logger(WeatherLayerFetcherService.name);
  private readonly mockApiBaseUrl =
    process.env['MOCK_API_BASE_URL'] ?? 'http://localhost:4001';
  private readonly url =
    process.env['LAYER_WEATHER_URL'] ?? `${this.mockApiBaseUrl}/graphql`;
  private readonly apiKey = process.env['LAYER_WEATHER_API_KEY'];

  async fetchLayerData(): Promise<unknown> {
    try {
      const response = await axios.post<WeatherGraphqlResponse>(
        this.url,
        {
          query: WEATHER_QUERY,
          variables: {
            stable: process.env['LAYER_WEATHER_STABLE'] === 'true',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          timeout: DEFAULT_TIMEOUT_MS,
        },
      );

      if (response.data.errors?.length) {
        const errorMessage = response.data.errors
          .map((error) => error.message ?? 'Unknown GraphQL error')
          .join('; ');
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data.data || !('weather' in response.data.data)) {
        throw new Error('GraphQL response did not include data.weather');
      }

      return response.data.data.weather;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 'N/A';
        const message = `Failed to fetch "${this.layerId}" layer data from ${this.url} - HTTP ${status}: ${error.message}`;
        this.logger.error(message);
        throw new Error(message);
      }

      if (error instanceof Error) {
        const message = `Failed to fetch "${this.layerId}" layer data from ${this.url}: ${error.message}`;
        this.logger.error(message);
        throw new Error(message);
      }

      throw error;
    }
  }
}
