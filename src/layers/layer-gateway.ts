import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from './config/config.service.js';
import { StoreService } from './store/store.service.js';
import { LayerUpdateMessage } from './types/layer.types.js';

/**
 * WebSocket gateway for real-time layer updates.
 *
 * Clients join/leave per-layer rooms and receive:
 *   - `layer.snapshot`  — latest cached data on subscribe
 *   - `layer.updated`   — new data whenever a layer changes
 *   - `layer.error`     — validation or server-side errors
 *
 * The gateway contains **only** WebSocket handling logic — all data
 * operations are delegated to the LayerStoreService.
 *
 * Updates arrive via Redis Pub/Sub so every pod (not just the one that
 * polled) can broadcast to its connected clients.
 */
@WebSocketGateway({
  cors: { origin: '*' },
})
export class LayerGateway implements OnModuleInit {
  private readonly logger = new Logger(LayerGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly store: StoreService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    const enabledLayers = this.configService.getEnabledLayers();
    const layerIds = enabledLayers.map((l) => l.id);

    if (layerIds.length === 0) {
      this.logger.warn(
        'No enabled layers — skipping Redis Pub/Sub subscription.',
      );
      return;
    }

    await this.store.subscribeToLayerUpdates(
      layerIds,
      (message: LayerUpdateMessage) => this.onLayerUpdate(message),
    );

    this.logger.log(
      `Gateway listening for updates on ${layerIds.length} layer(s).`,
    );
  }

  // ---------------------------------------------------------------------------
  // Client events
  // ---------------------------------------------------------------------------

  @SubscribeMessage('layer.subscribe')
  async handleSubscribe(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // Validate payload shape
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('layerId' in payload) ||
      typeof (payload as Record<string, unknown>)['layerId'] !== 'string'
    ) {
      client.emit('layer.error', {
        layerId: null,
        message: 'Invalid payload: expected { layerId: string }.',
      });
      return;
    }

    const { layerId } = payload as { layerId: string };

    // Validate that the layer exists
    const layer = this.configService.getLayerById(layerId);
    if (!layer) {
      client.emit('layer.error', {
        layerId,
        message: `Unknown layer: "${layerId}"`,
      });
      return;
    }

    // Join the room
    const room = `layer:${layerId}`;
    await client.join(room);
    this.logger.debug?.(`Client ${client.id} joined room ${room}`);

    // Send latest snapshot if available
    try {
      const snapshot = await this.store.getLatest(layerId);
      if (snapshot) {
        client.emit('layer.snapshot', snapshot);
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch latest snapshot for "${layerId}": ${(error as Error).message}`,
      );
      client.emit('layer.error', {
        layerId,
        message: 'Failed to retrieve latest snapshot.',
      });
    }
  }

  @SubscribeMessage('layer.unsubscribe')
  async handleUnsubscribe(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // Validate payload shape
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('layerId' in payload) ||
      typeof (payload as Record<string, unknown>)['layerId'] !== 'string'
    ) {
      client.emit('layer.error', {
        layerId: null,
        message: 'Invalid payload: expected { layerId: string }.',
      });
      return;
    }

    const { layerId } = payload as { layerId: string };
    const room = `layer:${layerId}`;
    await client.leave(room);
    this.logger.debug?.(`Client ${client.id} left room ${room}`);
  }

  // ---------------------------------------------------------------------------
  // Redis Pub/Sub handler
  // ---------------------------------------------------------------------------

  private onLayerUpdate(message: LayerUpdateMessage): void {
    const room = `layer:${message.layerId}`;
    this.server.to(room).emit('layer.updated', message);
    this.logger.debug?.(`Broadcast layer.updated to room ${room}`);
  }
}
