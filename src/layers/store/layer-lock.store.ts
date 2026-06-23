import { Injectable } from '@nestjs/common';
import { RedisClientService } from './redis-client.service.js';

@Injectable()
export class LayerLockStore {
  constructor(private readonly redis: RedisClientService) {}

  /**
   * Attempt to acquire or renew a distributed lock for a layer.
   *
   * Acquires the lock when it is empty, or renews the lock when this
   * instance already owns it. Other instances are blocked until the
   * current owner's lock expires.
   */
  async tryAcquireOrRenewLayerLock(
    layerId: string,
    instanceId: string,
    ttlMs: number,
  ): Promise<boolean> {
    const result = await this.redis.command.eval(
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
}
