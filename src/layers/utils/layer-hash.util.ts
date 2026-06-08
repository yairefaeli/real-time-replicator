import { createHash } from 'crypto';

/**
 * Compute a stable SHA-256 hash of arbitrary data.
 * Used to detect whether a layer's payload has changed between polls.
 *
 * Note: JSON.stringify produces deterministic output for the same object
 * structure, which is sufficient for change detection. If key ordering
 * becomes an issue with upstream APIs, consider a canonical JSON library.
 */
export function computeLayerHash(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
