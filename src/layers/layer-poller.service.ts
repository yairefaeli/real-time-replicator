import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EMPTY, Subject, Subscription, from, timer } from 'rxjs';
import { catchError, exhaustMap, takeUntil } from 'rxjs/operators';
import { computeLayerHash } from './utils/layer-hash.util.js';
import { ConfigService } from './config/config.service.js';
import { LayerDataFetcher } from './fetchers/layer-data-fetcher.interface.js';
import { LayerDataFetcherRegistry } from './fetchers/layer-data-fetcher.registry.js';
import { LayerLockStore } from './store/layer-lock.store.js';
import { LayerSnapshotStore } from './store/layer-snapshot.store.js';
import { LayerUpdateBus } from './store/layer-update-bus.service.js';
import {
  LayerConfig,
  LayerSnapshot,
  LayerUpdateMessage,
} from './types/layer.types.js';

/**
 * Placeholder normalisation function.
 *
 * TODO: Replace with per-layer normalisation strategies when the
 *       upstream API contracts are finalised.
 */
function normalizeLayer(data: unknown): unknown {
  return data;
}

function getLayerSizeMb(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf8') / 1024 / 1024;
}

function getEntityCount(data: unknown): number | null {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === 'object') {
    const features = (data as Record<string, unknown>)['features'];
    if (Array.isArray(features)) {
      return features.length;
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Creates and manages one independent RxJS polling stream per enabled layer.
 *
 * Each stream:
 *   1. Fires on `timer(0, intervalMs)`.
 *   2. Acquires a distributed Redis lock — if another pod holds it, the
 *      tick is skipped (single-writer guarantee).
 *   3. Fetches data through the layer-specific fetcher service.
 *   4. Normalises the response.
 *   5. If change detection is enabled, hashes and skips unchanged payloads.
 *   6. Saves snapshot to Redis and publishes via Pub/Sub.
 *
 * Design choices:
 *   - `exhaustMap` prevents overlapping fetches within a single layer.
 *   - Independent streams mean a slow layer never blocks other layers.
 *   - `catchError` inside the projection keeps the outer timer alive.
 *   - `takeUntil(destroy$)` enables graceful shutdown.
 */
@Injectable()
export class LayerPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LayerPollerService.name);
  private readonly destroy$ = new Subject<void>();
  private readonly subscriptions: Subscription[] = [];
  private readonly instanceId = randomUUID();

  constructor(
    private readonly configService: ConfigService,
    private readonly layerDataFetchers: LayerDataFetcherRegistry,
    private readonly locks: LayerLockStore,
    private readonly snapshots: LayerSnapshotStore,
    private readonly updates: LayerUpdateBus,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onModuleInit(): void {
    this.logger.log(`Poller instance ID: ${this.instanceId}`);

    const enabledLayers = this.configService.getEnabledLayers();

    if (enabledLayers.length === 0) {
      this.logger.warn('No enabled layers configured — nothing to poll.');
      return;
    }

    const layerFetchers = enabledLayers.map((layer) => ({
      layer,
      fetcher: this.layerDataFetchers.getFetcher(layer.id),
    }));

    for (const { layer, fetcher } of layerFetchers) {
      this.startLayerPolling(layer, fetcher);
    }

    this.logger.log(
      `Started polling for ${enabledLayers.length} layer(s): ${enabledLayers.map((layer) => layer.id).join(', ')}`,
    );
  }

  onModuleDestroy(): void {
    this.logger.log('Shutting down layer pollers…');
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  // ---------------------------------------------------------------------------
  // Polling stream
  // ---------------------------------------------------------------------------

  private startLayerPolling(
    layer: LayerConfig,
    fetcher: LayerDataFetcher,
  ): void {
    const lockTtlMs =
      layer.intervalMs * 2 + layer.retryCount * layer.retryIntervalMs;

    const sub = timer(0, layer.intervalMs)
      .pipe(
        exhaustMap(() =>
          from(this.pollLayer(layer, fetcher, lockTtlMs)).pipe(
            catchError((err) => {
              // Safety net: if pollLayer throws past its own try/catch
              // (e.g. a synchronous error before the try block), the
              // outer timer stream must survive.
              this.logger.error(
                `Unhandled error in poll stream for "${layer.id}": ${(err as Error).message}`,
              );
              return EMPTY;
            }),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.subscriptions.push(sub);
  }

  /**
   * Execute a single poll cycle for a layer.
   *
   * Errors are caught here so that routine failures (network timeouts,
   * Redis blips) are logged but do not propagate to the RxJS stream.
   * An additional `catchError` in the pipe acts as a safety net for
   * anything this try/catch doesn't cover.
   */
  private async pollLayer(
    layer: LayerConfig,
    fetcher: LayerDataFetcher,
    lockTtlMs: number,
  ): Promise<void> {
    try {
      // 1. Acquire or renew distributed lock
      const acquired = await this.locks.tryAcquireOrRenewLayerLock(
        layer.id,
        this.instanceId,
        lockTtlMs,
      );
      if (!acquired) {
        this.logger.debug(
          `Layer "${layer.id}" lock not acquired — another pod is handling this layer.`,
        );
        return; // Another pod is handling this layer
      }
      // 2. Fetch external data
      const rawData = await this.fetchLayerDataWithRetry(layer, fetcher);

      // 3. Normalise
      const normalized = normalizeLayer(rawData);
      const layerSizeMb = getLayerSizeMb(normalized);
      const entityCount = getEntityCount(normalized);

      this.logger.log(
        `Layer "${layer.id}" payload size: ${layerSizeMb.toFixed(3)} MB; entities: ${entityCount ?? 'unknown'}.`,
      );

      let newHash: string | undefined;

      // 4. Compute hash and compare when change detection is enabled
      if (layer.changeDetection) {
        newHash = computeLayerHash(normalized);
        const existingHash = await this.snapshots.getHash(layer.id);

        if (newHash === existingHash) {
          this.logger.debug?.(
            `Layer "${layer.id}" unchanged — skipping publish.`,
          );
          return;
        }
      }

      // 5. Build snapshot
      const now = new Date().toISOString();
      const snapshot: LayerSnapshot = {
        layerId: layer.id,
        data: normalized,
        timestamp: now,
      };

      // 6. Persist to Redis
      await this.snapshots.setLatest(layer.id, snapshot);
      if (newHash) {
        await this.snapshots.setHash(layer.id, newHash);
      }

      // 7. Publish update
      const message: LayerUpdateMessage = {
        layerId: layer.id,
        data: normalized,
        timestamp: now,
      };
      await this.updates.publishLayerUpdate(layer.id, message);

      this.logger.log(`Layer "${layer.id}" updated and published.`);
    } catch (error) {
      this.logger.error(
        `Error polling layer "${layer.id}": ${getErrorMessage(error)}`,
      );
      // Error is caught here — the outer timer stream stays alive.
    }
  }

  private async fetchLayerDataWithRetry(
    layer: LayerConfig,
    fetcher: LayerDataFetcher,
  ): Promise<unknown> {
    const maxAttempts = layer.retryCount + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetcher.fetchLayerData();
      } catch (error) {
        this.logger.error(
          `Failed to fetch layer "${layer.id}" on attempt ${attempt}/${maxAttempts}: ${getErrorMessage(error)}`,
        );

        if (attempt === maxAttempts) {
          throw error;
        }

        await sleep(layer.retryIntervalMs);
      }
    }

    throw new Error(`Failed to fetch layer "${layer.id}".`);
  }
}
