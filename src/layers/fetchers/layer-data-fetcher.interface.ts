/**
 * Contract implemented by each layer-specific API client.
 *
 * Keep API URLs, credentials, request params, and response handling inside the
 * concrete fetcher. The poller only needs to know which layer it belongs to.
 */
export interface LayerDataFetcher {
  /** The layer id this fetcher serves, matching LayerConfig.id. */
  readonly layerId: string;

  /** Fetch the raw payload for this layer from its upstream API. */
  fetchLayerData(): Promise<unknown>;
}

export const LAYER_DATA_FETCHERS = Symbol('LAYER_DATA_FETCHERS');
