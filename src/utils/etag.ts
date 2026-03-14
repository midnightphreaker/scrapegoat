import { xxh64 } from "@node-rs/xxhash";

const ETAG_HASH_SEED = BigInt(0);
const ETAG_PREFIX = "xxh64";

export function generateETag(data: unknown): string {
  if (data === undefined) {
    const hash = xxh64("undefined", ETAG_HASH_SEED);
    return `"${ETAG_PREFIX}:${hash}"`;
  }

  if (data === null) {
    const hash = xxh64("null", ETAG_HASH_SEED);
    return `"${ETAG_PREFIX}:${hash}"`;
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    const serialized = JSON.stringify(data);
    const hash = xxh64(serialized, ETAG_HASH_SEED);
    return `"${ETAG_PREFIX}:${hash}"`;
  }

  const obj = data as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const serialized = JSON.stringify(data, sortedKeys);
  const hash = xxh64(serialized, ETAG_HASH_SEED);
  return `"${ETAG_PREFIX}:${hash}"`;
}
