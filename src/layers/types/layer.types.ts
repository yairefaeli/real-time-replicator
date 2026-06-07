/**
 * Configuration for a single data layer.
 * Each layer defines an external API endpoint to poll at a given interval.
 */
export interface LayerConfig {
  /** Unique identifier for this layer (e.g. "roads", "weather"). */
  id: string;

  /** External API URL to poll for data. */
  url: string;

  /** Polling interval in milliseconds. */
  intervalMs: number;

  /** Whether this layer is actively polled. */
  enabled: boolean;

  /** Whether unchanged payloads should be skipped using hash comparison. */
  changeDetection: boolean;
}

/**
 * A point-in-time snapshot of a layer's data, stored in Redis
 * and sent to WebSocket clients on initial subscription.
 */
export interface LayerSnapshot {
  layerId: string;
  data: unknown;
  timestamp: string; // ISO 8601
}

/**
 * Message published over Redis Pub/Sub and broadcast
 * to WebSocket clients when a layer's data changes.
 */
export interface LayerUpdateMessage {
  layerId: string;
  data: unknown;
  timestamp: string; // ISO 8601
}
