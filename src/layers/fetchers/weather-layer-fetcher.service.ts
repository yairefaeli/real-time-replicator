import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { ConfigService } from '../config/config.service.js';
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
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly stable: boolean;

  constructor(configService: ConfigService) {
    const config = configService.getWeatherLayerFetcherConfig();
    this.url = config.url;
    this.apiKey = config.apiKey;
    this.stable = config.stable;
  }

  async fetchLayerData(): Promise<unknown> {
    try {
      const response = await axios.post<WeatherGraphqlResponse>(
        this.url,
        {
          query: WEATHER_QUERY,
          variables: {
            stable: this.stable,
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
