import { Inject, Injectable } from '@nestjs/common';
import {
  LAYER_DATA_FETCHERS,
  LayerDataFetcher,
} from './layer-data-fetcher.interface.js';

@Injectable()
export class LayerDataFetcherRegistry {
  private readonly fetchersByLayerId: Map<string, LayerDataFetcher>;

  constructor(
    @Inject(LAYER_DATA_FETCHERS)
    fetchers: LayerDataFetcher[],
  ) {
    this.fetchersByLayerId = new Map();

    for (const fetcher of fetchers) {
      if (this.fetchersByLayerId.has(fetcher.layerId)) {
        throw new Error(
          `Multiple layer data fetchers registered for "${fetcher.layerId}".`,
        );
      }

      this.fetchersByLayerId.set(fetcher.layerId, fetcher);
    }
  }

  getFetcher(layerId: string): LayerDataFetcher {
    const fetcher = this.fetchersByLayerId.get(layerId);
    if (!fetcher) {
      throw new Error(`No layer data fetcher registered for "${layerId}".`);
    }

    return fetcher;
  }
}
