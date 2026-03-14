import { xxh64 } from "@node-rs/xxhash";

/**
 * Generate a stable ETag hash from any JSON-serializable data.
 * Uses sorted keys to ensure consistent hashing regardless of property order.
 * Returns quoted string per HTTP ETag specification.
 */
export function generateETag(data: unknown): string {
  const obj = data as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const serialized = JSON.stringify(data, sortedKeys);
  const hash = xxh64(serialized, BigInt(0));
  return `"xxh64:${hash}"`;
}
