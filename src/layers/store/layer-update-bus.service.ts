import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { LayerUpdateMessage } from '../types/layer.types.js';
import { RedisClientService } from './redis-client.service.js';

@Injectable()
export class LayerUpdateBus implements OnModuleDestroy {
  private readonly logger = new Logger(LayerUpdateBus.name);
  private isSubscribed = false;
  private isSubscriptionPending = false;
  private subscriptionRetryTimer: NodeJS.Timeout | undefined;
  private isShuttingDown = false;

  constructor(private readonly redis: RedisClientService) {}

  async publishLayerUpdate(
    layerId: string,
    message: LayerUpdateMessage,
  ): Promise<void> {
    await this.redis.command.publish(
      `layer:${layerId}:updates`,
      JSON.stringify(message),
    );
  }

  /**
   * Subscribe to update channels for the given layer IDs.
   *
   * The first SUBSCRIBE can fail while Redis is down. That failure is retried
   * in the background so Nest startup can complete and readiness can report the
   * Redis outage instead of crashing the process.
   */
  subscribeToLayerUpdates(
    layerIds: string[],
    handler: (message: LayerUpdateMessage) => void,
  ): void {
    if (layerIds.length === 0) return;

    if (this.isSubscribed || this.isSubscriptionPending) {
      this.logger.warn(
        'subscribeToLayerUpdates called multiple times; ignoring duplicate call.',
      );
      return;
    }
    this.isSubscriptionPending = true;

    const channels = layerIds.map((id) => `layer:${id}:updates`);

    this.redis.subscriber.on('message', (_channel: string, raw: string) => {
      try {
        const parsed = JSON.parse(raw) as LayerUpdateMessage;
        handler(parsed);
      } catch (err) {
        this.logger.error(
          `Failed to parse layer update message: ${(err as Error).message}`,
        );
      }
    });

    this.subscribeWithRetry(channels);
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.subscriptionRetryTimer) {
      clearTimeout(this.subscriptionRetryTimer);
    }

    if (this.isSubscribed) {
      try {
        await this.redis.subscriber.unsubscribe();
      } catch {
        // Already disconnected or in error state; safe to ignore.
      }
    }
  }

  private subscribeWithRetry(channels: string[]): void {
    void this.trySubscribe(channels);
  }

  private async trySubscribe(channels: string[]): Promise<void> {
    try {
      await this.redis.subscriber.subscribe(...channels);
      if (this.isShuttingDown) return;
      this.isSubscribed = true;
      this.isSubscriptionPending = false;
      this.logger.log(`Subscribed to Redis channels: ${channels.join(', ')}`);
    } catch (error) {
      if (this.isShuttingDown) return;
      this.logger.error(
        `Failed to subscribe to Redis channels; retrying in ${this.redis.subscriptionRetryDelayMs}ms: ${(error as Error).message}`,
      );
      this.subscriptionRetryTimer = setTimeout(
        () => this.subscribeWithRetry(channels),
        this.redis.subscriptionRetryDelayMs,
      );
      this.subscriptionRetryTimer.unref();
    }
  }
}
