import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { LayerSnapshot, LayerUpdateMessage } from './layer.types.js';

/**
 * Redis-backed store for layer data.
 *
 * Manages two ioredis connections:
 *   1. `redis`    — general commands (GET, SET, PUBLISH)
 *   2. `redisSub` — dedicated Pub/Sub subscriber (Redis requires a
 *                    separate connection once SUBSCRIBE is called)
 *
 * Redis key schema:
 *   layer:{layerId}:latest   — JSON-serialised LayerSnapshot
 *   layer:{layerId}:hash     — SHA-256 content hash
 *   layer:{layerId}:lock     — distributed lock owner id
 *
 * Redis Pub/Sub channel:
 *   layer:{layerId}:updates  — LayerUpdateMessage JSON
 */
@Injectable()
export class LayerStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(LayerStoreService.name);
  private readonly redis: Redis;
  private readonly redisSub: Redis;
  private isSubscribed = false;

  constructor() {
    const host = process.env['REDIS_HOST'] ?? '127.0.0.1';
    const port = parseInt(process.env['REDIS_PORT'] ?? '6379', 10);

    this.redis = new Redis({ host, port, lazyConnect: false });
    this.redisSub = new Redis({ host, port, lazyConnect: false });

    this.redis.on('error', (err) =>
      this.logger.error(`Redis command client error: ${err.message}`),
    );
    this.redisSub.on('error', (err) =>
      this.logger.error(`Redis subscriber client error: ${err.message}`),
    );
  }

  // ---------------------------------------------------------------------------
  // Latest snapshot
  // ---------------------------------------------------------------------------

  async getLatest(layerId: string): Promise<LayerSnapshot | null> {
    const raw = await this.redis.get(`layer:${layerId}:latest`);
    if (!raw) return null;
    return JSON.parse(raw) as LayerSnapshot;
  }

  async setLatest(layerId: string, snapshot: LayerSnapshot): Promise<void> {
    await this.redis.set(`layer:${layerId}:latest`, JSON.stringify(snapshot));
  }

  // ---------------------------------------------------------------------------
  // Content hash
  // ---------------------------------------------------------------------------

  async getHash(layerId: string): Promise<string | null> {
    return this.redis.get(`layer:${layerId}:hash`);
  }

  async setHash(layerId: string, hash: string): Promise<void> {
    await this.redis.set(`layer:${layerId}:hash`, hash);
  }

  // ---------------------------------------------------------------------------
  // Distributed lock
  // ---------------------------------------------------------------------------

  /**
   * Attempt to acquire or renew a distributed lock for a layer.
   *
   * Acquires the lock when it is empty, or renews the lock when this
   * instance already owns it. Other instances are blocked until the
   * current owner's lock expires.
   *
   * @returns `true` if the lock was acquired or renewed, `false` otherwise.
   */
  async tryAcquireOrRenewLayerLock(
    layerId: string,
    instanceId: string,
    ttlMs: number,
  ): Promise<boolean> {
    const result = await this.redis.eval(
      `
        local currentOwner = redis.call("GET", KEYS[1])

        if not currentOwner or currentOwner == ARGV[1] then
          redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
          return 1
        end

        return 0
      `,
      1,
      `layer:${layerId}:lock`,
      instanceId,
      ttlMs,
    );

    return result === 1;
  }

  // ---------------------------------------------------------------------------
  // Pub/Sub — publish
  // ---------------------------------------------------------------------------

  async publishLayerUpdate(
    layerId: string,
    message: LayerUpdateMessage,
  ): Promise<void> {
    await this.redis.publish(
      `layer:${layerId}:updates`,
      JSON.stringify(message),
    );
  }

  // ---------------------------------------------------------------------------
  // Pub/Sub — subscribe
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to update channels for the given layer IDs.
   *
   * Guarded against duplicate calls — if already subscribed, this is a no-op.
   * The `message` listener is registered exactly once to prevent handler
   * accumulation.
   *
   * @param layerIds - Layers to listen to.
   * @param handler  - Callback invoked with each parsed update message.
   */
  async subscribeToLayerUpdates(
    layerIds: string[],
    handler: (message: LayerUpdateMessage) => void,
  ): Promise<void> {
    if (layerIds.length === 0) return;

    if (this.isSubscribed) {
      this.logger.warn(
        'subscribeToLayerUpdates called multiple times — ignoring duplicate call.',
      );
      return;
    }
    this.isSubscribed = true;

    const channels = layerIds.map((id) => `layer:${id}:updates`);

    this.redisSub.on('message', (_channel: string, raw: string) => {
      try {
        const parsed = JSON.parse(raw) as LayerUpdateMessage;
        handler(parsed);
      } catch (err) {
        this.logger.error(
          `Failed to parse layer update message: ${(err as Error).message}`,
        );
      }
    });

    await this.redisSub.subscribe(...channels);
    this.logger.log(`Subscribed to Redis channels: ${channels.join(', ')}`);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Redis clients…');

    // Explicitly unsubscribe before quitting the subscriber client
    // to ensure a clean protocol-level teardown.
    if (this.isSubscribed) {
      try {
        await this.redisSub.unsubscribe();
      } catch {
        // Already disconnected or in error state — safe to ignore.
      }
    }

    await this.redisSub.quit();
    await this.redis.quit();
  }
}
