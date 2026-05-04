import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * HTTP client for fetching raw data from external layer API endpoints.
 *
 * Uses axios directly (not Nest HttpModule) to keep the dependency
 * footprint small and avoid extra module registration boilerplate.
 */
@Injectable()
export class ExternalLayerClientService {
  private readonly logger = new Logger(ExternalLayerClientService.name);

  /**
   * Fetch data from the given URL.
   *
   * @param url - The external API endpoint to GET.
   * @returns The raw response data (parsed JSON body).
   * @throws Error with a descriptive message including URL and status on failure.
   */
  async fetchLayerData(url: string): Promise<unknown> {
    try {
      const response = await axios.get(url, {
        timeout: DEFAULT_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status ?? 'N/A';
        const message = `Failed to fetch layer data from ${url} — HTTP ${status}: ${error.message}`;
        this.logger.error(message);
        throw new Error(message);
      }
      throw error;
    }
  }
}
