import { Injectable } from '@nestjs/common';
import { LayerSnapshot } from '../types/layer.types.js';
import { RedisClientService } from './redis-client.service.js';

@Injectable()
export class LayerSnapshotStore {
  constructor(private readonly redis: RedisClientService) {}

  async getLatest(layerId: string): Promise<LayerSnapshot | null> {
    const raw = await this.redis.command.get(`layer:${layerId}:latest`);
    if (!raw) return null;
    return JSON.parse(raw) as LayerSnapshot;
  }

  async setLatest(layerId: string, snapshot: LayerSnapshot): Promise<void> {
    await this.redis.command.set(
      `layer:${layerId}:latest`,
      JSON.stringify(snapshot),
    );
  }

  async getHash(layerId: string): Promise<string | null> {
    return this.redis.command.get(`layer:${layerId}:hash`);
  }

  async setHash(layerId: string, hash: string): Promise<void> {
    await this.redis.command.set(`layer:${layerId}:hash`, hash);
  }
}
